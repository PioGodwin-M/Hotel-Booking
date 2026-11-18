import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import { getPropertyBookingSnapshot } from "./catalogClient.js";
import { getPaymentSummaryByBooking } from "./paymentClient.js";
import { serializeBookingDetail } from "../serializers/bookingDetailSerializer.js";

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
  // Returns 404 BOOKING_NOT_FOUND if the booking doesn't exist OR isn't owned by this user.
  const booking = await Booking.findOne({
    _id: bookingId,
    userId,
  }).lean();

  if (!booking) {
    const error = new Error("Booking not found");
    error.code = "BOOKING_NOT_FOUND";
    throw error;
  }

  // Lazy snapshot fill: if the booking does not yet have stayDetails, fetch and cache it (Round 4g B4)
  if (!booking.stayDetails || !booking.stayDetails.propertyName) {
    try {
      const snapshot = await getPropertyBookingSnapshot(
        booking.hotelId?.toString(),
        booking.roomCategoryId?.toString()
      );
      if (snapshot) {
        await Booking.updateOne(
          { _id: booking._id },
          { $set: { stayDetails: snapshot } }
        );
        booking.stayDetails = snapshot;
      }
    } catch (err) {
      console.warn(`[getBookingById] Non-fatal error lazy-filling stayDetails: ${err.message}`);
    }
  }

  // Best-effort payment summary from Payment Service (Round 4g B5)
  let paymentSummary = null;
  try {
    paymentSummary = await getPaymentSummaryByBooking(booking._id.toString());
  } catch (err) {
    console.warn(`[getBookingById] Non-fatal error retrieving payment summary: ${err.message}`);
  }

  // Serialize and enforce privacy gate (Round 4g B1, B2)
  return serializeBookingDetail(booking, paymentSummary);
};