import mongoose from "mongoose";
import Hotel from "../models/Hotel.js";
import Room from "../models/Room.js";
import { validateLocationInput } from "../utils/locationValidator.js";
import {
  serializeOwnerHotel,
  serializePublicHotel,
} from "../serializers/propertyLocationSerializer.js";

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

    // Validate optional location fields
    const locationValidation = validateLocationInput(req.body);
    if (!locationValidation.valid) {
      return res.status(400).json({
        success: false,
        message: locationValidation.error,
      });
    }

    // Owner identity must come from verified authentication
    const ownerId = req.user.id;

    const hotelData = {
      name: name.trim(),
      address: address.trim(),
      contact: contact.trim(),
      city: city.trim(),
      owner: ownerId,
    };

    if (locationValidation.data.latitude !== undefined) {
      hotelData.latitude = locationValidation.data.latitude;
      hotelData.longitude = locationValidation.data.longitude;
    }

    if (locationValidation.data.locationPrecision !== undefined) {
      hotelData.locationPrecision = locationValidation.data.locationPrecision;
    }

    if (req.body.area !== undefined) {
      hotelData.area = typeof req.body.area === "string" ? req.body.area.trim() : null;
    }

    const hotel = await Hotel.create(hotelData);

    return res.status(201).json({
      success: true,
      message: "Hotel registered successfully",
      hotel: serializeOwnerHotel(hotel),
    });
  } catch (error) {
    next(error);
  }
};

// Update an existing hotel for the authenticated owner
export const updateHotel = async (req, res, next) => {
  try {
    const { hotelId } = req.params;

    if (!mongoose.isValidObjectId(hotelId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid hotel ID",
      });
    }

    const hotel = await Hotel.findById(hotelId);
    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: "Hotel not found",
      });
    }

    // Verify ownership
    if (hotel.owner !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not own this hotel",
      });
    }

    // Validate location inputs
    const locationValidation = validateLocationInput(req.body);
    if (!locationValidation.valid) {
      return res.status(400).json({
        success: false,
        message: locationValidation.error,
      });
    }

    const updates = {};

    if (req.body.name !== undefined) {
      if (typeof req.body.name !== "string" || !req.body.name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Hotel name must be a non-empty string",
        });
      }
      updates.name = req.body.name.trim();
    }

    if (req.body.address !== undefined) {
      if (typeof req.body.address !== "string" || !req.body.address.trim()) {
        return res.status(400).json({
          success: false,
          message: "Hotel address must be a non-empty string",
        });
      }
      updates.address = req.body.address.trim();
    }

    if (req.body.contact !== undefined) {
      if (typeof req.body.contact !== "string" || !req.body.contact.trim()) {
        return res.status(400).json({
          success: false,
          message: "Contact number must be a non-empty string",
        });
      }
      updates.contact = req.body.contact.trim();
    }

    if (req.body.city !== undefined) {
      if (typeof req.body.city !== "string" || !req.body.city.trim()) {
        return res.status(400).json({
          success: false,
          message: "City must be a non-empty string",
        });
      }
      updates.city = req.body.city.trim();
    }

    if (locationValidation.data.latitude !== undefined) {
      updates.latitude = locationValidation.data.latitude;
      updates.longitude = locationValidation.data.longitude;
    }

    if (locationValidation.data.locationPrecision !== undefined) {
      updates.locationPrecision = locationValidation.data.locationPrecision;
    }

    if (req.body.area !== undefined) {
      updates.area = typeof req.body.area === "string" ? req.body.area.trim() : null;
    }

    const updatedHotel = await Hotel.findByIdAndUpdate(
      hotelId,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Hotel updated successfully",
      hotel: serializeOwnerHotel(updatedHotel),
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
      hotels: hotels.map(serializeOwnerHotel),
    });
  } catch (error) {
    next(error);
  }
};

// Get a single public hotel by ID (canonical guest-facing contract)
export const getPublicHotelById = async (req, res, next) => {
  try {
    const { hotelId } = req.params;

    if (!mongoose.isValidObjectId(hotelId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid hotel ID",
      });
    }

    const hotel = await Hotel.findOne({
      _id: hotelId,
      status: "ACTIVE",
    }).lean();

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: "Hotel not found or unavailable",
      });
    }

    return res.status(200).json({
      success: true,
      hotel: serializePublicHotel(hotel),
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
