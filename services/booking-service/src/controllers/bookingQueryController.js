import { getAuth } from "@clerk/express";

import {
  getUserBookings,
  getBookingById,
} from "../services/bookingQueryService.js";

const handleQueryError = (error, res, next) => {
  const errorResponses = {
    UNAUTHENTICATED: {
      status: 401,
      message: error.message,
    },
    VALIDATION_ERROR: {
      status: 400,
      message: error.message,
    },
    BOOKING_NOT_FOUND: {
      status: 404,
      message: "Booking not found",
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
};

export const getUserBookingsController = async (req, res, next) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const page = req.query.page === undefined
      ? 1
      : Number(req.query.page);

    const limit = req.query.limit === undefined
      ? 10
      : Number(req.query.limit);

    const status = req.query.status;

    const result = await getUserBookings({
      userId,
      page,
      limit,
      status,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return handleQueryError(error, res, next);
  }
};

export const getBookingByIdController = async (req, res, next) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const booking = await getBookingById({
      bookingId: req.params.bookingId,
      userId,
    });

    return res.status(200).json({
      success: true,
      booking,
    });
  } catch (error) {
    return handleQueryError(error, res, next);
  }
};