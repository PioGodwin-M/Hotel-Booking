import express from "express";

import {
    registerHotel,
    getOwnerHotels,
    deleteHotel
} from "../controllers/hotelController.js";

import { updateHotelStatus } from "../controllers/hotelLifecycleController.js";

import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

// Register a hotel
router.post("/", authenticate, registerHotel);

// Retrieve hotels belonging to authenticated owner
router.get("/owner", authenticate, getOwnerHotels);

// Delete an owned hotel
router.delete("/:hotelId", authenticate, deleteHotel);

// Update hotel status (ACTIVE/INACTIVE)
router.patch("/:hotelId/status", authenticate, updateHotelStatus);

export default router;