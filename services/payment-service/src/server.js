
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";

import connectDatabase from "./config/database.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";

import {
  startOutboxWorker,
  stopOutboxWorker,
} from "./workers/outboxWorker.js";

const app = express();
const PORT = process.env.PORT || 4004;

let server = null;
let shuttingDown = false;

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));

app.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    service: "payment-service",
    status: "healthy",
  });
});

// Stripe requires the unmodified raw request body.
app.use("/api/webhooks/stripe", webhookRoutes);

// JSON parsing for normal application routes.
app.use(express.json({ limit: "1mb" }));

app.use("/api/payments", paymentRoutes);

// Central error handler.
app.use((error, req, res, next) => {
  console.error("Payment Service Error:", error);

  if (res.headersSent) {
    return next(error);
  }

  const statusCode = error.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500
        ? "Internal server error"
        : error.message,
    code: error.code || "INTERNAL_SERVER_ERROR",
  });
});

const closeHttpServer = async () => {
  if (!server) return;

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

  server = null;
};

const shutdown = async (signal) => {
  if (shuttingDown) return;

  shuttingDown = true;

  console.log(
    `${signal} received. Shutting down Payment Service...`
  );

  try {
    // 1. Stop accepting requests and drain active HTTP requests.
    await closeHttpServer();

    // 2. Stop background publication and close RabbitMQ resources.
    await stopOutboxWorker();

    // 3. Disconnect MongoDB after application work has stopped.
    await mongoose.disconnect();

    console.log("Payment Service shut down successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Payment Service shutdown failed:", error);
    process.exit(1);
  }
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

const startServer = async () => {
  try {
    await connectDatabase();

    server = app.listen(PORT, () => {
      console.log(`Payment Service running on port ${PORT}`);
    });

    await startOutboxWorker();
  } catch (error) {
    console.error("Payment Service startup failed:", error);

    try {
      await closeHttpServer();
      await stopOutboxWorker();
      await mongoose.disconnect();
    } catch (cleanupError) {
      console.error("Startup cleanup failed:", cleanupError);
    }

    process.exit(1);
  }
};

startServer();
