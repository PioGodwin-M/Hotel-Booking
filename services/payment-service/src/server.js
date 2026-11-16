
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";
import { clerkMiddleware } from "@clerk/express";

import connectDatabase from "./config/database.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import internalPaymentRoutes from "./routes/internalPaymentRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";

import {
  startOutboxWorker,
  stopOutboxWorker,
} from "./workers/outboxWorker.js";
import {
  startPaymentReconciliationWorker,
  stopPaymentReconciliationWorker,
} from "./workers/paymentReconciliationWorker.js";

const app = express();
const PORT = process.env.PORT || 4004;

let server = null;
let shuttingDown = false;

const getAllowedOrigins = () => {
  const configured = process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL;
  if (configured) {
    return configured.split(",").map((o) => o.trim()).filter(Boolean);
  }
  if (process.env.NODE_ENV !== "production") {
    return ["http://localhost:5173", "http://127.0.0.1:5173"];
  }
  return [];
};

const allowedOrigins = getAllowedOrigins();

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (
        process.env.NODE_ENV !== "production" &&
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    },
    credentials: true,
  })
);
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

// Internal service-to-service routes (authenticated via serviceAuthMiddleware)
app.use("/internal/payments", internalPaymentRoutes);

app.use(clerkMiddleware());
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

    // 2. Stop background publication and reconciliation workers.
    await stopPaymentReconciliationWorker();
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
    await startPaymentReconciliationWorker();
  } catch (error) {
    console.error("Payment Service startup failed:", error);

    try {
      await closeHttpServer();
      await stopPaymentReconciliationWorker();
      await stopOutboxWorker();
      await mongoose.disconnect();
    } catch (cleanupError) {
      console.error("Startup cleanup failed:", cleanupError);
    }

    process.exit(1);
  }
};

startServer();
