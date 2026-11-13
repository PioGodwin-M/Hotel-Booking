import {
  expireExpiredBookingHolds,
} from "../services/holdExpirationService.js";

const POLL_INTERVAL_MS = 15000;

let interval = null;
let runningPromise = null;

const runWorker = async () => {
  if (runningPromise) {
    return runningPromise;
  }

  runningPromise = (async () => {
    try {
      const expiredCount = await expireExpiredBookingHolds();

      if (expiredCount > 0) {
        console.log(
          `Hold expiration worker expired ${expiredCount} booking(s)`
        );
      }
    } catch (error) {
      console.error("Hold expiration worker failed:", error.message);
    } finally {
      runningPromise = null;
    }
  })();

  return runningPromise;
};

export const startHoldExpirationWorker = () => {
  if (interval) {
    return;
  }

  console.log("Booking hold expiration worker started");

  // Process already-expired holds immediately on startup.
  void runWorker();

  interval = setInterval(() => {
    void runWorker();
  }, POLL_INTERVAL_MS);
};

export const stopHoldExpirationWorker = async () => {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }

  // Allow an in-progress batch to finish before shutdown.
  if (runningPromise) {
    await runningPromise;
  }

  console.log("Booking hold expiration worker stopped");
};