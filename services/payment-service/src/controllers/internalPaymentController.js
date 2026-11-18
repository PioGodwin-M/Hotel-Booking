import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import { processRefund } from "../services/refundService.js";
import {
  getInternalPaymentStatus,
  reconcileZombiePayments,
  reconcileExternalRefunds,
} from "../services/paymentReconciliationService.js";
import { redriveDeadOutboxEvents } from "../events/outboxPublisher.js";

/**
 * Controller for internal service-to-service refund initiation.
 */
export const internalRefundPaymentController = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const { bookingId, reason } = req.body || {};

    if (!paymentId || typeof paymentId !== "string") {
      return res.status(400).json({
        success: false,
        message: "A valid paymentId is required",
      });
    }

    if (
      !bookingId ||
      typeof bookingId !== "string" ||
      !mongoose.isValidObjectId(bookingId)
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid bookingId is required in authorization context",
      });
    }

    const result = await processRefund({
      paymentId,
      bookingId,
      reason: reason || "RECONCILIATION",
      origin: "AUTHORIZED_INTERNAL",
    });

    return res.status(200).json({
      success: true,
      message: "Refund processed successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Controller for internal cross-service payment status inquiry.
 */
export const internalGetPaymentStatusController = async (req, res, next) => {
  try {
    const { paymentId } = req.params;

    if (!paymentId || typeof paymentId !== "string") {
      return res.status(400).json({
        success: false,
        message: "A valid paymentId is required",
      });
    }

    const status = await getInternalPaymentStatus(paymentId);

    if (!status) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Controller for internal booking payment summary inquiry (Round 4g B5).
 * Returns customer-facing payment summary: status, amountMinor, currency, paidAt, cardBrand, cardLast4, paymentReference.
 * Never leaks Stripe PaymentIntent IDs, Stripe secrets, or internal payment IDs.
 */
export const internalGetPaymentSummaryByBookingController = async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    if (!bookingId || !mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "A valid bookingId is required",
      });
    }

    // Look for successful payment first, otherwise latest attempt
    let payment = await Payment.findOne({
      bookingId,
      status: "SUCCEEDED",
    }).lean();

    if (!payment) {
      payment = await Payment.findOne({ bookingId })
        .sort({ attemptNumber: -1, createdAt: -1 })
        .lean();
    }

    if (!payment) {
      return res.status(200).json({
        success: true,
        data: null,
      });
    }

    const summary = {
      status: payment.status,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      paidAt: payment.paidAt || null,
      cardBrand: payment.cardBrand || payment.metadata?.cardBrand || null,
      cardLast4: payment.cardLast4 || payment.metadata?.cardLast4 || null,
      paymentReference:
        payment.paymentReference ||
        payment.metadata?.receiptNumber ||
        `REC-${payment.bookingId.toString().slice(-8).toUpperCase()}`,
    };

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Controller for zombie payment reconciliation.
 */
export const internalReconcileZombiePaymentsController = async (req, res, next) => {
  try {
    const { maxAgeMs, batchSize } = req.body || {};
    const results = await reconcileZombiePayments({ maxAgeMs, batchSize });

    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Controller for external Stripe refund reconciliation.
 */
export const internalReconcileExternalRefundsController = async (req, res, next) => {
  try {
    const { batchSize } = req.body || {};
    const results = await reconcileExternalRefunds({ batchSize });

    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Controller for operator-audited DEAD outbox redrive.
 */
export const internalRedriveDeadEventsController = async (req, res, next) => {
  try {
    const { eventIds, approvedBy, operatorId, role, reason, operatorKey } = req.body || {};
    const suppliedKey = req.get("x-operator-admin-key") || operatorKey;
    const finalOperatorId = operatorId || approvedBy;

    const results = await redriveDeadOutboxEvents({
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
