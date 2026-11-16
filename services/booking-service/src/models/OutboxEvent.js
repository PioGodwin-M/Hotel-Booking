
import mongoose from "mongoose";

const outboxEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },

    eventType: {
      type: String,
      enum: [
        "BookingConfirmed",
        "BookingCancelled",
        "BookingPaymentFailed",
        "BookingExpired",
      ],
      required: true,
    },

    routingKey: {
      type: String,
      enum: [
        "booking.confirmed",
        "booking.cancelled",
        "booking.payment-failed",
        "booking.expired",
      ],
      required: true,
    },

    aggregateType: {
      type: String,
      default: "Booking",
      required: true,
    },

    aggregateId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    // Complete event envelope sent to RabbitMQ.
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "PUBLISHED", "DEAD"],
      default: "PENDING",
      required: true,
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    maxAttempts: {
      type: Number,
      default: 10,
      min: 1,
    },

    nextAttemptAt: {
      type: Date,
      default: Date.now,
    },

    lockedBy: {
      type: String,
      default: null,
    },

    leaseToken: {
      type: String,
      default: null,
    },

    lockedUntil: {
      type: Date,
      default: null,
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    deadAt: {
      type: Date,
      default: null,
    },

    lastError: {
      type: String,
      default: null,
    },

    redriveAudit: [
      {
        operatorId: { type: String, required: true },
        role: { type: String, default: "ADMIN" },
        reason: { type: String, required: true },
        redrivenAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

outboxEventSchema.index(
  {
    status: 1,
    nextAttemptAt: 1,
    createdAt: 1,
  },
  {
    name: "outbox_pending_events",
  }
);

outboxEventSchema.index(
  {
    status: 1,
    lockedUntil: 1,
  },
  {
    name: "outbox_expired_leases",
  }
);

const OutboxEvent = mongoose.model(
  "OutboxEvent",
  outboxEventSchema
);

export default OutboxEvent;
