
import mongoose from "mongoose";

import DailyInventory from "../models/DailyInventory.js";

import {
  getStayDates,
} from "../utils/dateUtils.js";

import {
  initializeDailyInventory,
} from "./dailyInventoryService.js";

// Atomically hold inventory for every night in a stay.
export const reserveInventory = async ({
  roomCategoryId,
  checkIn,
  checkOut,
  requestedRooms,
  session,
}) => {

  if (!session) {
    throw new Error(
      "A MongoDB transaction session is required"
    );
  }

  if (!mongoose.isValidObjectId(roomCategoryId)) {
    throw new Error("Invalid room category ID");
  }

  if (
    !Number.isInteger(requestedRooms) ||
    requestedRooms < 1
  ) {
    throw new Error(
      "Requested rooms must be a positive integer"
    );
  }

  // 1. Ensure daily inventory exists.
  await initializeDailyInventory({
    roomCategoryId,
    checkIn,
    checkOut,
    session,
  });

  // 2. Generate every night of the stay.
  const stayDates = getStayDates(checkIn, checkOut);

  // 3. Reserve inventory for each night.
  for (const date of stayDates) {

    const result = await DailyInventory.updateOne(
      {
        roomCategoryId,
        date,

        // Reserve only if enough inventory remains.
        $expr: {
          $lte: [
            {
              $add: [
                "$bookedUnits",
                "$heldUnits",
              ],
            },
            {
              $subtract: [
                "$totalUnits",
                requestedRooms,
              ],
            },
          ],
        },
      },
      {
        $inc: {
          heldUnits: requestedRooms,
        },
      },
      {
        session,
      }
    );

    // If one night cannot be reserved,
    // abort the entire stay reservation.
    if (result.modifiedCount !== 1) {
      const error = new Error(
        "INSUFFICIENT_INVENTORY"
      );

      error.code = "INSUFFICIENT_INVENTORY";

      throw error;
    }
  }

  return {
    roomCategoryId,
    requestedRooms,
    reservedDates: stayDates,
    status: "HELD",
  };
};
