import mongoose from "mongoose";
import Booking from "../models/Booking.js";

const ALLOWED_STATUSES = [
  "PENDING",
  "HELD",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "CANCELLED",
  "EXPIRED",
  "PAYMENT_FAILED",
];

export const getUserBookings = async ({
  userId,
  page = 1,
  limit = 10,
  status,
}) => {
  if (!userId) {
    const error = new Error("Authentication is required");
    error.code = "UNAUTHENTICATED";
    throw error;
  }

  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1
  ) {
    const error = new Error("Page and limit must be positive integers");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  // Prevent excessively large database queries.
  const pageSize = Math.min(limit, 50);

  const filter = { userId };

  if (status !== undefined) {
    if (!ALLOWED_STATUSES.includes(status)) {
      const error = new Error("Invalid booking status filter");
      error.code = "VALIDATION_ERROR";
      throw error;
    }

    filter.status = status;
  }

  const [bookings, totalBookings] = await Promise.all([
    Booking.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),

    Booking.countDocuments(filter),
  ]);

  return {
    bookings,
    pagination: {
      page,
      limit: pageSize,
      totalBookings,
      totalPages: Math.ceil(totalBookings / pageSize),
      hasNextPage: page * pageSize < totalBookings,
      hasPreviousPage: page > 1,
    },
  };
};

export const getBookingById = async ({ bookingId, userId }) => {
  if (!userId) {
    const error = new Error("Authentication is required");
    error.code = "UNAUTHENTICATED";
    throw error;
  }

  if (!mongoose.isValidObjectId(bookingId)) {
    const error = new Error("Invalid booking ID");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  // Ownership is part of the query, not a separate client-side check.
  const booking = await Booking.findOne({
    _id: bookingId,
    userId,
  }).lean();

  if (!booking) {
    const error = new Error("Booking not found");
    error.code = "BOOKING_NOT_FOUND";
    throw error;
  }

  return booking;
};