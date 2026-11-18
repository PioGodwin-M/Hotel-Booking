import { Router } from "express";
import {
  internalRefundPaymentController,
  internalGetPaymentStatusController,
  internalGetPaymentSummaryByBookingController,
  internalReconcileZombiePaymentsController,
  internalReconcileExternalRefundsController,
  internalRedriveDeadEventsController,
} from "../controllers/internalPaymentController.js";
import { authenticateInternalService } from "../middleware/serviceAuthMiddleware.js";

const router = Router();

// All internal routes require authenticated service key
router.use(authenticateInternalService);

// 1. Internal refund endpoint
router.post("/:paymentId/refund", internalRefundPaymentController);

// 2. Cross-service payment status inquiry
router.get("/:paymentId/status", internalGetPaymentStatusController);

// 3. Customer-facing payment summary by booking ID (Round 4g B5)
router.get("/booking/:bookingId/summary", internalGetPaymentSummaryByBookingController);

// 3. Reconciliation triggers
router.post("/reconcile/zombie", internalReconcileZombiePaymentsController);
router.post("/reconcile/refunds", internalReconcileExternalRefundsController);

// 4. Operator-audited DEAD outbox redrive
router.post("/outbox/redrive", internalRedriveDeadEventsController);

export default router;
