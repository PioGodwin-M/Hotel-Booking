
import { randomUUID, timingSafeEqual } from "node:crypto";

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
  const isUnroutable = error?.code === "UNROUTABLE_RETURN";

  if (isUnroutable) {
    console.error(
      `[ALERT] RabbitMQ Unroutable Message: Event ${event.eventId} (${error.routingKey || event.payload?.routingKey}) was returned with no matching consumer queue! Keeping event PENDING with extended retry backoff.`
    );
  }

  const maxAttempts = event.maxAttempts || MAX_ATTEMPTS_DEFAULT;
  const permanentlyFailed = !isUnroutable && event.attempts >= maxAttempts;

  const errorMessage = String(error.message || error).slice(0, 2000);

  const nextDelay = isUnroutable
    ? Math.min(30000 * Math.max(1, event.attempts), 300000)
    : calculateBackoff(event.attempts);

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
          nextAttemptAt: new Date(Date.now() + nextDelay),
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

/**
 * Classifies a dead outbox event's failure reason to verify if it is safely recoverable.
 */
export const classifyDeadEvent = (event) => {
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
export const redriveDeadOutboxEvents = async ({
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
    const classification = classifyDeadEvent(event);
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
