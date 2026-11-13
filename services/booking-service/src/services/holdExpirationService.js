
import mongoose from "mongoose";

import Booking from "../models/Booking.js";
import DailyInventory from "../models/DailyInventory.js";

import { getStayDates } from "../utils/dateUtils.js";
import { createBookingEvent } from "./bookingEventService.js";

const BATCH_SIZE = 50;

const EXPIRABLE_STATUSES = ["HELD", "PAYMENT_PENDING"];

export const expireBookingHold = async (bookingId) => {
  const session = await mongoose.startSession();

  try {
    let expired = false;

    await session.withTransaction(async () => {
      const now = new Date();

      // Conditional state transition prevents two workers from
      // releasing inventory for the same booking.
      const booking = await Booking.findOneAndUpdate(
        {
          _id: bookingId,
          status: { $in: EXPIRABLE_STATUSES },
          holdExpiresAt: { $lte: now },
        },
        {
          $set: {
            status: "EXPIRED",
          },
        },
        {
          session,
          returnDocument: "after",
        }
      );

      if (!booking) {
        expired = false;
        return;
      }

      const stayDates = getStayDates(
        booking.checkIn,
        booking.checkOut
      );

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
            `Inventory release failed for booking ${booking._id} on ${date.toISOString()}`
          );
        }
      }
            await createBookingEvent({
        booking,
        eventType: "BookingExpired",
        session,
      });

  
      expired = true;
    });

    return expired;
  } finally {
    await session.endSession();
  }
};

export const expireExpiredBookingHolds = async () => {
  const now = new Date();

  const expiredCandidates = await Booking.find({
    status: { $in: EXPIRABLE_STATUSES },
    holdExpiresAt: { $lte: now },
  })
    .select("_id")
    .sort({ holdExpiresAt: 1 })
    .limit(BATCH_SIZE)
    .lean();

  let expiredCount = 0;

  for (const candidate of expiredCandidates) {
    try {
      const expired = await expireBookingHold(candidate._id);

      if (expired) {
        expiredCount += 1;

        console.log(
          `Expired booking hold: ${candidate._id}`
        );
      }
    } catch (error) {
      console.error(
        `Failed to expire booking ${candidate._id}:`,
        error.message
      );
    }
  }

  return expiredCount;
};
