/**
 * Booking status and payment attempt reconciliation utilities.
 * Pure functions with zero side effects, suitable for unit testing.
 */

export const PAYMENT_ATTEMPT_KEY_PREFIX = "pgm_pay_attempt_";

export const PAYMENT_ATTEMPT_STATES = {
  NOT_SUBMITTED: "NOT_SUBMITTED",
  PROCESSING: "PROCESSING",
  SUCCEEDED: "SUCCEEDED",
  FAILED_RETRYABLE: "FAILED_RETRYABLE",
  UNKNOWN: "UNKNOWN",
};

/**
 * Gets the current payment attempt state for a booking.
 * Authoritative backend state always supersedes client session storage.
 *
 * @param {Object} booking
 * @returns {string} One of PAYMENT_ATTEMPT_STATES
 */
export const getPaymentAttemptState = (booking) => {
  if (!booking) return PAYMENT_ATTEMPT_STATES.NOT_SUBMITTED;

  // Authoritative server states win unconditionally
  if (booking.status === "CONFIRMED") {
    clearStoredPaymentAttempt(booking._id);
    return PAYMENT_ATTEMPT_STATES.SUCCEEDED;
  }

  if (booking.status === "CANCELLED" || booking.status === "EXPIRED") {
    clearStoredPaymentAttempt(booking._id);
    return PAYMENT_ATTEMPT_STATES.NOT_SUBMITTED;
  }

  // Check temporary client session state for in-flight/recent payments
  if (typeof window !== "undefined" && window.sessionStorage && booking._id) {
    try {
      const stored = window.sessionStorage.getItem(
        `${PAYMENT_ATTEMPT_KEY_PREFIX}${booking._id}`
      );
      if (stored) {
        const parsed = JSON.parse(stored);
        // Valid for up to 10 minutes
        if (Date.now() - parsed.timestamp < 10 * 60 * 1000) {
          if (parsed.state === PAYMENT_ATTEMPT_STATES.PROCESSING) {
            return PAYMENT_ATTEMPT_STATES.PROCESSING;
          }
          if (parsed.state === PAYMENT_ATTEMPT_STATES.SUCCEEDED) {
            return PAYMENT_ATTEMPT_STATES.SUCCEEDED;
          }
          if (parsed.state === PAYMENT_ATTEMPT_STATES.FAILED_RETRYABLE) {
            return PAYMENT_ATTEMPT_STATES.FAILED_RETRYABLE;
          }
        } else {
          clearStoredPaymentAttempt(booking._id);
        }
      }
    } catch {
      // sessionStorage unavailable or parse error
    }
  }

  return PAYMENT_ATTEMPT_STATES.NOT_SUBMITTED;
};

/**
 * Records a client-side payment attempt in sessionStorage.
 */
export const recordPaymentAttempt = (bookingId, state) => {
  if (typeof window === "undefined" || !window.sessionStorage || !bookingId) return;
  try {
    window.sessionStorage.setItem(
      `${PAYMENT_ATTEMPT_KEY_PREFIX}${bookingId}`,
      JSON.stringify({
        state,
        timestamp: Date.now(),
      })
    );
  } catch {
    // sessionStorage quota or security restriction
  }
};

/**
 * Clears temporary payment attempt state.
 */
export const clearStoredPaymentAttempt = (bookingId) => {
  if (typeof window === "undefined" || !window.sessionStorage || !bookingId) return;
  try {
    window.sessionStorage.removeItem(`${PAYMENT_ATTEMPT_KEY_PREFIX}${bookingId}`);
  } catch {
    // ignore
  }
};

/**
 * Maps a booking and its countdown state to a clean, authoritative UI status.
 *
 * Rules:
 * - Hold or expiry text appears ONLY for bookings awaiting payment.
 * - Confirmed, past, and cancelled bookings NEVER show hold or expiry text.
 * - When payment has been submitted but booking is not yet CONFIRMED, returns 'Confirming your booking…'.
 *
 * @param {Object} params
 * @param {Object} params.booking - The booking document
 * @param {boolean} [params.isExpiredCountdown=false] - Whether countdown timer reached 0
 * @param {string} [params.countdownText=""] - Formatted mm:ss countdown string
 * @param {string} [params.attemptState] - Optional explicit attempt state
 * @returns {Object} { statusType: string, label: string, canPay: boolean, canCancel: boolean, canViewReceipt: boolean }
 */
export const getBookingStatusDisplay = ({
  booking,
  isExpiredCountdown = false,
  countdownText = "",
  attemptState,
}) => {
  if (!booking) {
    return {
      statusType: "unknown",
      label: "Unknown",
      canPay: false,
      canCancel: false,
      canViewReceipt: false,
    };
  }

  const rawStatus = (booking.status || "").toUpperCase();
  const paymentState = attemptState || getPaymentAttemptState(booking);

  // 1. Confirmed booking (Authoritative CONFIRMED)
  if (rawStatus === "CONFIRMED") {
    return {
      statusType: "confirmed",
      label: "Confirmed",
      canPay: false,
      canCancel: false,
      canViewReceipt: true,
    };
  }

  // 2. Cancelled booking
  if (rawStatus === "CANCELLED") {
    return {
      statusType: "cancelled",
      label: "Cancelled",
      canPay: false,
      canCancel: false,
      canViewReceipt: false,
    };
  }

  // 3. Expired hold (Authoritative server EXPIRED status)
  if (rawStatus === "EXPIRED") {
    return {
      statusType: "expired",
      label: "Hold expired",
      canPay: false,
      canCancel: false,
      canViewReceipt: false,
    };
  }

  // 4. Awaiting Payment states (HELD or PAYMENT_PENDING)
  const isAwaitingPayment =
    rawStatus === "HELD" || rawStatus === "PAYMENT_PENDING";

  if (isAwaitingPayment) {
    // If countdown expired locally or past holdExpiresAt
    const isHoldExpired =
      isExpiredCountdown ||
      (booking.holdExpiresAt && new Date(booking.holdExpiresAt).getTime() <= Date.now());

    if (isHoldExpired) {
      return {
        statusType: "expired",
        label: "Hold expired",
        canPay: false,
        canCancel: false,
        canViewReceipt: false,
      };
    }

    // If payment was submitted and is processing/verifying
    if (
      paymentState === PAYMENT_ATTEMPT_STATES.PROCESSING ||
      paymentState === PAYMENT_ATTEMPT_STATES.SUCCEEDED
    ) {
      return {
        statusType: "confirming",
        label: "Confirming your booking…",
        canPay: false, // NO Complete Payment button while confirming
        canCancel: false,
        canViewReceipt: false,
      };
    }

    // Awaiting payment with active hold
    const countdownSuffix = countdownText ? ` · held for ${countdownText}` : "";
    return {
      statusType: "held",
      label: `Payment pending${countdownSuffix}`,
      canPay: true,
      canCancel: rawStatus === "HELD",
      canViewReceipt: false,
    };
  }

  // Default fallback for any unhandled state
  return {
    statusType: "expired",
    label: "Hold expired",
    canPay: false,
    canCancel: false,
    canViewReceipt: false,
  };
};

/**
 * Checks whether an existing booking matches the stay and dates being viewed.
 */
export const findMatchingActiveHold = (existingBookings, { hotelId, roomCategoryId, checkInDate, checkOutDate }) => {
  if (!Array.isArray(existingBookings) || !hotelId || !roomCategoryId || !checkInDate || !checkOutDate) {
    return null;
  }

  const now = Date.now();

  return (
    existingBookings.find((b) => {
      // Must be awaiting payment
      if (b.status !== "HELD" && b.status !== "PAYMENT_PENDING") return false;

      // Must not be expired
      if (b.holdExpiresAt && new Date(b.holdExpiresAt).getTime() <= now) return false;

      // Match hotel ID
      const bHotelId = String(b.hotelId || b.hotel?._id || b.hotel || "");
      if (bHotelId !== String(hotelId)) return false;

      // Match room category ID
      const bRoomCategoryId = String(b.roomCategoryId || b.room?._id || b.room || "");
      if (bRoomCategoryId !== String(roomCategoryId)) return false;

      // Match check-in date (YYYY-MM-DD)
      const bCheckIn = (b.checkIn || b.checkInDate || "").split("T")[0];
      if (bCheckIn !== checkInDate) return false;

      // Match check-out date (YYYY-MM-DD)
      const bCheckOut = (b.checkOut || b.checkOutDate || "").split("T")[0];
      if (bCheckOut !== checkOutDate) return false;

      return true;
    }) || null
  );
};
