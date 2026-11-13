
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
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

    recipient: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    notificationType: {
      type: String,
      required: true,
      enum: [
        "BOOKING_CONFIRMED",
        "BOOKING_CANCELLED",
        "PAYMENT_FAILED",
        "BOOKING_EXPIRED",
      ],
    },

    subject: {
      type: String,
      required: true,
      trim: true,
    },

    // Booking and template data needed to render the email.
    templateData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "SENT", "FAILED"],
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
      default: 5,
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

    lastError: {
      type: String,
      default: null,
    },

    sentAt: {
      type: Date,
      default: null,
    },

    providerMessageId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// One email of a given type per recipient for each event.
notificationSchema.index(
  {
    eventId: 1,
    notificationType: 1,
    recipient: 1,
  },
  {
    unique: true,
    name: "uniq_event_notification_recipient",
  }
);

// Efficiently find pending jobs ready for delivery.
notificationSchema.index(
  {
    status: 1,
    nextAttemptAt: 1,
    createdAt: 1,
  },
  {
    name: "notification_delivery_queue",
  }
);

// Find jobs whose processing lease has expired.
notificationSchema.index(
  {
    status: 1,
    lockedUntil: 1,
  },
  {
    name: "notification_expired_leases",
  }
);

const Notification = mongoose.model(
  "Notification",
  notificationSchema
);

export default Notification;
