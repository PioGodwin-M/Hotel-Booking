import express from "express";

import {
  createBookingController,
} from "../controllers/bookingController.js";

import {
  cancelBookingController,
} from "../controllers/cancellationController.js";

import {
  getUserBookingsController,
  getBookingByIdController,
} from "../controllers/bookingQueryController.js";

import {
  getOwnerDashboardController,
} from "../controllers/ownerDashboardController.js";

const router = express.Router();

// Create a booking hold.
router.post("/", createBookingController);

// Retrieve the authenticated customer's bookings.
router.get("/", getUserBookingsController);

// Retrieve owner's dashboard stats and bookings (MUST be registered before /:bookingId)
router.get("/owner", getOwnerDashboardController);

// Retrieve one booking owned by the authenticated customer.
router.get("/:bookingId", getBookingByIdController);

// Cancel a booking hold.
router.patch("/:bookingId/cancel", cancelBookingController);

export default router;