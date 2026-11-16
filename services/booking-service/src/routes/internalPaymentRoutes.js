import { Router } from "express";

import {
  markPaymentPendingController,
  listReconciliationsController,
  reconcileGhostBookingsController,
  redriveDeadBookingEventsController,
  resolveReconciliationWithRefundController,
} from "../controllers/paymentBookingController.js";

import {
  authenticatePaymentService,
} from "../middleware/paymentServiceAuth.js";

const router = Router();

// All internal routes require authenticated service key
router.use(authenticatePaymentService);

// 1. Payment attempt initiation
router.patch(
  "/:bookingId/payment-pending",
  markPaymentPendingController
);

// 2. Reconciliation review inquiries
router.get("/reconciliations", listReconciliationsController);

// 3. Ghost booking reconciliation trigger
router.post("/reconcile/ghost", reconcileGhostBookingsController);

// 4. Operator-audited DEAD outbox redrive
router.post("/outbox/redrive", redriveDeadBookingEventsController);

// 5. Operator-authorized reconciliation refund resolution
router.post(
  "/reconciliations/:reconciliationId/resolve-refund",
  resolveReconciliationWithRefundController
);

export default router;
