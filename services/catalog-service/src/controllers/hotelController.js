
import mongoose from "mongoose";
import Hotel from "../models/Hotel.js";
import Room from "../models/Room.js";
// Register a new hotel for the authenticated owner
export const registerHotel = async (req, res, next) => {
  try {
    const { name, address, contact, city } = req.body;

    // Validate required fields
    if (
      !name?.trim() ||
      !address?.trim() ||
      !contact?.trim() ||
      !city?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, address, contact and city are required",
      });
    }

    // Owner identity must come from verified authentication
    const ownerId = req.user.id;

    const hotel = await Hotel.create({
      name: name.trim(),
      address: address.trim(),
      contact: contact.trim(),
      city: city.trim(),
      owner: ownerId,
    });

    return res.status(201).json({
      success: true,
      message: "Hotel registered successfully",
      hotel,
    });
  } catch (error) {
    next(error);
  }
};

// Get all hotels belonging to the authenticated owner
export const getOwnerHotels = async (req, res, next) => {
  try {
    const ownerId = req.user.id;

    const hotels = await Hotel.find({
      owner: ownerId,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: hotels.length,
      hotels,
    });
  } catch (error) {
    next(error);
  }
};


// Delete a hotel only if it belongs to the authenticated owner

export const deleteHotel = async (req, res, next) => {
  const { hotelId } = req.params;

  if (!mongoose.isValidObjectId(hotelId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid hotel ID",
    });
  }

  const session = await mongoose.startSession();

  let deletedRoomCount = 0;
  let hotelFound = false;

  try {
    await session.withTransaction(async () => {
      // 1. Atomically transition ACTIVE -> DELETING.
      const hotel = await Hotel.findOneAndUpdate(
        {
          _id: hotelId,
          owner: req.user.id,
          status: "ACTIVE",
        },
        {
          $set: { status: "DELETING" },
          $inc: { roomRevision: 1 },
        },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        }
      );

      if (!hotel) {
        return;
      }
      

      hotelFound = true;

      // 2. Delete all rooms belonging to the hotel.
      const roomResult = await Room.deleteMany(
        { hotel: hotel._id },
        { session }
      );

      deletedRoomCount = roomResult.deletedCount;

      // 3. Delete the hotel itself.
      const hotelResult = await Hotel.deleteOne(
        {
          _id: hotel._id,
          owner: req.user.id,
          status: "DELETING",
        },
        { session }
      );

      if (hotelResult.deletedCount !== 1) {
        throw new Error("HOTEL_DELETION_FAILED");
      }
    });

    if (!hotelFound) {
      return res.status(404).json({
        success: false,
        message: "Hotel not found or is not active",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Hotel and associated rooms deleted successfully",
      deletedRooms: deletedRoomCount,
    });

  } catch (error) {
    return next(error);

  } finally {
    await session.endSession();
  }
};
