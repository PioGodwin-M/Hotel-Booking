import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import Hotel from "../models/Hotel.js";
import Room from "../models/Room.js";
import OutboxEvent from "../models/OutboxEvent.js";
import {
  serializePublicRoom,
  serializePublicRoomList,
} from "../serializers/propertyLocationSerializer.js";

// Create a room under a hotel owned by the authenticated user


export const createRoom = async (req, res, next) => {
  const {
    hotelId,
    roomType,
    pricePerNight,
    totalUnits,
    amenities = [],
    images = [],
  } = req.body;

  // 1. Validate hotel ID
  if (!mongoose.isValidObjectId(hotelId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid hotel ID",
    });
  }

  // 2. Validate room type
  if (
    !roomType ||
    typeof roomType !== "string" ||
    !roomType.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: "Room type is required",
    });
  }

  // 3. Validate price
  if (
    !Number.isFinite(pricePerNight) ||
    pricePerNight <= 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Price per night must be a positive number",
    });
  }

  // 4. Validate arrays
  if (!Array.isArray(amenities) || !Array.isArray(images)) {
    return res.status(400).json({
      success: false,
      message: "Amenities and images must be arrays",
    });
  }

  // 5. Validate total units
  if (!Number.isInteger(totalUnits) || totalUnits < 1) {
    return res.status(400).json({
      success: false,
      message: "Total units must be a positive integer",
    });
  }

  // Generate once, outside the transaction callback.
  // MongoDB may retry the transaction callback.
  const eventId = randomUUID();

  const session = await mongoose.startSession();

  let createdRoom;

  try {
    await session.withTransaction(async () => {

      // Operation 1: Verify hotel ownership and increment revision.
      const hotel = await Hotel.findOneAndUpdate(
        {
          _id: hotelId,
          owner: req.user.id,
          status: "ACTIVE",
        },
        {
          $inc: { roomRevision: 1 },
        },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        }
      );

      if (!hotel) {
        const error = new Error("HOTEL_NOT_AVAILABLE");
        error.code = "HOTEL_NOT_AVAILABLE";
        throw error;
      }

      // Operation 2: Create room category.
      const [room] = await Room.create(
        [
          {
            hotel: hotel._id,
            roomType: roomType.trim(),
            pricePerNight,
            totalUnits,
            amenities,
            images,
          },
        ],
        { session }
      );

      createdRoom = room;

      // Operation 3: Save event in the same transaction.
      await OutboxEvent.create(
        [
          {
            eventId,
            eventType: "RoomCategoryCreated",
            aggregateType: "Room",
            aggregateId: room._id.toString(),

            payload: {
              roomCategoryId: room._id.toString(),
              hotelId: hotel._id.toString(),
              totalUnits: room.totalUnits,
            },

            status: "PENDING",
          },
        ],
        { session }
      );
    });

    // All three operations have committed.
    return res.status(201).json({
      success: true,
      message: "Room created successfully",
      room: createdRoom,
    });

  } catch (error) {
    if (error.code === "HOTEL_NOT_AVAILABLE") {
      return res.status(404).json({
        success: false,
        message: "Hotel not found or is not active",
      });
    }

    return next(error);

  } finally {
    await session.endSession();
  }
};




// Get active rooms belonging to a hotel
export const getHotelRooms = async (req, res, next) => {
  try {
    const { hotelId } = req.params;

    // 1. Validate MongoDB ObjectId
    if (!mongoose.isValidObjectId(hotelId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid hotel ID",
      });
    }

    // 2. Verify hotel ownership
    const hotel = await Hotel.findOne({
      _id: hotelId,
      owner: req.user.id,
      status: "ACTIVE",
    });

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: "Hotel not found",
      });
    }

    // 3. Retrieve active rooms belonging to this hotel
    const rooms = await Room.find({
      hotel: hotel._id,
      isActive: true,
    }).sort({ createdAt: -1 });

    // 4. Return results
    return res.status(200).json({
      success: true,
      hotelId: hotel._id,
      count: rooms.length,
      rooms,
    });
  } catch (error) {
    next(error);
  }
};


export const updateRoom = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { roomType, pricePerNight, amenities, images } = req.body;

    // 1. Validate room ID
    if (!mongoose.isValidObjectId(roomId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid room ID",
      });
    }

    // 2. Find the room
    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    // 3. Verify ownership of the parent hotel
    const hotel = await Hotel.findOne({
      _id: room.hotel,
      owner: req.user.id,
    });

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    // 4. Validate supplied fields
    const updates = {};

    if (roomType !== undefined) {
      if (typeof roomType !== "string" || !roomType.trim()) {
        return res.status(400).json({
          success: false,
          message: "Room type must be a non-empty string",
        });
      }

      updates.roomType = roomType.trim();
    }

    if (pricePerNight !== undefined) {
      const price = Number(pricePerNight);

      if (!Number.isFinite(price) || price <= 0) {
        return res.status(400).json({
          success: false,
          message: "Price must be a positive number",
        });
      }

      updates.pricePerNight = price;
    }

    if (amenities !== undefined) {
      if (
        !Array.isArray(amenities) ||
        !amenities.every(
          (item) => typeof item === "string" && item.trim()
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Amenities must be an array of non-empty strings",
        });
      }

      updates.amenities = amenities.map((item) => item.trim());
    }

    if (images !== undefined) {
      if (
        !Array.isArray(images) ||
        !images.every(
          (item) => typeof item === "string" && item.trim()
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Images must be an array of non-empty strings",
        });
      }

      updates.images = images.map((item) => item.trim());
    }

    // 5. Update only explicitly allowed fields
    const updatedRoom = await Room.findByIdAndUpdate(
      roomId,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Room updated successfully",
      room: updatedRoom,
    });
  } catch (error) {
    next(error);
  }
};


export const updateRoomStatus = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { isActive } = req.body;

    // 1. Validate room ID
    if (!mongoose.isValidObjectId(roomId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid room ID",
      });
    }

    // 2. Validate status
    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean",
      });
    }

    // 3. Find the room
    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    // 4. Verify ownership of the parent hotel
    const hotel = await Hotel.findOne({
      _id: room.hotel,
      owner: req.user.id,
    });

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    // 5. Update room status
    const updatedRoom = await Room.findByIdAndUpdate(
      roomId,
      {
        $set: { isActive },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    return res.status(200).json({
      success: true,
      message: `Room ${isActive ? "activated" : "deactivated"} successfully`,
      room: updatedRoom,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/rooms
 * Public customer discovery: list active rooms belonging to active hotels.
 * Optional query: ?city=...
 */
export const getPublicRooms = async (req, res, next) => {
  try {
    const { city } = req.query;

    // 1. Find all hotels with ACTIVE status (optionally filtered by city)
    const hotelFilter = { status: "ACTIVE" };
    if (city && typeof city === "string" && city.trim()) {
      hotelFilter.city = new RegExp(city.trim(), "i");
    }

    const activeHotels = await Hotel.find(hotelFilter).select("_id").lean();
    const activeHotelIds = activeHotels.map((h) => h._id);

    if (activeHotelIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        rooms: [],
      });
    }

    // 2. Find active rooms belonging to active hotels
    const rooms = await Room.find({
      hotel: { $in: activeHotelIds },
      isActive: true,
    })
      .populate("hotel", "_id name address contact city area status latitude longitude locationPrecision")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: rooms.length,
      rooms: serializePublicRoomList(rooms),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/rooms/:roomId
 * Public customer discovery: retrieve an individual active room with hotel metadata.
 */
export const getPublicRoomById = async (req, res, next) => {
  try {
    const { roomId } = req.params;

    // 1. Validate ObjectId
    if (!mongoose.isValidObjectId(roomId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid room ID",
      });
    }

    // 2. Find room with active status and populated hotel
    const room = await Room.findOne({
      _id: roomId,
      isActive: true,
    })
      .populate("hotel", "_id name address contact city area status latitude longitude locationPrecision")
      .lean();

    // 3. Verify room exists and parent hotel is active
    if (!room || !room.hotel || room.hotel.status !== "ACTIVE") {
      return res.status(404).json({
        success: false,
        message: "Room not found or unavailable",
      });
    }

    return res.status(200).json({
      success: true,
      room: serializePublicRoom(room),
    });
  } catch (error) {
    next(error);
  }
};
