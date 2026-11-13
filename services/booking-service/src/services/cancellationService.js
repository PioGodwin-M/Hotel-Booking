import mongoose from "mongoose";

import Booking from "../models/Booking.js";
import DailyInventory from "../models/DailyInventory.js";

import { getStayDates } from "../utils/dateUtils.js";
import { createBookingEvent } from "./bookingEventService.js";

export const cancelBooking = async ({ bookingId, userId }) => {
  if (!mongoose.isValidObjectId(bookingId)) {
    const error = new Error("Invalid booking ID");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  if (!userId) {
    const error = new Error("Authentication is required");
    error.code = "UNAUTHENTICATED";
    throw error;
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      result = null;

      // Atomically transition only an owned, HELD booking.
      const booking = await Booking.findOneAndUpdate(
        {
          _id: bookingId,
          userId,
          status: "HELD",
        },
        {
          $set: {
            status: "CANCELLED",
            holdExpiresAt: null,
          },
        },
        {
          session,
          returnDocument: "after",
        }
      );

      if (!booking) {
        // Determine why the conditional transition did not happen.
        const existingBooking = await Booking.findOne({
          _id: bookingId,
          userId,
        }).session(session);

        if (!existingBooking) {
          const error = new Error("Booking not found");
          error.code = "BOOKING_NOT_FOUND";
          throw error;
        }

        if (existingBooking.status === "CANCELLED") {
          result = existingBooking;
          return;
        }

        if (existingBooking.status === "EXPIRED") {
          const error = new Error("This booking hold has already expired");
          error.code = "BOOKING_ALREADY_EXPIRED";
          throw error;
        }

        const error = new Error(
          `Booking cannot be cancelled in ${existingBooking.status} state`
        );
        error.code = "BOOKING_NOT_CANCELLABLE";
        throw error;
      }

      const stayDates = getStayDates(
        booking.checkIn,
        booking.checkOut
      );

      // Release held inventory for every night of the stay.
      for (const date of stayDates) {
        const inventoryUpdate = await DailyInventory.updateOne(
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
          
        if (inventoryUpdate.modifiedCount !== 1) {
          throw new Error(
            `Could not release inventory for booking ${booking._id} on ${date.toISOString()}`
          );
        }
      }
            // Persist BookingCancelled in the same transaction.
      await createBookingEvent({
        booking,
        eventType: "BookingCancelled",
        session,
      });
      result = booking;
    });

    return result;
  } finally {
    await session.endSession();
  }
};