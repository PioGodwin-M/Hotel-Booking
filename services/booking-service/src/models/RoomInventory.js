
import mongoose from "mongoose";

const roomInventorySchema = new mongoose.Schema(
  {
    // ID of the Room category in Catalog Service.
    // This is an external service reference, not a Mongoose ref.
    roomCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    // ID of the Hotel in Catalog Service.
    hotelId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    // Total physical units in this room category.
    totalUnits: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Total units must be an integer",
      },
    },

    // Whether this category can accept new reservations.
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// One inventory record per Catalog room category.
roomInventorySchema.index(
  { roomCategoryId: 1 },
  { unique: true }
);

// Useful when retrieving inventory by hotel.
roomInventorySchema.index({ hotelId: 1 });

const RoomInventory = mongoose.model(
  "RoomInventory",
  roomInventorySchema
);

export default RoomInventory;
