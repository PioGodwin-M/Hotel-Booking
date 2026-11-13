import mongoose from "mongoose";

import Booking from "../models/Booking.js";
import DailyInventory from "../models/DailyInventory.js";

import { getStayDates } from "../utils/dateUtils.js";

const validateIdentifiers = ({ bookingId, paymentId }) => {
  if (!mongoose.isValidObjectId(bookingId)) {
    const error = new Error("Invalid booking ID");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  if (
    typeof paymentId !== "string" ||
    paymentId.trim().length === 0 ||
    paymentId.length > 256
  ) {
    const error = new Error("A valid payment ID is required");
    error.code = "VALIDATION_ERROR";
    throw error;
  }
};

const getBookingOrThrow = async (bookingId, session) => {
  const booking = await Booking.findById(bookingId).session(session);

  if (!booking) {
    const error = new Error("Booking not found");
    error.code = "BOOKING_NOT_FOUND";
    throw error;
  }

  return booking;
};

const assertMatchingPayment = (booking, paymentId) => {
  if (booking.paymentId !== paymentId) {
    const error = new Error(
      "Payment ID does not match the booking's payment attempt"
    );
    error.code = "PAYMENT_ID_MISMATCH";
    throw error;
  }
};

const assertBookingOwner = (booking, userId) => {
  if (!userId || booking.userId !== userId) {
    // Do not reveal whether another customer's booking exists.
    const error = new Error("Booking not found");
    error.code = "BOOKING_NOT_FOUND";
    throw error;
  }
};

// HELD -> PAYMENT_PENDING
export const markBookingPaymentPending = async ({
  bookingId,
  paymentId,
  userId,
}) => {
  validateIdentifiers({ bookingId, paymentId });

  if (typeof userId !== "string" || !userId.trim()) {
    const error = new Error("Authenticated user is required");
    error.code = "UNAUTHENTICATED";
    throw error;
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      result = null;

      const booking = await getBookingOrThrow(bookingId, session);

      // Ownership must be checked before any state transition.
      assertBookingOwner(booking, userId);

      // Idempotent retry of the same payment initiation.
      if (booking.status === "PAYMENT_PENDING") {
  assertMatchingPayment(booking, paymentId);
  result = booking;
  return;
}

if (booking.status === "CONFIRMED") {
  assertMatchingPayment(booking, paymentId);
  result = booking;
  return;
}

      if (booking.status !== "HELD") {
        const error = new Error(
          `Cannot initiate payment for booking in ${booking.status} state`
        );
        error.code = "BOOKING_NOT_PAYABLE";
        throw error;
      }

      const now = new Date();

      if (!booking.holdExpiresAt || booking.holdExpiresAt <= now) {
        const error = new Error("Booking hold has expired");
        error.code = "BOOKING_ALREADY_EXPIRED";
        throw error;
      }

      const updatedBooking = await Booking.findOneAndUpdate(
        {
          _id: bookingId,
          userId,
          status: "HELD",
          holdExpiresAt: { $gt: now },
        },
        {
          $set: {
            status: "PAYMENT_PENDING",
            paymentId,
          },
        },
        {
          session,
          returnDocument: "after",
        }
      );

      if (!updatedBooking) {
        const error = new Error(
          "Booking is no longer eligible for payment"
        );
        error.code = "BOOKING_NOT_PAYABLE";
        throw error;
      }

      result = updatedBooking;
    });

    return result;
  } finally {
    await session.endSession();
  }
};

// PAYMENT_PENDING -> CONFIRMED
export const confirmBookingPayment = async ({
  bookingId,
  paymentId,
}) => {
  validateIdentifiers({ bookingId, paymentId });

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      result = null;

      const booking = await getBookingOrThrow(bookingId, session);

      if (booking.status === "CONFIRMED") {
        assertMatchingPayment(booking, paymentId);
        result = booking;
        return;
      }

      if (booking.status !== "PAYMENT_PENDING") {
        const error = new Error(
          `Cannot confirm payment for booking in ${booking.status} state`
        );
        error.code = "BOOKING_NOT_PAYMENT_PENDING";
        throw error;
      }

      assertMatchingPayment(booking, paymentId);

      const updatedBooking = await Booking.findOneAndUpdate(
        {
          _id: bookingId,
          status: "PAYMENT_PENDING",
          paymentId,
        },
        {
          $set: {
            status: "CONFIRMED",
            holdExpiresAt: null,
          },
        },
        {
          session,
          returnDocument: "after",
        }
      );

      if (!updatedBooking) {
        const error = new Error(
          "Booking payment state changed unexpectedly"
        );
        error.code = "BOOKING_STATE_CONFLICT";
        throw error;
      }

      const stayDates = getStayDates(
        booking.checkIn,
        booking.checkOut
      );

      for (const date of stayDates) {
        const inventoryUpdate = await DailyInventory.updateOne(
          {
            roomCategoryId: booking.roomCategoryId,
            date,
            heldUnits: { $gte: booking.numberOfRooms },
          },
          {
            $inc: {
              heldUnits: -booking.numberOfRooms,
              bookedUnits: booking.numberOfRooms,
            },
          },
          { session }
        );

        if (inventoryUpdate.modifiedCount !== 1) {
          throw new Error(
            `Could not confirm inventory for booking ${booking._id} on ${date.toISOString()}`
          );
        }
      }

      result = updatedBooking;
    });

    return result;
  } finally {
    await session.endSession();
  }
};

// PAYMENT_PENDING -> PAYMENT_FAILED
export const failBookingPayment = async ({
  bookingId,
  paymentId,
}) => {
  validateIdentifiers({ bookingId, paymentId });

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      result = null;

      const booking = await getBookingOrThrow(bookingId, session);

      if (booking.status === "PAYMENT_FAILED") {
        assertMatchingPayment(booking, paymentId);
        result = booking;
        return;
      }

      if (booking.status !== "PAYMENT_PENDING") {
        const error = new Error(
          `Cannot fail payment for booking in ${booking.status} state`
        );
        error.code = "BOOKING_NOT_PAYMENT_PENDING";
        throw error;
      }

      assertMatchingPayment(booking, paymentId);

      const updatedBooking = await Booking.findOneAndUpdate(
        {
          _id: bookingId,
          status: "PAYMENT_PENDING",
          paymentId,
        },
        {
          $set: {
            status: "PAYMENT_FAILED",
            holdExpiresAt: null,
          },
        },
        {
          session,
          returnDocument: "after",
        }
      );

      if (!updatedBooking) {
        const error = new Error(
          "Booking payment state changed unexpectedly"
        );
        error.code = "BOOKING_STATE_CONFLICT";
        throw error;
      }

      const stayDates = getStayDates(
        booking.checkIn,
        booking.checkOut
      );

      for (const date of stayDates) {
        const inventoryUpdate = await DailyInventory.updateOne(
          {
            roomCategoryId: booking.roomCategoryId,
            date,
            heldUnits: { $gte: booking.numberOfRooms },
          },
          {
            $inc: {
              heldUnits: -booking.numberOfRooms,
            },
          },
          { session }
        );

        if (inventoryUpdate.modifiedCount !== 1) {
          throw new Error(
            `Could not release inventory for booking ${booking._id} on ${date.toISOString()}`
          );
        }
      }

      result = updatedBooking;
    });

    return result;
  } finally {
    await session.endSession();
  }
};