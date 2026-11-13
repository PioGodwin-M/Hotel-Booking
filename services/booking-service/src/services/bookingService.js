import mongoose from "mongoose";
import { createHash } from "node:crypto";

import Booking from "../models/Booking.js";
import RoomInventory from "../models/RoomInventory.js";

import { normalizeDate, calculateNights } from "../utils/dateUtils.js";
import { reserveInventory } from "./reservationService.js";
import { getRoomPricing } from "./catalogClient.js";


const HOLD_DURATION_MS = 10 * 60 * 1000;

const createRequestFingerprint = ({
  hotelId,
  roomCategoryId,
  checkIn,
  checkOut,
  numberOfRooms,
  numberOfGuests,
}) => {
  const canonicalRequest = JSON.stringify({
    hotelId: hotelId.toString(),
    roomCategoryId: roomCategoryId.toString(),
    checkIn: checkIn.toISOString(),
    checkOut: checkOut.toISOString(),
    numberOfRooms,
    numberOfGuests,
  });

  return createHash("sha256")
    .update(canonicalRequest)
    .digest("hex");
};

const getExistingBooking = async (userId, idempotencyKey, fingerprint) => {
  const existingBooking = await Booking.findOne({
    userId,
    idempotencyKey,
  });

  if (!existingBooking) {
    return null;
  }

  if (existingBooking.requestFingerprint !== fingerprint) {
    const error = new Error(
      "Idempotency key has already been used with a different request"
    );
    error.code = "IDEMPOTENCY_KEY_REUSED";
    throw error;
  }

  return existingBooking;
};

const calculatePriceSnapshot = (pricing, numberOfNights, numberOfRooms) => {
  const pricePerNight = pricing.pricePerNight;
  const pricePerNightMinor = Math.round(pricePerNight * 100);

  // INR is represented here using two decimal places (paise).
  if (
    !Number.isSafeInteger(pricePerNightMinor) ||
    Math.abs(pricePerNight - pricePerNightMinor / 100) > 1e-8
  ) {
    const error = new Error("Room price has an unsupported precision");
    error.code = "INVALID_CATALOG_PRICE";
    throw error;
  }

  const totalAmountMinor =
    pricePerNightMinor * numberOfNights * numberOfRooms;

  if (!Number.isSafeInteger(totalAmountMinor)) {
    const error = new Error("Booking amount exceeds supported limits");
    error.code = "INVALID_BOOKING_AMOUNT";
    throw error;
  }

  return {
    pricePerNight: pricePerNightMinor / 100,
    numberOfNights,
    totalAmount: totalAmountMinor / 100,
    currency: pricing.currency,
  };
};

export const createBooking = async ({
  userId,
  hotelId,
  roomCategoryId,
  checkIn,
  checkOut,
  numberOfRooms,
  numberOfGuests,
  idempotencyKey,
}) => {
  // 1. Validate required input.
  if (!userId) {
    const error = new Error("User authentication is required");
    error.code = "UNAUTHENTICATED";
    throw error;
  }

  if (
    !mongoose.isValidObjectId(hotelId) ||
    !mongoose.isValidObjectId(roomCategoryId)
  ) {
    const error = new Error("Invalid hotel ID or room category ID");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  if (
    !Number.isInteger(numberOfRooms) ||
    numberOfRooms < 1 ||
    !Number.isInteger(numberOfGuests) ||
    numberOfGuests < 1
  ) {
    const error = new Error(
      "Number of rooms and guests must be positive integers"
    );
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.trim().length === 0 ||
    idempotencyKey.length > 128
  ) {
    const error = new Error("A valid idempotency key is required");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  // 2. Normalize dates and calculate the stay duration.
  let normalizedCheckIn;
  let normalizedCheckOut;
  let numberOfNights;

  try {
    normalizedCheckIn = normalizeDate(checkIn);
    normalizedCheckOut = normalizeDate(checkOut);

    numberOfNights = calculateNights(
      normalizedCheckIn,
      normalizedCheckOut
    );
  } catch {
    const error = new Error("Invalid check-in or check-out dates");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  if (
    normalizedCheckIn.getTime() <=
    normalizeDate(new Date()).getTime()
  ) {
    const error = new Error("Check-in must be a future date");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  // 3. Generate a stable fingerprint for this exact request.
  const fingerprint = createRequestFingerprint({
    hotelId,
    roomCategoryId,
    checkIn: normalizedCheckIn,
    checkOut: normalizedCheckOut,
    numberOfRooms,
    numberOfGuests,
  });

  // 4. Return the original booking if this exact request already exists.
  const existingBooking = await getExistingBooking(
    userId,
    idempotencyKey,
    fingerprint
  );

  if (existingBooking) {
    return existingBooking;
  }

  // 5. Get the authoritative room price from Catalog Service.
  // Never make an HTTP request from inside the MongoDB transaction.
  const pricing = await getRoomPricing(roomCategoryId);

  if (pricing.roomCategoryId !== roomCategoryId.toString()) {
    const error = new Error("Catalog returned a different room category");
    error.code = "CATALOG_SERVICE_ERROR";
    throw error;
  }

  if (pricing.hotelId !== hotelId.toString()) {
    const error = new Error("Room category does not belong to this hotel");
    error.code = "ROOM_CATEGORY_NOT_AVAILABLE";
    throw error;
  }

  const priceSnapshot = calculatePriceSnapshot(
    pricing,
    numberOfNights,
    numberOfRooms
  );

  // 6. Create the booking and reserve inventory atomically.
  const session = await mongoose.startSession();

  let createdBooking;

  try {
    await session.withTransaction(async () => {
      // Reset this variable because the transaction callback may be retried.
      createdBooking = null;

      const roomInventory = await RoomInventory.findOne({
        roomCategoryId,
        hotelId,
        isActive: true,
      }).session(session);

      if (!roomInventory) {
        const error = new Error("Room category is not available");
        error.code = "ROOM_CATEGORY_NOT_AVAILABLE";
        throw error;
      }

      await reserveInventory({
        roomCategoryId,
        checkIn: normalizedCheckIn,
        checkOut: normalizedCheckOut,
        requestedRooms: numberOfRooms,
        session,
      });

      const holdExpiresAt = new Date(
        Date.now() + HOLD_DURATION_MS
      );

      const bookings = await Booking.create(
        [
          {
            userId,
            hotelId,
            roomCategoryId,
            checkIn: normalizedCheckIn,
            checkOut: normalizedCheckOut,
            numberOfRooms,
            numberOfGuests,
            priceSnapshot,
            status: "HELD",
            holdExpiresAt,
            idempotencyKey,
            requestFingerprint: fingerprint,
          },
        ],
        { session }
      );

      createdBooking = bookings[0];
    });
  } catch (error) {
    // A concurrent request may have committed the same idempotency key.
    if (error.code === 11000) {
      const duplicateBooking = await getExistingBooking(
        userId,
        idempotencyKey,
        fingerprint
      );

      if (duplicateBooking) {
        return duplicateBooking;
      }
    }

    throw error;
  } finally {
    await session.endSession();
  }

  return createdBooking;
};