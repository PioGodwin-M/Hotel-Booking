import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const mongoose = require(path.join(__dirname, "../services/payment-service/node_modules/mongoose"));
const dotenv = require(path.join(__dirname, "../services/payment-service/node_modules/dotenv"));
const Stripe = require(path.join(__dirname, "../services/payment-service/node_modules/stripe"));

dotenv.config({ path: path.join(__dirname, "../services/payment-service/.env") });

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);

const { createPayment } = await import("../services/payment-service/src/services/paymentService.js");
const Payment = (await import("../services/payment-service/src/models/Payment.js")).default;
const PaymentRequest = (await import("../services/payment-service/src/models/PaymentRequest.js")).default;

async function runPhase2Tests() {
  console.log("=== Phase 2 Automated Test Suite: Payment Attempt Reservation & Retry Engine ===\n");
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

  // Connect default mongoose connection for Payment models, and bookingConn for Booking models
  await mongoose.connect(process.env.MONGODB_URI, { dbName: "hotel_payment" });
  const paymentConn = mongoose.connection;
  const bookingConn = await mongoose.createConnection(process.env.MONGODB_URI, { dbName: "hotel_booking" }).asPromise();

  const testUserId = `user_test_retry_${Date.now()}`;
  const testHotelId = new mongoose.Types.ObjectId();
  const testRoomCatId = new mongoose.Types.ObjectId();

  // Helper to create a test booking in hotel_booking
  const createTestBooking = async (overrides = {}) => {
    const bId = new mongoose.Types.ObjectId();
    const doc = {
      _id: bId,
      userId: testUserId,
      hotelId: testHotelId,
      roomCategoryId: testRoomCatId,
      checkIn: new Date(Date.now() + 86400000),
      checkOut: new Date(Date.now() + 2 * 86400000),
      numberOfRooms: 1,
      numberOfGuests: 2,
      priceSnapshot: {
        pricePerNight: 5000,
        numberOfNights: 1,
        totalAmount: 5000,
        currency: "INR",
      },
      status: "HELD",
      holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins in future
      idempotencyKey: `idemp_${bId}`,
      requestFingerprint: `fp_${bId}`,
      paymentId: null,
      paymentAttemptCount: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
    await bookingConn.collection("bookings").insertOne(doc);
    return doc;
  };

  try {
    // ----------------------------------------------------
    // Test 1: Concurrency Test (5 Simultaneous Requests)
    // ----------------------------------------------------
    console.log("1. Testing Concurrent Payment-Attempt Reservation (5 simultaneous calls)...");
    const booking1 = await createTestBooking();
    const bId1 = booking1._id.toString();

    const concurrentResults = await Promise.all([
      createPayment({ bookingId: bId1, userId: testUserId }),
      createPayment({ bookingId: bId1, userId: testUserId }),
      createPayment({ bookingId: bId1, userId: testUserId }),
      createPayment({ bookingId: bId1, userId: testUserId }),
      createPayment({ bookingId: bId1, userId: testUserId }),
    ]);

    const firstPaymentId = concurrentResults[0].paymentId;
    const firstClientSecret = concurrentResults[0].clientSecret;
    const allSamePaymentId = concurrentResults.every((r) => r.paymentId === firstPaymentId);
    const allSameClientSecret = concurrentResults.every((r) => r.clientSecret === firstClientSecret);
    const allAttempt1 = concurrentResults.every((r) => r.attemptNumber === 1);

    assert(allSamePaymentId, `All 5 concurrent requests returned identical paymentId (${firstPaymentId.slice(0, 16)}...)`);
    assert(allSameClientSecret, "All 5 concurrent requests returned identical clientSecret");
    assert(allAttempt1, "All 5 concurrent requests returned attemptNumber: 1");

    const reqCount1 = await paymentConn.collection("paymentrequests").countDocuments({ bookingId: booking1._id, attemptNumber: 1 });
    const payCount1 = await paymentConn.collection("payments").countDocuments({ bookingId: booking1._id, attemptNumber: 1 });
    assert(reqCount1 === 1, `Exactly 1 PaymentRequest document created (found: ${reqCount1})`);
    assert(payCount1 === 1, `Exactly 1 Payment document created (found: ${payCount1})`);

    // ----------------------------------------------------
    // Test 2: Card Decline / Soft Failure Reusable Intent
    // ----------------------------------------------------
    console.log("\n2. Testing Card Decline / Soft Failure Reuse...");
    // The payment from Test 1 is in REQUIRES_ACTION with Stripe status 'requires_payment_method'
    const repeatResult = await createPayment({ bookingId: bId1, userId: testUserId });
    assert(repeatResult.paymentId === firstPaymentId, "Re-requesting payment reuses existing paymentId");
    assert(repeatResult.attemptNumber === 1, "Re-requesting reusable attempt maintains attemptNumber: 1");
    assert(repeatResult.clientSecret === firstClientSecret, "Re-requesting reusable attempt returns existing clientSecret without creating new intent");

    // ----------------------------------------------------
    // Test 3: Lease Expiry & Crash Recovery
    // ----------------------------------------------------
    console.log("\n3. Testing Expired-Lease Takeover & Worker Crash Recovery...");
    const booking2 = await createTestBooking();
    const bId2 = booking2._id.toString();
    const expiredAttemptKey = `pay_booking_${bId2}_att_1`;
    const dummyPaymentId = `pay_dummy_${Date.now()}`;

    // Simulate an abandoned reservation from a crashed worker
    await paymentConn.collection("paymentrequests").insertOne({
      userId: testUserId,
      idempotencyKey: expiredAttemptKey,
      bookingId: booking2._id,
      attemptNumber: 1,
      attemptId: `att_${bId2}_1`,
      paymentId: dummyPaymentId,
      status: "PROCESSING",
      leaseToken: "crashed-worker-token-xyz",
      leaseUntil: new Date(Date.now() - 10000), // Expired 10s ago
      createdAt: new Date(Date.now() - 15000),
      updatedAt: new Date(Date.now() - 15000),
    });

    // Calling createPayment should atomically take over the expired lease and finish
    const recoveredResult = await createPayment({ bookingId: bId2, userId: testUserId });
    assert(recoveredResult && recoveredResult.clientSecret, "Expired lease was taken over and payment created successfully");
    assert(recoveredResult.attemptNumber === 1, "Recovered attempt maintains attemptNumber: 1");

    const reqDoc2 = await paymentConn.collection("paymentrequests").findOne({ bookingId: booking2._id, attemptNumber: 1 });
    assert(reqDoc2.status === "COMPLETED", "Recovered reservation transitioned to COMPLETED");
    assert(reqDoc2.leaseToken !== "crashed-worker-token-xyz", "Recovered reservation generated a fresh leaseToken");

    // -------------------------------------------------------------------------
    // Test 3B: Dedicated Post-Stripe Crash Recovery Test (Real Stripe Test-Mode API)
    // -------------------------------------------------------------------------
    // Failure model being simulated:
    // 1. Stripe successfully creates a PaymentIntent.
    // 2. The Payment Service crashes BEFORE persisting stripePaymentIntentId into MongoDB.
    // 3. The reservation lease expires.
    // 4. A retry takes over the expired lease.
    // 5. Stripe returns the ORIGINAL PaymentIntent using the deterministic idempotency key.
    // 6. MongoDB links the original PaymentIntent without creating another.
    //
    // NOTE ON STRIPE IDEMPOTENCY KEY RETENTION:
    // Stripe retains and enforces idempotency keys for 24 hours. Within 24 hours,
    // sending the same idempotency key guarantees Stripe replays the original response.
    // For long outages (>24h), reconciliation must query existing intents by metadata before creation.
    console.log("\n3B. Testing Dedicated Post-Stripe Crash Recovery (Stripe created -> crash before MongoDB update -> retry)...");
    const bookingCrash = await createTestBooking();
    const bIdCrash = bookingCrash._id.toString();
    const idempotencyKeyCrash = `pay_booking_${bIdCrash}_att_1`;
    const hashCrash = createHash("sha256")
      .update(`${testUserId}:${idempotencyKeyCrash}`)
      .digest("hex");
    const deterministicPaymentId = `pay_${hashCrash}`;

    // Step 1: Create the PaymentIntent directly on Stripe using real test-mode API
    const preCreatedIntent = await stripeClient.paymentIntents.create(
      {
        amount: 500000,
        currency: "inr",
        automatic_payment_methods: { enabled: true },
        metadata: {
          paymentId: deterministicPaymentId,
          bookingId: bIdCrash,
          userId: testUserId,
        },
      },
      { idempotencyKey: deterministicPaymentId }
    );

    // Step 2: Advance booking to PAYMENT_PENDING with deterministicPaymentId
    await bookingConn.collection("bookings").updateOne(
      { _id: bookingCrash._id },
      { $set: { status: "PAYMENT_PENDING", paymentId: deterministicPaymentId, paymentAttemptCount: 1 } }
    );

    // MongoDB Payment doc has stripePaymentIntentId: null (simulating crash before update!)
    await paymentConn.collection("payments").insertOne({
      paymentId: deterministicPaymentId,
      bookingId: bookingCrash._id,
      userId: testUserId,
      attemptNumber: 1,
      attemptId: `att_${bIdCrash}_1`,
      amountMinor: 500000,
      currency: "INR",
      provider: "STRIPE",
      status: "CREATED",
      idempotencyKey: idempotencyKeyCrash,
      stripePaymentIntentId: null, // CRASH BEFORE PERSISTENCE
      createdAt: new Date(Date.now() - 20000),
      updatedAt: new Date(Date.now() - 20000),
    });

    // Step 3: Insert expired PaymentRequest (simulating crashed worker)
    await paymentConn.collection("paymentrequests").insertOne({
      userId: testUserId,
      idempotencyKey: idempotencyKeyCrash,
      bookingId: bookingCrash._id,
      attemptNumber: 1,
      attemptId: `att_${bIdCrash}_1`,
      paymentId: deterministicPaymentId,
      status: "PROCESSING",
      leaseToken: "crashed-worker-post-stripe",
      leaseUntil: new Date(Date.now() - 5000), // Expired 5s ago
      createdAt: new Date(Date.now() - 20000),
      updatedAt: new Date(Date.now() - 20000),
    });

    // Step 4 & 5: Invoke createPayment. The retry takes over lease, queries Stripe with identical idempotency key,
    // and links the original intent.
    const crashRecoveredResult = await createPayment({ bookingId: bIdCrash, userId: testUserId });

    // Step 6: Verify assertions
    assert(
      crashRecoveredResult.clientSecret === preCreatedIntent.client_secret,
      "Retry returned the original Stripe clientSecret via Stripe idempotency replay"
    );
    assert(
      crashRecoveredResult.paymentId === deterministicPaymentId,
      "Retry maintained the identical deterministic paymentId"
    );

    const updatedPaymentDoc = await paymentConn.collection("payments").findOne({ bookingId: bookingCrash._id, attemptNumber: 1 });
    assert(
      updatedPaymentDoc.stripePaymentIntentId === preCreatedIntent.id,
      `MongoDB Payment document successfully linked original stripePaymentIntentId (${preCreatedIntent.id})`
    );

    const totalPaymentsForCrashBooking = await paymentConn.collection("payments").countDocuments({ bookingId: bookingCrash._id });
    assert(totalPaymentsForCrashBooking === 1, "Exactly 1 Payment record exists in MongoDB (no duplicate created)");

    const totalRequestsForCrashBooking = await paymentConn.collection("paymentrequests").countDocuments({ bookingId: bookingCrash._id });
    assert(totalRequestsForCrashBooking === 1, "Exactly 1 PaymentRequest record exists in MongoDB (no duplicate created)");

    const reqDocCrash = await paymentConn.collection("paymentrequests").findOne({ bookingId: bookingCrash._id, attemptNumber: 1 });
    assert(reqDocCrash.status === "COMPLETED", "Recovered reservation transitioned to COMPLETED");

    // ----------------------------------------------------
    // Test 4: Definitively Terminal Attempt Retry Advancement
    // ----------------------------------------------------
    console.log("\n4. Testing Definitively Terminal Retry Advancement (Attempt 1 -> Attempt 2)...");
    // Mark Attempt 1 on booking1 as CANCELLED
    await paymentConn.collection("payments").updateOne(
      { bookingId: booking1._id, attemptNumber: 1 },
      { $set: { status: "CANCELLED", failureCode: "PAYMENT_INTENT_CANCELLED", failureMessage: "Test Intent Cancelled" } }
    );

    const attempt2Result = await createPayment({ bookingId: bId1, userId: testUserId });
    assert(attempt2Result.attemptNumber === 2, `Attempt 2 initiated with attemptNumber: 2 (got: ${attempt2Result.attemptNumber})`);
    assert(attempt2Result.paymentId !== firstPaymentId, "Attempt 2 generated a distinct new paymentId");
    assert(attempt2Result.clientSecret !== firstClientSecret, "Attempt 2 created a new Stripe PaymentIntent");

    const updatedBooking1 = await bookingConn.collection("bookings").findOne({ _id: booking1._id });
    assert(updatedBooking1.paymentAttemptCount === 2, "Booking Service accepted Attempt 2 and recorded paymentAttemptCount: 2");
    assert(updatedBooking1.paymentId === attempt2Result.paymentId, "Booking Service updated its paymentId to Attempt 2 paymentId");

    // ----------------------------------------------------
    // Test 5: Hold Expiration Rejection Test
    // ----------------------------------------------------
    console.log("\n5. Testing Hold Expiration Block...");
    const booking3 = await createTestBooking({
      holdExpiresAt: new Date(Date.now() - 5000), // Hold expired 5s ago
    });
    const bId3 = booking3._id.toString();

    let holdExpiredCaught = false;
    try {
      await createPayment({ bookingId: bId3, userId: testUserId });
    } catch (err) {
      if (err.message.includes("expired") || err.code === "BOOKING_ALREADY_EXPIRED" || err.statusCode === 409) {
        holdExpiredCaught = true;
      }
    }
    assert(holdExpiredCaught, "Attempting payment on expired hold is rejected with 409 BOOKING_ALREADY_EXPIRED");

    // ----------------------------------------------------
    // Test 6: Succeeded Payment Block Test
    // ----------------------------------------------------
    console.log("\n6. Testing Succeeded Payment Block...");
    // Mark Attempt 2 on booking1 as SUCCEEDED
    await paymentConn.collection("payments").updateOne(
      { bookingId: booking1._id, attemptNumber: 2 },
      { $set: { status: "SUCCEEDED" } }
    );

    let alreadyCompletedCaught = false;
    try {
      await createPayment({ bookingId: bId1, userId: testUserId });
    } catch (err) {
      if (err.code === "PAYMENT_ALREADY_SUCCEEDED" || err.statusCode === 409) {
        alreadyCompletedCaught = true;
      }
    }
    assert(alreadyCompletedCaught, "Attempting payment after success is rejected with 409 PAYMENT_ALREADY_SUCCEEDED");

    // Cleanup test bookings
    await bookingConn.collection("bookings").deleteMany({ userId: testUserId });
    await paymentConn.collection("payments").deleteMany({ userId: testUserId });
    await paymentConn.collection("paymentrequests").deleteMany({ userId: testUserId });
    console.log("\n✓ Cleaned up test records.");

  } finally {
    await mongoose.disconnect();
    await bookingConn.close();
  }

  console.log(`\n========================================`);
  console.log(`Phase 2 Test Result: ${passed}/${total} passed`);
  console.log(`========================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runPhase2Tests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
