
import { clerkClient } from "@clerk/express";
import User from "../models/User.js";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const getOrCreateUser = async (clerkUserId) => {
  if (!clerkUserId || typeof clerkUserId !== "string" || !clerkUserId.trim()) {
    throw createError("Invalid Clerk user ID", 400);
  }

  const trimmedId = clerkUserId.trim();

  // 1. Check if user already exists in database
  let existingUser = await User.findOne({ clerkUserId: trimmedId });

  // Determine if profile needs retrieval from Clerk:
  // - If user does not exist in DB: definitely needs Clerk retrieval
  // - If user exists, but has missing/null email or missing names: needs Clerk retrieval to complete profile
  const isMissingCoreData =
    !existingUser ||
    existingUser.email === null ||
    existingUser.email === undefined ||
    !existingUser.firstName;

  let clerkUser = null;

  if (isMissingCoreData) {
    try {
      clerkUser = await clerkClient.users.getUser(trimmedId);
    } catch (clerkErr) {
      // Do NOT silently treat Clerk API failures as successful synchronization.
      // Do not create an incomplete profile with missing email when Clerk retrieval has failed.
      const status = clerkErr.status === 404 ? 404 : 502;
      const message =
        clerkErr.status === 404
          ? "User not found in Clerk"
          : `Clerk API failure during profile synchronization: ${clerkErr.message || "Unknown error"}`;
      const error = createError(message, status);
      error.code = clerkErr.status === 404 ? "CLERK_USER_NOT_FOUND" : "CLERK_API_ERROR";
      throw error;
    }

    if (!clerkUser || typeof clerkUser !== "object") {
      throw createError("Clerk API returned an invalid user response", 502);
    }
  }

  // Extract fields from Clerk safely
  let primaryEmail = null;
  let firstName = "";
  let lastName = "";
  let displayName = "";
  let imageUrl = null;

  if (clerkUser) {
    const emailAddresses = Array.isArray(clerkUser.emailAddresses)
      ? clerkUser.emailAddresses
      : [];
    const primary = emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    );
    const resolvedEmail =
      primary?.emailAddress || emailAddresses[0]?.emailAddress || null;
    primaryEmail =
      typeof resolvedEmail === "string"
        ? resolvedEmail.trim().toLowerCase()
        : null;

    firstName =
      typeof clerkUser.firstName === "string" ? clerkUser.firstName.trim() : "";
    lastName =
      typeof clerkUser.lastName === "string" ? clerkUser.lastName.trim() : "";
    displayName =
      [firstName, lastName].filter(Boolean).join(" ") ||
      (typeof clerkUser.username === "string" ? clerkUser.username.trim() : "") ||
      "";
    imageUrl = typeof clerkUser.imageUrl === "string" ? clerkUser.imageUrl : null;
  }

  // 2. If user does NOT exist: insert new record with Clerk data atomically
  if (!existingUser) {
    try {
      const newUser = await User.findOneAndUpdate(
        { clerkUserId: trimmedId },
        {
          $setOnInsert: {
            clerkUserId: trimmedId,
            firstName,
            lastName,
            displayName,
            email: primaryEmail,
            imageUrl,
            status: "ACTIVE",
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      );
      return newUser;
    } catch (dbErr) {
      // Handle concurrent race condition (E11000 duplicate key on clerkUserId)
      if (dbErr.code === 11000) {
        existingUser = await User.findOne({ clerkUserId: trimmedId });
        if (existingUser) return existingUser;
      }
      throw dbErr;
    }
  }

  // 3. If user ALREADY exists: complete missing fields while preserving existing valid profile data
  if (clerkUser) {
    const updates = {};

    // Only update if existing record lacks the field and Clerk provides a non-empty value
    if (
      (existingUser.email === null || existingUser.email === undefined) &&
      primaryEmail
    ) {
      updates.email = primaryEmail;
    }
    if (!existingUser.firstName && firstName) {
      updates.firstName = firstName;
    }
    if (!existingUser.lastName && lastName) {
      updates.lastName = lastName;
    }
    if (!existingUser.displayName && displayName) {
      updates.displayName = displayName;
    }
    if (!existingUser.imageUrl && imageUrl) {
      updates.imageUrl = imageUrl;
    }

    if (Object.keys(updates).length > 0) {
      const updatedUser = await User.findOneAndUpdate(
        { clerkUserId: trimmedId },
        { $set: updates },
        { new: true, runValidators: true }
      );
      return updatedUser || existingUser;
    }
  }

  return existingUser;
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
