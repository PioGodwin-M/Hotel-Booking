
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
      enum: ["PENDING", "PUBLISHED"],
      default: "PENDING",
      index: true,
    },

    attempts: {
      type: Number,
      default: 0,
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    lastError: {
      type: String,
      default: null,
    },

    // Publisher ownership
    lockedBy: {
      type: String,
      default: null,
    },

    // Claim expiration time
    lockedUntil: {
      type: Date,
      default: null,
    },

    // Earliest time this event can be retried
    nextAttemptAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Efficient retrieval of events ready for publishing.
outboxEventSchema.index({
  status: 1,
  nextAttemptAt: 1,
  createdAt: 1,
});

// Helps locate expired publisher claims.
outboxEventSchema.index({
  status: 1,
  lockedUntil: 1,
});

const OutboxEvent = mongoose.model(
  "OutboxEvent",
  outboxEventSchema
);

export default OutboxEvent;
