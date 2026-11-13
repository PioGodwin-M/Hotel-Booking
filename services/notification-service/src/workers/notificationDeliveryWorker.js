
import { randomUUID } from "node:crypto";

import Notification from "../models/Notification.js";
import { sendEmail } from "../services/emailService.js";
import { getBookingEmailTemplate } from "../templates/bookingEmailTemplates.js";

const POLL_INTERVAL_MS = 5000;
const LEASE_DURATION_MS = 60000;
const LEASE_RENEW_INTERVAL_MS = 20000;
const MAX_RETRY_DELAY_MS = 300000;
const BATCH_SIZE = 10;

const workerId = randomUUID();

let intervalId = null;
let currentExecution = null;
let isStopping = false;

const calculateRetryDelay = (attempts) => {
  const exponentialDelay = Math.min(
    1000 * 2 ** Math.max(0, attempts - 1),
    MAX_RETRY_DELAY_MS
  );

  const jitter = Math.floor(Math.random() * 1000);

  return exponentialDelay + jitter;
};

const claimNotification = async () => {
  const now = new Date();
  const leaseToken = randomUUID();

  return Notification.findOneAndUpdate(
    {
      $or: [
        {
          status: "PENDING",
          nextAttemptAt: { $lte: now },
        },
        {
          status: "PROCESSING",
          lockedUntil: { $lte: now },
        },
      ],
    },
    {
      $set: {
        status: "PROCESSING",
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
      sort: { nextAttemptAt: 1, createdAt: 1 },
      returnDocument: "after",
    }
  );
};

/**
 * Extend the lease only if this worker still owns it.
 * A stale worker cannot renew another worker's lease.
 */
const renewNotificationLease = async (notification) => {
  const now = new Date();

  const result = await Notification.updateOne(
    {
      _id: notification._id,
      status: "PROCESSING",
      lockedBy: workerId,
      leaseToken: notification.leaseToken,
      lockedUntil: { $gt: now },
    },
    {
      $set: {
        lockedUntil: new Date(
          now.getTime() + LEASE_DURATION_MS
        ),
      },
    }
  );

  return result.modifiedCount === 1;
};

const startLeaseHeartbeat = (notification) => {
  let leaseLost = false;
  let heartbeatInProgress = false;

  const timer = setInterval(async () => {
    if (heartbeatInProgress || leaseLost) return;

    heartbeatInProgress = true;

    try {
      const renewed = await renewNotificationLease(notification);

      if (!renewed) {
        leaseLost = true;

        console.error(
          `Notification lease lost: ${notification._id}`
        );
      }
    } catch (error) {
      // A failed renewal is treated conservatively:
      // this worker must not assume it still owns the job.
      leaseLost = true;

      console.error(
        `Notification lease renewal failed: ${notification._id}`,
        error.message
      );
    } finally {
      heartbeatInProgress = false;
    }
  }, LEASE_RENEW_INTERVAL_MS);

  return {
    stop: () => clearInterval(timer),
    hasLostLease: () => leaseLost,
  };
};

const markNotificationSent = async (
  notification,
  providerMessageId
) => {
  const result = await Notification.updateOne(
    {
      _id: notification._id,
      status: "PROCESSING",
      lockedBy: workerId,
      leaseToken: notification.leaseToken,
      lockedUntil: { $gt: new Date() },
    },
    {
      $set: {
        status: "SENT",
        sentAt: new Date(),
        providerMessageId,
        lastError: null,
      },
      $unset: {
        lockedBy: "",
        leaseToken: "",
        lockedUntil: "",
      },
    }
  );

  if (result.modifiedCount !== 1) {
    throw new Error(
      `Lost notification lease before marking SENT: ${notification._id}`
    );
  }
};

const markNotificationFailed = async (
  notification,
  error
) => {
  const exhausted =
    notification.attempts >= notification.maxAttempts;

  const update = exhausted
    ? {
        $set: {
          status: "FAILED",
          lastError: error.message,
        },
      }
    : {
        $set: {
          status: "PENDING",
          nextAttemptAt: new Date(
            Date.now() +
              calculateRetryDelay(notification.attempts)
          ),
          lastError: error.message,
        },
      };

  update.$unset = {
    lockedBy: "",
    leaseToken: "",
    lockedUntil: "",
  };

  const result = await Notification.updateOne(
    {
      _id: notification._id,
      status: "PROCESSING",
      lockedBy: workerId,
      leaseToken: notification.leaseToken,
      lockedUntil: { $gt: new Date() },
    },
    update
  );

  if (result.modifiedCount !== 1) {
    console.error(
      `Could not update notification ${notification._id}; lease was lost`
    );

    return;
  }

  if (exhausted) {
    console.error(
      `Notification permanently failed: ${notification._id}`
    );
  }
};

const deliverNotification = async (notification) => {
  const heartbeat = startLeaseHeartbeat(notification);

  try {
    const email = getBookingEmailTemplate({
      eventType: notification.eventType,
      displayName: notification.templateData.displayName,
      payload: notification.templateData.payload,
    });

    const result = await sendEmail({
      to: notification.recipient,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    if (heartbeat.hasLostLease()) {
      throw new Error(
        `Notification lease was lost during delivery: ${notification._id}`
      );
    }

    await markNotificationSent(
      notification,
      result.messageId
    );

    console.log(
      `Notification delivered: ${notification._id}`
    );
  } finally {
    heartbeat.stop();
  }
};

const processBatch = async () => {
  for (let index = 0; index < BATCH_SIZE; index += 1) {
    if (isStopping) return;

    const notification = await claimNotification();

    if (!notification) return;

    try {
      await deliverNotification(notification);
    } catch (error) {
      console.error(
        `Notification delivery failed: ${notification._id}`,
        error.message
      );

      try {
        await markNotificationFailed(notification, error);
      } catch (updateError) {
        console.error(
          "Failed to update notification status:",
          updateError.message
        );
      }
    }
  }
};

const runWorker = async () => {
  if (currentExecution || isStopping) return;

  currentExecution = processBatch()
    .catch((error) => {
      console.error(
        "Notification worker error:",
        error.message
      );
    })
    .finally(() => {
      currentExecution = null;
    });

  await currentExecution;
};

export const startNotificationDeliveryWorker = () => {
  if (intervalId) return;

  isStopping = false;

  console.log("Notification delivery worker started");

  void runWorker();

  intervalId = setInterval(() => {
    void runWorker();
  }, POLL_INTERVAL_MS);
};

export const stopNotificationDeliveryWorker = async () => {
  isStopping = true;

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  if (currentExecution) {
    await currentExecution;
  }

  console.log("Notification delivery worker stopped");
};
