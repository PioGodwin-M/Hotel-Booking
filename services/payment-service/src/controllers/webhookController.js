
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

    await processPaymentIntentEvent(stripeEvent);

    return sendSuccess(res);
  } catch (error) {
    return next(error);
  }
};
