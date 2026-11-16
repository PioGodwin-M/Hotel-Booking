import {
  markBookingPaymentPending,
} from "../services/paymentBookingService.js";
import {
  reconcileGhostPayments,
  listPaymentReconciliations,
  resolveReconciliationWithRefund,
} from "../services/bookingReconciliationService.js";
import { redriveDeadBookingOutboxEvents } from "../workers/bookingOutboxWorker.js";

export const markPaymentPendingController = async (
  req,
  res,
  next
) => {
  try {
    const booking = await markBookingPaymentPending({
      bookingId: req.params.bookingId,
      paymentId: req.body.paymentId,
      attemptNumber: req.body.attemptNumber,
      userId: req.body.userId,
      previousAttempt: req.body.previousAttempt,
    });

    return res.status(200).json({
      success: true,
      booking,
    });
  } catch (error) {
    const errorResponses = {
      VALIDATION_ERROR: [400, error.message],
      UNAUTHENTICATED: [401, "Authenticated service user required"],
      BOOKING_NOT_FOUND: [404, "Booking not found"],
      BOOKING_ALREADY_EXPIRED: [409, error.message],
      BOOKING_NOT_PAYABLE: [409, error.message],
      PAYMENT_ID_MISMATCH: [409, error.message],
      PREVIOUS_ATTEMPT_PROOF_REQUIRED: [400, error.message],
      PREVIOUS_PAYMENT_ID_MISMATCH: [409, error.message],
      PREVIOUS_ATTEMPT_NOT_TERMINAL: [409, error.message],
    };

    const mapped = errorResponses[error.code];

    if (mapped) {
      return res.status(mapped[0]).json({
        success: false,
        message: mapped[1],
      });
    }

    return next(error);
  }
};

export const listReconciliationsController = async (req, res, next) => {
  try {
    const { status, limit } = req.query || {};
    const records = await listPaymentReconciliations({
      status,
      limit: limit ? parseInt(limit, 10) : 50,
    });

    return res.status(200).json({
      success: true,
      data: records,
    });
  } catch (error) {
    return next(error);
  }
};

export const reconcileGhostBookingsController = async (req, res, next) => {
  try {
    const { maxAgeMs, batchSize } = req.body || {};
    const results = await reconcileGhostPayments({ maxAgeMs, batchSize });

    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    return next(error);
  }
};

export const redriveDeadBookingEventsController = async (req, res, next) => {
  try {
    const { eventIds, approvedBy, operatorId, role, reason, operatorKey } = req.body || {};
    const suppliedKey = req.get("x-operator-admin-key") || operatorKey;
    const finalOperatorId = operatorId || approvedBy;

    const results = await redriveDeadBookingOutboxEvents({
      eventIds,
      operatorIdentity: {
        operatorKey: suppliedKey,
        operatorId: finalOperatorId,
        role: role || "ADMIN",
      },
      reason,
    });

    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code || "OPERATOR_ERROR",
      });
    }
    return next(error);
  }
};

export const resolveReconciliationWithRefundController = async (req, res, next) => {
  try {
    const { reconciliationId } = req.params;
    const { operatorId, role, reason, operatorKey } = req.body || {};
    const suppliedKey = req.get("x-operator-admin-key") || operatorKey;

    const result = await resolveReconciliationWithRefund({
      reconciliationId,
      operatorIdentity: {
        operatorKey: suppliedKey,
        operatorId: operatorId || "verified_operator",
        role: role || "ADMIN",
      },
      reason,
    });

    return res.status(200).json({
      success: true,
      message: "Reconciliation refund resolved successfully",
      data: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code || "RECONCILIATION_ERROR",
      });
    }
    return next(error);
  }
};

