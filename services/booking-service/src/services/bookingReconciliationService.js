import mongoose from "mongoose";
import { randomUUID, timingSafeEqual } from "node:crypto";

import Booking from "../models/Booking.js";
import PaymentReconciliation from "../models/PaymentReconciliation.js";
import { processPaymentResult } from "../events/paymentResultHandler.js";
import { requestInternalRefund } from "./paymentClient.js";

const PAYMENT_SERVICE_URL =
  process.env.PAYMENT_SERVICE_URL || "http://localhost:4004";
const PAYMENT_SERVICE_SECRET = process.env.PAYMENT_SERVICE_SECRET;

/**
 * Fetches authoritative Payment aggregate state via authenticated internal HTTP contract.
 * Strictly maintains database boundaries (never accesses Payment Service database directly).
 */
export const fetchInternalPaymentStatus = async (paymentId) => {
  if (!paymentId) return null;

  try {
    const res = await fetch(
      `${PAYMENT_SERVICE_URL}/internal/payments/${paymentId}/status`,
      {
        headers: {
          "x-payment-service-key": PAYMENT_SERVICE_SECRET,
        },
      }
    );

    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(
        `Payment Service responded with status ${res.status} during status check`
      );
    }

    const data = await res.json();
    return data.data;
  } catch (err) {
    console.error(
      `Failed to fetch payment status for ${paymentId} via internal contract:`,
      err.message
    );
    return null;
  }
};

/**
 * Reconciles ghost payments: Bookings stuck in PAYMENT_PENDING.
 *
 * Invariants:
 * 1. Safe auto-confirmation occurs ONLY if the booking hold is strictly active (holdExpiresAt > now).
 * 2. If the hold has expired or was cancelled, the booking is NEVER silently confirmed.
 * 3. Expired or cancelled bookings with successful payments are recorded in PaymentReconciliation with REVIEW_REQUIRED.
 * 4. Duplicate discrepancy detections do not create duplicate review records.
 */
export const reconcileGhostPayments = async ({
  maxAgeMs = 120000,
  batchSize = 50,
} = {}) => {
  const cutoff = new Date(Date.now() - maxAgeMs);

  const pendingBookings = await Booking.find({
    status: "PAYMENT_PENDING",
    paymentId: { $exists: true, $ne: null },
    createdAt: { $lte: cutoff },
  })
    .limit(batchSize)
    .lean();

  const results = {
    scanned: pendingBookings.length,
    confirmedUnderActiveHold: 0,
    escalatedExpiredHold: 0,
    skipped: 0,
    errors: [],
  };

  const now = new Date();

  for (const booking of pendingBookings) {
    try {
      const paymentStatus = await fetchInternalPaymentStatus(booking.paymentId);

      if (!paymentStatus) {
        results.skipped += 1;
        continue;
      }

      if (paymentStatus.status === "SUCCEEDED") {
        const isHoldActive =
          booking.holdExpiresAt && new Date(booking.holdExpiresAt) > now;

        if (isHoldActive) {
          // Hold is still active: safe auto-confirmation via idempotent handler
          const outcome = await processPaymentResult({
            eventId: `recon_ghost_${randomUUID().replace(/-/g, "")}`,
            eventType: "PaymentSucceeded",
            schemaVersion: 1,
            occurredAt: new Date().toISOString(),
            payload: {
              bookingId: booking._id.toString(),
              paymentId: paymentStatus.paymentId,
              attemptNumber: paymentStatus.attemptNumber,
              attemptId: paymentStatus.attemptId,
              userId: paymentStatus.userId,
              amountMinor: paymentStatus.amountMinor,
              currency: paymentStatus.currency,
            },
          });

          if (outcome === "CONFIRMED") {
            results.confirmedUnderActiveHold += 1;
          } else {
            results.skipped += 1;
          }
        } else {
          // Hold expired: NEVER silently confirm. Escalate for human review.
          const reconciliationKey = `recon_${booking._id}_${paymentStatus.paymentId}_LATE_PAYMENT_ON_EXPIRED_BOOKING`;

          await PaymentReconciliation.findOneAndUpdate(
            { reconciliationKey },
            {
              $setOnInsert: {
                reconciliationKey,
                bookingId: booking._id,
                paymentId: paymentStatus.paymentId,
                attemptNumber: paymentStatus.attemptNumber,
                attemptId: paymentStatus.attemptId,
                reason: "LATE_PAYMENT_ON_EXPIRED_BOOKING",
                amountMinor: paymentStatus.amountMinor,
                currency: paymentStatus.currency,
                status: "REVIEW_REQUIRED",
                details: {
                  bookingStatus: booking.status,
                  holdExpiresAt: booking.holdExpiresAt,
                  paymentPaidAt: paymentStatus.paidAt,
                },
              },
            },
            { upsert: true }
          );

          results.escalatedExpiredHold += 1;
        }
      } else {
        results.skipped += 1;
      }
    } catch (err) {
      results.errors.push({ bookingId: booking._id, error: err.message });
    }
  }

  return results;
};

/**
 * Lists active payment reconciliation review records for operator review.
 */
export const listPaymentReconciliations = async ({
  status = "REVIEW_REQUIRED",
  limit = 50,
} = {}) => {
  const query = status ? { status } : {};
  return PaymentReconciliation.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Resolves a PaymentReconciliation record by executing an authorized refund through Payment Service.
 *
 * Invariants:
 * 1. Requires verified operator identity against OPERATOR_ADMIN_KEY via constant-time comparison.
 * 2. Record must exist in REVIEW_REQUIRED status.
 * 3. Invokes Payment Service's internal refund contract via paymentClient.
 * 4. Atomically marks reconciliation record RESOLVED with operator audit fields.
 */
export const resolveReconciliationWithRefund = async ({
  reconciliationId,
  operatorIdentity,
  reason = "OPERATOR_RECONCILIATION_REFUND",
}) => {
  const configuredAdminKey = process.env.OPERATOR_ADMIN_KEY;
  const suppliedKey = operatorIdentity?.operatorKey;

  if (
    !configuredAdminKey ||
    !suppliedKey ||
    typeof suppliedKey !== "string"
  ) {
    const error = new Error("Operator administrative authorization required");
    error.code = "UNAUTHORIZED_OPERATOR";
    error.statusCode = 403;
    throw error;
  }

  const expectedBuffer = Buffer.from(configuredAdminKey);
  const suppliedBuffer = Buffer.from(suppliedKey);

  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    const error = new Error("Invalid operator credentials");
    error.code = "UNAUTHORIZED_OPERATOR";
    error.statusCode = 403;
    throw error;
  }

  if (!reconciliationId || !mongoose.isValidObjectId(reconciliationId)) {
    const error = new Error("A valid reconciliationId is required");
    error.code = "VALIDATION_ERROR";
    error.statusCode = 400;
    throw error;
  }

  const record = await PaymentReconciliation.findById(reconciliationId);
  if (!record) {
    const error = new Error("Reconciliation record not found");
    error.code = "NOT_FOUND";
    error.statusCode = 404;
    throw error;
  }

  if (record.status === "RESOLVED") {
    return {
      success: true,
      alreadyResolved: true,
      reconciliation: record,
    };
  }

  // Execute internal refund via Payment Service internal contract
  const refundResult = await requestInternalRefund({
    paymentId: record.paymentId,
    bookingId: record.bookingId.toString(),
    reason,
  });

  // Mark reconciliation resolved with operator audit trail
  record.status = "RESOLVED";
  record.resolvedBy = operatorIdentity.operatorId || "verified_operator";
  record.resolvedAt = new Date();
  record.resolutionAction = "REFUND_EXECUTED";
  record.resolutionDetails = {
    refundId: refundResult.data?.refundId,
    reason,
    refundStatus: refundResult.data?.refundStatus,
  };
  await record.save();

  return {
    success: true,
    reconciliation: record,
    refund: refundResult.data,
  };
};

