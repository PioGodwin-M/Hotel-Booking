
import "dotenv/config";

import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";

import connectDatabase from "./config/database.js";

import {
  connectRabbitMQ,
  closeRabbitMQ,
} from "./config/rabbitmq.js";

import {
  startBookingEventConsumer,
  closeBookingEventConsumer,
} from "./consumers/bookingEventConsumer.js";

import {
  startNotificationDeliveryWorker,
  stopNotificationDeliveryWorker,
} from "./workers/notificationDeliveryWorker.js";

import {
  verifyEmailTransport,
} from "./services/emailService.js";

import healthRoutes from "./routes/healthRoutes.js";
import errorMiddleware from "./middleware/errorMiddleware.js";

const app = express();

const PORT = process.env.PORT || 4005;

let server;
let shuttingDown = false;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/health", healthRoutes);

// Central error handler.
app.use(errorMiddleware);

const shutdown = async (signal = "SHUTDOWN") => {
  if (shuttingDown) return;

  shuttingDown = true;

  console.log(
    `${signal} received. Notification Service shutting down...`
  );

  try {
    // Stop accepting HTTP requests.
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }

    // Stop accepting new booking events.
    await closeBookingEventConsumer();

    // Finish any current email delivery.
    await stopNotificationDeliveryWorker();

    // Close RabbitMQ resources.
    await closeRabbitMQ();

    // Disconnect MongoDB last.
    await mongoose.disconnect();

    console.log("Notification Service shutdown complete");

    process.exit(0);
  } catch (error) {
    console.error(
      "Notification Service shutdown failed:",
      error
    );

    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

const startServer = async () => {
  try {
    // 1. Connect MongoDB.
    await connectDatabase();

    // 2. Establish RabbitMQ connection and topology.
    await connectRabbitMQ();

    // 3. Start the booking event consumer.
    await startBookingEventConsumer();

    // 4. Start asynchronous email delivery.
    startNotificationDeliveryWorker();

    // 5. Verify SMTP without preventing startup if SMTP is down.
    try {
      await verifyEmailTransport();
    } catch (error) {
      console.error(
        "SMTP verification failed. Email jobs will remain retryable:",
        error.message
      );
    }

    // 6. Start HTTP server.
    server = app.listen(PORT, () => {
      console.log(
        `Notification Service running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "Notification Service startup failed:",
      error
    );

    await closeBookingEventConsumer().catch(() => {});

    await stopNotificationDeliveryWorker().catch(() => {});

    await closeRabbitMQ().catch(() => {});

    await mongoose.disconnect().catch(() => {});

    process.exit(1);
  }
};

startServer();
