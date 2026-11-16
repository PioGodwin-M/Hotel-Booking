import mongoose from "mongoose";

const paymentReconciliationSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: false,
      sparse: true,
    },

    reconciliationKey: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      index: true,
    },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    paymentId: {
      type: String,
      required: true,
      index: true,
    },

    attemptNumber: {
      type: Number,
      default: null,
    },

    attemptId: {
      type: String,
      default: null,
    },

    reason: {
      type: String,
      required: true,
      enum: [
        "BOOKING_NOT_PAYMENT_PENDING",
        "PAYMENT_ID_MISMATCH",
        "PAYMENT_AMOUNT_MISMATCH",
        "PAYMENT_CURRENCY_MISMATCH",
        "OBSOLETE_ATTEMPT",
        "UNEXPECTED_FUTURE_ATTEMPT",
        "ATTEMPT_ID_MISMATCH",
        "ATTEMPT_NUMBER_MISMATCH",
        "EXTERNAL_REFUND_ON_CONFIRMED_BOOKING",
        "STRIPE_DISPUTE_CREATED",
        "LATE_PAYMENT_ON_EXPIRED_BOOKING",
        "LATE_PAYMENT_ON_CANCELLED_BOOKING",
        "USER_ID_MISMATCH",
        "MISSING_ATTEMPT_ID",
        "MISSING_ATTEMPT_NUMBER",
        "MISSING_USER_ID",
        "MISSING_PAYMENT_AMOUNT",
        "MISSING_PAYMENT_CURRENCY",
      ],
    },

    amountMinor: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["REFUND_REQUIRED", "REVIEW_REQUIRED", "RESOLVED"],
      default: "REVIEW_REQUIRED",
      index: true,
    },

    resolvedBy: {
      type: String,
      default: null,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },

    resolutionAction: {
      type: String,
      default: null,
    },

    resolutionDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

paymentReconciliationSchema.index({ status: 1, createdAt: 1 });
paymentReconciliationSchema.index({ bookingId: 1, paymentId: 1, reason: 1 });

const PaymentReconciliation = mongoose.model(
  "PaymentReconciliation",
  paymentReconciliationSchema
);

export default PaymentReconciliation;
