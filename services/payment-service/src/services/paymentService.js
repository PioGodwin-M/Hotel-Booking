
import mongoose from "mongoose";
import { createHash, randomUUID } from "node:crypto";

import Payment from "../models/Payment.js";
import PaymentRequest from "../models/PaymentRequest.js";

import {
  markBookingPaymentPending,
} from "./bookingClient.js";

import {
  createStripePaymentIntent,
  retrieveStripePaymentIntent,
} from "./stripeService.js";

const LEASE_DURATION_MS = 60_000;
const LEASE_RENEWAL_INTERVAL_MS = 20_000;

const TERMINAL_PAYMENT_STATUSES = [
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUNDED",
];

const generatePaymentId = (userId, idempotencyKey) => {
  const hash = createHash("sha256")
    .update(`${userId}:${idempotencyKey}`)
    .digest("hex");

  return `pay_${hash}`;
};

const createError = (message, code, statusCode = 409) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

const mapStripeStatus = (status) => {
  switch (status) {
    case "succeeded":
      return "SUCCEEDED";

    case "processing":
      return "PROCESSING";

    case "requires_action":
    case "requires_payment_method":
    case "requires_confirmation":
      return "REQUIRES_ACTION";

    case "canceled":
      return "CANCELLED";

    default:
      return "CREATED";
  }
};

const assertSameRequest = (request, bookingId) => {
  if (request.bookingId.toString() !== bookingId.toString()) {
    throw createError(
      "Idempotency key was already used for another booking",
      "IDEMPOTENCY_KEY_REUSED"
    );
  }
};

// Reserve the key before making any external service calls.
const acquireReservation = async ({
  userId,
  idempotencyKey,
  bookingId,
  paymentId,
  attemptNumber = 1,
  attemptId,
}) => {
  const leaseToken = randomUUID();
  const leaseUntil = new Date(Date.now() + LEASE_DURATION_MS);

  try {
    const request = await PaymentRequest.create({
      userId,
      idempotencyKey,
      bookingId,
      attemptNumber,
      attemptId,
      paymentId,
      status: "PROCESSING",
      leaseToken,
      leaseUntil,
    });

    return {
      request,
      leaseToken,
      acquired: true,
    };
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }
  }

  // Contender handling: another concurrent request holds the reservation or is processing
  const maxWaitMs = 5000;
  const pollIntervalMs = 150;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const now = new Date();
    const existing = await PaymentRequest.findOne({
      bookingId,
      attemptNumber,
    });

    if (existing) {
      assertSameRequest(existing, bookingId);

      if (existing.status === "COMPLETED") {
        return {
          request: existing,
          leaseToken: null,
          acquired: false,
        };
      }

      // Check if lease expired (process crash, unhandled error, or timeout)
      if (
        existing.status === "RETRYABLE" ||
        (existing.status === "PROCESSING" && (!existing.leaseUntil || existing.leaseUntil <= now))
      ) {
        const recovered = await PaymentRequest.findOneAndUpdate(
          {
            _id: existing._id,
            $or: [
              { status: "RETRYABLE" },
              { status: "PROCESSING", leaseUntil: { $lte: now } },
              { status: "PROCESSING", leaseUntil: null },
              { status: "PROCESSING", leaseUntil: { $exists: false } },
            ],
          },
          {
            $set: {
              status: "PROCESSING",
              leaseToken,
              leaseUntil: new Date(Date.now() + LEASE_DURATION_MS),
              lastError: null,
            },
          },
          { returnDocument: "after" }
        );

        if (recovered) {
          return {
            request: recovered,
            leaseToken,
            acquired: true,
          };
        }
      }
    }

    await new Promise((res) => setTimeout(res, pollIntervalMs + Math.floor(Math.random() * 50)));
  }

  throw createError(
    "Another request is currently processing this payment attempt",
    "IDEMPOTENCY_REQUEST_IN_PROGRESS"
  );
};

const startLeaseHeartbeat = (requestId, leaseToken) => {
  let leaseLost = false;
  let heartbeatPromise = Promise.resolve();
  let heartbeatRunning = false;

  const renewLease = async () => {
    if (heartbeatRunning || leaseLost) return;

    heartbeatRunning = true;

    try {
      const result = await PaymentRequest.updateOne(
        {
          _id: requestId,
          status: "PROCESSING",
          leaseToken,
          leaseUntil: { $gt: new Date() },
        },
        {
          $set: {
            leaseUntil: new Date(Date.now() + LEASE_DURATION_MS),
          },
        }
      );

      if (result.modifiedCount !== 1) {
        leaseLost = true;
      }
    } catch (error) {
      console.error("Payment reservation lease renewal failed:", error);
      leaseLost = true;
    } finally {
      heartbeatRunning = false;
    }
  };

  const timer = setInterval(() => {
    heartbeatPromise = renewLease();
  }, LEASE_RENEWAL_INTERVAL_MS);

  timer.unref?.();

  return {
    assertOwnership: async () => {
      await heartbeatPromise;

      if (leaseLost) {
        throw createError(
          "Payment request lease ownership was lost",
          "PAYMENT_REQUEST_LEASE_LOST"
        );
      }

      const request = await PaymentRequest.findOne({
        _id: requestId,
        status: "PROCESSING",
        leaseToken,
        leaseUntil: { $gt: new Date() },
      }).lean();

      if (!request) {
        leaseLost = true;

        throw createError(
          "Payment request lease ownership was lost",
          "PAYMENT_REQUEST_LEASE_LOST"
        );
      }
    },

    stop: async () => {
      clearInterval(timer);
      await heartbeatPromise;
    },
  };
};

const completeReservation = async (requestId, leaseToken) => {
  const result = await PaymentRequest.updateOne(
    {
      _id: requestId,
      status: "PROCESSING",
      leaseToken,
      leaseUntil: { $gt: new Date() },
    },
    {
      $set: {
        status: "COMPLETED",
        leaseToken: null,
        leaseUntil: null,
        completedAt: new Date(),
        lastError: null,
      },
    }
  );

  if (result.modifiedCount !== 1) {
    throw createError(
      "Could not complete payment request because ownership was lost",
      "PAYMENT_REQUEST_LEASE_LOST"
    );
  }
};

const releaseReservation = async (requestId, leaseToken, error) => {
  await PaymentRequest.updateOne(
    {
      _id: requestId,
      status: "PROCESSING",
      leaseToken,
    },
    {
      $set: {
        status: "RETRYABLE",
        leaseToken: null,
        leaseUntil: null,
        lastError: String(error.message || error).slice(0, 1000),
      },
    }
  );
};

const getExistingPaymentResponse = async (paymentId, userId) => {
  const payment = await Payment.findOne({
    paymentId,
    userId,
  }).lean();

  if (!payment) {
    throw new Error(
      "Completed payment reservation has no corresponding Payment record"
    );
  }

  if (!payment.stripePaymentIntentId) {
    throw new Error(
      "Payment has no associated Stripe PaymentIntent"
    );
  }

  const intent = await retrieveStripePaymentIntent(
    payment.stripePaymentIntentId
  );

  return {
    paymentId: payment.paymentId,
    bookingId: payment.bookingId,
    attemptNumber: payment.attemptNumber || 1,
    attemptId: payment.attemptId || `att_${payment.bookingId}_${payment.attemptNumber || 1}`,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    status: payment.status,
    clientSecret: intent.client_secret || null,
  };
};

export const createPayment = async ({
  bookingId,
  userId,
  idempotencyKey,
}) => {
  if (!userId) {
    throw createError(
      "Authenticated user is required",
      "UNAUTHENTICATED",
      401
    );
  }

  if (!mongoose.isValidObjectId(bookingId)) {
    throw createError(
      "A valid booking ID is required",
      "VALIDATION_ERROR",
      400
    );
  }

  // 1. Authoritative attempt resolution
  const latestPayment = await Payment.findOne({
    bookingId,
    userId,
  }).sort({ attemptNumber: -1 });

  let attemptNumber = 1;
  let previousAttempt = null;

  if (latestPayment) {
    // Check if active attempt is reusable (including soft card decline where intent is requires_payment_method)
    const isLocalActive = ["CREATED", "REQUIRES_ACTION", "PROCESSING"].includes(latestPayment.status);

    if (isLocalActive && latestPayment.stripePaymentIntentId) {
      try {
        const intent = await retrieveStripePaymentIntent(latestPayment.stripePaymentIntentId);
        const reusableStripeStatuses = [
          "requires_payment_method",
          "requires_action",
          "processing",
          "requires_confirmation",
        ];

        if (reusableStripeStatuses.includes(intent.status)) {
          // REUSE EXISTING PAYMENTINTENT & ATTEMPT
          return {
            paymentId: latestPayment.paymentId,
            bookingId: latestPayment.bookingId,
            attemptNumber: latestPayment.attemptNumber || 1,
            attemptId: latestPayment.attemptId || `att_${bookingId}_${latestPayment.attemptNumber || 1}`,
            amountMinor: latestPayment.amountMinor,
            currency: latestPayment.currency,
            status: latestPayment.status,
            clientSecret: intent.client_secret || null,
          };
        }
      } catch (intentErr) {
        console.warn("Could not inspect existing intent, proceeding with attempt check:", intentErr.message);
      }
    }

    if (["SUCCEEDED", "REFUND_PENDING", "REFUNDED"].includes(latestPayment.status)) {
      throw createError(
        "Payment has already been completed for this booking",
        "PAYMENT_ALREADY_SUCCEEDED",
        409
      );
    }

    if (["FAILED", "CANCELLED"].includes(latestPayment.status)) {
      attemptNumber = (latestPayment.attemptNumber || 1) + 1;
      previousAttempt = {
        paymentId: latestPayment.paymentId,
        attemptNumber: latestPayment.attemptNumber || 1,
        terminalStatus: latestPayment.status,
        terminalReason: latestPayment.failureCode || latestPayment.failureMessage || "TERMINAL",
      };
    } else {
      attemptNumber = latestPayment.attemptNumber || 1;
    }
  }

  const attemptId = `att_${bookingId}_${attemptNumber}`;
  const effectiveIdempotencyKey = (typeof idempotencyKey === "string" && idempotencyKey.trim())
    ? `${idempotencyKey.trim()}_att_${attemptNumber}`
    : `pay_booking_${bookingId}_att_${attemptNumber}`;

  const paymentId = generatePaymentId(userId, effectiveIdempotencyKey);

  const reservation = await acquireReservation({
    userId,
    idempotencyKey: effectiveIdempotencyKey,
    bookingId,
    paymentId,
    attemptNumber,
    attemptId,
  });

  if (!reservation.acquired) {
    return getExistingPaymentResponse(paymentId, userId);
  }

  const { request, leaseToken } = reservation;

  const heartbeat = startLeaseHeartbeat(
    request._id,
    leaseToken
  );

  try {
    await heartbeat.assertOwnership();

    // Booking Service owns booking validation, ownership, hold-expiry, and authoritative pricing.
    const bookingDetails = await markBookingPaymentPending({
      bookingId,
      paymentId,
      attemptNumber,
      userId,
      previousAttempt,
    });

    await heartbeat.assertOwnership();

    const currency = bookingDetails.currency.toUpperCase();
    const amountMinor = bookingDetails.amountMinor;

    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw createError(
        "Booking returned an invalid payment amount",
        "INVALID_PAYMENT_AMOUNT",
        502
      );
    }

    let payment = await Payment.findOne({
      userId,
      idempotencyKey: effectiveIdempotencyKey,
    });

    if (payment) {
      if (
        payment.paymentId !== paymentId ||
        payment.bookingId.toString() !== bookingId.toString() ||
        payment.amountMinor !== amountMinor ||
        payment.currency !== currency
      ) {
        throw createError(
          "Existing payment does not match the booking",
          "PAYMENT_DETAILS_MISMATCH"
        );
      }

      if (TERMINAL_PAYMENT_STATUSES.includes(payment.status)) {
        throw createError(
          "This payment attempt is terminal",
          "PAYMENT_TERMINAL"
        );
      }
    } else {
      try {
        payment = await Payment.create({
          paymentId,
          bookingId,
          attemptNumber,
          attemptId,
          userId,
          amountMinor,
          currency,
          provider: "STRIPE",
          status: "CREATED",
          idempotencyKey: effectiveIdempotencyKey,
        });
      } catch (error) {
        if (error.code !== 11000) {
          throw error;
        }

        payment = await Payment.findOne({
          userId,
          idempotencyKey: effectiveIdempotencyKey,
        });

        if (!payment) throw error;

        if (
          payment.paymentId !== paymentId ||
          payment.bookingId.toString() !== bookingId.toString() ||
          payment.amountMinor !== amountMinor ||
          payment.currency !== currency
        ) {
          throw createError(
            "Existing payment does not match the booking",
            "PAYMENT_DETAILS_MISMATCH"
          );
        }
      }
    }

    await heartbeat.assertOwnership();

    // Prefer retrieval when the PaymentIntent ID has already been saved.
    // Otherwise retry creation using the deterministic Stripe key.
    let paymentIntent;

    if (payment.stripePaymentIntentId) {
      paymentIntent = await retrieveStripePaymentIntent(
        payment.stripePaymentIntentId
      );
    } else {
      paymentIntent = await createStripePaymentIntent({
        paymentId,
        bookingId,
        userId,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
      });
    }

    await heartbeat.assertOwnership();

    if (
      paymentIntent.amount !== payment.amountMinor ||
      paymentIntent.currency.toUpperCase() !== payment.currency
    ) {
      throw createError(
        "Stripe PaymentIntent does not match the Payment record",
        "STRIPE_PAYMENT_DETAILS_MISMATCH"
      );
    }

    // Link the PaymentIntent only if it is not already linked to another ID.
    const linkedPayment = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        $or: [
          { stripePaymentIntentId: { $exists: false } },
          { stripePaymentIntentId: null },
          { stripePaymentIntentId: paymentIntent.id },
        ],
      },
      {
        $set: {
          stripePaymentIntentId: paymentIntent.id,
          stripePaymentIntentStatus: paymentIntent.status,
        },
      },
      {
        returnDocument: "after",
      }
    );

    if (!linkedPayment) {
      throw createError(
        "Payment is linked to a different Stripe PaymentIntent",
        "STRIPE_PAYMENT_INTENT_MISMATCH"
      );
    }

    // NOTE ON STRIPE IDEMPOTENCY RETENTION:
    // Stripe retains and enforces idempotency keys for 24 hours. Within this window,
    // re-using the deterministic paymentId guarantees recovery without duplicate intent creation.
    // For long outages (>24h), reconciliation must query existing intents by metadata before creation.
    //
    // A webhook may have advanced the state while this request was running.
    // Strictly fence the status update with stripePaymentIntentId and nonterminal status.
    const statusUpdateResult = await Payment.updateOne(
      {
        _id: payment._id,
        stripePaymentIntentId: paymentIntent.id,
        status: { $nin: TERMINAL_PAYMENT_STATUSES },
      },
      {
        $set: {
          status: mapStripeStatus(paymentIntent.status),
          stripePaymentIntentStatus: paymentIntent.status,
        },
      }
    );

    if (statusUpdateResult.matchedCount === 0) {
      const currentPayment = await Payment.findById(payment._id).lean();

      if (!currentPayment) {
        throw createError("Payment record not found", "PAYMENT_NOT_FOUND", 404);
      }

      if (currentPayment.stripePaymentIntentId !== paymentIntent.id) {
        throw createError(
          "Payment is linked to a different Stripe PaymentIntent",
          "STRIPE_PAYMENT_INTENT_MISMATCH"
        );
      }

      if (!TERMINAL_PAYMENT_STATUSES.includes(currentPayment.status)) {
        throw createError(
          "Could not update payment status",
          "PAYMENT_UPDATE_FAILED"
        );
      }
      // If currentPayment is already in a terminal status (e.g. an asynchronous webhook already marked it SUCCEEDED),
      // we preserve that terminal status safely without overwriting it.
    }

    await heartbeat.assertOwnership();

    await heartbeat.stop();

    await completeReservation(request._id, leaseToken);

    const latestPaymentDoc = await Payment.findById(payment._id).lean();

    return {
      paymentId: latestPaymentDoc.paymentId,
      bookingId: latestPaymentDoc.bookingId,
      attemptNumber: latestPaymentDoc.attemptNumber || attemptNumber,
      attemptId: latestPaymentDoc.attemptId || attemptId,
      amountMinor: latestPaymentDoc.amountMinor,
      currency: latestPaymentDoc.currency,
      status: latestPaymentDoc.status,
      clientSecret: paymentIntent.client_secret || null,
    };
  } catch (error) {
    await heartbeat.stop();

    await releaseReservation(
      request._id,
      leaseToken,
      error
    ).catch((releaseError) => {
      console.error(
        "Could not release payment reservation:",
        releaseError.message
      );
    });

    throw error;
  }
};
