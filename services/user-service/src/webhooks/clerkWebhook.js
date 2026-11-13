
import { Webhook } from "svix";
import mongoose from "mongoose";

import User from "../models/User.js";
import ClerkWebhookEvent from "../models/ClerkWebhookEvent.js";

const getPrimaryEmail = (data) => {
  const emailAddresses = data.email_addresses || [];

  const primaryEmail = emailAddresses.find(
    (item) => item.id === data.primary_email_address_id
  );

  return (
    primaryEmail?.email_address ||
    emailAddresses[0]?.email_address ||
    null
  );
};

const getPrimaryPhone = (data) => {
  const phoneNumbers = data.phone_numbers || [];

  const primaryPhone = phoneNumbers.find(
    (item) => item.id === data.primary_phone_number_id
  );

  return (
    primaryPhone?.phone_number ||
    phoneNumbers[0]?.phone_number ||
    null
  );
};

const syncClerkUser = async (data, session) => {
  const clerkUserId = data.id;

  if (!clerkUserId) {
    throw new Error("Clerk user ID missing from webhook");
  }

  const email = getPrimaryEmail(data);
  const phoneNumber = getPrimaryPhone(data);

  await User.findOneAndUpdate(
    { clerkUserId },
    {
      $set: {
        firstName: data.first_name || "",
        lastName: data.last_name || "",
        email,
        phoneNumber,
        imageUrl: data.image_url || null,
        status: "ACTIVE",
        deletedAt: null,
      },
      $setOnInsert: {
        clerkUserId,
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
      session,
    }
  );
};

export const handleClerkWebhook = async (req, res, next) => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return res.status(503).json({
      success: false,
      message: "Clerk webhook is not configured",
    });
  }

  const headers = {
    "svix-id": req.get("svix-id"),
    "svix-timestamp": req.get("svix-timestamp"),
    "svix-signature": req.get("svix-signature"),
  };

  let event;

  try {
    const webhook = new Webhook(webhookSecret);

    event = webhook.verify(req.body, headers);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Invalid Clerk webhook signature",
    });
  }

  const eventId = headers["svix-id"];
  const eventType = event.type;
  const data = event.data;

  if (!eventId || !eventType || !data) {
    return res.status(400).json({
      success: false,
      message: "Invalid Clerk webhook payload",
    });
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      await ClerkWebhookEvent.create(
        [
          {
            eventId,
            eventType,
          },
        ],
        { session }
      );

      if (
        eventType === "user.created" ||
        eventType === "user.updated"
      ) {
        await syncClerkUser(data, session);
      }

      if (eventType === "user.deleted") {
        await User.updateOne(
          { clerkUserId: data.id },
          {
            $set: {
              status: "DELETED",
              deletedAt: new Date(),
            },
          },
          { session }
        );
      }
    });

    return res.status(200).json({
      success: true,
      message: "Clerk webhook processed",
    });
  } catch (error) {
    if (error.code === 11000) {
      const alreadyProcessed =
        await ClerkWebhookEvent.exists({ eventId });

      if (alreadyProcessed) {
        return res.status(200).json({
          success: true,
          message: "Webhook already processed",
        });
      }
    }

    next(error);
  } finally {
    await session.endSession();
  }
};
