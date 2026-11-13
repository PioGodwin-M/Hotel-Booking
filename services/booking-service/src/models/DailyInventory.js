
import mongoose from "mongoose";

const dailyInventorySchema = new mongoose.Schema(
  {
    roomCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    // Start of the inventory date in UTC.
    date: {
      type: Date,
      required: true,
    },

    totalUnits: {
      type: Number,
      required: true,
      min: 1,
    },

    bookedUnits: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    heldUnits: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Exactly one inventory record per category per date.
dailyInventorySchema.index(
  { roomCategoryId: 1, date: 1 },
  { unique: true }
);

dailyInventorySchema.index({ date: 1 });

const DailyInventory = mongoose.model(
  "DailyInventory",
  dailyInventorySchema
);

export default DailyInventory;
