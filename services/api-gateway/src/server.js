
import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import proxyRoutes from "./routes/proxyRoutes.js";
import { validateServices } from "./config/services.js";

const app = express();

const PORT = process.env.PORT || 4000;

app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(morgan("dev"));

app.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    service: "api-gateway",
    status: "healthy",
  });
});

// Do not add express.json() before the proxy.
// Stripe requires its original raw request body.
app.use("/api", proxyRoutes);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

validateServices();

const server = app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});

const shutdown = (signal) => {
  console.log(`${signal} received. Shutting down API Gateway...`);

  server.close((error) => {
    if (error) {
      console.error("Gateway shutdown error:", error);
      process.exit(1);
    }

    console.log("API Gateway shut down successfully");
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
