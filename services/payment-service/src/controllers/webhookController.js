
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import Payment from "../models/Payment.js";
import OutboxEvent from "../models/OutboxEvent.js";
import ProcessedWebhookEvent from "../models/ProcessedWebhookEvent.js";

import {
  constructStripeWebhookEvent,
} from "../services/stripeService.js";

const SUPPORTED_EVENTS = new Set([
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "charge.refunded",
  "refund.created",
  "refund.updated",
  "charge.refund.updated",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
  "charge.dispute.funds_withdrawn",
  "charge.dispute.funds_reinstated",
]);

const sendSuccess = (res) => {
  return res.status(200).json({ received: true });
};

const validatePaymentIntent = (intent) => {
  if (
    !intent ||
    intent.object !== "payment_intent" ||
    typeof intent.id !== "string" ||
    typeof intent.metadata?.paymentId !== "string" ||
    typeof intent.metadata?.bookingId !== "string" ||
    typeof intent.metadata?.userId !== "string"
  ) {
    throw new Error("Invalid or incomplete PaymentIntent data");
  }

  if (
    !Number.isSafeInteger(intent.amount) ||
    intent.amount <= 0 ||
    typeof intent.currency !== "string"
  ) {
    throw new Error("Invalid PaymentIntent amount or currency");
  }
};

const validatePaymentIntentState = (stripeEvent, intent) => {
  if (
    stripeEvent.type === "payment_intent.succeeded" &&
    intent.status !== "succeeded"
  ) {
    throw new Error("PaymentIntent success event has an invalid status");
  }

  if (
    stripeEvent.type === "payment_intent.canceled" &&
    intent.status !== "canceled"
  ) {
    throw new Error("PaymentIntent cancellation event has an invalid status");
  }

  if (
    stripeEvent.type === "payment_intent.payment_failed" &&
    intent.status !== "requires_payment_method"
  ) {
    throw new Error("PaymentIntent failure event has an invalid status");
  }
};

const createPaymentDomainEvent = async ({
  session,
  payment,
  eventType,
  routingKey,
  payload,
}) => {
  const eventId = randomUUID();

  const eventEnvelope = {
    eventId,
    eventType,
    schemaVersion: 1,
    occurredAt: new Date().toISOString(),
    payload,
  };

  await OutboxEvent.create(
    [
      {
        eventId,
        eventType,
        aggregateType: "Payment",
        aggregateId: payment.paymentId,
        payload: {
          ...eventEnvelope,
          routingKey,
        },
        status: "PENDING",
        attempts: 0,
        nextAttemptAt: new Date(),
      },
    ],
    { session }
  );
};

const processPaymentIntentEvent = async (stripeEvent) => {
  const intent = stripeEvent.data.object;

  validatePaymentIntent(intent);
  validatePaymentIntentState(stripeEvent, intent);

  const {
    paymentId,
    bookingId,
    userId,
  } = intent.metadata;

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // Stripe can retry webhooks. Never process the same Stripe event twice.
      const alreadyProcessed = await ProcessedWebhookEvent.findOne({
        stripeEventId: stripeEvent.id,
      }).session(session);

      if (alreadyProcessed) {
        return;
      }

      const payment = await Payment.findOne({
        paymentId,
        userId,
        bookingId,
      }).session(session);

      if (!payment) {
        throw new Error(
          `Payment record not found for PaymentIntent ${intent.id}`
        );
      }

      // Link the Stripe ID if the webhook arrives before the API
      // request has saved it. Reject a conflicting PaymentIntent.
      if (
        payment.stripePaymentIntentId &&
        payment.stripePaymentIntentId !== intent.id
      ) {
        throw new Error("Stripe PaymentIntent ID mismatch");
      }

      if (
        intent.amount !== payment.amountMinor ||
        intent.currency.toUpperCase() !== payment.currency
      ) {
        throw new Error("Stripe amount or currency mismatch");
      }

      if (
        payment.stripePaymentIntentId == null
      ) {
        payment.stripePaymentIntentId = intent.id;
      }

      let eventType = null;
      let routingKey = null;
      let payload = null;

      // A failed payment attempt is not necessarily a failed PaymentIntent.
      if (stripeEvent.type === "payment_intent.payment_failed") {
        if (
          !["SUCCEEDED", "REFUNDED", "CANCELLED"].includes(payment.status)
        ) {
          payment.failureCode =
            intent.last_payment_error?.code ||
            "PAYMENT_ATTEMPT_FAILED";

          payment.failureMessage =
            intent.last_payment_error?.message || null;

          await payment.save({ session });
        }
      }

      // Explicit cancellation is terminal unless payment already succeeded.
      else if (stripeEvent.type === "payment_intent.canceled") {
        if (
          !["SUCCEEDED", "REFUNDED", "CANCELLED"].includes(payment.status)
        ) {
          payment.status = "CANCELLED";
          payment.failureCode = "PAYMENT_INTENT_CANCELLED";
          payment.failureMessage = "The PaymentIntent was cancelled";

          await payment.save({ session });

          eventType = "PaymentFailed";
          routingKey = "payment.failed";

          payload = {
            bookingId: payment.bookingId.toString(),
            paymentId: payment.paymentId,
            failureCode: "PAYMENT_INTENT_CANCELLED",
          };
        }
      }

      // Successful payment must be propagated even if the booking
      // was cancelled or expired. Booking Service owns reconciliation.
      else if (stripeEvent.type === "payment_intent.succeeded") {
        if (
          !Number.isSafeInteger(intent.amount_received) ||
          intent.amount_received !== payment.amountMinor
        ) {
          throw new Error(
            "Stripe received amount does not match payment"
          );
        }

        if (payment.status !== "REFUNDED") {
          const wasAlreadySucceeded = payment.status === "SUCCEEDED";

          if (!wasAlreadySucceeded) {
            payment.status = "SUCCEEDED";
            payment.paidAt = new Date();
          }

          await payment.save({ session });

          // Do not emit another success event if the Payment was
          // already successfully processed.
          if (!wasAlreadySucceeded) {
            eventType = "PaymentSucceeded";
            routingKey = "payment.succeeded";

            payload = {
              bookingId: payment.bookingId.toString(),
              paymentId: payment.paymentId,
              attemptNumber: payment.attemptNumber,
              attemptId: payment.attemptId,
              userId: payment.userId,
              amountMinor: payment.amountMinor,
              currency: payment.currency,
            };
          }
        }
      }

      // Payment state and its outgoing domain event are committed together.
      if (eventType) {
        await createPaymentDomainEvent({
          session,
          payment,
          eventType,
          routingKey,
          payload,
        });
      }

      // Record supported Stripe events, including failed attempts that
      // intentionally do not produce a domain event.
      await ProcessedWebhookEvent.create(
        [
          {
            stripeEventId: stripeEvent.id,
            eventType: stripeEvent.type,
            processedAt: new Date(),
          },
        ],
        { session }
      );
    });

    return { processed: true };
  } finally {
    await session.endSession();
  }
};

const processRefundWebhookEvent = async (stripeEvent) => {
  const eventObject = stripeEvent.data.object;

  let refund;
  let paymentIntentId;

  if (stripeEvent.type === "charge.refunded") {
    paymentIntentId = eventObject.payment_intent;
    refund = eventObject.refunds?.data?.[0];
  } else {
    // refund.created, refund.updated, charge.refund.updated
    refund = eventObject;
    paymentIntentId = eventObject.payment_intent;
  }

  if (!paymentIntentId || !refund) {
    console.warn("Refund webhook event missing payment_intent or refund data:", stripeEvent.type);
    return { processed: false };
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // 1. Idempotency deduplication check
      const alreadyProcessed = await ProcessedWebhookEvent.findOne({
        stripeEventId: stripeEvent.id,
      }).session(session);

      if (alreadyProcessed) {
        return;
      }

      // 2. Find Payment document by stripePaymentIntentId
      const payment = await Payment.findOne({
        stripePaymentIntentId: paymentIntentId,
      }).session(session);

      if (!payment) {
        console.warn(`Payment not found for refunded PaymentIntent: ${paymentIntentId}`);
        await ProcessedWebhookEvent.create(
          [
            {
              stripeEventId: stripeEvent.id,
              eventType: stripeEvent.type,
              processedAt: new Date(),
            },
          ],
          { session }
        );
        return;
      }

      // 3. Check for partial refund: must NOT treat partial refund as completed full refund
      if (refund.amount < payment.amountMinor) {
        console.warn(
          `Partial refund (${refund.amount} < ${payment.amountMinor}) received for payment ${payment.paymentId}; not marking as fully REFUNDED`
        );
        await ProcessedWebhookEvent.create(
          [
            {
              stripeEventId: stripeEvent.id,
              eventType: stripeEvent.type,
              processedAt: new Date(),
            },
          ],
          { session }
        );
        return;
      }

      // 4. Handle refund statuses
      let eventType = null;
      let routingKey = null;
      let payload = null;

      if (refund.status === "succeeded") {
        // Out-of-order & deduplication guard: only update if not already SUCCEEDED
        const updated = await Payment.findOneAndUpdate(
          {
            _id: payment._id,
            refundStatus: { $ne: "SUCCEEDED" },
          },
          {
            $set: {
              status: "REFUNDED",
              refundStatus: "SUCCEEDED",
              refundId: refund.id,
              refundedAmountMinor: refund.amount,
              refundReason: payment.refundReason || refund.reason || "CUSTOMER_REQUESTED",
              refundedAt: new Date(),
              lastRefundError: null,
            },
          },
          { session, returnDocument: "after" }
        );

        if (updated) {
          const origin = payment.refundReason && payment.refundReason !== "CUSTOMER_REQUESTED" && payment.refundReason !== "EXTERNAL_STRIPE"
            ? "AUTHORIZED_INTERNAL"
            : "EXTERNAL_STRIPE";

          eventType = "PaymentRefunded";
          routingKey = "payment.refunded";
          payload = {
            bookingId: updated.bookingId.toString(),
            paymentId: updated.paymentId,
            refundId: refund.id,
            amountMinor: refund.amount,
            currency: updated.currency,
            reason: updated.refundReason || "EXTERNAL_STRIPE",
            origin,
          };
        }
      } else if (refund.status === "failed" || refund.status === "canceled") {
        // Guard against out-of-order: do NOT overwrite a succeeded refund
        const updated = await Payment.findOneAndUpdate(
          {
            _id: payment._id,
            refundStatus: { $ne: "SUCCEEDED" },
          },
          {
            $set: {
              status: "SUCCEEDED", // Payment itself is still succeeded; the refund attempt failed
              refundStatus: refund.status === "canceled" ? "CANCELLED" : "FAILED",
              refundId: refund.id,
              lastRefundError: refund.failure_reason || "Refund failed or cancelled",
            },
          },
          { session, returnDocument: "after" }
        );

        if (updated) {
          eventType = "PaymentRefundFailed";
          routingKey = "payment.refund-failed";
          payload = {
            bookingId: updated.bookingId.toString(),
            paymentId: updated.paymentId,
            failureCode: refund.failure_reason || "STRIPE_REFUND_FAILED",
            failureMessage: refund.failure_reason || "Stripe refund failed or cancelled",
          };
        }
      } else if (refund.status === "pending") {
        await Payment.updateOne(
          {
            _id: payment._id,
            refundStatus: { $nin: ["SUCCEEDED", "PENDING"] },
          },
          {
            $set: {
              status: "REFUND_PENDING",
              refundStatus: "PENDING",
              refundId: refund.id,
            },
          },
          { session }
        );
      }

      // 5. Emit Outbox event if state changed
      if (eventType) {
        await createPaymentDomainEvent({
          session,
          payment,
          eventType,
          routingKey,
          payload,
        });
      }

      // 6. Record processed webhook event
      await ProcessedWebhookEvent.create(
        [
          {
            stripeEventId: stripeEvent.id,
            eventType: stripeEvent.type,
            processedAt: new Date(),
          },
        ],
        { session }
      );
    });

    return { processed: true };
  } finally {
    await session.endSession();
  }
};

const mapDisputeStatus = (stripeStatus) => {
  switch (stripeStatus) {
    case "needs_response":
    case "warning_needs_response":
      return "NEEDS_RESPONSE";
    case "under_review":
    case "warning_under_review":
      return "UNDER_REVIEW";
    case "won":
      return "WON";
    case "lost":
      return "LOST";
    default:
      return "NEEDS_RESPONSE";
  }
};

const processDisputeWebhookEvent = async (stripeEvent) => {
  const dispute = stripeEvent.data.object;
  const paymentIntentId = dispute.payment_intent;

  if (!paymentIntentId) {
    console.warn("Dispute webhook missing payment_intent:", stripeEvent.type);
    return { processed: false };
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // 1. Idempotency deduplication check
      const alreadyProcessed = await ProcessedWebhookEvent.findOne({
        stripeEventId: stripeEvent.id,
      }).session(session);

      if (alreadyProcessed) {
        return;
      }

      // 2. Find Payment document by stripePaymentIntentId
      const payment = await Payment.findOne({
        stripePaymentIntentId: paymentIntentId,
      }).session(session);

      if (!payment) {
        console.warn(`Payment not found for disputed PaymentIntent: ${paymentIntentId}`);
        await ProcessedWebhookEvent.create(
          [
            {
              stripeEventId: stripeEvent.id,
              eventType: stripeEvent.type,
              processedAt: new Date(),
            },
          ],
          { session }
        );
        return;
      }

      // 3. Map dispute status. Crucial: Do NOT touch refundStatus! Do NOT treat as refund!
      const internalDisputeStatus = mapDisputeStatus(dispute.status);

      payment.disputeStatus = internalDisputeStatus;
      payment.disputeId = dispute.id;
      payment.disputeReason = dispute.reason || "STRIPE_CHARGEBACK";
      payment.disputeAmountMinor = dispute.amount || payment.amountMinor;
      payment.disputedAt = new Date();

      await payment.save({ session });

      // 4. Emit PaymentDisputed domain event (distinct from PaymentRefunded)
      await createPaymentDomainEvent({
        session,
        payment,
        eventType: "PaymentDisputed",
        routingKey: "payment.disputed",
        payload: {
          bookingId: payment.bookingId.toString(),
          paymentId: payment.paymentId,
          disputeId: dispute.id,
          disputeStatus: internalDisputeStatus,
          amountMinor: dispute.amount || payment.amountMinor,
          currency: payment.currency,
          reason: dispute.reason || "STRIPE_CHARGEBACK",
        },
      });

      // 5. Record processed webhook event
      await ProcessedWebhookEvent.create(
        [
          {
            stripeEventId: stripeEvent.id,
            eventType: stripeEvent.type,
            processedAt: new Date(),
          },
        ],
        { session }
      );
    });

    return { processed: true };
  } finally {
    await session.endSession();
  }
};

export const handleStripeWebhook = async (req, res, next) => {
  try {
    const signature = req.get("stripe-signature");

    if (!signature) {
      return res.status(400).json({
        success: false,
        message: "Missing Stripe signature",
      });
    }

    let stripeEvent;

    try {
      stripeEvent = constructStripeWebhookEvent(
        req.body,
        signature
      );
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid Stripe webhook signature",
      });
    }

    // Unknown events are acknowledged because this service does not
    // subscribe to their business meaning.
    if (!SUPPORTED_EVENTS.has(stripeEvent.type)) {
      return sendSuccess(res);
    }

    if (stripeEvent.type.startsWith("payment_intent.")) {
      await processPaymentIntentEvent(stripeEvent);
    } else if (stripeEvent.type.startsWith("charge.dispute.")) {
      await processDisputeWebhookEvent(stripeEvent);
    } else {
      await processRefundWebhookEvent(stripeEvent);
    }

    return sendSuccess(res);
  } catch (error) {
    return next(error);
  }
};
