import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import Payment from "../models/Payment.js";
import OutboxEvent from "../models/OutboxEvent.js";
import {
  listStripeRefunds,
  retrieveStripePaymentIntent,
} from "./stripeService.js";

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
 * Reconciles non-terminal Payment records against authoritative Stripe PaymentIntents.
 *
 * Invariants:
 * 1. Succeeded Stripe intents are transitioned to SUCCEEDED and emit PaymentSucceeded.
 * 2. requires_payment_method preserves retry eligibility (never marked terminal FAILED).
 * 3. requires_action and processing are handled without premature termination.
 * 4. cancelled Stripe intents are transitioned to CANCELLED.
 */
export const reconcileZombiePayments = async ({
  maxAgeMs = 120000,
  batchSize = 50,
} = {}) => {
  const cutoff = new Date(Date.now() - maxAgeMs);

  const pendingPayments = await Payment.find({
    status: { $in: ["CREATED", "PROCESSING", "REQUIRES_ACTION"] },
    stripePaymentIntentId: { $exists: true, $ne: null },
    createdAt: { $lte: cutoff },
  })
    .limit(batchSize)
    .lean();

  const results = {
    scanned: pendingPayments.length,
    succeeded: 0,
    preservedRetryable: 0,
    preservedRequiresAction: 0,
    cancelled: 0,
    errors: [],
  };

  for (const payment of pendingPayments) {
    try {
      const intent = await retrieveStripePaymentIntent(
        payment.stripePaymentIntentId
      );

      if (intent.status === "succeeded") {
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            const updated = await Payment.findOneAndUpdate(
              { _id: payment._id, status: { $ne: "SUCCEEDED" } },
              {
                $set: {
                  status: "SUCCEEDED",
                  stripePaymentIntentStatus: "succeeded",
                  paidAt: new Date(),
                  lastInitiationError: null,
                },
              },
              { session, returnDocument: "after" }
            );

            if (updated) {
              await createOutboxEvent({
                session,
                payment: updated,
                eventType: "PaymentSucceeded",
                routingKey: "payment.succeeded",
                payload: {
                  bookingId: updated.bookingId.toString(),
                  paymentId: updated.paymentId,
                  attemptNumber: updated.attemptNumber,
                  attemptId: updated.attemptId,
                  userId: updated.userId,
                  amountMinor: updated.amountMinor,
                  currency: updated.currency,
                },
              });
              results.succeeded += 1;
            }
          });
        } finally {
          await session.endSession();
        }
      } else if (intent.status === "requires_payment_method") {
        // Preserve Phase 2 retry eligibility: card declines remain reusable
        await Payment.updateOne(
          { _id: payment._id },
          {
            $set: {
              stripePaymentIntentStatus: "requires_payment_method",
            },
          }
        );
        results.preservedRetryable += 1;
      } else if (intent.status === "requires_action") {
        await Payment.updateOne(
          { _id: payment._id },
          {
            $set: {
              status: "REQUIRES_ACTION",
              stripePaymentIntentStatus: "requires_action",
            },
          }
        );
        results.preservedRequiresAction += 1;
      } else if (intent.status === "canceled") {
        await Payment.updateOne(
          { _id: payment._id, status: { $nin: ["SUCCEEDED", "REFUNDED"] } },
          {
            $set: {
              status: "CANCELLED",
              stripePaymentIntentStatus: "canceled",
            },
          }
        );
        results.cancelled += 1;
      }
    } catch (err) {
      results.errors.push({ paymentId: payment.paymentId, error: err.message });
    }
  }

  return results;
};

/**
 * Reconciles external Stripe refunds into MongoDB Payment records.
 *
 * Invariants:
 * 1. Discovers full refunds existing on Stripe but not yet marked SUCCEEDED in MongoDB.
 * 2. Emits PaymentRefunded outbox event with origin: "EXTERNAL_STRIPE".
 * 3. Never treats partial refunds as full refunds.
 */
export const reconcileExternalRefunds = async ({ batchSize = 50 } = {}) => {
  const eligiblePayments = await Payment.find({
    status: "SUCCEEDED",
    refundStatus: { $in: ["NONE", "FAILED", "PENDING"] },
    stripePaymentIntentId: { $exists: true, $ne: null },
  })
    .limit(batchSize)
    .lean();

  const results = {
    scanned: eligiblePayments.length,
    reconciled: 0,
    skipped: 0,
    errors: [],
  };

  for (const payment of eligiblePayments) {
    try {
      const existingRefunds = await listStripeRefunds(
        payment.stripePaymentIntentId
      );

      const matchedRefund = existingRefunds.find(
        (r) =>
          r.amount === payment.amountMinor &&
          r.currency.toUpperCase() === payment.currency.toUpperCase() &&
          r.status === "succeeded"
      );

      if (matchedRefund) {
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            const updated = await Payment.findOneAndUpdate(
              { _id: payment._id, refundStatus: { $ne: "SUCCEEDED" } },
              {
                $set: {
                  status: "REFUNDED",
                  refundStatus: "SUCCEEDED",
                  refundId: matchedRefund.id,
                  refundedAmountMinor: matchedRefund.amount,
                  refundReason: "EXTERNAL_STRIPE",
                  refundedAt: new Date(),
                  lastRefundError: null,
                },
              },
              { session, returnDocument: "after" }
            );

            if (updated) {
              await createOutboxEvent({
                session,
                payment: updated,
                eventType: "PaymentRefunded",
                routingKey: "payment.refunded",
                payload: {
                  bookingId: updated.bookingId.toString(),
                  paymentId: updated.paymentId,
                  refundId: matchedRefund.id,
                  amountMinor: matchedRefund.amount,
                  currency: updated.currency,
                  reason: "EXTERNAL_STRIPE",
                  origin: "EXTERNAL_STRIPE",
                },
              });
              results.reconciled += 1;
            }
          });
        } finally {
          await session.endSession();
        }
      } else {
        results.skipped += 1;
      }
    } catch (err) {
      results.errors.push({ paymentId: payment.paymentId, error: err.message });
    }
  }

  return results;
};

/**
 * Returns authoritative internal status for a Payment aggregate.
 */
export const getInternalPaymentStatus = async (paymentId) => {
  const payment = await Payment.findOne({ paymentId }).lean();
  if (!payment) return null;

  return {
    paymentId: payment.paymentId,
    bookingId: payment.bookingId,
    userId: payment.userId,
    attemptNumber: payment.attemptNumber,
    attemptId: payment.attemptId,
    status: payment.status,
    stripePaymentIntentId: payment.stripePaymentIntentId,
    stripePaymentIntentStatus: payment.stripePaymentIntentStatus,
    refundStatus: payment.refundStatus,
    refundId: payment.refundId,
    disputeStatus: payment.disputeStatus,
    disputeId: payment.disputeId,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    paidAt: payment.paidAt,
  };
};
