
import mongoose from "mongoose";

import ProcessedEvent from "../models/ProcessedEvent.js";
import Notification from "../models/Notification.js";

import { getUserDetails } from "../clients/userClient.js";
import { getBookingEmailTemplate } from "../templates/bookingEmailTemplates.js";

const EVENT_CONFIG = {
  BookingConfirmed: {
    notificationType: "BOOKING_CONFIRMED",
  },

  BookingCancelled: {
    notificationType: "BOOKING_CANCELLED",
  },

  BookingPaymentFailed: {
    notificationType: "PAYMENT_FAILED",
  },

  BookingExpired: {
    notificationType: "BOOKING_EXPIRED",
  },
};

const validateEvent = (event) => {
  if (!event || typeof event !== "object") {
    throw new Error("Invalid event");
  }

  if (!event.eventId || typeof event.eventId !== "string") {
    throw new Error("Event ID is missing");
  }

  if (event.schemaVersion !== 1) {
    throw new Error("Unsupported event schema version");
  }

  if (!EVENT_CONFIG[event.eventType]) {
    throw new Error(`Unsupported event type: ${event.eventType}`);
  }

  const payload = event.payload;

  if (!payload || typeof payload !== "object") {
    throw new Error("Event payload is missing");
  }

  if (!payload.userId || !payload.bookingId) {
    throw new Error("Booking or user ID is missing");
  }

  if (
    !payload.checkIn ||
    !payload.checkOut ||
    !Number.isInteger(payload.numberOfRooms) ||
    !Number.isInteger(payload.numberOfGuests)
  ) {
    throw new Error("Invalid booking details in event payload");
  }

  return true;
};

export const createNotificationFromEvent = async (event) => {
  validateEvent(event);

  // Fast path for already-processed events.
  const existingEvent = await ProcessedEvent.exists({
    eventId: event.eventId,
  });

  if (existingEvent) {
    return {
      duplicate: true,
      message: "Event already processed",
    };
  }

  // User Service owns customer profile information.
  const user = await getUserDetails(event.payload.userId);

  const config = EVENT_CONFIG[event.eventType];

  const email = getBookingEmailTemplate({
    eventType: event.eventType,
    displayName: user.displayName,
    payload: event.payload,
  });

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      // Recheck within the transaction to handle concurrent delivery.
      const alreadyProcessed = await ProcessedEvent.findOne({
        eventId: event.eventId,
      }).session(session);

      if (alreadyProcessed) {
        result = {
          duplicate: true,
          message: "Event already processed",
        };
        return;
      }

      await ProcessedEvent.create(
        [
          {
            eventId: event.eventId,
            eventType: event.eventType,
            status: "PROCESSED",
            processedAt: new Date(),
          },
        ],
        { session }
      );

      await Notification.create(
        [
          {
            eventId: event.eventId,
            eventType: event.eventType,
            recipient: user.email,
            notificationType: config.notificationType,
            subject: email.subject,

            templateData: {
              displayName: user.displayName,
              payload: event.payload,
            },

            status: "PENDING",
            attempts: 0,
            maxAttempts: 5,
            nextAttemptAt: new Date(),
          },
        ],
        { session }
      );

      result = {
        duplicate: false,
        message: "Notification job created",
      };
    });

    return result;
  } catch (error) {
    // Concurrent consumers can race on the unique event index.
    if (error.code === 11000) {
      const existing = await ProcessedEvent.exists({
        eventId: event.eventId,
      });

      if (existing) {
        return {
          duplicate: true,
          message: "Event already processed",
        };
      }
    }

    throw error;
  } finally {
    await session.endSession();
  }
};
