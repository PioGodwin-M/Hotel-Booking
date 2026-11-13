import { Router } from "express";

import {
  markPaymentPendingController,
} from "../controllers/paymentBookingController.js";

import {
  authenticatePaymentService,
} from "../middleware/paymentServiceAuth.js";

const router = Router();

router.patch(
  "/bookings/:bookingId/payment-pending",
  authenticatePaymentService,
  markPaymentPendingController
);

export default router;