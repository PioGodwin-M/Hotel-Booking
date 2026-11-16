import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const mongoose = require(path.join(__dirname, "../services/booking-service/node_modules/mongoose"));
const dotenv = require(path.join(__dirname, "../services/booking-service/node_modules/dotenv"));

dotenv.config({ path: path.join(__dirname, "../services/booking-service/.env") });

const {
  markBookingPaymentPending,
  confirmBookingPayment,
  failBookingPayment,
} = await import("../services/booking-service/src/services/paymentBookingService.js");

const { processPaymentResult } = await import(
  "../services/booking-service/src/events/paymentResultHandler.js"
);

const { expireBookingHold } = await import(
  "../services/booking-service/src/services/holdExpirationService.js"
);

const { cancelBooking } = await import(
  "../services/booking-service/src/services/cancellationService.js"
);

const Booking = (await import("../services/booking-service/src/models/Booking.js")).default;
const DailyInventory = (await import("../services/booking-service/src/models/DailyInventory.js")).default;
const PaymentReconciliation = (await import("../services/booking-service/src/models/PaymentReconciliation.js")).default;
const ProcessedEvent = (await import("../services/booking-service/src/models/ProcessedEvent.js")).default;

async function runPhase3Tests() {
  console.log("=== Phase 3 Automated Test Suite: Booking Service Attempt Validation & Invariants ===\n");
  let passed = 0;
  let total = 0;

  const assert = (condition, desc) => {
    total++;
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
    }
  };

  await mongoose.connect(process.env.MONGODB_URI, { dbName: "hotel_booking" });
  const db = mongoose.connection;

  const testUserId = `user_p3_${Date.now()}`;
  const testHotelId = new mongoose.Types.ObjectId();

  const stayDateUTC = new Date(Date.UTC(2026, 11, 20, 0, 0, 0));
  const checkOutDateUTC = new Date(Date.UTC(2026, 11, 21, 0, 0, 0));

  const createTestBookingWithInventory = async (overrides = {}) => {
    const bookingId = new mongoose.Types.ObjectId();
    const roomCategoryId = new mongoose.Types.ObjectId();

    // Seed DailyInventory with 1 held unit
    await DailyInventory.create({
      roomCategoryId,
      date: stayDateUTC,
      totalUnits: 10,
      bookedUnits: 0,
      heldUnits: 1,
    });

    const booking = await Booking.create({
      _id: bookingId,
      userId: testUserId,
      hotelId: testHotelId,
      roomCategoryId,
      checkIn: stayDateUTC,
      checkOut: checkOutDateUTC,
      numberOfRooms: 1,
      numberOfGuests: 2,
      priceSnapshot: {
        pricePerNight: 5000,
        numberOfNights: 1,
        totalAmount: 5000,
        currency: "INR",
      },
      status: "HELD",
      holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      idempotencyKey: `idemp_${bookingId}`,
      requestFingerprint: `fp_${bookingId}`,
      paymentId: null,
      paymentAttemptCount: 1,
      ...overrides,
    });

    return { booking, roomCategoryId };
  };

  try {
    // =========================================================================
    // Group 1: State Machine & Permitted Transitions
    // =========================================================================
    console.log("--- Group 1: State Machine & Permitted Transitions ---");

    // 1.1 Happy Path: HELD -> PAYMENT_PENDING -> CONFIRMED
    console.log("1.1 Testing Happy Path (HELD -> PAYMENT_PENDING -> CONFIRMED)...");
    const { booking: b1, roomCategoryId: rc1 } = await createTestBookingWithInventory();
    const paymentId1 = `pay_p3_${randomUUID().replace(/-/g, "")}`;

    const pendingB1 = await markBookingPaymentPending({
      bookingId: b1._id.toString(),
      paymentId: paymentId1,
      attemptNumber: 1,
      userId: testUserId,
    });
    assert(pendingB1.status === "PAYMENT_PENDING", "Booking transitioned to PAYMENT_PENDING");
    assert(pendingB1.paymentId === paymentId1, "Booking recorded correct paymentId");

    const event1 = {
      eventId: `evt_${randomUUID()}`,
      eventType: "PaymentSucceeded",
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      payload: {
        bookingId: b1._id.toString(),
        paymentId: paymentId1,
        attemptNumber: 1,
        attemptId: `att_${b1._id}_1`,
        userId: testUserId,
        amountMinor: 500000,
        currency: "INR",
      },
    };
    const outcome1 = await processPaymentResult(event1);
    assert(outcome1 === "CONFIRMED", `processPaymentResult returned 'CONFIRMED' (got: ${outcome1})`);

    const confirmedB1 = await Booking.findById(b1._id).lean();
    assert(confirmedB1.status === "CONFIRMED", "Booking status is CONFIRMED");
    assert(confirmedB1.holdExpiresAt === null, "holdExpiresAt cleared to null on confirmation");

    const inv1 = await DailyInventory.findOne({ roomCategoryId: rc1, date: stayDateUTC }).lean();
    assert(inv1.heldUnits === 0, `heldUnits converted from 1 to 0 (got: ${inv1.heldUnits})`);
    assert(inv1.bookedUnits === 1, `bookedUnits incremented from 0 to 1 (got: ${inv1.bookedUnits})`);

    // 1.2 Idempotent Payment Pending Call
    console.log("\n1.2 Testing Idempotent Payment Initiation...");
    const repeatPendingB1 = await markBookingPaymentPending({
      bookingId: b1._id.toString(),
      paymentId: paymentId1,
      attemptNumber: 1,
      userId: testUserId,
    });
    assert(repeatPendingB1.status === "CONFIRMED", "Confirmed booking idempotent call returns CONFIRMED");

    // 1.3 Normal Failure Path: HELD -> PAYMENT_PENDING -> PAYMENT_FAILED
    console.log("\n1.3 Testing Normal Failure Path (HELD -> PAYMENT_PENDING -> PAYMENT_FAILED)...");
    const { booking: b2, roomCategoryId: rc2 } = await createTestBookingWithInventory();
    const paymentId2 = `pay_p3_${randomUUID().replace(/-/g, "")}`;

    await markBookingPaymentPending({
      bookingId: b2._id.toString(),
      paymentId: paymentId2,
      attemptNumber: 1,
      userId: testUserId,
    });

    const eventFail = {
      eventId: `evt_${randomUUID()}`,
      eventType: "PaymentFailed",
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      payload: {
        bookingId: b2._id.toString(),
        paymentId: paymentId2,
        failureCode: "CARD_DECLINED",
      },
    };
    const outcomeFail = await processPaymentResult(eventFail);
    assert(outcomeFail === "PAYMENT_FAILED", `processPaymentResult returned 'PAYMENT_FAILED' (got: ${outcomeFail})`);

    const failedB2 = await Booking.findById(b2._id).lean();
    assert(failedB2.status === "PAYMENT_FAILED", "Booking status is PAYMENT_FAILED");
    assert(failedB2.holdExpiresAt === null, "holdExpiresAt cleared to null on failure");

    const inv2 = await DailyInventory.findOne({ roomCategoryId: rc2, date: stayDateUTC }).lean();
    assert(inv2.heldUnits === 0, `heldUnits cleanly released to 0 (got: ${inv2.heldUnits})`);
    assert(inv2.bookedUnits === 0, "bookedUnits remains 0");

    // 1.4 Hold Expiration Path: HELD -> EXPIRED
    console.log("\n1.4 Testing Hold Expiration Path (HELD -> EXPIRED)...");
    const { booking: b3, roomCategoryId: rc3 } = await createTestBookingWithInventory({
      holdExpiresAt: new Date(Date.now() - 5000), // Expired 5s ago
    });

    const expiredResult = await expireBookingHold(b3._id.toString());
    assert(expiredResult === true, "expireBookingHold returned true");

    const expiredB3 = await Booking.findById(b3._id).lean();
    assert(expiredB3.status === "EXPIRED", "Booking status transitioned to EXPIRED");

    const inv3 = await DailyInventory.findOne({ roomCategoryId: rc3, date: stayDateUTC }).lean();
    assert(inv3.heldUnits === 0, `heldUnits cleanly released on expiration (got: ${inv3.heldUnits})`);

    // 1.5 User Cancellation Path: HELD -> CANCELLED
    console.log("\n1.5 Testing User Cancellation Path (HELD -> CANCELLED)...");
    const { booking: b4, roomCategoryId: rc4 } = await createTestBookingWithInventory();

    const cancelledB4 = await cancelBooking({
      bookingId: b4._id.toString(),
      userId: testUserId,
    });
    assert(cancelledB4.status === "CANCELLED", "cancelBooking transitioned booking to CANCELLED");
    assert(cancelledB4.holdExpiresAt === null, "holdExpiresAt cleared to null on cancellation");

    const inv4 = await DailyInventory.findOne({ roomCategoryId: rc4, date: stayDateUTC }).lean();
    assert(inv4.heldUnits === 0, `heldUnits cleanly released on cancellation (got: ${inv4.heldUnits})`);

    // =========================================================================
    // Group 2: Ownership, Authentication & Hold Expiry Rules
    // =========================================================================
    console.log("\n--- Group 2: Ownership, Authentication & Hold Expiry Rules ---");

    // 2.1 Booking Ownership Check
    console.log("2.1 Testing Booking Ownership Enforcement...");
    const { booking: b5 } = await createTestBookingWithInventory();
    let wrongUserCaught = false;
    try {
      await markBookingPaymentPending({
        bookingId: b5._id.toString(),
        paymentId: `pay_${randomUUID()}`,
        attemptNumber: 1,
        userId: "wrong_unauthorized_user",
      });
    } catch (err) {
      if (err.code === "BOOKING_NOT_FOUND") wrongUserCaught = true;
    }
    assert(wrongUserCaught, "Access with wrong userId rejected with BOOKING_NOT_FOUND (404 anti-harvesting)");

    // 2.2 Expired Hold Rejection
    console.log("\n2.2 Testing Expired Hold Payment Rejection...");
    const { booking: b6 } = await createTestBookingWithInventory({
      holdExpiresAt: new Date(Date.now() - 10000), // Expired
    });
    let expiredHoldCaught = false;
    try {
      await markBookingPaymentPending({
        bookingId: b6._id.toString(),
        paymentId: `pay_${randomUUID()}`,
        attemptNumber: 1,
        userId: testUserId,
      });
    } catch (err) {
      if (err.code === "BOOKING_ALREADY_EXPIRED") expiredHoldCaught = true;
    }
    assert(expiredHoldCaught, "Initiating payment on expired hold rejected with BOOKING_ALREADY_EXPIRED");

    // 2.3 Cannot Cancel Booking in PAYMENT_PENDING
    console.log("\n2.3 Testing Cancellation Block in PAYMENT_PENDING State...");
    const { booking: b7 } = await createTestBookingWithInventory();
    await markBookingPaymentPending({
      bookingId: b7._id.toString(),
      paymentId: `pay_${randomUUID()}`,
      attemptNumber: 1,
      userId: testUserId,
    });
    let cancelInPaymentCaught = false;
    try {
      await cancelBooking({ bookingId: b7._id.toString(), userId: testUserId });
    } catch (err) {
      if (err.code === "BOOKING_NOT_CANCELLABLE") cancelInPaymentCaught = true;
    }
    assert(cancelInPaymentCaught, "Cancelling booking in PAYMENT_PENDING rejected with BOOKING_NOT_CANCELLABLE");

    // 2.4 Cannot Cancel Booking in CONFIRMED
    console.log("\n2.4 Testing Cancellation Block in CONFIRMED State...");
    let cancelConfirmedCaught = false;
    try {
      await cancelBooking({ bookingId: b1._id.toString(), userId: testUserId });
    } catch (err) {
      if (err.code === "BOOKING_NOT_CANCELLABLE") cancelConfirmedCaught = true;
    }
    assert(cancelConfirmedCaught, "Cancelling confirmed booking rejected with BOOKING_NOT_CANCELLABLE");

    // =========================================================================
    // Group 3: Multi-Attempt Advancement & Terminal Proof Rules
    // =========================================================================
    console.log("\n--- Group 3: Multi-Attempt Advancement & Terminal Proof Rules ---");

    const { booking: b8, roomCategoryId: rc8 } = await createTestBookingWithInventory();
    const att1PaymentId = `pay_att1_${randomUUID().replace(/-/g, "")}`;
    const att2PaymentId = `pay_att2_${randomUUID().replace(/-/g, "")}`;

    await markBookingPaymentPending({
      bookingId: b8._id.toString(),
      paymentId: att1PaymentId,
      attemptNumber: 1,
      userId: testUserId,
    });

    // 3.1 Missing Terminal Proof
    console.log("3.1 Testing Missing Terminal Proof Rejection...");
    let missingProofCaught = false;
    try {
      await markBookingPaymentPending({
        bookingId: b8._id.toString(),
        paymentId: att2PaymentId,
        attemptNumber: 2,
        userId: testUserId,
        previousAttempt: null,
      });
    } catch (err) {
      if (err.code === "PREVIOUS_ATTEMPT_PROOF_REQUIRED") missingProofCaught = true;
    }
    assert(missingProofCaught, "Advancement without proof rejected with PREVIOUS_ATTEMPT_PROOF_REQUIRED");

    // 3.2 Non-Terminal Proof
    console.log("\n3.2 Testing Non-Terminal Proof Rejection...");
    let nonTerminalProofCaught = false;
    try {
      await markBookingPaymentPending({
        bookingId: b8._id.toString(),
        paymentId: att2PaymentId,
        attemptNumber: 2,
        userId: testUserId,
        previousAttempt: {
          paymentId: att1PaymentId,
          terminalStatus: "PROCESSING",
        },
      });
    } catch (err) {
      if (err.code === "PREVIOUS_ATTEMPT_NOT_TERMINAL") nonTerminalProofCaught = true;
    }
    assert(nonTerminalProofCaught, "Advancement with non-terminal proof rejected with PREVIOUS_ATTEMPT_NOT_TERMINAL");

    // 3.3 Mismatched Previous PaymentId Proof
    console.log("\n3.3 Testing Mismatched Previous PaymentId Rejection...");
    let mismatchPrevIdCaught = false;
    try {
      await markBookingPaymentPending({
        bookingId: b8._id.toString(),
        paymentId: att2PaymentId,
        attemptNumber: 2,
        userId: testUserId,
        previousAttempt: {
          paymentId: "wrong_previous_pay_id",
          terminalStatus: "CANCELLED",
        },
      });
    } catch (err) {
      if (err.code === "PREVIOUS_PAYMENT_ID_MISMATCH") mismatchPrevIdCaught = true;
    }
    assert(mismatchPrevIdCaught, "Advancement with mismatched previous paymentId rejected with PREVIOUS_PAYMENT_ID_MISMATCH");

    // 3.4 Valid Attempt 1 -> Attempt 2 Advancement
    console.log("\n3.4 Testing Valid Attempt 1 -> Attempt 2 Advancement...");
    const advancedB8 = await markBookingPaymentPending({
      bookingId: b8._id.toString(),
      paymentId: att2PaymentId,
      attemptNumber: 2,
      userId: testUserId,
      previousAttempt: {
        paymentId: att1PaymentId,
        terminalStatus: "CANCELLED",
      },
    });
    assert(advancedB8.paymentAttemptCount === 2, `Booking successfully advanced to paymentAttemptCount: 2`);
    assert(advancedB8.paymentId === att2PaymentId, `Booking paymentId updated to Attempt 2 paymentId`);

    const inv8 = await DailyInventory.findOne({ roomCategoryId: rc8, date: stayDateUTC }).lean();
    assert(inv8.heldUnits === 1, `Held inventory preserved for Attempt 2 (heldUnits: ${inv8.heldUnits})`);

    // 3.5 Atomic Concurrent Attempt Advancement Test
    console.log("\n3.5 Testing Atomic Concurrent Attempt Advancement Race Condition...");
    const { booking: b9 } = await createTestBookingWithInventory();
    const initPayId = `pay_init_${randomUUID().replace(/-/g, "")}`;
    await markBookingPaymentPending({
      bookingId: b9._id.toString(),
      paymentId: initPayId,
      attemptNumber: 1,
      userId: testUserId,
    });

    const candPayIdA = `pay_cand_A_${randomUUID().replace(/-/g, "")}`;
    const candPayIdB = `pay_cand_B_${randomUUID().replace(/-/g, "")}`;

    const concurrentAdvancements = await Promise.allSettled([
      markBookingPaymentPending({
        bookingId: b9._id.toString(),
        paymentId: candPayIdA,
        attemptNumber: 2,
        userId: testUserId,
        previousAttempt: { paymentId: initPayId, terminalStatus: "CANCELLED" },
      }),
      markBookingPaymentPending({
        bookingId: b9._id.toString(),
        paymentId: candPayIdB,
        attemptNumber: 2,
        userId: testUserId,
        previousAttempt: { paymentId: initPayId, terminalStatus: "CANCELLED" },
      }),
    ]);

    const fulfilledCount = concurrentAdvancements.filter((r) => r.status === "fulfilled").length;
    const rejectedCount = concurrentAdvancements.filter((r) => r.status === "rejected").length;

    assert(fulfilledCount === 1, `Exactly one concurrent transition succeeded (fulfilled: ${fulfilledCount})`);
    assert(rejectedCount === 1, `The concurrent competitor was rejected (rejected: ${rejectedCount})`);

    const b9Doc = await Booking.findById(b9._id).lean();
    assert(b9Doc.paymentAttemptCount === 2, "Booking paymentAttemptCount was advanced exactly once to 2");

    // =========================================================================
    // Group 4: Duplicate & Out-Of-Order Event Resilience
    // =========================================================================
    console.log("\n--- Group 4: Duplicate & Out-Of-Order Event Resilience ---");

    // 4.1 Duplicate Event Protection (Same eventId)
    console.log("4.1 Testing Duplicate Event Detection (Identical eventId)...");
    const dupOutcome = await processPaymentResult(event1);
    assert(dupOutcome === "DUPLICATE", `Re-processing event1 returned 'DUPLICATE' (got: ${dupOutcome})`);

    const inv1AfterDup = await DailyInventory.findOne({ roomCategoryId: rc1, date: stayDateUTC }).lean();
    assert(inv1AfterDup.bookedUnits === 1, "Duplicate event did NOT double-increment bookedUnits");

    // 4.2 Duplicate Event with Fresh eventId on Already CONFIRMED Booking
    console.log("\n4.2 Testing Fresh eventId on Already CONFIRMED Booking...");
    const freshDupEvent = {
      ...event1,
      eventId: `evt_fresh_${randomUUID()}`,
    };
    const freshDupOutcome = await processPaymentResult(freshDupEvent);
    assert(freshDupOutcome === "ALREADY_CONFIRMED", `Fresh eventId on confirmed booking returned 'ALREADY_CONFIRMED' (got: ${freshDupOutcome})`);

    // 4.3 Stale PaymentFailed on Already CONFIRMED Booking
    console.log("\n4.3 Testing Out-of-Order PaymentFailed on CONFIRMED Booking...");
    const staleFailEvent = {
      eventId: `evt_${randomUUID()}`,
      eventType: "PaymentFailed",
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      payload: {
        bookingId: b1._id.toString(),
        paymentId: paymentId1,
        failureCode: "LATE_DECLINE",
      },
    };
    const staleFailOutcome = await processPaymentResult(staleFailEvent);
    assert(staleFailOutcome === "STALE_PAYMENT_FAILURE", `Delayed failure on confirmed booking returned 'STALE_PAYMENT_FAILURE' (got: ${staleFailOutcome})`);

    const b1AfterStale = await Booking.findById(b1._id).lean();
    assert(b1AfterStale.status === "CONFIRMED", "Confirmed booking remained CONFIRMED");

    // 4.4 Stale PaymentFailed from Attempt 1 after Attempt 2 was initiated
    console.log("\n4.4 Testing Stale PaymentFailed from Attempt 1 after Attempt 2 Initiated...");
    const staleAtt1FailEvent = {
      eventId: `evt_${randomUUID()}`,
      eventType: "PaymentFailed",
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      payload: {
        bookingId: b8._id.toString(),
        paymentId: att1PaymentId, // Old paymentId
        failureCode: "ATTEMPT_1_DECLINED",
      },
    };
    const staleAtt1Outcome = await processPaymentResult(staleAtt1FailEvent);
    assert(staleAtt1Outcome === "STALE_PAYMENT_FAILURE", `Old attempt failure returned 'STALE_PAYMENT_FAILURE' (got: ${staleAtt1Outcome})`);

    const b8AfterStale = await Booking.findById(b8._id).lean();
    assert(b8AfterStale.status === "PAYMENT_PENDING", "Booking remained in PAYMENT_PENDING for Attempt 2");
    assert(b8AfterStale.paymentId === att2PaymentId, "Booking paymentId remained set to Attempt 2");

    const inv8AfterStale = await DailyInventory.findOne({ roomCategoryId: rc8, date: stayDateUTC }).lean();
    assert(inv8AfterStale.heldUnits === 1, "Held inventory was NOT released by stale Attempt 1 failure");

    // 4.5 Late PaymentSucceeded on EXPIRED Booking (Reconciliation Required)
    console.log("\n4.5 Testing Late PaymentSucceeded on EXPIRED Booking...");
    const lateSuccessEvent = {
      eventId: `evt_${randomUUID()}`,
      eventType: "PaymentSucceeded",
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      payload: {
        bookingId: b3._id.toString(),
        paymentId: `pay_late_${randomUUID()}`,
        attemptNumber: 1,
        attemptId: `att_${b3._id}_1`,
        userId: testUserId,
        amountMinor: 500000,
        currency: "INR",
      },
    };
    const lateSuccessOutcome = await processPaymentResult(lateSuccessEvent);
    assert(lateSuccessOutcome === "RECONCILIATION_REQUIRED", `Late success on expired booking returned 'RECONCILIATION_REQUIRED' (got: ${lateSuccessOutcome})`);

    const recB3 = await PaymentReconciliation.findOne({ bookingId: b3._id }).lean();
    assert(recB3 !== null, "PaymentReconciliation record was created");
    assert(recB3.reason === "PAYMENT_ID_MISMATCH" || recB3.reason === "BOOKING_NOT_PAYMENT_PENDING", `Reconciliation reason recorded (${recB3.reason})`);

    const b3StillExpired = await Booking.findById(b3._id).lean();
    assert(b3StillExpired.status === "EXPIRED", "Expired booking remained EXPIRED");

    // 4.6 Late PaymentSucceeded on CANCELLED Booking
    console.log("\n4.6 Testing Late PaymentSucceeded on CANCELLED Booking...");
    const lateCancelSuccessEvent = {
      eventId: `evt_${randomUUID()}`,
      eventType: "PaymentSucceeded",
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      payload: {
        bookingId: b4._id.toString(),
        paymentId: `pay_late_cancel_${randomUUID()}`,
        attemptNumber: 1,
        attemptId: `att_${b4._id}_1`,
        userId: testUserId,
        amountMinor: 500000,
        currency: "INR",
      },
    };
    const lateCancelOutcome = await processPaymentResult(lateCancelSuccessEvent);
    assert(lateCancelOutcome === "RECONCILIATION_REQUIRED", "Late success on cancelled booking returned 'RECONCILIATION_REQUIRED'");

    const b4StillCancelled = await Booking.findById(b4._id).lean();
    assert(b4StillCancelled.status === "CANCELLED", "Cancelled booking remained CANCELLED");

    // 4.7 Amount & Currency Mismatch Protection
    console.log("\n4.7 Testing Amount and Currency Mismatches in PaymentSucceeded...");
    const { booking: b10 } = await createTestBookingWithInventory();
    const payId10 = `pay_10_${randomUUID().replace(/-/g, "")}`;
    await markBookingPaymentPending({
      bookingId: b10._id.toString(),
      paymentId: payId10,
      attemptNumber: 1,
      userId: testUserId,
    });

    const wrongAmountEvent = {
      eventId: `evt_${randomUUID()}`,
      eventType: "PaymentSucceeded",
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      payload: {
        bookingId: b10._id.toString(),
        paymentId: payId10,
        attemptNumber: 1,
        attemptId: `att_${b10._id}_1`,
        userId: testUserId,
        amountMinor: 999999, // Expected 500000
        currency: "INR",
      },
    };
    const amountMismatchOutcome = await processPaymentResult(wrongAmountEvent);
    assert(amountMismatchOutcome === "RECONCILIATION_REQUIRED", "Amount mismatch triggered 'RECONCILIATION_REQUIRED'");

    const recAmount = await PaymentReconciliation.findOne({ eventId: wrongAmountEvent.eventId }).lean();
    assert(recAmount.reason === "PAYMENT_AMOUNT_MISMATCH", "Reconciliation recorded 'PAYMENT_AMOUNT_MISMATCH'");

    const wrongCurrencyEvent = {
      eventId: `evt_${randomUUID()}`,
      eventType: "PaymentSucceeded",
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      payload: {
        bookingId: b10._id.toString(),
        paymentId: payId10,
        attemptNumber: 1,
        attemptId: `att_${b10._id}_1`,
        userId: testUserId,
        amountMinor: 500000,
        currency: "USD", // Expected INR
      },
    };
    const currencyMismatchOutcome = await processPaymentResult(wrongCurrencyEvent);
    assert(currencyMismatchOutcome === "RECONCILIATION_REQUIRED", "Currency mismatch triggered 'RECONCILIATION_REQUIRED'");

    const recCurrency = await PaymentReconciliation.findOne({ eventId: wrongCurrencyEvent.eventId }).lean();
    assert(recCurrency.reason === "PAYMENT_CURRENCY_MISMATCH", "Reconciliation recorded 'PAYMENT_CURRENCY_MISMATCH'");

    // =========================================================================
    // Group 5: Inventory Double-Release / Double-Reservation Protection
    // =========================================================================
    console.log("\n--- Group 5: Inventory Double-Release / Double-Reservation Protection ---");

    // 5.1 Idempotent Cancellation Inventory Safety
    console.log("5.1 Testing Idempotent Cancellation Inventory Safety...");
    const inv4BeforeRepeat = await DailyInventory.findOne({ roomCategoryId: rc4, date: stayDateUTC }).lean();
    await cancelBooking({ bookingId: b4._id.toString(), userId: testUserId });
    const inv4AfterRepeat = await DailyInventory.findOne({ roomCategoryId: rc4, date: stayDateUTC }).lean();
    assert(inv4BeforeRepeat.heldUnits === inv4AfterRepeat.heldUnits, "Second cancelBooking call did not alter heldUnits");

    // 5.2 Idempotent Expiration Inventory Safety
    console.log("\n5.2 Testing Idempotent Expiration Inventory Safety...");
    const inv3BeforeRepeat = await DailyInventory.findOne({ roomCategoryId: rc3, date: stayDateUTC }).lean();
    const secondExpireResult = await expireBookingHold(b3._id.toString());
    assert(secondExpireResult === false, "Second expireBookingHold call returned false");
    const inv3AfterRepeat = await DailyInventory.findOne({ roomCategoryId: rc3, date: stayDateUTC }).lean();
    assert(inv3BeforeRepeat.heldUnits === inv3AfterRepeat.heldUnits, "Second expireBookingHold call did not alter heldUnits");

    // 5.3 Defense Against Negative Inventory
    console.log("\n5.3 Testing Defense Against Negative Inventory Decrement...");
    let negativeInvCaught = false;
    try {
      const updateResult = await DailyInventory.updateOne(
        {
          roomCategoryId: rc1,
          date: stayDateUTC,
          heldUnits: { $gte: 1 }, // Already 0!
        },
        {
          $inc: { heldUnits: -1 },
        }
      );
      if (updateResult.modifiedCount !== 1) negativeInvCaught = true;
    } catch {
      negativeInvCaught = true;
    }
    assert(negativeInvCaught, "Decrementing heldUnits below 0 blocked by heldUnits: { $gte: 1 } predicate");

    // Cleanup test data created during this run
    await Booking.deleteMany({ userId: testUserId });
    await DailyInventory.deleteMany({ roomCategoryId: { $in: [rc1, rc2, rc3, rc4, rc8, b9.roomCategoryId, b10.roomCategoryId] } });
    await PaymentReconciliation.deleteMany({ bookingId: { $in: [b1._id, b2._id, b3._id, b4._id, b8._id, b9._id, b10._id] } });
    await ProcessedEvent.deleteMany({ eventId: { $regex: "^evt_" } });
    console.log("\n✓ Cleaned up test records.");

  } finally {
    await mongoose.disconnect();
  }

  console.log(`\n========================================`);
  console.log(`Phase 3 Test Result: ${passed}/${total} passed`);
  console.log(`========================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runPhase3Tests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
