
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      required: true,
      unique: true,
    },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    attemptNumber: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    attemptId: {
      type: String,
      required: true,
      index: true,
    },

    userId: {
      type: String,
      required: true,
      index: true,
    },

    amountMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Payment amount must be a safe integer in minor units",
      },
    },

    currency: {
      type: String,
      required: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
      match: /^[A-Z]{3}$/,
    },

    provider: {
      type: String,
      enum: ["STRIPE"],
      default: "STRIPE",
      required: true,
    },

    stripePaymentIntentId: {
      type: String,
      default: undefined,
    },

    stripePaymentIntentStatus: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: [
        "CREATED",
        "REQUIRES_ACTION",
        "PROCESSING",
        "SUCCEEDED",
        "FAILED",
        "CANCELLED",
        "REFUND_PENDING",
        "REFUNDED",
      ],
      default: "CREATED",
      required: true,
      index: true,
    },

    idempotencyKey: {
      type: String,
      required: true,
    },

    failureCode: {
      type: String,
      default: null,
    },

    failureMessage: {
      type: String,
      default: null,
    },

    lastInitiationError: {
      type: String,
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    refundId: {
      type: String,
      default: null,
      index: true,
    },

    refundStatus: {
      type: String,
      enum: ["NONE", "PENDING", "SUCCEEDED", "FAILED", "CANCELLED"],
      default: "NONE",
    },

    refundedAmountMinor: {
      type: Number,
      default: 0,
    },

    refundReason: {
      type: String,
      default: null,
    },

    refundedAt: {
      type: Date,
      default: null,
    },

    lastRefundError: {
      type: String,
      default: null,
    },

    disputeStatus: {
      type: String,
      enum: ["NONE", "NEEDS_RESPONSE", "UNDER_REVIEW", "WON", "LOST"],
      default: "NONE",
      index: true,
    },

    disputeId: {
      type: String,
      default: null,
      index: true,
    },

    disputeReason: {
      type: String,
      default: null,
    },

    disputeAmountMinor: {
      type: Number,
      default: 0,
    },

    disputedAt: {
      type: Date,
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

paymentSchema.index(
  { bookingId: 1, attemptNumber: 1 },
  {
    unique: true,
    name: "unique_booking_payment_attempt",
  }
);

paymentSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    name: "unique_user_payment_idempotency",
  }
);

paymentSchema.index({ bookingId: 1, createdAt: -1 });

paymentSchema.index(
  { stripePaymentIntentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      stripePaymentIntentId: { $type: "string" },
    },
    name: "unique_stripe_payment_intent",
  }
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
