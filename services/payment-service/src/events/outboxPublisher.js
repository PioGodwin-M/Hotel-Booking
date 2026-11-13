
import { randomUUID } from "node:crypto";

import OutboxEvent from "../models/OutboxEvent.js";
import {
  publishPaymentEvent,
} from "./paymentEventPublisher.js";

const BATCH_SIZE = 20;
const LEASE_DURATION_MS = 60_000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS_DEFAULT = 10;

const workerId = randomUUID();

const calculateBackoff = (attempts) => {
  const exponentialDelay = Math.min(
    1000 * 2 ** Math.max(0, attempts - 1),
    MAX_BACKOFF_MS
  );

  return exponentialDelay + Math.floor(Math.random() * 500);
};

const claimNextEvent = async () => {
  const now = new Date();
  const leaseToken = randomUUID();

  const event = await OutboxEvent.findOneAndUpdate(
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
        lockedBy: workerId,
        lockedUntil: new Date(now.getTime() + LEASE_DURATION_MS),
        leaseToken,
      },
      $inc: {
        attempts: 1,
      },
    },
    {
      sort: { createdAt: 1 },
      returnDocument: "after",
    }
  );

  return event;
};

const hasValidLease = (event) => ({
  _id: event._id,
  status: "PENDING",
  lockedBy: workerId,
  leaseToken: event.leaseToken,
  lockedUntil: { $gt: new Date() },
});

const markPublished = async (event) => {
  const result = await OutboxEvent.updateOne(
    hasValidLease(event),
    {
      $set: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        lastError: null,
        lockedBy: null,
        lockedUntil: null,
        leaseToken: null,
      },
    }
  );

  if (result.modifiedCount !== 1) {
    throw new Error(
      `Lost lease while marking event ${event.eventId} as published`
    );
  }
};

const scheduleRetry = async (event, error) => {
  const maxAttempts = event.maxAttempts || MAX_ATTEMPTS_DEFAULT;
  const permanentlyFailed = event.attempts >= maxAttempts;

  const errorMessage = String(error.message || error).slice(0, 2000);

  const update = permanentlyFailed
    ? {
        $set: {
          status: "DEAD",
          deadAt: new Date(),
          lockedBy: null,
          lockedUntil: null,
          leaseToken: null,
          lastError: errorMessage,
        },
      }
    : {
        $set: {
          lockedBy: null,
          lockedUntil: null,
          leaseToken: null,
          nextAttemptAt: new Date(
            Date.now() + calculateBackoff(event.attempts)
          ),
          lastError: errorMessage,
        },
      };

  const result = await OutboxEvent.updateOne(
    hasValidLease(event),
    update
  );

  if (result.modifiedCount !== 1) {
    throw new Error(
      `Lost lease while scheduling retry for event ${event.eventId}`
    );
  }

  if (permanentlyFailed) {
    console.error(
      `Outbox event ${event.eventId} moved to DEAD status`
    );
  }
};

export const publishPendingOutboxEvents = async () => {
  let publishedCount = 0;

  for (let i = 0; i < BATCH_SIZE; i += 1) {
    const event = await claimNextEvent();

    if (!event) {
      break;
    }

    try {
      await publishPaymentEvent(event);
      await markPublished(event);

      publishedCount += 1;
    } catch (error) {
      console.error(
        `Failed to publish outbox event ${event.eventId}:`,
        error.message
      );

      try {
        await scheduleRetry(event, error);
      } catch (retryError) {
        console.error(
          `Failed to schedule retry for ${event.eventId}:`,
          retryError.message
        );
      }

      // Stop this batch if publication fails.
      break;
    }
  }

  return publishedCount;
};
