
import mongoose from "mongoose";

const clerkWebhookEventSchema = new mongoose.Schema(
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

    processedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const ClerkWebhookEvent = mongoose.model(
  "ClerkWebhookEvent",
  clerkWebhookEventSchema
);

export default ClerkWebhookEvent;
