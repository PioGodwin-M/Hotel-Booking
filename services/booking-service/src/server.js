
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";
import { clerkMiddleware } from "@clerk/express";

import connectDatabase from "./config/database.js";

import {
  startRoomCategoryConsumer,
  closeRoomCategoryConsumer,
} from "./events/roomCategoryConsumer.js";

import {
  startPaymentResultConsumer,
  closePaymentResultConsumer,
} from "./events/paymentResultConsumer.js";

import bookingRoutes from "./routes/bookingRoutes.js";
import internalPaymentRoutes from "./routes/internalPaymentRoutes.js";

import {
  startHoldExpirationWorker,
  stopHoldExpirationWorker,
} from "./workers/holdExpirationWorker.js";

import {
  startBookingOutboxWorker,
  stopBookingOutboxWorker,
} from "./workers/bookingOutboxWorker.js";

const app = express();
const PORT = process.env.PORT || 4003;

let server;
let shuttingDown = false;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Health check.
app.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    service: "booking-service",
    status: "healthy",
  });
});

// Internal service-to-service payment initiation.
app.use("/internal/payments/bookings", internalPaymentRoutes);

// Customer-facing authenticated routes.
app.use(clerkMiddleware());
app.use("/api/bookings", bookingRoutes);

// Central error handler.
app.use((err, req, res, next) => {
  console.error("Booking Service error:", err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(err.status || 500).json({
    success: false,
    message: "Internal server error",
  });
});

// Graceful shutdown.
const shutdown = async (signal = "SHUTDOWN") => {
  if (shuttingDown) return;

  shuttingDown = true;

  console.log(`${signal} received. Booking Service shutting down...`);

  try {
    // 1. Stop accepting new HTTP requests.
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }

    // 2. Stop background workers.
    await stopHoldExpirationWorker();
    await stopBookingOutboxWorker();

    // 3. Close RabbitMQ consumers.
    await closePaymentResultConsumer();
    await closeRoomCategoryConsumer();

    // 4. Disconnect MongoDB last.
    await mongoose.disconnect();

    console.log("Booking Service shutdown complete");
    process.exit(0);
  } catch (error) {
    console.error("Booking Service shutdown error:", error);
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Server startup.
const startServer = async () => {
  try {
    // 1. Connect to MongoDB.
    await connectDatabase();

    console.log("Booking Service database connected");

    // 2. Start RabbitMQ consumers.
    await startRoomCategoryConsumer();
    await startPaymentResultConsumer();

    // 3. Start hold expiration worker.
    startHoldExpirationWorker();

    // 4. Start transactional outbox publisher.
    await startBookingOutboxWorker();

    // 5. Start HTTP server.
    server = app.listen(PORT, () => {
      console.log(`Booking Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Booking Service startup failed:", error);

    // Clean up any resources that were started successfully.
    await stopHoldExpirationWorker().catch((err) => {
      console.error("Hold expiration worker cleanup failed:", err);
    });

    await stopBookingOutboxWorker().catch((err) => {
      console.error("Booking outbox worker cleanup failed:", err);
    });

    await closePaymentResultConsumer().catch((err) => {
      console.error("Payment consumer cleanup failed:", err);
    });

    await closeRoomCategoryConsumer().catch((err) => {
      console.error("Room category consumer cleanup failed:", err);
    });

    await mongoose.disconnect().catch((err) => {
      console.error("MongoDB cleanup failed:", err);
    });

    process.exit(1);
  }
};

startServer();
