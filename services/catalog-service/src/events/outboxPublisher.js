
import amqp from "amqplib";
import { randomUUID } from "node:crypto";

import OutboxEvent from "../models/OutboxEvent.js";

const EXCHANGE_NAME = "hotel.events";
const ROUTING_KEY = "catalog.room-category.created";

const BATCH_SIZE = 20;
const CLAIM_DURATION = 30000;
const MAX_BACKOFF = 300000;

// Unique identity for this publisher process.
const WORKER_ID = randomUUID();

let connection;
let channel;

const connectRabbitMQ = async () => {
  if (channel) return channel;

  const url = process.env.RABBITMQ_URL;

  if (!url) {
    throw new Error("RABBITMQ_URL is not configured");
  }

  connection = await amqp.connect(url);

  connection.on("close", () => {
    connection = null;
    channel = null;

    console.error("RabbitMQ connection closed");
  });

  connection.on("error", (error) => {
    console.error(
      "RabbitMQ connection error:",
      error.message
    );
  });

  channel = await connection.createConfirmChannel();

  await channel.assertExchange(EXCHANGE_NAME, "topic", {
    durable: true,
  });

  console.log(
    "Catalog Outbox Publisher connected to RabbitMQ"
  );

  return channel;
};

// Atomically claim one pending event.
// Only one publisher can successfully claim a particular event.
const claimNextEvent = async () => {
  const now = new Date();

  const claimedEvent = await OutboxEvent.findOneAndUpdate(
    {
      status: "PENDING",
      nextAttemptAt: { $lte: now },

      $or: [
        { lockedUntil: null },
        { lockedUntil: { $exists: false } },
        { lockedUntil: { $lte: now } },
      ],
    },
    {
      $set: {
        lockedBy: WORKER_ID,
        lockedUntil: new Date(
          now.getTime() + CLAIM_DURATION
        ),
      },
    },
    {
      sort: { createdAt: 1 },
      returnDocument: "after",
    }
  );

  return claimedEvent;
};

// Publish one event and wait for RabbitMQ confirmation.
// mandatory:true lets us detect an unroutable message.
const publishAndConfirm = async (event) => {
  const publisherChannel = await connectRabbitMQ();

  const message = {
    eventId: event.eventId,
    eventType: event.eventType,
    schemaVersion: 1,
    occurredAt: event.createdAt,
    payload: event.payload,
  };

  return new Promise((resolve, reject) => {
    let returned = false;

    const onReturn = (returnedMessage) => {
      if (
        returnedMessage.properties.messageId ===
        event.eventId
      ) {
        returned = true;
      }
    };

    publisherChannel.on("return", onReturn);

    try {
      publisherChannel.publish(
        EXCHANGE_NAME,
        ROUTING_KEY,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
          mandatory: true,
          contentType: "application/json",
          messageId: event.eventId,
        },
        (error) => {
          publisherChannel.off("return", onReturn);

          if (error) {
            reject(error);
            return;
          }

          if (returned) {
            reject(
              new Error(
                `Event ${event.eventId} was not routed to a queue`
              )
            );
            return;
          }

          resolve();
        }
      );
    } catch (error) {
      publisherChannel.off("return", onReturn);
      reject(error);
    }
  });
};

// Mark an event published only if this worker still owns it.
const markAsPublished = async (event) => {
  const result = await OutboxEvent.updateOne(
    {
      _id: event._id,
      status: "PENDING",
      lockedBy: WORKER_ID,
    },
    {
      $set: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        lastError: null,
        lockedBy: null,
        lockedUntil: null,
      },
      $inc: {
        attempts: 1,
      },
    }
  );

  if (result.modifiedCount !== 1) {
    throw new Error(
      `Could not mark event ${event.eventId} as published`
    );
  }
};

// Release an event after a failure and schedule a retry.
const releaseAfterFailure = async (event, error) => {
  const nextAttempts = event.attempts + 1;

  const backoff = Math.min(
    1000 * Math.pow(2, event.attempts),
    MAX_BACKOFF
  );

  await OutboxEvent.updateOne(
    {
      _id: event._id,
      status: "PENDING",
      lockedBy: WORKER_ID,
    },
    {
      $set: {
        lockedBy: null,
        lockedUntil: null,
        lastError: error.message,
        nextAttemptAt: new Date(
          Date.now() + backoff
        ),
      },
      $inc: {
        attempts: 1,
      },
    }
  );

  console.error(
    `Event ${event.eventId} failed. Attempt ${nextAttempts}.`,
    error.message
  );
};

// Main outbox publishing operation.
export const publishPendingEvents = async () => {
  await connectRabbitMQ();

  for (let i = 0; i < BATCH_SIZE; i++) {
    const event = await claimNextEvent();

    if (!event) {
      break;
    }

    try {
      await publishAndConfirm(event);

      await markAsPublished(event);

      console.log(
        `Published event: ${event.eventId}`
      );

    } catch (error) {
      await releaseAfterFailure(event, error);
    }
  }
};

// Close RabbitMQ resources.
export const closeRabbitMQ = async () => {
  const currentChannel = channel;
  const currentConnection = connection;

  channel = null;
  connection = null;

  if (currentChannel) {
    await currentChannel.close();
  }

  if (currentConnection) {
    await currentConnection.close();
  }
};
