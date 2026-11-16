
import { randomUUID, timingSafeEqual } from "node:crypto";

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

/**
 * Classifies a dead outbox event's failure reason to verify if it is safely recoverable.
 */
export const classifyDeadBookingEvent = (event) => {
  const errorStr = String(event.lastError || "").toLowerCase();

  const isFatalDataError =
    errorStr.includes("validationerror") ||
    errorStr.includes("schema") ||
    errorStr.includes("casterror") ||
    errorStr.includes("syntaxerror") ||
    errorStr.includes("malformed");

  if (isFatalDataError) {
    return {
      isRecoverable: false,
      classification: "FATAL_DATA_ERROR",
      reason: "Payload or schema error cannot be resolved by redrive without code fix",
    };
  }

  const isInfraError =
    errorStr.includes("unroutable_return") ||
    errorStr.includes("econnrefused") ||
    errorStr.includes("etimedout") ||
    errorStr.includes("socket closed") ||
    errorStr.includes("channel closed") ||
    errorStr.includes("connection closed");

  return {
    isRecoverable: true,
    classification: isInfraError ? "RECOVERABLE_INFRASTRUCTURE" : "TRANSIENT_FAILURE",
    reason: "Transient infrastructure or delivery failure eligible for audited redrive",
  };
};

/**
 * Operator-controlled and audited redrive mechanism for DEAD outbox events.
 *
 * Invariants:
 * 1. Requires verified operator identity validated against OPERATOR_ADMIN_KEY via constant-time check.
 * 2. Arbitrary caller-supplied strings without genuine operator authentication are rejected.
 * 3. Requires explicit eventIds array and reason.
 * 4. Classifies failure before redriving; skips unrecoverable data errors.
 * 5. Atomically transitions DEAD -> PENDING, resets attempts to 0, clears deadAt.
 * 6. Persists verified operator identity, reason, and timestamp in redriveAudit array.
 */
export const redriveDeadBookingOutboxEvents = async ({
  eventIds,
  operatorIdentity,
  reason,
}) => {
  const configuredAdminKey = process.env.OPERATOR_ADMIN_KEY;
  const suppliedKey = operatorIdentity?.operatorKey;

  if (
    !configuredAdminKey ||
    !suppliedKey ||
    typeof suppliedKey !== "string"
  ) {
    const error = new Error("Operator administrative authorization required for DEAD event redrive");
    error.code = "UNAUTHORIZED_OPERATOR";
    error.statusCode = 403;
    throw error;
  }

  const expectedBuf = Buffer.from(configuredAdminKey);
  const suppliedBuf = Buffer.from(suppliedKey);

  if (
    expectedBuf.length !== suppliedBuf.length ||
    !timingSafeEqual(expectedBuf, suppliedBuf)
  ) {
    const error = new Error("Invalid operator administrative credentials");
    error.code = "UNAUTHORIZED_OPERATOR";
    error.statusCode = 403;
    throw error;
  }

  const operatorId = operatorIdentity?.operatorId;
  if (!operatorId || typeof operatorId !== "string" || operatorId.trim().length < 3) {
    const error = new Error("A verified operator identifier is required");
    error.code = "INVALID_OPERATOR_IDENTITY";
    error.statusCode = 400;
    throw error;
  }

  if (typeof reason !== "string" || reason.trim().length < 5) {
    const error = new Error("A valid operator reason is required for audited redrive");
    error.code = "INVALID_REDRIVE_REASON";
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(eventIds) || eventIds.length === 0) {
    const error = new Error("Explicit eventIds array is required for audited redrive");
    error.code = "INVALID_EVENT_IDS";
    error.statusCode = 400;
    throw error;
  }

  const deadEvents = await OutboxEvent.find({
    status: "DEAD",
    eventId: { $in: eventIds },
  });

  const recoverableIds = [];
  const skipped = [];

  for (const event of deadEvents) {
    const classification = classifyDeadBookingEvent(event);
    if (classification.isRecoverable) {
      recoverableIds.push(event._id);
    } else {
      skipped.push({
        eventId: event.eventId,
        classification: classification.classification,
        reason: classification.reason,
      });
    }
  }

  if (recoverableIds.length > 0) {
    await OutboxEvent.updateMany(
      {
        _id: { $in: recoverableIds },
        status: "DEAD",
      },
      {
        $set: {
          status: "PENDING",
          attempts: 0,
          nextAttemptAt: new Date(),
          deadAt: null,
          lockedBy: null,
          lockedUntil: null,
          leaseToken: null,
          lastError: null,
        },
        $push: {
          redriveAudit: {
            operatorId: operatorId.trim(),
            role: operatorIdentity?.role || "ADMIN",
            reason: reason.trim(),
            redrivenAt: new Date(),
          },
        },
      }
    );
  }

  return {
    verifiedOperator: {
      operatorId: operatorId.trim(),
      role: operatorIdentity?.role || "ADMIN",
    },
    requestedCount: eventIds.length,
    foundDeadCount: deadEvents.length,
    redrivenCount: recoverableIds.length,
    skippedCount: skipped.length,
    skipped,
  };
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
