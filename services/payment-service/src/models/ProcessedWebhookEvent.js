
import mongoose from "mongoose";

const processedWebhookEventSchema = new mongoose.Schema(
  {
    stripeEventId: {
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
      default: Date.now,
      required: true,
    },
  },
  { timestamps: true }
);

processedWebhookEventSchema.index({
  eventType: 1,
  processedAt: -1,
});

const ProcessedWebhookEvent = mongoose.model(
  "ProcessedWebhookEvent",
  processedWebhookEventSchema
);

export default ProcessedWebhookEvent;
