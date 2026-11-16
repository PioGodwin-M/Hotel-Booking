
const getBookingUrl = () => process.env.BOOKING_SERVICE_URL;
const getPaymentSecret = () => process.env.PAYMENT_SERVICE_SECRET;

export const markBookingPaymentPending = async ({
  bookingId,
  paymentId,
  attemptNumber = 1,
  userId,
  previousAttempt = null,
}) => {
  const BOOKING_SERVICE_URL = getBookingUrl();
  const PAYMENT_SERVICE_SECRET = getPaymentSecret();

  if (!BOOKING_SERVICE_URL || !PAYMENT_SERVICE_SECRET) {
    const error = new Error("Booking Service configuration is missing");
    error.code = "BOOKING_SERVICE_UNAVAILABLE";
    throw error;
  }

  const baseUrl = BOOKING_SERVICE_URL.replace(/\/+$/, "");

  const url =
    `${baseUrl}/internal/payments/bookings/` +
    `${encodeURIComponent(bookingId)}/payment-pending`;

  let response;

  try {
    response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-payment-service-key": PAYMENT_SERVICE_SECRET,
      },
      body: JSON.stringify({
        paymentId,
        attemptNumber,
        userId,
        previousAttempt,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (cause) {
    const error = new Error("Could not communicate with Booking Service");
    error.code = "BOOKING_SERVICE_UNAVAILABLE";
    error.cause = cause;
    throw error;
  }

  let result;

  try {
    result = await response.json();
  } catch {
    const error = new Error("Booking Service returned an invalid response");
    error.code = "BOOKING_SERVICE_ERROR";
    throw error;
  }

  if (response.status === 404) {
    const error = new Error("Booking was not found");
    error.code = "BOOKING_NOT_FOUND";
    throw error;
  }

  if (response.status === 409) {
    const error = new Error(
      result.message || "Booking is not eligible for payment"
    );
    error.code = "BOOKING_NOT_PAYABLE";
    throw error;
  }

  if (!response.ok) {
    const error = new Error("Booking Service request failed");

    error.code =
      response.status >= 500
        ? "BOOKING_SERVICE_UNAVAILABLE"
        : "BOOKING_SERVICE_ERROR";

    throw error;
  }

  const booking = result?.booking;

  if (
    !booking ||
    booking._id !== bookingId ||
    booking.paymentId !== paymentId ||
    booking.userId !== userId ||
    !booking.priceSnapshot ||
    typeof booking.priceSnapshot.totalAmount !== "number" ||
    !Number.isFinite(booking.priceSnapshot.totalAmount) ||
    booking.priceSnapshot.totalAmount <= 0 ||
    typeof booking.priceSnapshot.currency !== "string"
  ) {
    const error = new Error(
      "Booking Service returned invalid payment details"
    );

    error.code = "BOOKING_SERVICE_ERROR";
    throw error;
  }

  const amountMinor = Math.round(
    booking.priceSnapshot.totalAmount * 100
  );

  if (
    !Number.isSafeInteger(amountMinor) ||
    Math.abs(
      booking.priceSnapshot.totalAmount - amountMinor / 100
    ) > 1e-8
  ) {
    const error = new Error("Booking amount has unsupported precision");
    error.code = "INVALID_PAYMENT_AMOUNT";
    throw error;
  }

  return {
    bookingId: booking._id,
    userId: booking.userId,
    amountMinor,
    currency: booking.priceSnapshot.currency,
    status: booking.status,
  };
};
