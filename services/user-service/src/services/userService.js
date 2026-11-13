
import User from "../models/User.js";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const getOrCreateUser = async (clerkUserId) => {
  if (!clerkUserId) {
    throw createError("Invalid Clerk user ID", 400);
  }

  const user = await User.findOneAndUpdate(
    { clerkUserId },
    {
      $setOnInsert: {
        clerkUserId,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  return user;
};

export const getUserProfile = async (clerkUserId) => {
  const user = await User.findOne({ clerkUserId });

  if (!user || user.status !== "ACTIVE") {
    throw createError("User profile not found", 404);
  }

  return user;
};

export const updateUserProfile = async (
  clerkUserId,
  updates
) => {
  const allowedFields = ["displayName"];

  const updateData = {};

  for (const field of allowedFields) {
    if (Object.hasOwn(updates, field)) {
      if (typeof updates[field] !== "string") {
        throw createError(`${field} must be a string`, 400);
      }

      const value = updates[field].trim();

      if (!value || value.length > 150) {
        throw createError(
          "Display name must contain 1–150 characters",
          400
        );
      }

      updateData[field] = value;
    }
  }

  if (Object.hasOwn(updates, "preferences")) {
    const preferences = updates.preferences;

    if (
      !preferences ||
      typeof preferences !== "object" ||
      Array.isArray(preferences)
    ) {
      throw createError("Invalid preferences object", 400);
    }

    const allowedPreferences = [
      "currency",
      "language",
      "marketingEmails",
    ];

    for (const key of Object.keys(preferences)) {
      if (!allowedPreferences.includes(key)) {
        throw createError(
          `Unsupported preference: ${key}`,
          400
        );
      }
    }

    if (Object.hasOwn(preferences, "currency")) {
      const currency = preferences.currency;

      if (
        typeof currency !== "string" ||
        !/^[A-Za-z]{3}$/.test(currency)
      ) {
        throw createError("Invalid currency", 400);
      }

      updateData["preferences.currency"] =
        currency.toUpperCase();
    }

    if (Object.hasOwn(preferences, "language")) {
      const language = preferences.language;

      if (
        typeof language !== "string" ||
        !/^[a-zA-Z-]{2,10}$/.test(language)
      ) {
        throw createError("Invalid language", 400);
      }

      updateData["preferences.language"] = language;
    }

    if (Object.hasOwn(preferences, "marketingEmails")) {
      if (typeof preferences.marketingEmails !== "boolean") {
        throw createError(
          "marketingEmails must be a boolean",
          400
        );
      }

      updateData["preferences.marketingEmails"] =
        preferences.marketingEmails;
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw createError("No valid profile updates provided", 400);
  }

  const user = await User.findOneAndUpdate(
    {
      clerkUserId,
      status: "ACTIVE",
    },
    {
      $set: updateData,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!user) {
    throw createError("Active user profile not found", 404);
  }

  return user;
};

export const deactivateUser = async (clerkUserId) => {
  const user = await User.findOneAndUpdate(
    {
      clerkUserId,
      status: "ACTIVE",
    },
    {
      $set: {
        status: "DEACTIVATED",
        deactivatedAt: new Date(),
      },
    },
    {
      new: true,
    }
  );

  if (!user) {
    throw createError("Active user profile not found", 404);
  }

  return user;
};

export const getInternalUser = async (clerkUserId) => {
  const user = await User.findOne({
    clerkUserId,
    status: "ACTIVE",
  }).select(
    "clerkUserId firstName lastName displayName email phoneNumber imageUrl status"
  );

  if (!user) {
    throw createError("User not found", 404);
  }

  return user;
};
