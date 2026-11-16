
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

const getAllowedOrigins = () => {
  const configured = process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL;
  if (configured) {
    return configured.split(",").map((o) => o.trim()).filter(Boolean);
  }
  // In development, default to local Vite dev server origins
  if (process.env.NODE_ENV !== "production") {
    return ["http://localhost:5173", "http://127.0.0.1:5173"];
  }
  return [];
};

const allowedOrigins = getAllowedOrigins();

const corsOptions = {
  origin: (origin, callback) => {
    // Permit requests with no origin (e.g. curl, server-to-server, mobile native)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // In development mode, dynamically permit localhost / 127.0.0.1 on any port
    if (
      process.env.NODE_ENV !== "production" &&
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    ) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Idempotency-Key",
    "x-payment-service-key",
    "x-internal-service-key",
  ],
  exposedHeaders: ["Content-Length", "X-Request-Id"],
  maxAge: 86400,
};

app.use(cors(corsOptions));

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
