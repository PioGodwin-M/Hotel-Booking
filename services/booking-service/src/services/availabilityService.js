
import mongoose from "mongoose";

import DailyInventory from "../models/DailyInventory.js";

import {
  getStayDates,
} from "../utils/dateUtils.js";

import {
  initializeDailyInventory,
} from "./dailyInventoryService.js";

// Calculate room availability for a complete stay.
export const checkAvailability = async ({
  roomCategoryId,
  checkIn,
  checkOut,
  requestedRooms = 1,
  session,
}) => {

  // 1. Validate category ID.
  if (!mongoose.isValidObjectId(roomCategoryId)) {
    throw new Error("Invalid room category ID");
  }

  // 2. Validate requested room count.
  if (
    !Number.isInteger(requestedRooms) ||
    requestedRooms < 1
  ) {
    throw new Error(
      "Requested rooms must be a positive integer"
    );
  }

  // 3. Initialize missing daily inventory.
  await initializeDailyInventory({
    roomCategoryId,
    checkIn,
    checkOut,
    session,
  });

  // 4. Generate all dates in the stay.
  const stayDates = getStayDates(checkIn, checkOut);

  // 5. Retrieve daily inventory records.
  const inventoryRecords = await DailyInventory.find({
    roomCategoryId,
    date: { $in: stayDates },
  })
    .sort({ date: 1 })
    .session(session);

  // 6. Ensure every requested night has a record.
  if (inventoryRecords.length !== stayDates.length) {
    throw new Error(
      "Daily inventory initialization incomplete"
    );
  }

  // 7. Calculate availability for each night.
  const dailyAvailability = inventoryRecords.map(
    (inventory) => {
      const availableUnits =
        inventory.totalUnits -
        inventory.bookedUnits -
        inventory.heldUnits;

      return {
        date: inventory.date,
        totalUnits: inventory.totalUnits,
        bookedUnits: inventory.bookedUnits,
        heldUnits: inventory.heldUnits,
        availableUnits,
      };
    }
  );

  // 8. The entire stay must accommodate the request.
  const minimumAvailableRooms = Math.min(
    ...dailyAvailability.map(
      (day) => day.availableUnits
    )
  );

  return {
    roomCategoryId,
    checkIn: stayDates[0],
    checkOut,
    requestedRooms,
    availableRooms: minimumAvailableRooms,
    isAvailable:
      minimumAvailableRooms >= requestedRooms,
    dailyAvailability,
  };
};
