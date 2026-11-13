
import { randomUUID } from "node:crypto";

import OutboxEvent from "../models/OutboxEvent.js";
import {
  publishBookingEvent,
  closeBookingOutboxPublisher,
} from "../events/bookingOutboxPublisher.js";

const BATCH_SIZE = 20;
const POLL_INTERVAL_MS = 5000;
const LEASE_DURATION_MS = 60000;
const MAX_RETRY_DELAY_MS = 300000;

const workerId = randomUUID();

let timer = null;
let currentExecution = null;
let started = false;
let stopping = false;

const claimNextEvent = async () => {
  const now = new Date();
  const leaseToken = randomUUID();

  return OutboxEvent.findOneAndUpdate(
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
        leaseToken,
        lockedUntil: new Date(
          now.getTime() + LEASE_DURATION_MS
        ),
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
};

const markPublished = async (event) => {
  const result = await OutboxEvent.updateOne(
    {
      _id: event._id,
      status: "PENDING",
      lockedBy: workerId,
      leaseToken: event.leaseToken,
      lockedUntil: { $gt: new Date() },
    },
    {
      $set: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        lastError: null,
      },
      $unset: {
        lockedBy: 1,
        leaseToken: 1,
        lockedUntil: 1,
      },
    }
  );

  if (result.modifiedCount !== 1) {
    throw new Error(
      `Lost outbox lease before marking event published: ${event.eventId}`
    );
  }
};

const scheduleRetry = async (event, error) => {
  const exhausted = event.attempts >= event.maxAttempts;

  const exponentialDelay = Math.min(
    1000 * 2 ** Math.min(event.attempts - 1, 8),
    MAX_RETRY_DELAY_MS
  );

  const jitter = Math.floor(Math.random() * 1000);

  const update = {
    $set: {
      status: exhausted ? "DEAD" : "PENDING",
      lastError: String(error.message || error).slice(0, 2000),
      nextAttemptAt: new Date(
        Date.now() + exponentialDelay + jitter
      ),
    },
    $unset: {
      lockedBy: 1,
      leaseToken: 1,
      lockedUntil: 1,
    },
  };

  if (exhausted) {
    update.$set.deadAt = new Date();
  }

  const result = await OutboxEvent.updateOne(
    {
      _id: event._id,
      status: "PENDING",
      lockedBy: workerId,
      leaseToken: event.leaseToken,
      lockedUntil: { $gt: new Date() },
    },
    update
  );

  if (result.modifiedCount !== 1) {
    console.error(
      `Could not update retry state for event ${event.eventId}; lease may have expired`
    );
  }

  if (exhausted) {
    console.error(
      `Booking outbox event moved to DEAD: ${event.eventId}`
    );
  }
};

const processEvent = async (event) => {
  try {
    await publishBookingEvent(event);
    await markPublished(event);

    console.log(
      `Booking event published: ${event.eventType} (${event.eventId})`
    );
  } catch (error) {
    console.error(
      `Booking event publishing failed: ${event.eventId}`,
      error.message
    );

    await scheduleRetry(event, error);
  }
};

const processBatch = async () => {
  for (let i = 0; i < BATCH_SIZE; i += 1) {
    if (stopping) return;

    const event = await claimNextEvent();

    if (!event) return;

    await processEvent(event);
  }
};

const runWorker = async () => {
  if (currentExecution || stopping) return;

  currentExecution = processBatch()
    .catch((error) => {
      console.error("Booking outbox worker error:", error);
    })
    .finally(() => {
      currentExecution = null;
    });

  await currentExecution;
};

export const startBookingOutboxWorker = async () => {
  if (started) return;

  started = true;
  stopping = false;

  console.log("Booking outbox worker started");

  await runWorker();

  if (!stopping) {
    timer = setInterval(() => {
      void runWorker();
    }, POLL_INTERVAL_MS);
  }
};

export const stopBookingOutboxWorker = async () => {
  if (!started) return;

  stopping = true;
  started = false;

  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  if (currentExecution) {
    await currentExecution;
  }

  await closeBookingOutboxPublisher();

  console.log("Booking outbox worker stopped");
};
