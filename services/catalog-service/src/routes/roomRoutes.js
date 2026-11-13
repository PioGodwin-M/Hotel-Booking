import express from "express";

import {
  createRoom,
  getHotelRooms,
  updateRoom,
  updateRoomStatus,
  getPublicRooms,
  getPublicRoomById,
} from "../controllers/roomController.js";

import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public customer discovery routes (no authentication required)
router.get("/", getPublicRooms);
router.get("/hotel/:hotelId", authenticate, getHotelRooms);
router.get("/:roomId", getPublicRoomById);

// Protected owner management routes
router.post("/", authenticate, createRoom);
router.put("/:roomId", authenticate, updateRoom);
router.patch("/:roomId/status", authenticate, updateRoomStatus);

export default router;
