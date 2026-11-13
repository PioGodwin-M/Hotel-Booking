import mongoose from "mongoose";

const paymentReconciliationSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
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

    reason: {
      type: String,
      required: true,
      enum: [
        "BOOKING_NOT_PAYMENT_PENDING",
        "PAYMENT_ID_MISMATCH",
        "PAYMENT_AMOUNT_MISMATCH",
        "PAYMENT_CURRENCY_MISMATCH",
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
  },
  { timestamps: true }
);

paymentReconciliationSchema.index({ status: 1, createdAt: 1 });

const PaymentReconciliation = mongoose.model(
  "PaymentReconciliation",
  paymentReconciliationSchema
);

export default PaymentReconciliation;