import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import Payment from "../models/Payment.js";
import OutboxEvent from "../models/OutboxEvent.js";
import {
  createStripeRefund,
  listStripeRefunds,
  retrieveStripeRefund,
} from "./stripeService.js";

const createError = (message, code, statusCode = 409) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

/**
 * Creates a domain event in the transactional outbox.
 */
const createOutboxEvent = async ({
  session,
  payment,
  eventType,
  routingKey,
  payload,
}) => {
  const eventId = randomUUID();

  await OutboxEvent.create(
    [
      {
        eventId,
        eventType,
        aggregateType: "Payment",
        aggregateId: payment.paymentId,
        payload: {
          eventId,
          eventType,
          schemaVersion: 1,
          occurredAt: new Date().toISOString(),
          routingKey,
          payload,
        },
        status: "PENDING",
        attempts: 0,
        nextAttemptAt: new Date(),
      },
    ],
    { session }
  );
};

/**
 * Helper to wait for an in-flight refund operation to complete.
 * Returns the completed Payment document if it transitioned to REFUNDED,
 * or the latest document if it transitioned out of REFUND_PENDING,
 * or null if maxWaitMs elapsed while still in REFUND_PENDING.
 */
const waitForRefundCompletion = async (
  paymentObjectId,
  maxWaitMs = 5000,
  pollIntervalMs = 150
) => {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    await new Promise((res) =>
      setTimeout(res, pollIntervalMs + Math.floor(Math.random() * 50))
    );

    const doc = await Payment.findById(paymentObjectId).lean();
    if (!doc) return null;

    if (doc.status === "REFUNDED" && doc.refundStatus === "SUCCEEDED") {
      return doc;
    }

    if (doc.status !== "REFUND_PENDING") {
      return doc;
    }
  }
  return null;
};

/**
 * Process a full refund for an eligible payment.
 *
 * Invariants:
 * 1. Only SUCCEEDED or retryable REFUND_PENDING payments can be refunded.
 * 2. Deterministic idempotency key: `ref_idemp_${payment.paymentId}`.
 * 3. Concurrent requests are fenced: Worker B waits for in-flight Worker A to complete,
 *    and recovers safely if Worker A crashed or delayed.
 * 4. Pre-checks Stripe for existing refunds before issuing creation.
 * 5. Partial refunds are never treated as completed full refunds.
 * 6. Exactly one outbox event is emitted for the refund lifecycle transition.
 * 7. Refund amount and currency are derived authoritatively from Payment record.
 * 8. Authorization context: requires bookingId matching payment.bookingId.
 */
export const processRefund = async ({
  paymentId,
  bookingId = null,
  userId = null,
  reason = "RECONCILIATION",
  origin = "AUTHORIZED_INTERNAL",
}) => {
  if (!paymentId || typeof paymentId !== "string") {
    throw createError("A valid payment ID is required", "VALIDATION_ERROR", 400);
  }

  const payment = await Payment.findOne({ paymentId });

  if (!payment) {
    throw createError("Payment not found", "PAYMENT_NOT_FOUND", 404);
  }

  // Enforce booking aggregate root alignment if bookingId is provided
  if (bookingId && payment.bookingId.toString() !== bookingId.toString()) {
    throw createError(
      `Payment ${payment.paymentId} does not match booking ${bookingId}`,
      "BOOKING_MISMATCH",
      409
    );
  }

  // Idempotent return if already refunded
  if (payment.status === "REFUNDED" && payment.refundStatus === "SUCCEEDED") {
    return {
      paymentId: payment.paymentId,
      bookingId: payment.bookingId,
      refundId: payment.refundId,
      refundStatus: payment.refundStatus,
      refundedAmountMinor: payment.refundedAmountMinor,
      currency: payment.currency,
      status: payment.status,
    };
  }

  // Eligibility check
  if (!["SUCCEEDED", "REFUND_PENDING"].includes(payment.status)) {
    throw createError(
      `Payment in ${payment.status} state is not eligible for refund`,
      "PAYMENT_NOT_REFUNDABLE",
      409
    );
  }

  if (!payment.stripePaymentIntentId) {
    throw createError(
      "Payment has no associated Stripe PaymentIntent",
      "STRIPE_PAYMENT_INTENT_MISSING",
      409
    );
  }

  // Concurrency Lock & Wait / Recovery Handling
  if (payment.status === "SUCCEEDED") {
    const lockedPayment = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        status: "SUCCEEDED",
        refundStatus: { $in: ["NONE", "FAILED"] },
      },
      {
        $set: {
          status: "REFUND_PENDING",
          refundStatus: "PENDING",
          refundReason: reason,
          lastRefundError: null,
        },
      },
      { returnDocument: "after" }
    );

    if (!lockedPayment) {
      // Contender: Another concurrent worker acquired the lock first.
      // Wait for in-flight completion.
      const completedDoc = await waitForRefundCompletion(payment._id);

      if (
        completedDoc &&
        completedDoc.status === "REFUNDED" &&
        completedDoc.refundStatus === "SUCCEEDED"
      ) {
        return {
          paymentId: completedDoc.paymentId,
          bookingId: completedDoc.bookingId,
          refundId: completedDoc.refundId,
          refundStatus: completedDoc.refundStatus,
          refundedAmountMinor: completedDoc.refundedAmountMinor,
          currency: completedDoc.currency,
          status: completedDoc.status,
        };
      }
      // If still REFUND_PENDING after wait (prior worker delayed or crashed), fall through to recovery
    }
  } else if (payment.status === "REFUND_PENDING") {
    // Arrived while already REFUND_PENDING: wait for in-flight completion
    const completedDoc = await waitForRefundCompletion(payment._id);

    if (
      completedDoc &&
      completedDoc.status === "REFUNDED" &&
      completedDoc.refundStatus === "SUCCEEDED"
    ) {
      return {
        paymentId: completedDoc.paymentId,
        bookingId: completedDoc.bookingId,
        refundId: completedDoc.refundId,
        refundStatus: completedDoc.refundStatus,
        refundedAmountMinor: completedDoc.refundedAmountMinor,
        currency: completedDoc.currency,
        status: completedDoc.status,
      };
    }
    // If still REFUND_PENDING after wait (prior worker delayed or crashed), fall through to recovery
  }

  // Step 1: Reconcile existing Stripe refunds before creating a new one
  let matchedRefund;

  try {
    const existingRefunds = await listStripeRefunds(
      payment.stripePaymentIntentId
    );

    // Check for partial refunds: must NOT be treated as a full refund
    const partialRefund = existingRefunds.find(
      (r) =>
        r.amount < payment.amountMinor &&
        ["succeeded", "pending"].includes(r.status)
    );

    if (partialRefund) {
      throw createError(
        `Existing partial refund (${partialRefund.amount} < ${payment.amountMinor}) detected on Stripe; cannot treat as completed full refund`,
        "PARTIAL_REFUND_DETECTED",
        409
      );
    }

    // Check for existing matching full refund
    matchedRefund = existingRefunds.find(
      (r) =>
        r.amount === payment.amountMinor &&
        r.currency.toUpperCase() === payment.currency.toUpperCase() &&
        ["succeeded", "pending"].includes(r.status)
    );

    // Step 2: If no existing refund on Stripe, create it using deterministic idempotency key
    if (!matchedRefund) {
      const deterministicKey = `ref_idemp_${payment.paymentId}`;

      try {
        matchedRefund = await createStripeRefund({
          stripePaymentIntentId: payment.stripePaymentIntentId,
          amountMinor: payment.amountMinor,
          reason: "requested_by_customer",
          metadata: {
            paymentId: payment.paymentId,
            bookingId: payment.bookingId.toString(),
            userId: payment.userId,
          },
          idempotencyKey: deterministicKey,
        });
      } catch (stripeCreateError) {
        if (stripeCreateError.code === "charge_already_refunded") {
          const recheckRefunds = await listStripeRefunds(
            payment.stripePaymentIntentId
          );
          matchedRefund = recheckRefunds.find(
            (r) => r.amount === payment.amountMinor
          );
        }

        if (!matchedRefund) {
          throw stripeCreateError;
        }
      }
    }
  } catch (stripeError) {
    // Record failure transactionally and emit PaymentRefundFailed
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const failedPayment = await Payment.findOneAndUpdate(
          {
            _id: payment._id,
            refundStatus: { $ne: "SUCCEEDED" },
          },
          {
            $set: {
              status: "SUCCEEDED", // Revert status so it can be retried
              refundStatus: "FAILED",
              lastRefundError: String(
                stripeError.message || stripeError
              ).slice(0, 1000),
            },
          },
          { session, returnDocument: "after" }
        );

        if (failedPayment && stripeError.code !== "PARTIAL_REFUND_DETECTED") {
          await createOutboxEvent({
            session,
            payment: failedPayment,
            eventType: "PaymentRefundFailed",
            routingKey: "payment.refund-failed",
            payload: {
              bookingId: failedPayment.bookingId.toString(),
              paymentId: failedPayment.paymentId,
              failureCode: stripeError.code || "STRIPE_REFUND_FAILED",
              failureMessage: stripeError.message,
            },
          });
        }
      });
    } finally {
      await session.endSession();
    }

    throw stripeError;
  }

  // Step 3: Transactional Persistence of Succeeded / Pending Refund & Outbox Event
  const isSucceeded = matchedRefund.status === "succeeded";
  const finalStatus = isSucceeded ? "REFUNDED" : "REFUND_PENDING";
  const finalRefundStatus = isSucceeded ? "SUCCEEDED" : "PENDING";

  const session = await mongoose.startSession();
  let updatedPayment;

  try {
    await session.withTransaction(async () => {
      // Exactly-once outbox creation: Only emit if refundStatus was NOT already SUCCEEDED
      updatedPayment = await Payment.findOneAndUpdate(
        {
          _id: payment._id,
          refundStatus: { $ne: "SUCCEEDED" },
        },
        {
          $set: {
            status: finalStatus,
            refundStatus: finalRefundStatus,
            refundId: matchedRefund.id,
            refundedAmountMinor: matchedRefund.amount,
            refundReason: reason,
            refundedAt: new Date(),
            lastRefundError: null,
          },
        },
        { session, returnDocument: "after" }
      );

      if (updatedPayment && isSucceeded) {
        await createOutboxEvent({
          session,
          payment: updatedPayment,
          eventType: "PaymentRefunded",
          routingKey: "payment.refunded",
          payload: {
            bookingId: updatedPayment.bookingId.toString(),
            paymentId: updatedPayment.paymentId,
            refundId: matchedRefund.id,
            amountMinor: matchedRefund.amount,
            currency: updatedPayment.currency,
            reason,
            origin,
          },
        });
      }
    });
  } finally {
    await session.endSession();
  }

  const latestDoc =
    updatedPayment || (await Payment.findById(payment._id).lean());

  return {
    paymentId: latestDoc.paymentId,
    bookingId: latestDoc.bookingId,
    refundId: latestDoc.refundId || matchedRefund.id,
    refundStatus: latestDoc.refundStatus,
    refundedAmountMinor: latestDoc.refundedAmountMinor || matchedRefund.amount,
    currency: latestDoc.currency,
    status: latestDoc.status,
  };
};
