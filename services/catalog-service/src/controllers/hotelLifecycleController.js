
import mongoose from "mongoose";
import Hotel from "../models/Hotel.js";

export const updateHotelStatus = async (req, res, next) => {
  const { hotelId } = req.params;
  const { status } = req.body;

  try {
    // 1. Validate hotel ID
    if (!mongoose.isValidObjectId(hotelId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid hotel ID",
      });
    }

    // 2. Only allow owner-controlled transitions.
    const allowedStatuses = ["ACTIVE", "INACTIVE"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be ACTIVE or INACTIVE",
      });
    }

    // 3. Update only a hotel belonging to this owner.
    // The shared document write coordinates with room creation.
    const hotel = await Hotel.findOneAndUpdate(
      {
        _id: hotelId,
        owner: req.user.id,
        status: { $in: ["ACTIVE", "INACTIVE"] },
      },
      {
        $set: { status },
        $inc: { roomRevision: 1 },
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: "Hotel not found or deletion is in progress",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Hotel status updated to ${status}`,
      hotel,
    });

  } catch (error) {
    return next(error);
  }
};
