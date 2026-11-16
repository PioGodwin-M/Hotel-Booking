import mongoose from "mongoose";

import Booking from "../models/Booking.js";
import DailyInventory from "../models/DailyInventory.js";
import ProcessedEvent from "../models/ProcessedEvent.js";
import PaymentReconciliation from "../models/PaymentReconciliation.js";
import { createBookingEvent } from "../services/bookingEventService.js";

import { getStayDates } from "../utils/dateUtils.js";

const isValidPaymentEvent = (event) => {
  if (
    !event ||
    typeof event.eventId !== "string" ||
    !event.eventId.trim() ||
    ![
      "PaymentSucceeded",
      "PaymentFailed",
      "PaymentRefunded",
      "PaymentRefundFailed",
      "PaymentDisputed",
    ].includes(event.eventType) ||
    event.schemaVersion !== 1 ||
    !event.payload ||
    !mongoose.isValidObjectId(event.payload.bookingId) ||
    typeof event.payload.paymentId !== "string" ||
    !event.payload.paymentId.trim()
  ) {
    return false;
  }

  if (["PaymentSucceeded", "PaymentRefunded", "PaymentDisputed"].includes(event.eventType)) {
    return (
      Number.isSafeInteger(event.payload.amountMinor) &&
      event.payload.amountMinor > 0 &&
      typeof event.payload.currency === "string" &&
      /^[A-Z]{3}$/.test(event.payload.currency)
    );
  }

  return (
    typeof event.payload.failureCode === "string" &&
    event.payload.failureCode.trim().length > 0
  );
};

const recordReconciliation = async ({
  event,
  booking,
  reason,
  details = {},
  session,
}) => {
  const payload = event?.payload || {};
  const reconciliationKey = `recon_${booking._id}_${payload.paymentId || "unknown"}_${reason}`;

  await PaymentReconciliation.findOneAndUpdate(
    { reconciliationKey },
    {
      $setOnInsert: {
        eventId: event?.eventId || null,
        reconciliationKey,
        bookingId: booking._id,
        paymentId: payload.paymentId || booking.paymentId || "UNKNOWN",
        attemptNumber: payload.attemptNumber || booking.paymentAttemptCount,
        attemptId: payload.attemptId || null,
        reason,
        amountMinor:
          payload.amountMinor ||
          Math.round(booking.priceSnapshot.totalAmount * 100),
        currency: payload.currency || booking.priceSnapshot.currency,
        status: "REVIEW_REQUIRED",
        details,
      },
    },
    { upsert: true, session }
  );
};

const releaseHeldInventory = async (booking, session) => {
  const stayDates = getStayDates(booking.checkIn, booking.checkOut);

  for (const date of stayDates) {
    const result = await DailyInventory.updateOne(
      {
        roomCategoryId: booking.roomCategoryId,
        date,
        heldUnits: { $gte: booking.numberOfRooms },
      },
      {
        $inc: {
          heldUnits: -booking.numberOfRooms,
        },
      },
      { session }
    );

    if (result.modifiedCount !== 1) {
      throw new Error(
        `Unable to release held inventory for booking ${booking._id}`
      );
    }
  }
};

const confirmHeldInventory = async (booking, session) => {
  const stayDates = getStayDates(booking.checkIn, booking.checkOut);

  for (const date of stayDates) {
    const result = await DailyInventory.updateOne(
      {
        roomCategoryId: booking.roomCategoryId,
        date,
        heldUnits: { $gte: booking.numberOfRooms },
      },
      {
        $inc: {
          heldUnits: -booking.numberOfRooms,
          bookedUnits: booking.numberOfRooms,
        },
      },
      { session }
    );

    if (result.modifiedCount !== 1) {
      throw new Error(
        `Unable to confirm inventory for booking ${booking._id}`
      );
    }
  }
};

export const processPaymentResult = async (event) => {
  if (!isValidPaymentEvent(event)) {
    const error = new Error("Invalid payment event payload");
    error.code = "INVALID_PAYMENT_EVENT";
    throw error;
  }

  const { eventId, eventType, payload } = event;
  const session = await mongoose.startSession();

  try {
    let outcome = "IGNORED";

    await session.withTransaction(async () => {
      outcome = "IGNORED";

      // Insert the event ID inside the same transaction as business changes.
      await ProcessedEvent.create(
        [
          {
            eventId,
            eventType,
          },
        ],
        { session }
      );

      const booking = await Booking.findById(payload.bookingId).session(session);

      if (!booking) {
        // Persist the event as processed so a permanently missing booking
        // does not create an endless retry loop.
        outcome = "BOOKING_NOT_FOUND";
        return;
      }

      if (eventType === "PaymentDisputed") {
        await recordReconciliation({
          event,
          booking,
          reason: "STRIPE_DISPUTE_CREATED",
          details: {
            disputeId: payload.disputeId,
            disputeStatus: payload.disputeStatus,
            amountMinor: payload.amountMinor,
            reason: payload.reason,
          },
          session,
        });
        outcome = "DISPUTE_ACKNOWLEDGED";
        return;
      }

      if (eventType === "PaymentRefunded") {
        if (booking.status === "CONFIRMED" && payload.origin === "EXTERNAL_STRIPE") {
          await recordReconciliation({
            event,
            booking,
            reason: "EXTERNAL_REFUND_ON_CONFIRMED_BOOKING",
            details: {
              refundId: payload.refundId,
              amountMinor: payload.amountMinor,
              origin: payload.origin,
            },
            session,
          });
          // Invariant: Do NOT automatically cancel booking or release inventory!
          outcome = "EXTERNAL_REFUND_REVIEW_REQUIRED";
          return;
        }

        outcome = "REFUND_ACKNOWLEDGED";
        return;
      }

      if (eventType === "PaymentRefundFailed") {
        outcome = "REFUND_FAILED_ACKNOWLEDGED";
        return;
      }

      if (eventType === "PaymentSucceeded") {
        const expectedAmountMinor = Math.round(
          booking.priceSnapshot.totalAmount * 100
        );
        const expectedAttemptNumber = booking.paymentAttemptCount;
        const expectedAttemptId = `att_${booking._id}_${expectedAttemptNumber}`;

        // 1. Mandatory userId validation (missing, malformed, or mismatched)
        if (typeof payload.userId !== "string" || !payload.userId.trim()) {
          await recordReconciliation({
            event,
            booking,
            reason: "MISSING_USER_ID",
            details: {
              eventUserId: payload.userId ?? null,
              bookingUserId: booking.userId,
            },
            session,
          });
          outcome = "RECONCILIATION_REQUIRED";
          return;
        }

        if (payload.userId !== booking.userId) {
          await recordReconciliation({
            event,
            booking,
            reason: "USER_ID_MISMATCH",
            details: {
              eventUserId: payload.userId,
              bookingUserId: booking.userId,
            },
            session,
          });
          outcome = "RECONCILIATION_REQUIRED";
          return;
        }

        // 2. Mandatory attemptNumber validation (missing, malformed, obsolete, or unexpected future)
        if (
          typeof payload.attemptNumber !== "number" ||
          !Number.isInteger(payload.attemptNumber) ||
          payload.attemptNumber <= 0
        ) {
          await recordReconciliation({
            event,
            booking,
            reason: "MISSING_ATTEMPT_NUMBER",
            details: {
              eventAttemptNumber: payload.attemptNumber ?? null,
              bookingAttemptCount: expectedAttemptNumber,
            },
            session,
          });
          outcome = "RECONCILIATION_REQUIRED";
          return;
        }

        if (payload.attemptNumber < expectedAttemptNumber) {
          await recordReconciliation({
            event,
            booking,
            reason: "OBSOLETE_ATTEMPT",
            details: {
              eventAttemptNumber: payload.attemptNumber,
              bookingAttemptCount: expectedAttemptNumber,
            },
            session,
          });
          outcome = "RECONCILIATION_REQUIRED";
          return;
        }

        if (payload.attemptNumber > expectedAttemptNumber) {
          await recordReconciliation({
            event,
            booking,
            reason: "UNEXPECTED_FUTURE_ATTEMPT",
            details: {
              eventAttemptNumber: payload.attemptNumber,
              bookingAttemptCount: expectedAttemptNumber,
            },
            session,
          });
          outcome = "RECONCILIATION_REQUIRED";
          return;
        }

        // 3. Mandatory attemptId validation (missing, malformed, or mismatched)
        if (typeof payload.attemptId !== "string" || !payload.attemptId.trim()) {
          await recordReconciliation({
            event,
            booking,
            reason: "MISSING_ATTEMPT_ID",
            details: {
              eventAttemptId: payload.attemptId ?? null,
              expectedAttemptId,
            },
            session,
          });
          outcome = "RECONCILIATION_REQUIRED";
          return;
        }

        if (
          payload.attemptId !== expectedAttemptId &&
          payload.attemptId !== booking.paymentId
        ) {
          await recordReconciliation({
            event,
            booking,
            reason: "ATTEMPT_ID_MISMATCH",
            details: {
              eventAttemptId: payload.attemptId,
              expectedAttemptId,
              bookingPaymentId: booking.paymentId,
            },
            session,
          });
          outcome = "RECONCILIATION_REQUIRED";
          return;
        }

        // 4. Mandatory paymentId alignment
        if (
          typeof payload.paymentId !== "string" ||
          !payload.paymentId.trim() ||
          booking.paymentId !== payload.paymentId
        ) {
          await recordReconciliation({
            event,
            booking,
            reason: "PAYMENT_ID_MISMATCH",
            details: {
              eventPaymentId: payload.paymentId ?? null,
              bookingPaymentId: booking.paymentId,
            },
            session,
          });
          outcome = "RECONCILIATION_REQUIRED";
          return;
        }

        // 5. Mandatory amountMinor validation (missing, malformed, or mismatched)
        if (
          typeof payload.amountMinor !== "number" ||
          !Number.isSafeInteger(payload.amountMinor) ||
          payload.amountMinor <= 0
        ) {
          await recordReconciliation({
            event,
            booking,
            reason: "MISSING_PAYMENT_AMOUNT",
            details: {
              eventAmount: payload.amountMinor ?? null,
              expectedAmount: expectedAmountMinor,
            },
            session,
          });
          outcome = "RECONCILIATION_REQUIRED";
          return;
        }

        if (payload.amountMinor !== expectedAmountMinor) {
          await recordReconciliation({
            event,
            booking,
            reason: "PAYMENT_AMOUNT_MISMATCH",
            details: {
              eventAmount: payload.amountMinor,
              expectedAmount: expectedAmountMinor,
            },
            session,
          });
          outcome = "RECONCILIATION_REQUIRED";
          return;
        }

        // 6. Mandatory currency validation (missing, malformed, or mismatched)
        if (
          typeof payload.currency !== "string" ||
          !/^[A-Z]{3}$/.test(payload.currency)
        ) {
          await recordReconciliation({
            event,
            booking,
            reason: "MISSING_PAYMENT_CURRENCY",
            details: {
              eventCurrency: payload.currency ?? null,
              expectedCurrency: booking.priceSnapshot.currency,
            },
            session,
          });
          outcome = "RECONCILIATION_REQUIRED";
          return;
        }

        if (payload.currency !== booking.priceSnapshot.currency) {
          await recordReconciliation({
            event,
            booking,
            reason: "PAYMENT_CURRENCY_MISMATCH",
            details: {
              eventCurrency: payload.currency,
              expectedCurrency: booking.priceSnapshot.currency,
            },
            session,
          });
          outcome = "RECONCILIATION_REQUIRED";
          return;
        }

        // 6. Idempotent return if already confirmed
        if (booking.status === "CONFIRMED") {
          outcome = "ALREADY_CONFIRMED";
          return;
        }

        // 7. Late payment on expired hold
        if (booking.status === "EXPIRED") {
          await recordReconciliation({
            event,
            booking,
            reason: "LATE_PAYMENT_ON_EXPIRED_BOOKING",
            details: {
              bookingStatus: booking.status,
              holdExpiresAt: booking.holdExpiresAt,
            },
            session,
          });
          outcome = "RECONCILIATION_REQUIRED";
          return;
        }

        // 8. Late payment on cancelled booking
        if (booking.status === "CANCELLED") {
          await recordReconciliation({
            event,
            booking,
            reason: "LATE_PAYMENT_ON_CANCELLED_BOOKING",
            details: {
              bookingStatus: booking.status,
            },
            session,
          });
          outcome = "RECONCILIATION_REQUIRED";
          return;
        }

        // 9. Other non-pending status
        if (booking.status !== "PAYMENT_PENDING") {
          await recordReconciliation({
            event,
            booking,
            reason: "BOOKING_NOT_PAYMENT_PENDING",
            details: {
              bookingStatus: booking.status,
            },
            session,
          });
          outcome = "RECONCILIATION_REQUIRED";
          return;
        }

        const updatedBooking = await Booking.updateOne(
          {
            _id: booking._id,
            status: "PAYMENT_PENDING",
            paymentId: payload.paymentId,
          },
          {
            $set: {
              status: "CONFIRMED",
              holdExpiresAt: null,
            },
          },
          { session }
        );

        if (updatedBooking.modifiedCount !== 1) {
          throw new Error("Booking confirmation state transition failed");
        }

       await confirmHeldInventory(booking, session);

await createBookingEvent({
  booking,
  eventType: "BookingConfirmed",
  session,
});

outcome = "CONFIRMED";
        return;
      }

      // PaymentFailed
      if (booking.paymentId !== payload.paymentId) {
        // A failure from an old or unrelated payment attempt must not
        // release the current booking's inventory.
        outcome = "STALE_PAYMENT_FAILURE";
        return;
      }

      if (booking.status === "PAYMENT_FAILED") {
        outcome = "ALREADY_FAILED";
        return;
      }

      if (booking.status !== "PAYMENT_PENDING") {
        // A stale failure must not change a confirmed, cancelled or expired
        // booking.
        outcome = "STALE_PAYMENT_FAILURE";
        return;
      }

      const updatedBooking = await Booking.updateOne(
        {
          _id: booking._id,
          status: "PAYMENT_PENDING",
          paymentId: payload.paymentId,
        },
        {
          $set: {
            status: "PAYMENT_FAILED",
            holdExpiresAt: null,
          },
        },
        { session }
      );

      if (updatedBooking.modifiedCount !== 1) {
        throw new Error("Booking failure state transition failed");
      }

      await releaseHeldInventory(booking, session);

await createBookingEvent({
  booking,
  eventType: "BookingPaymentFailed",
  session,
  extraPayload: {
    failureCode: payload.failureCode,
  },
});

outcome = "PAYMENT_FAILED";
    });

    return outcome;
  } catch (error) {
    // A duplicate event ID means the event was committed previously.
    if (error.code === 11000) {
      const alreadyProcessed = await ProcessedEvent.exists({ eventId });

      if (alreadyProcessed) {
        return "DUPLICATE";
      }
    }

    throw error;
  } finally {
    await session.endSession();
  }
};