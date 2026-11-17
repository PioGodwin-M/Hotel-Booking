import express from "express";

import {
  registerHotel,
  getOwnerHotels,
  getPublicHotelById,
  updateHotel,
  deleteHotel,
} from "../controllers/hotelController.js";

import { updateHotelStatus } from "../controllers/hotelLifecycleController.js";

import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

// Register a hotel (owner)
router.post("/", authenticate, registerHotel);

// Retrieve hotels belonging to authenticated owner
router.get("/owner", authenticate, getOwnerHotels);

// Public canonical hotel detail
router.get("/:hotelId", getPublicHotelById);

// Update an owned hotel (owner)
router.put("/:hotelId", authenticate, updateHotel);

// Delete an owned hotel (owner)
router.delete("/:hotelId", authenticate, deleteHotel);

// Update hotel status (ACTIVE/INACTIVE) (owner)
router.patch("/:hotelId/status", authenticate, updateHotelStatus);

export default router;
