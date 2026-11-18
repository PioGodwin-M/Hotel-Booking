
import express from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";

import connectDatabase from "./config/database.js";

import hotelRoutes from "./routes/hotelRoutes.js";
import roomRoutes from "./routes/roomRoutes.js";
import internalRoomRoutes from "./routes/internalRoomRoutes.js";
import internalHotelRoutes from "./routes/internalHotelRoutes.js";

import { clerkMiddleware } from "@clerk/express";
import {
  publishPendingEvents,
  closeRabbitMQ,
} from "./events/outboxPublisher.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4002;

// Prevent overlapping publishing cycles.
let publisherRunning = false;
let publisherInterval;

const runOutboxPublisher = async () => {
  if (publisherRunning) return;

  publisherRunning = true;

  try {
    await publishPendingEvents();
  } catch (error) {
    console.error("Outbox publisher error:", error.message);
  } finally {
    publisherRunning = false;
  }
};

// Health endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "catalog-service",
    status: "healthy",
  });
});

// Security headers
app.use(helmet());

// Request logging
app.use(morgan("dev"));

// Parse JSON requests
app.use(express.json());

// Clerk authentication
app.use(clerkMiddleware());

// Hotel routes
app.use("/api/hotels", hotelRoutes);

// Room routes
app.use("/api/rooms", roomRoutes);

// Internal room routes (for inter-service communication)
app.use("/internal/rooms", internalRoomRoutes);

// Internal hotel routes (for inter-service communication)
app.use("/internal/hotels", internalHotelRoutes);
app.use("/internal/properties", internalHotelRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error("Catalog Service error:", err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(err.status || 500).json({
    success: false,
    message: "Internal server error",
  });
});

// Graceful shutdown
const shutdown = async () => {
  console.log("Catalog Service shutting down...");

  clearInterval(publisherInterval);

  try {
    await closeRabbitMQ();
  } catch (error) {
    console.error("RabbitMQ shutdown error:", error.message);
  }

  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Start server
const startServer = async () => {
  try {
    await connectDatabase();

    app.listen(PORT, () => {
      console.log(`Catalog Service running on port ${PORT}`);
    });

    // Publish pending events every 5 seconds.
    publisherInterval = setInterval(
      runOutboxPublisher,
      5000
    );

    // Also run once immediately after startup.
    runOutboxPublisher();

  } catch (error) {
    console.error("Catalog Service startup failed:", error);
    process.exit(1);
  }
};

startServer();
