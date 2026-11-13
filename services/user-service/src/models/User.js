
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    clerkUserId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
    },

    firstName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    lastName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    displayName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 150,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },

    phoneNumber: {
      type: String,
      trim: true,
      default: null,
    },

    imageUrl: {
      type: String,
      default: null,
    },

    preferences: {
      currency: {
        type: String,
        default: "INR",
        uppercase: true,
      },

      language: {
        type: String,
        default: "en",
      },

      marketingEmails: {
        type: Boolean,
        default: false,
      },
    },

    status: {
      type: String,
      enum: ["ACTIVE", "DEACTIVATED", "DELETED"],
      default: "ACTIVE",
      required: true,
    },

    deactivatedAt: {
      type: Date,
      default: null,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

userSchema.index({ status: 1 });

const User = mongoose.model("User", userSchema);

export default User;
