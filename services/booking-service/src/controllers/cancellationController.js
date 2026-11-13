import { getAuth } from "@clerk/express";

import { cancelBooking } from "../services/cancellationService.js";

export const cancelBookingController = async (req, res, next) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const booking = await cancelBooking({
      bookingId: req.params.bookingId,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      booking,
    });
  } catch (error) {
    const errorResponses = {
      VALIDATION_ERROR: {
        status: 400,
        message: error.message,
      },
      UNAUTHENTICATED: {
        status: 401,
        message: error.message,
      },
      BOOKING_NOT_FOUND: {
        status: 404,
        message: error.message,
      },
      BOOKING_ALREADY_EXPIRED: {
        status: 409,
        message: error.message,
      },
      BOOKING_NOT_CANCELLABLE: {
        status: 409,
        message: error.message,
      },
    };

    const mappedError = errorResponses[error.code];

    if (mappedError) {
      return res.status(mappedError.status).json({
        success: false,
        message: mappedError.message,
      });
    }

    return next(error);
  }
};