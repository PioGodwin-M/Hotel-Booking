import {
  reconcileZombiePayments,
  reconcileExternalRefunds,
} from "../services/paymentReconciliationService.js";

const DEFAULT_INTERVAL_MS = 30000;
const RECONCILIATION_INTERVAL_MS = process.env.PAYMENT_RECONCILIATION_INTERVAL_MS
  ? parseInt(process.env.PAYMENT_RECONCILIATION_INTERVAL_MS, 10)
  : DEFAULT_INTERVAL_MS;

let timer = null;
let started = false;
let stopping = false;
let runningPromise = null;

/**
 * Executes a single reconciliation tick.
 * In-memory mutex ensures overlapping runs are strictly prevented.
 * Transient errors are caught and logged so future ticks are not killed.
 */
export const runPaymentReconciliationTick = async () => {
  if (runningPromise) {
    console.log("[PaymentReconciliationWorker] Tick skipped: previous run still active");
    return { skipped: true, reason: "OVERLAPPING_EXECUTION_PREVENTED" };
  }

  if (stopping) {
    return { skipped: true, reason: "WORKER_STOPPING" };
  }

  runningPromise = (async () => {
    const tickResult = {
      timestamp: new Date().toISOString(),
      zombie: null,
      refund: null,
    };

    try {
      // 1. Reconcile zombie payments (PaymentIntents succeeded on Stripe but unconfirmed in DB)
      tickResult.zombie = await reconcileZombiePayments();
    } catch (err) {
      console.error("[PaymentReconciliationWorker] Zombie reconciliation error:", err.message);
      tickResult.zombieError = err.message;
    }

    try {
      // 2. Reconcile external refunds (Refunds on Stripe not yet reflected in Payment DB)
      tickResult.refund = await reconcileExternalRefunds();
    } catch (err) {
      console.error("[PaymentReconciliationWorker] External refund reconciliation error:", err.message);
      tickResult.refundError = err.message;
    }

    return tickResult;
  })()
    .catch((err) => {
      console.error("[PaymentReconciliationWorker] Fatal tick error:", err.message);
      return { error: err.message };
    })
    .finally(() => {
      runningPromise = null;
    });

  return runningPromise;
};

/**
 * Starts the periodic payment reconciliation worker during service bootstrap.
 */
export const startPaymentReconciliationWorker = async () => {
  if (started) {
    return;
  }

  started = true;
  stopping = false;

  console.log(
    `[PaymentReconciliationWorker] Started periodic worker (interval: ${RECONCILIATION_INTERVAL_MS}ms)`
  );

  // Run initial tick on startup
  await runPaymentReconciliationTick();

  if (!stopping) {
    timer = setInterval(() => {
      void runPaymentReconciliationTick();
    }, RECONCILIATION_INTERVAL_MS);
  }
};

/**
 * Stops the periodic payment reconciliation worker gracefully during service shutdown.
 */
export const stopPaymentReconciliationWorker = async () => {
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

  console.log("[PaymentReconciliationWorker] Stopped periodic worker");
};

export const getPaymentReconciliationWorkerStatus = () => ({
  started,
  stopping,
  isRunning: Boolean(runningPromise),
  intervalMs: RECONCILIATION_INTERVAL_MS,
});
