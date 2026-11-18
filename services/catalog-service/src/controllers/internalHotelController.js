import mongoose from "mongoose";
import Hotel from "../models/Hotel.js";
import Room from "../models/Room.js";

/**
 * GET /internal/hotels/owner/:ownerId
 * Internal endpoint for inter-service communication (e.g. Booking Service).
 * Returns array of hotel IDs owned by the given ownerId.
 * Includes both ACTIVE and INACTIVE hotels to preserve historical metrics.
 * Excludes only hotels explicitly marked DELETING.
 */
export const getOwnerHotelsInternal = async (req, res, next) => {
  try {
    const { ownerId } = req.params;

    if (!ownerId || typeof ownerId !== "string" || !ownerId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Owner ID is required",
      });
    }

    const hotels = await Hotel.find({
      owner: ownerId.trim(),
      status: { $ne: "DELETING" },
    })
      .select("_id")
      .lean();

    const hotelIds = hotels.map((h) => h._id.toString());

    return res.status(200).json({
      success: true,
      hotelIds,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /internal/properties/:propertyId/booking-snapshot
 * Returns stay-details snapshot for Booking Service.
 * Includes exact coordinates, full street address, contact details, and room info.
 * Protected by authenticateInternalService (x-internal-service-key).
 */
export const getPropertyBookingSnapshotInternal = async (req, res, next) => {
  try {
    const { propertyId } = req.params;
    const { roomId } = req.query;

    if (!mongoose.isValidObjectId(propertyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID",
      });
    }

    const hotel = await Hotel.findById(propertyId).lean();
    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    let room = null;
    if (roomId && mongoose.isValidObjectId(roomId)) {
      room = await Room.findById(roomId).lean();
    }
    if (!room) {
      room = await Room.findOne({ hotel: propertyId, isActive: true }).lean();
    }

    const coordinates =
      hotel.latitude != null && hotel.longitude != null
        ? { lat: Number(hotel.latitude), lng: Number(hotel.longitude) }
        : null;

    const data = {
      propertyId: hotel._id.toString(),
      propertyName: hotel.name,
      address: hotel.address,
      area: hotel.area || null,
      city: hotel.city,
      contactPhone: hotel.contact || null,
      contactEmail: null,
      checkInTime: "14:00",
      checkOutTime: "11:00",
      coordinates,
      locationPrecision: hotel.locationPrecision || "exact",
      approximateRadiusMeters: hotel.locationPrecision === "approximate" ? 500 : null,
      roomCategoryId: room ? room._id.toString() : (roomId || null),
      roomTypeName: room ? room.roomType : "Standard Room",
      maxGuests: 2,
      bedConfiguration: null,
      mainPhoto: room?.images?.[0] || null,
    };

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};
