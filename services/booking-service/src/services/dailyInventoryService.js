
import mongoose from "mongoose";

import DailyInventory from "../models/DailyInventory.js";
import RoomInventory from "../models/RoomInventory.js";

import { getStayDates } from "../utils/dateUtils.js";

// Ensure daily inventory exists for the requested stay.
export const initializeDailyInventory = async ({
  roomCategoryId,
  checkIn,
  checkOut,
  session,
}) => {
  if (!mongoose.isValidObjectId(roomCategoryId)) {
    throw new Error("Invalid room category ID");
  }

  // 1. Retrieve the room category's inventory configuration.
  const roomInventory = await RoomInventory.findOne({
    roomCategoryId,
    isActive: true,
  }).session(session);

  if (!roomInventory) {
    throw new Error(
      "Room category inventory not found or inactive"
    );
  }

  // 2. Generate all dates in the requested stay.
  const stayDates = getStayDates(checkIn, checkOut);

  // 3. Create missing daily records.
  const operations = stayDates.map((date) => ({
    updateOne: {
      filter: {
        roomCategoryId,
        date,
      },
      update: {
        $setOnInsert: {
          roomCategoryId,
          date,
          totalUnits: roomInventory.totalUnits,
          bookedUnits: 0,
          heldUnits: 0,
        },
      },
      upsert: true,
    },
  }));

  if (operations.length > 0) {
    await DailyInventory.bulkWrite(
      operations,
      {
        session,
        ordered: true,
      }
    );
  }

  return {
    roomCategoryId,
    datesInitialized: stayDates.length,
  };
};