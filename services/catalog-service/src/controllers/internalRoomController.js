
import mongoose from "mongoose";

import Room from "../models/Room.js";
import Hotel from "../models/Hotel.js";

export const getRoomPricing = async (req, res, next) => {
  try {
    const { roomId } = req.params;

    if (!mongoose.isValidObjectId(roomId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid room category ID",
      });
    }

    // Find an active room category.
    const room = await Room.findOne({
      _id: roomId,
      isActive: true,
    })
      .select("_id hotel roomType pricePerNight")
      .lean();

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room category not found or inactive",
      });
    }

    // Verify that its parent hotel is active.
    const hotel = await Hotel.findOne({
      _id: room.hotel,
      status: "ACTIVE",
    })
      .select("_id")
      .lean();

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: "Hotel is not available",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        roomCategoryId: room._id.toString(),
        hotelId: hotel._id.toString(),
        roomType: room.roomType,
        pricePerNight: room.pricePerNight,
        currency: "INR",
      },
    });

  } catch (error) {
    next(error);
  }
};
