const getPaymentUrl = () =>
  process.env.PAYMENT_SERVICE_URL || "http://localhost:4004";
const getPaymentSecret = () => process.env.PAYMENT_SERVICE_SECRET;

const REQUEST_TIMEOUT_MS = 10000;

/**
 * Minimal internal HTTP client to invoke Payment Service's authorized internal refund contract.
 *
 * Invariants:
 * 1. Only used by authorized internal workflows (reconciliation / operator resolution).
 * 2. Authenticates using PAYMENT_SERVICE_SECRET via 'x-payment-service-key'.
 * 3. Validates required parameters (paymentId, bookingId, reason) before dispatching.
 * 4. Strictly preserves service boundaries (never directly accesses hotel_payment database).
 */
export const requestInternalRefund = async ({
  paymentId,
  bookingId,
  reason = "RECONCILIATION_RESOLUTION",
}) => {
  if (!paymentId || typeof paymentId !== "string" || !paymentId.trim()) {
    const error = new Error("A valid paymentId is required for refund request");
    error.code = "VALIDATION_ERROR";
    error.statusCode = 400;
    throw error;
  }

  if (!bookingId || typeof bookingId !== "string" || !bookingId.trim()) {
    const error = new Error("A valid bookingId is required for refund request");
    error.code = "VALIDATION_ERROR";
    error.statusCode = 400;
    throw error;
  }

  const PAYMENT_SERVICE_URL = getPaymentUrl();
  const PAYMENT_SERVICE_SECRET = getPaymentSecret();

  if (!PAYMENT_SERVICE_URL || !PAYMENT_SERVICE_SECRET) {
    const error = new Error("Payment Service internal configuration is missing");
    error.code = "PAYMENT_SERVICE_UNAVAILABLE";
    error.statusCode = 503;
    throw error;
  }

  const baseUrl = PAYMENT_SERVICE_URL.replace(/\/+$/, "");
  const url = `${baseUrl}/internal/payments/${encodeURIComponent(paymentId.trim())}/refund`;

  let response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-payment-service-key": PAYMENT_SERVICE_SECRET,
      },
      body: JSON.stringify({
        bookingId: String(bookingId).trim(),
        reason: String(reason).trim(),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    const error = new Error(
      `Could not communicate with Payment Service refund endpoint: ${cause.message}`
    );
    error.code = "PAYMENT_SERVICE_UNAVAILABLE";
    error.statusCode = 503;
    error.cause = cause;
    throw error;
  }

  let result;
  try {
    result = await response.json();
  } catch {
    const error = new Error("Payment Service returned an invalid JSON response");
    error.code = "PAYMENT_SERVICE_ERROR";
    error.statusCode = 502;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(
      result?.message || `Payment Service refund failed with HTTP ${response.status}`
    );
    error.code = result?.code || (response.status === 409 ? "REFUND_CONFLICT" : "PAYMENT_SERVICE_ERROR");
    error.statusCode = response.status;
    error.details = result;
    throw error;
  }

  if (!result || result.success !== true || !result.data) {
    const error = new Error("Payment Service returned an incomplete refund result");
    error.code = "PAYMENT_SERVICE_ERROR";
    error.statusCode = 502;
    throw error;
  }

  return {
    success: true,
    data: result.data,
  };
};

/**
 * Fetch customer-facing payment summary from Payment Service (Round 4g B5).
 * Best-effort helper: returns null on failure without throwing.
 */
export const getPaymentSummaryByBooking = async (bookingId) => {
  if (!bookingId) {
    return null;
  }

  const PAYMENT_SERVICE_URL = getPaymentUrl();
  const PAYMENT_SERVICE_SECRET = getPaymentSecret();

  if (!PAYMENT_SERVICE_URL || !PAYMENT_SERVICE_SECRET) {
    console.warn("[paymentClient] Payment Service configuration missing for summary");
    return null;
  }

  const baseUrl = PAYMENT_SERVICE_URL.replace(/\/+$/, "");
  const url = `${baseUrl}/internal/payments/booking/${encodeURIComponent(bookingId)}/summary`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-payment-service-key": PAYMENT_SERVICE_SECRET,
      },
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) {
      console.warn(`[paymentClient] Failed to fetch payment summary for booking ${bookingId}: HTTP ${response.status}`);
      return null;
    }

    const result = await response.json();
    return result?.data || null;
  } catch (err) {
    console.warn(`[paymentClient] Network error fetching payment summary for booking ${bookingId}: ${err.message}`);
    return null;
  }
};
