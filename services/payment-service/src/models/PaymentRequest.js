
import mongoose from "mongoose";

const paymentRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
    },

    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 128,
    },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    paymentId: {
      type: String,
      required: true,
      unique: true,
    },

    status: {
      type: String,
      enum: ["PROCESSING", "RETRYABLE", "COMPLETED"],
      default: "PROCESSING",
      required: true,
    },

    leaseToken: {
      type: String,
      default: null,
    },

    leaseUntil: {
      type: Date,
      default: null,
    },

    lastError: {
      type: String,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

paymentRequestSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    name: "unique_user_idempotency_key",
  }
);

paymentRequestSchema.index({
  status: 1,
  leaseUntil: 1,
});

const PaymentRequest = mongoose.model(
  "PaymentRequest",
  paymentRequestSchema
);

export default PaymentRequest;
