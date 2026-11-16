import { reconcileGhostPayments } from "../services/bookingReconciliationService.js";

const DEFAULT_INTERVAL_MS = 30000;
const RECONCILIATION_INTERVAL_MS = process.env.BOOKING_RECONCILIATION_INTERVAL_MS
  ? parseInt(process.env.BOOKING_RECONCILIATION_INTERVAL_MS, 10)
  : DEFAULT_INTERVAL_MS;

let timer = null;
let started = false;
let stopping = false;
let runningPromise = null;

/**
 * Executes a single ghost-booking reconciliation tick.
 * In-memory mutex ensures overlapping runs are strictly prevented.
 * Transient errors are caught and logged so future ticks are not killed.
 */
export const runBookingReconciliationTick = async () => {
  if (runningPromise) {
    console.log("[BookingReconciliationWorker] Tick skipped: previous run still active");
    return { skipped: true, reason: "OVERLAPPING_EXECUTION_PREVENTED" };
  }

  if (stopping) {
    return { skipped: true, reason: "WORKER_STOPPING" };
  }

  runningPromise = (async () => {
    const tickResult = {
      timestamp: new Date().toISOString(),
      ghostBookings: null,
    };

    try {
      // Reconcile ghost payments (Bookings stuck in PAYMENT_PENDING with successful payments)
      tickResult.ghostBookings = await reconcileGhostPayments();
    } catch (err) {
      console.error("[BookingReconciliationWorker] Ghost booking reconciliation error:", err.message);
      tickResult.ghostError = err.message;
    }

    return tickResult;
  })()
    .catch((err) => {
      console.error("[BookingReconciliationWorker] Fatal tick error:", err.message);
      return { error: err.message };
    })
    .finally(() => {
      runningPromise = null;
    });

  return runningPromise;
};

/**
 * Starts the periodic booking reconciliation worker during service bootstrap.
 */
export const startBookingReconciliationWorker = async () => {
  if (started) {
    return;
  }

  started = true;
  stopping = false;

  console.log(
    `[BookingReconciliationWorker] Started periodic worker (interval: ${RECONCILIATION_INTERVAL_MS}ms)`
  );

  // Run initial tick on startup
  await runBookingReconciliationTick();

  if (!stopping) {
    timer = setInterval(() => {
      void runBookingReconciliationTick();
    }, RECONCILIATION_INTERVAL_MS);
  }
};

/**
 * Stops the periodic booking reconciliation worker gracefully during service shutdown.
 */
export const stopBookingReconciliationWorker = async () => {
  if (!started) {
    return;
  }

  stopping = true;
  started = false;

  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  if (runningPromise) {
    try {
      await runningPromise;
    } catch (err) {
      // Ignore errors on shutdown
    }
  }

  console.log("[BookingReconciliationWorker] Stopped periodic worker");
};

export const getBookingReconciliationWorkerStatus = () => ({
  started,
  stopping,
  isRunning: Boolean(runningPromise),
  intervalMs: RECONCILIATION_INTERVAL_MS,
});
