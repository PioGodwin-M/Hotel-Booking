import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
    },

    roomType: {
      type: String,
      required: [true, "Room type is required"],
      trim: true,
    },

    pricePerNight: {
      type: Number,
      required: [true, "Price per night is required"],
      min: [0, "Price cannot be negative"],
    },

    amenities: {
      type: [String],
      required: true,
      default: [],
    },

    images: {
      type: [String],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    totalUnits: {
  type: Number,
  required: true,
  min: 1,
  validate: {
    validator: Number.isInteger,
    message: "Total units must be an integer",
  },
},
  },
  {
    timestamps: true,
  }
);

// Frequently used catalog query.
roomSchema.index({ hotel: 1, isActive: 1 });

const Room = mongoose.model("Room", roomSchema);

export default Room;