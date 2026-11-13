
import mongoose from "mongoose";

const processedEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
    },

    eventType: {
      type: String,
      required: true,
      enum: [
        "BookingConfirmed",
        "BookingCancelled",
        "BookingPaymentFailed",
        "BookingExpired",
      ],
      immutable: true,
    },

    status: {
      type: String,
      enum: ["PROCESSED"],
      default: "PROCESSED",
      required: true,
    },

    processedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

processedEventSchema.index(
  { eventId: 1 },
  { unique: true, name: "uniq_processed_event_id" }
);

const ProcessedEvent = mongoose.model(
  "ProcessedEvent",
  processedEventSchema
);

export default ProcessedEvent;
