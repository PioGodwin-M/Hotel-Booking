
import {
  publishPendingOutboxEvents,
} from "../events/outboxPublisher.js";

import {
  closePaymentEventPublisher,
} from "../events/paymentEventPublisher.js";

const POLL_INTERVAL_MS = 5000;

let interval = null;
let isRunning = false;
let currentExecution = null;
let isStarted = false;
let isStopping = false;

const runWorker = async () => {
  if (isRunning || isStopping) {
    return;
  }

  isRunning = true;

  currentExecution = (async () => {
    try {
      const publishedCount = await publishPendingOutboxEvents();

      if (publishedCount > 0) {
        console.log(
          `Payment outbox published ${publishedCount} event(s)`
        );
      }
    } catch (error) {
      console.error("Payment outbox worker error:", error);
    } finally {
      isRunning = false;
      currentExecution = null;
    }
  })();

  await currentExecution;
};

export const startOutboxWorker = async () => {
  if (isStarted || isStopping) {
    return;
  }

  isStarted = true;

  console.log("Starting Payment Service outbox worker...");

  // Attempt an initial run without blocking server availability
  // if RabbitMQ is temporarily unavailable.
  await runWorker();

  if (isStopping) {
    return;
  }

  interval = setInterval(() => {
    void runWorker();
  }, POLL_INTERVAL_MS);
};

export const stopOutboxWorker = async () => {
  if (isStopping) {
    if (currentExecution) {
      await currentExecution;
    }
    return;
  }

  isStopping = true;

  if (interval) {
    clearInterval(interval);
    interval = null;
  }

  if (currentExecution) {
    await currentExecution;
  }

  await closePaymentEventPublisher();

  isStarted = false;

  console.log("Payment Service outbox worker stopped.");
};
