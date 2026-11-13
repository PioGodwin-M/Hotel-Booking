import { getAuth } from "@clerk/express";
import { createBooking } from "../services/bookingService.js";

export const createBookingController = async (req, res, next) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const {
      hotelId,
      roomCategoryId,
      checkIn,
      checkOut,
      numberOfRooms,
      numberOfGuests,
      idempotencyKey,
    } = req.body;

    const booking = await createBooking({
      userId,
      hotelId,
      roomCategoryId,
      checkIn,
      checkOut,
      numberOfRooms,
      numberOfGuests,
      idempotencyKey,
    });

    return res.status(201).json({
      success: true,
      message: "Booking hold created successfully",
      booking,
    });
  } catch (error) {
    const errorResponses = {
      UNAUTHENTICATED: {
        status: 401,
        message: "Authentication required",
      },
      VALIDATION_ERROR: {
        status: 400,
        message: error.message,
      },
      IDEMPOTENCY_KEY_REUSED: {
        status: 409,
        message: error.message,
      },
      INSUFFICIENT_INVENTORY: {
        status: 409,
        message: "Insufficient room inventory for the selected dates",
      },
      ROOM_CATEGORY_NOT_AVAILABLE: {
        status: 404,
        message: "Room category is not available for this hotel",
      },
      CATALOG_SERVICE_UNAVAILABLE: {
        status: 503,
        message: "Catalog Service is temporarily unavailable",
      },
      CATALOG_SERVICE_ERROR: {
        status: 502,
        message: "Catalog Service returned an invalid response",
      },
      INVALID_CATALOG_PRICE: {
        status: 502,
        message: "Catalog returned an unsupported room price",
      },
      INVALID_BOOKING_AMOUNT: {
        status: 400,
        message: "Booking amount exceeds supported limits",
      },
    };

    const mappedError = errorResponses[error.code];

    if (mappedError) {
      return res.status(mappedError.status).json({
        success: false,
        message: mappedError.message,
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A booking with this request already exists",
      });
    }

    return next(error);
  }
};