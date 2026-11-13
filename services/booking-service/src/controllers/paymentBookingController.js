
import {
  markBookingPaymentPending,
} from "../services/paymentBookingService.js";

export const markPaymentPendingController = async (
  req,
  res,
  next
) => {
  try {
    const booking = await markBookingPaymentPending({
      bookingId: req.params.bookingId,
      paymentId: req.body.paymentId,
      userId: req.body.userId,
    });

    return res.status(200).json({
      success: true,
      booking,
    });
  } catch (error) {
    const errorResponses = {
      VALIDATION_ERROR: [400, error.message],
      UNAUTHENTICATED: [401, "Authenticated service user required"],
      BOOKING_NOT_FOUND: [404, "Booking not found"],
      BOOKING_ALREADY_EXPIRED: [409, error.message],
      BOOKING_NOT_PAYABLE: [409, error.message],
      PAYMENT_ID_MISMATCH: [409, error.message],
    };

    const mapped = errorResponses[error.code];

    if (mapped) {
      return res.status(mapped[0]).json({
        success: false,
        message: mapped[1],
      });
    }

    return next(error);
  }
};
