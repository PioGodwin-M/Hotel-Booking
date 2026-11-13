import mongoose from "mongoose";

import Booking from "../models/Booking.js";
import DailyInventory from "../models/DailyInventory.js";
import ProcessedEvent from "../models/ProcessedEvent.js";
import PaymentReconciliation from "../models/PaymentReconciliation.js";
import { createBookingEvent } from "../services/bookingEventService.js";

import { getStayDates } from "../utils/dateUtils.js";

const isValidPaymentEvent = (event) => {
  if (
    !event ||
    typeof event.eventId !== "string" ||
    !event.eventId.trim() ||
    !["PaymentSucceeded", "PaymentFailed"].includes(event.eventType) ||
    event.schemaVersion !== 1 ||
    !event.payload ||
    !mongoose.isValidObjectId(event.payload.bookingId) ||
    typeof event.payload.paymentId !== "string" ||
    !event.payload.paymentId.trim()
  ) {
    return false;
  }

  if (event.eventType === "PaymentSucceeded") {
    return (
      Number.isSafeInteger(event.payload.amountMinor) &&
      event.payload.amountMinor > 0 &&
      typeof event.payload.currency === "string" &&
      /^[A-Z]{3}$/.test(event.payload.currency)
    );
  }

  return (
    typeof event.payload.failureCode === "string" &&
    event.payload.failureCode.trim().length > 0
  );
};

const recordReconciliation = async ({
  event,
  booking,
  reason,
  session,
}) => {
  const { payload } = event;

  await PaymentReconciliation.create(
    [
      {
        eventId: event.eventId,
        bookingId: booking._id,
        paymentId: payload.paymentId,
        reason,
        amountMinor: payload.amountMinor,
        currency: payload.currency,
        status: "REVIEW_REQUIRED",
      },
    ],
    { session }
  );
};

const releaseHeldInventory = async (booking, session) => {
  const stayDates = getStayDates(booking.checkIn, booking.checkOut);

  for (const date of stayDates) {
    const result = await DailyInventory.updateOne(
      {
        roomCategoryId: booking.roomCategoryId,
        date,
        heldUnits: { $gte: booking.numberOfRooms },
      },
      {
        $inc: {
          heldUnits: -booking.numberOfRooms,
        },
      },
      { session }
    );

    if (result.modifiedCount !== 1) {
      throw new Error(
        `Unable to release held inventory for booking ${booking._id}`
      );
    }
  }
};

const confirmHeldInventory = async (booking, session) => {
  const stayDates = getStayDates(booking.checkIn, booking.checkOut);

  for (const date of stayDates) {
    const result = await DailyInventory.updateOne(
      {
        roomCategoryId: booking.roomCategoryId,
        date,
        heldUnits: { $gte: booking.numberOfRooms },
      },
      {
        $inc: {
          heldUnits: -booking.numberOfRooms,
          bookedUnits: booking.numberOfRooms,
        },
      },
      { session }
    );

    if (result.modifiedCount !== 1) {
      throw new Error(
        `Unable to confirm inventory for booking ${booking._id}`
      );
    }
  }
};

export const processPaymentResult = async (event) => {
  if (!isValidPaymentEvent(event)) {
    const error = new Error("Invalid payment event payload");
    error.code = "INVALID_PAYMENT_EVENT";
    throw error;
  }

  const { eventId, eventType, payload } = event;
  const session = await mongoose.startSession();

  try {
    let outcome = "IGNORED";

    await session.withTransaction(async () => {
      outcome = "IGNORED";

      // Insert the event ID inside the same transaction as business changes.
      await ProcessedEvent.create(
        [
          {
            eventId,
            eventType,
          },
        ],
        { session }
      );

      const booking = await Booking.findById(payload.bookingId).session(session);

      if (!booking) {
        // Persist the event as processed so a permanently missing booking
        // does not create an endless retry loop.
        outcome = "BOOKING_NOT_FOUND";
        return;
      }

      if (eventType === "PaymentSucceeded") {
        const expectedAmountMinor = Math.round(
          booking.priceSnapshot.totalAmount * 100
        );

        if (booking.paymentId !== payload.paymentId) {
          await recordReconciliation({
            event,
            booking,
            reason: "PAYMENT_ID_MISMATCH",
            session,
          });
          outcome = "RECONCILIATION_REQUIRED";
          return;
        }

        if (payload.amountMinor !== expectedAmountMinor) {
          await recordReconciliation({
            event,
            booking,
            reason: "PAYMENT_AMOUNT_MISMATCH",
            session,
          });
          outcome = "RECONCILIATION_REQUIRED";
          return;
        }

        if (payload.currency !== booking.priceSnapshot.currency) {
          await recordReconciliation({
            event,
            booking,
            reason: "PAYMENT_CURRENCY_MISMATCH",
            session,
          });
          outcome = "RECONCILIATION_REQUIRED";
          return;
        }

        if (booking.status === "CONFIRMED") {
          outcome = "ALREADY_CONFIRMED";
          return;
        }

        if (booking.status !== "PAYMENT_PENDING") {
          await recordReconciliation({
            event,
            booking,
            reason: "BOOKING_NOT_PAYMENT_PENDING",
            session,
          });
          outcome = "RECONCILIATION_REQUIRED";
          return;
        }

        const updatedBooking = await Booking.updateOne(
          {
            _id: booking._id,
            status: "PAYMENT_PENDING",
            paymentId: payload.paymentId,
          },
          {
            $set: {
              status: "CONFIRMED",
              holdExpiresAt: null,
            },
          },
          { session }
        );

        if (updatedBooking.modifiedCount !== 1) {
          throw new Error("Booking confirmation state transition failed");
        }

       await confirmHeldInventory(booking, session);

await createBookingEvent({
  booking,
  eventType: "BookingConfirmed",
  session,
});

outcome = "CONFIRMED";
        return;
      }

      // PaymentFailed
      if (booking.paymentId !== payload.paymentId) {
        // A failure from an old or unrelated payment attempt must not
        // release the current booking's inventory.
        outcome = "STALE_PAYMENT_FAILURE";
        return;
      }

      if (booking.status === "PAYMENT_FAILED") {
        outcome = "ALREADY_FAILED";
        return;
      }

      if (booking.status !== "PAYMENT_PENDING") {
        // A stale failure must not change a confirmed, cancelled or expired
        // booking.
        outcome = "STALE_PAYMENT_FAILURE";
        return;
      }

      const updatedBooking = await Booking.updateOne(
        {
          _id: booking._id,
          status: "PAYMENT_PENDING",
          paymentId: payload.paymentId,
        },
        {
          $set: {
            status: "PAYMENT_FAILED",
            holdExpiresAt: null,
          },
        },
        { session }
      );

      if (updatedBooking.modifiedCount !== 1) {
        throw new Error("Booking failure state transition failed");
      }

      await releaseHeldInventory(booking, session);

await createBookingEvent({
  booking,
  eventType: "BookingPaymentFailed",
  session,
  extraPayload: {
    failureCode: payload.failureCode,
  },
});

outcome = "PAYMENT_FAILED";
    });

    return outcome;
  } catch (error) {
    // A duplicate event ID means the event was committed previously.
    if (error.code === 11000) {
      const alreadyProcessed = await ProcessedEvent.exists({ eventId });

      if (alreadyProcessed) {
        return "DUPLICATE";
      }
    }

    throw error;
  } finally {
    await session.endSession();
  }
};