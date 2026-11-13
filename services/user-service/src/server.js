
import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";

import { clerkMiddleware } from "@clerk/express";

import connectDatabase from "./config/database.js";

import userRoutes from "./routes/userRoutes.js";
import internalUserRoutes from "./routes/internalUserRoutes.js";

import {
  handleClerkWebhook,
} from "./webhooks/clerkWebhook.js";

import errorMiddleware from "./middleware/errorMiddleware.js";

const app = express();

const PORT = process.env.PORT || 4001;

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));

// Public health endpoint.
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "user-service",
    status: "healthy",
  });
});

// Clerk webhook must receive raw body.
app.post(
  "/webhooks/clerk",
  express.raw({ type: "application/json" }),
  handleClerkWebhook
);

// Parse JSON for regular API requests.
app.use(express.json({ limit: "1mb" }));

// Clerk authentication context.
app.use(clerkMiddleware());

// Customer profile endpoints.
app.use("/api/users", userRoutes);

// Internal service endpoints.
app.use("/internal/users", internalUserRoutes);

// 404 handler.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Central error handler.
app.use(errorMiddleware);

let server;

const startServer = async () => {
  try {
    await connectDatabase();

    server = app.listen(PORT, () => {
      console.log(`User Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error("User Service startup failed:", error);
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  console.log(`${signal} received. Shutting down User Service...`);

  if (server) {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }

  await mongoose.disconnect();

  console.log("User Service shut down successfully");
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startServer();
