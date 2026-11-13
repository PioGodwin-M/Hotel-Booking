
import { randomUUID } from "node:crypto";

import OutboxEvent from "../models/OutboxEvent.js";

const EVENT_CONFIG = {
  BookingConfirmed: {
    routingKey: "booking.confirmed",
  },

  BookingCancelled: {
    routingKey: "booking.cancelled",
  },

  BookingPaymentFailed: {
    routingKey: "booking.payment-failed",
  },

  BookingExpired: {
  routingKey: "booking.expired",
  },
};

export const createBookingEvent = async ({
  booking,
  eventType,
  session,
  extraPayload = {},
}) => {
  const config = EVENT_CONFIG[eventType];

  if (!config) {
    throw new Error(`Unsupported booking event: ${eventType}`);
  }

  if (!booking || !booking._id || !session) {
    throw new Error(
      "Booking and MongoDB transaction session are required"
    );
  }

  const eventId = randomUUID();

  const payload = {
    eventId,
    eventType,
    schemaVersion: 1,
    occurredAt: new Date().toISOString(),

    payload: {
      bookingId: booking._id.toString(),
      userId: booking.userId,
      hotelId: booking.hotelId.toString(),
      roomCategoryId: booking.roomCategoryId.toString(),

      checkIn: new Date(booking.checkIn).toISOString(),
      checkOut: new Date(booking.checkOut).toISOString(),

      numberOfRooms: booking.numberOfRooms,
      numberOfGuests: booking.numberOfGuests,

      totalAmount: booking.priceSnapshot.totalAmount,
      currency: booking.priceSnapshot.currency,

      ...extraPayload,
    },
  };

  const [outboxEvent] = await OutboxEvent.create(
    [
      {
        eventId,
        eventType,
        routingKey: config.routingKey,
        aggregateType: "Booking",
        aggregateId: booking._id,
        payload,
      },
    ],
    { session }
  );

  return outboxEvent;
};
