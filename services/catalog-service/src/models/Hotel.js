import mongoose from "mongoose";

const hotelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Hotel name is required"],
      trim: true,
    },

    address: {
      type: String,
      required: [true, "Hotel address is required"],
      trim: true,
    },

    contact: {
      type: String,
      required: [true, "Contact number is required"],
      trim: true,
    },

    owner: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
      index: true,
    },
    
   status: {
  type: String,
  enum: ["ACTIVE", "INACTIVE", "DELETING"],
  default: "ACTIVE",
  index: true,
},

roomRevision: {
  type: Number,
  default: 0,
},
  },
  {
    timestamps: true,
  }
);

const Hotel = mongoose.model("Hotel", hotelSchema);

export default Hotel;