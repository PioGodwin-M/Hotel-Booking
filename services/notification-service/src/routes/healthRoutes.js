
import express from "express";
import mongoose from "mongoose";

const router = express.Router();

router.get("/", (req, res) => {
  const databaseConnected =
    mongoose.connection.readyState === 1;

  const healthy = databaseConnected;

  return res.status(healthy ? 200 : 503).json({
    success: healthy,
    service: "notification-service",
    status: healthy ? "healthy" : "degraded",
    dependencies: {
      mongodb: databaseConnected
        ? "connected"
        : "disconnected",
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
