import express from "express";

import {
  createBookingController,
} from "../controllers/bookingController.js";

import {
  cancelBookingController,
} from "../controllers/cancellationController.js";

const router = express.Router();

router.post("/", createBookingController);

router.patch(
  "/:bookingId/cancel",
  cancelBookingController
);

export default router;