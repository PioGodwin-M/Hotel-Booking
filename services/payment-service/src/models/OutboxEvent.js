
import mongoose from "mongoose";

const outboxEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
    },

    eventType: {
      type: String,
      required: true,
    },

    aggregateType: {
      type: String,
      required: true,
    },

    aggregateId: {
      type: String,
      required: true,
    },

    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "PUBLISHED", "DEAD"],
      default: "PENDING",
      index: true,
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

    lockedBy: {
      type: String,
      default: null,
    },

    lockedUntil: {
      type: Date,
      default: null,
    },

    nextAttemptAt: {
      type: Date,
      default: Date.now,
    },

    leaseToken: {
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
  { timestamps: true }
);

outboxEventSchema.index({
  status: 1,
  nextAttemptAt: 1,
  createdAt: 1,
});

outboxEventSchema.index({
  status: 1,
  lockedUntil: 1,
});

const OutboxEvent = mongoose.model(
  "OutboxEvent",
  outboxEventSchema
);

export default OutboxEvent;
