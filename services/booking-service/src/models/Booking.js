import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },

    hotelId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    roomCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    checkIn: {
      type: Date,
      required: true,
    },

    checkOut: {
      type: Date,
      required: true,
    },

    numberOfRooms: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Number of rooms must be an integer",
      },
    },

    numberOfGuests: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Number of guests must be an integer",
      },
    },

    priceSnapshot: {
      pricePerNight: {
        type: Number,
        required: true,
        min: 0,
      },

      numberOfNights: {
        type: Number,
        required: true,
        min: 1,
      },

      totalAmount: {
        type: Number,
        required: true,
        min: 0,
      },

      currency: {
        type: String,
        required: true,
        default: "INR",
      },
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "HELD",
        "PAYMENT_PENDING",
        "CONFIRMED",
        "CANCELLED",
        "EXPIRED",
        "PAYMENT_FAILED",
      ],
      default: "PENDING",
      index: true,
    },

    holdExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },

    idempotencyKey: {
      type: String,
      required: true,
    },

    requestFingerprint: {
      type: String,
      required: true,
    },

    paymentId: {
      type: String,
      default: null,
      index: true,
    },

    paymentAttemptCount: {
      type: Number,
      default: 1,
      min: 1,
    },

    stayDetails: {
      propertyId: { type: String, default: null },
      propertyName: { type: String, default: null },
      address: { type: String, default: null },
      area: { type: String, default: null },
      city: { type: String, default: null },
      contactPhone: { type: String, default: null },
      contactEmail: { type: String, default: null },
      checkInTime: { type: String, default: "14:00" },
      checkOutTime: { type: String, default: "11:00" },
      roomCategoryId: { type: String, default: null },
      roomTypeName: { type: String, default: null },
      maxGuests: { type: Number, default: 2 },
      bedConfiguration: { type: String, default: null },
      mainPhoto: { type: String, default: null },
      coordinates: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
      locationPrecision: {
        type: String,
        enum: ["exact", "approximate"],
        default: "exact",
      },
      approximateRadiusMeters: { type: Number, default: null },
    },
  },
  { timestamps: true }
);

bookingSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true }
);

bookingSchema.index({ userId: 1, createdAt: -1 });

bookingSchema.index({
  roomCategoryId: 1,
  checkIn: 1,
  checkOut: 1,
});

bookingSchema.index({
  status: 1,
  holdExpiresAt: 1,
});

// Compound index for owner dashboard queries and aggregations
bookingSchema.index({ hotelId: 1, createdAt: -1 });

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;