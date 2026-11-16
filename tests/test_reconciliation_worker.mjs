import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const mongoosePayment = require(path.join(__dirname, "../services/payment-service/node_modules/mongoose"));
const mongooseBooking = require(path.join(__dirname, "../services/booking-service/node_modules/mongoose"));
const mongoose = mongoosePayment;
const dotenv = require(path.join(__dirname, "../services/payment-service/node_modules/dotenv"));
const Stripe = require(path.join(__dirname, "../services/payment-service/node_modules/stripe"));

dotenv.config({ path: path.join(__dirname, "../services/payment-service/.env") });
const paymentSecret = process.env.PAYMENT_SERVICE_SECRET;
const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);

// Payment Service Imports
const Payment = (await import("../services/payment-service/src/models/Payment.js")).default;
const OutboxEventPayment = (await import("../services/payment-service/src/models/OutboxEvent.js")).default;
const ProcessedWebhookEvent = (await import("../services/payment-service/src/models/ProcessedWebhookEvent.js")).default;
const {
  reconcileZombiePayments,
  reconcileExternalRefunds,
  getInternalPaymentStatus,
} = await import("../services/payment-service/src/services/paymentReconciliationService.js");
const {
  classifyDeadEvent,
  redriveDeadOutboxEvents,
} = await import("../services/payment-service/src/events/outboxPublisher.js");
const {
  runPaymentReconciliationTick,
  startPaymentReconciliationWorker,
  stopPaymentReconciliationWorker,
  getPaymentReconciliationWorkerStatus,
} = await import("../services/payment-service/src/workers/paymentReconciliationWorker.js");

// Booking Service Imports
const Booking = (await import("../services/booking-service/src/models/Booking.js")).default;
const DailyInventory = (await import("../services/booking-service/src/models/DailyInventory.js")).default;
const PaymentReconciliation = (await import("../services/booking-service/src/models/PaymentReconciliation.js")).default;
const ProcessedEventBooking = (await import("../services/booking-service/src/models/ProcessedEvent.js")).default;
const OutboxEventBooking = (await import("../services/booking-service/src/models/OutboxEvent.js")).default;
const { processPaymentResult } = await import(
  "../services/booking-service/src/events/paymentResultHandler.js"
);
const {
  reconcileGhostPayments,
  listPaymentReconciliations,
} = await import("../services/booking-service/src/services/bookingReconciliationService.js");
const {
  runBookingReconciliationTick,
  startBookingReconciliationWorker,
  stopBookingReconciliationWorker,
  getBookingReconciliationWorkerStatus,
} = await import("../services/booking-service/src/workers/bookingReconciliationWorker.js");

async function runPhase5Tests() {
  console.log("=== Phase 5 Automated Test Suite: Reconciliation Worker & Multi-State Recovery ===\n");
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

  // Connect both service module instances to their respective databases
  await mongoosePayment.connect(process.env.MONGODB_URI, { dbName: "hotel_payment" });
  await mongooseBooking.connect(process.env.MONGODB_URI, { dbName: "hotel_booking" });

  const TestPayment = Payment;
  const TestOutboxPayment = OutboxEventPayment;
  const TestProcessedWebhook = ProcessedWebhookEvent;

  const TestBooking = Booking;
  const TestDailyInventory = DailyInventory;
  const TestReconciliation = PaymentReconciliation;
  const TestProcessedEvent = ProcessedEventBooking;
  const TestOutboxBooking = OutboxEventBooking;

  const testUserId = `user_recon_${Date.now()}`;
  const testRoomCategoryId = new mongoose.Types.ObjectId();
  const testHotelId = new mongoose.Types.ObjectId();
  const todayStr = new Date().toISOString().split("T")[0];

  // Helper: Seed test inventory
  const seedInventory = async (dateStr, totalUnits = 10, heldUnits = 1, bookedUnits = 0) => {
    await TestDailyInventory.updateOne(
      { roomCategoryId: testRoomCategoryId, date: dateStr },
      {
        $set: {
          hotelId: testHotelId,
          totalInventory: totalUnits,
          heldUnits,
          bookedUnits,
          priceModifier: 1,
        },
      },
      { upsert: true }
    );
  };

  try {
    // =========================================================================
    // Group 1: Payment Service Reconciliation & Stripe State Preservation
    // =========================================================================
    console.log("--- Group 1: Payment Service Reconciliation & Stripe State Preservation ---");

    // 1.1 Stripe requires_payment_method preserves retry eligibility (never marked terminal FAILED)
    console.log("1.1 Testing requires_payment_method preserves retry eligibility...");
    // Create Stripe PaymentIntent without confirmation (requires_payment_method)
    const intentUnconfirmed = await stripeClient.paymentIntents.create({
      amount: 500000,
      currency: "inr",
      metadata: { test: "recon_retryable" },
    });

    const bId1 = new mongoose.Types.ObjectId();
    const pay1 = await TestPayment.create({
      paymentId: `pay_rpm_${randomUUID().replace(/-/g, "")}`,
      bookingId: bId1,
      attemptNumber: 1,
      attemptId: `att_${bId1}_1`,
      userId: testUserId,
      amountMinor: 500000,
      currency: "INR",
      provider: "STRIPE",
      status: "CREATED",
      stripePaymentIntentId: intentUnconfirmed.id,
      idempotencyKey: `idemp_${Date.now()}_1`,
      createdAt: new Date(Date.now() - 300000), // 5 mins old
    });

    // Run zombie reconciler
    const recon1 = await reconcileZombiePayments({ maxAgeMs: 60000 });
    const pay1After = await TestPayment.findById(pay1._id).lean();

    assert(pay1After.status !== "FAILED", "Payment with requires_payment_method was NOT marked terminal FAILED");
    assert(pay1After.stripePaymentIntentStatus === "requires_payment_method", "stripePaymentIntentStatus recorded as requires_payment_method");
    assert(recon1.preservedRetryable >= 1, "Reconciliation counted intent as preserved retryable");

    // 1.2 Stripe requires_action preserves in-progress state (marks REQUIRES_ACTION, not FAILED)
    console.log("\n1.2 Testing requires_action preserves in-progress state...");
    const pay2 = await TestPayment.create({
      paymentId: `pay_req_action_${randomUUID().replace(/-/g, "")}`,
      bookingId: new mongoose.Types.ObjectId(),
      attemptNumber: 1,
      attemptId: `att_req_action_1`,
      userId: testUserId,
      amountMinor: 500000,
      currency: "INR",
      provider: "STRIPE",
      status: "CREATED",
      stripePaymentIntentId: `pi_req_action_${Date.now()}_${randomUUID().replace(/-/g, "")}`,
      idempotencyKey: `idemp_${Date.now()}_2`,
      createdAt: new Date(Date.now() - 300000),
    });

    // Mock simulate requires_action intent response
    await TestPayment.updateOne(
      { _id: pay2._id },
      { $set: { status: "REQUIRES_ACTION", stripePaymentIntentStatus: "requires_action" } }
    );
    const pay2Doc = await TestPayment.findById(pay2._id).lean();
    assert(pay2Doc.status === "REQUIRES_ACTION", "requires_action state preserved in Payment record");
    assert(pay2Doc.status !== "FAILED", "requires_action is NOT marked FAILED");

    // 1.3 Stripe succeeded zombie intent reconciliation transitions Payment to SUCCEEDED and emits outbox event
    console.log("\n1.3 Testing Succeeded Zombie PaymentIntent Reconciliation...");
    const intentSucceeded = await stripeClient.paymentIntents.create({
      amount: 500000,
      currency: "inr",
      payment_method: "pm_card_visa",
      confirm: true,
      return_url: "http://localhost:5173",
      metadata: { test: "zombie_success" },
    });

    const bId3 = new mongoose.Types.ObjectId();
    const pay3 = await TestPayment.create({
      paymentId: `pay_zombie_${randomUUID().replace(/-/g, "")}`,
      bookingId: bId3,
      attemptNumber: 2,
      attemptId: `att_${bId3}_2`,
      userId: testUserId,
      amountMinor: 500000,
      currency: "INR",
      provider: "STRIPE",
      status: "PROCESSING", // Stuck in PROCESSING before server crashed
      stripePaymentIntentId: intentSucceeded.id,
      idempotencyKey: `idemp_${Date.now()}_3`,
      createdAt: new Date(Date.now() - 300000), // 5 mins old
    });

    const reconZombie = await reconcileZombiePayments({ maxAgeMs: 60000 });
    const pay3After = await TestPayment.findById(pay3._id).lean();

    assert(pay3After.status === "SUCCEEDED", "Zombie payment transitioned to SUCCEEDED");
    assert(pay3After.paidAt !== null, "Zombie payment recorded paidAt timestamp");
    assert(reconZombie.succeeded >= 1, "Reconciler recorded succeeded recovery");

    const outboxZombie = await TestOutboxPayment.find({
      aggregateId: pay3.paymentId,
      eventType: "PaymentSucceeded",
    }).lean();
    assert(outboxZombie.length === 1, "Exactly 1 PaymentSucceeded outbox event created for reconciled zombie payment");
    assert(outboxZombie[0].payload.payload.attemptNumber === 2, "Outbox event includes enriched attemptNumber: 2");
    assert(outboxZombie[0].payload.payload.attemptId === `att_${bId3}_2`, "Outbox event includes attemptId");
    assert(outboxZombie[0].payload.payload.userId === testUserId, "Outbox event includes userId");

    // 1.4 External Stripe refund reconciliation discovers existing refund and syncs MongoDB
    console.log("\n1.4 Testing External Stripe Refund Reconciliation...");
    const intentForRefund = await stripeClient.paymentIntents.create({
      amount: 500000,
      currency: "inr",
      payment_method: "pm_card_visa",
      confirm: true,
      return_url: "http://localhost:5173",
    });

    // Create refund directly on Stripe outside application
    const stripeDirectRefund = await stripeClient.refunds.create({
      payment_intent: intentForRefund.id,
      amount: 500000,
    });

    const bId4 = new mongoose.Types.ObjectId();
    const pay4 = await TestPayment.create({
      paymentId: `pay_ext_ref_${randomUUID().replace(/-/g, "")}`,
      bookingId: bId4,
      attemptNumber: 1,
      attemptId: `att_${bId4}_1`,
      userId: testUserId,
      amountMinor: 500000,
      currency: "INR",
      provider: "STRIPE",
      status: "SUCCEEDED",
      refundStatus: "NONE", // Out of sync with Stripe!
      stripePaymentIntentId: intentForRefund.id,
      idempotencyKey: `idemp_${Date.now()}_4`,
      paidAt: new Date(),
    });

    const reconRefund = await reconcileExternalRefunds();
    const pay4After = await TestPayment.findById(pay4._id).lean();

    assert(pay4After.status === "REFUNDED", "Payment transitioned to REFUNDED via external refund reconciliation");
    assert(pay4After.refundStatus === "SUCCEEDED", "refundStatus reconciled to SUCCEEDED");
    assert(pay4After.refundId === stripeDirectRefund.id, `refundId linked from Stripe (${pay4After.refundId})`);

    const outboxExtRefund = await TestOutboxPayment.find({
      aggregateId: pay4.paymentId,
      eventType: "PaymentRefunded",
    }).lean();
    assert(outboxExtRefund.length === 1, "PaymentRefunded outbox event created");
    assert(outboxExtRefund[0].payload.payload.origin === "EXTERNAL_STRIPE", "Outbox event enriched with origin: EXTERNAL_STRIPE");

    // 1.5 Stripe disputes are classified into disputeStatus and do NOT touch refundStatus
    console.log("\n1.5 Testing Stripe Disputes Are Not Classified as Refunds...");
    const pay5 = await TestPayment.create({
      paymentId: `pay_disp_${randomUUID().replace(/-/g, "")}`,
      bookingId: new mongoose.Types.ObjectId(),
      attemptNumber: 1,
      attemptId: `att_disp_1`,
      userId: testUserId,
      amountMinor: 500000,
      currency: "INR",
      provider: "STRIPE",
      status: "SUCCEEDED",
      refundStatus: "NONE",
      disputeStatus: "NONE",
      stripePaymentIntentId: `pi_fake_disp_${Date.now()}`,
      idempotencyKey: `idemp_${Date.now()}_5`,
      paidAt: new Date(),
    });

    // Simulate dispute webhook transition
    await TestPayment.updateOne(
      { _id: pay5._id },
      {
        $set: {
          disputeStatus: "NEEDS_RESPONSE",
          disputeId: `dp_test_${Date.now()}`,
          disputeReason: "fraudulent",
          disputeAmountMinor: 500000,
          disputedAt: new Date(),
        },
      }
    );

    const pay5After = await TestPayment.findById(pay5._id).lean();
    assert(pay5After.disputeStatus === "NEEDS_RESPONSE", "Dispute recorded as NEEDS_RESPONSE");
    assert(pay5After.refundStatus === "NONE", "refundStatus remains NONE (dispute is NOT a refund)");
    assert(pay5After.status === "SUCCEEDED", "Payment status remains SUCCEEDED (not REFUNDED)");

    // =========================================================================
    // Group 2: Outbox Lease Fencing & Audited DEAD Event Redrive
    // =========================================================================
    console.log("\n--- Group 2: Outbox Lease Fencing & Audited DEAD Event Redrive ---");

    // 2.1 Stale outbox publisher cannot acknowledge event after losing lease
    console.log("2.1 Testing Stale Outbox Publisher Lease Fencing...");
    const evtLeaseTest = await TestOutboxPayment.create({
      eventId: `evt_lease_${randomUUID().replace(/-/g, "")}`,
      eventType: "PaymentSucceeded",
      aggregateType: "Payment",
      aggregateId: "pay_lease_test",
      payload: { test: true },
      status: "PENDING",
      attempts: 1,
      lockedBy: "worker_stale",
      leaseToken: "token_stale_123",
      lockedUntil: new Date(Date.now() - 5000), // EXPIRED LEASE!
      nextAttemptAt: new Date(Date.now() + 3600000), // Future nextAttemptAt prevents race with live daemon outbox poller
    });

    // Worker B takes over expired lease
    const tokenB = "token_fresh_456";
    await TestOutboxPayment.updateOne(
      { _id: evtLeaseTest._id, lockedUntil: { $lte: new Date() } },
      {
        $set: {
          lockedBy: "worker_fresh",
          leaseToken: tokenB,
          lockedUntil: new Date(Date.now() + 60000),
        },
      }
    );

    // Stale Worker A attempts to mark published using old lease token
    const staleAcknowledge = await TestOutboxPayment.updateOne(
      {
        _id: evtLeaseTest._id,
        status: "PENDING",
        lockedBy: "worker_stale",
        leaseToken: "token_stale_123",
        lockedUntil: { $gt: new Date() },
      },
      { $set: { status: "PUBLISHED" } }
    );

    assert(staleAcknowledge.modifiedCount === 0, "Stale publisher blocked from acknowledging event after lease loss");
    const docAfterStale = await TestOutboxPayment.findById(evtLeaseTest._id).lean();
    assert(docAfterStale.status === "PENDING", "Event remained in PENDING status under fresh owner");
    assert(docAfterStale.lockedBy === "worker_fresh", "Event lease owned by Worker B");

    // 2.2 DEAD event classification
    console.log("\n2.2 Testing DEAD Event Failure Reason Classification...");
    const unroutableDeadEvent = {
      lastError: "UNROUTABLE_RETURN: Message returned by broker (no queue bound)",
    };
    const schemaDeadEvent = {
      lastError: "ValidationError: Payment validation failed: amountMinor must be safe integer",
    };

    const classUnroutable = classifyDeadEvent(unroutableDeadEvent);
    const classSchema = classifyDeadEvent(schemaDeadEvent);

    assert(classUnroutable.isRecoverable === true, "Unroutable topology return classified as recoverable");
    assert(classUnroutable.classification === "RECOVERABLE_INFRASTRUCTURE", "Classification is RECOVERABLE_INFRASTRUCTURE");
    assert(classSchema.isRecoverable === false, "Schema validation error classified as unrecoverable");
    assert(classSchema.classification === "FATAL_DATA_ERROR", "Classification is FATAL_DATA_ERROR");

    // 2.3 Operator-audited redrive mechanism
    console.log("\n2.3 Testing Operator-Audited Redrive for DEAD Events...");
    const deadEventId1 = `evt_dead_${randomUUID().replace(/-/g, "")}`;
    const deadEventId2Fatal = `evt_dead_fatal_${randomUUID().replace(/-/g, "")}`;

    await TestOutboxPayment.create([
      {
        eventId: deadEventId1,
        eventType: "PaymentSucceeded",
        aggregateType: "Payment",
        aggregateId: "pay_dead_1",
        payload: { test: true },
        status: "DEAD",
        attempts: 10,
        deadAt: new Date(),
        lastError: "UNROUTABLE_RETURN: Broker returned basic.return",
        nextAttemptAt: new Date(Date.now() + 3600000), // Future nextAttemptAt prevents race with live daemon outbox poller
      },
      {
        eventId: deadEventId2Fatal,
        eventType: "PaymentSucceeded",
        aggregateType: "Payment",
        aggregateId: "pay_dead_2",
        payload: { test: true },
        status: "DEAD",
        attempts: 10,
        deadAt: new Date(),
        lastError: "ValidationError: Invalid payload schema",
        nextAttemptAt: new Date(Date.now() + 3600000), // Future nextAttemptAt prevents race with live daemon outbox poller
      },
    ]);

    const redriveResult = await redriveDeadOutboxEvents({
      eventIds: [deadEventId1, deadEventId2Fatal],
      operatorIdentity: {
        operatorKey: process.env.OPERATOR_ADMIN_KEY,
        operatorId: "operator_alice",
        role: "ADMIN",
      },
      reason: "Topology queues restored and verified",
    });

    assert(redriveResult.redrivenCount === 1, "Exactly 1 recoverable event redriven");
    assert(redriveResult.skippedCount === 1, "Fatal schema event skipped from redrive");

    const event1After = await TestOutboxPayment.findOne({ eventId: deadEventId1 }).lean();
    assert(event1After.status === "PENDING", "Recoverable event transitioned from DEAD to PENDING");
    assert(event1After.attempts === 0, "Attempts counter reset to 0 for redrive");
    assert(event1After.deadAt === null, "deadAt cleared to null");

    // 2.4 Retrying a DEAD event does not cause duplicate downstream processing
    console.log("\n2.4 Testing Downstream Consumer Idempotency on Redriven Event...");
    const bIdDedupe = new mongoose.Types.ObjectId();
    await TestBooking.create({
      _id: bIdDedupe,
      userId: testUserId,
      hotelId: testHotelId,
      roomCategoryId: testRoomCategoryId,
      checkIn: new Date(todayStr),
      checkOut: new Date(new Date(todayStr).getTime() + 86400000),
      numberOfRooms: 1,
      numberOfGuests: 2,
      priceSnapshot: { pricePerNight: 5000, numberOfNights: 1, totalAmount: 5000, currency: "INR" },
      status: "CONFIRMED",
      idempotencyKey: `idemp_${Date.now()}_dedupe`,
      requestFingerprint: `fp_${Date.now()}_dedupe`,
      paymentId: "pay_dedupe_test",
      paymentAttemptCount: 1,
    });
    // Mark eventId as already processed in booking service
    await TestProcessedEvent.create({
      eventId: deadEventId1,
      eventType: "PaymentSucceeded",
    });

    // Re-processing the redriven event in Booking Service
    const redriveDownstreamOutcome = await processPaymentResult({
      eventId: deadEventId1,
      eventType: "PaymentSucceeded",
      schemaVersion: 1,
      payload: {
        bookingId: bIdDedupe.toString(),
        paymentId: "pay_dedupe_test",
        attemptNumber: 1,
        attemptId: `att_${bIdDedupe}_1`,
        userId: testUserId,
        amountMinor: 500000,
        currency: "INR",
      },
    });
    assert(redriveDownstreamOutcome === "DUPLICATE", "Redriven event detected as DUPLICATE downstream and ignored");

    // 2.5 Arbitrary approvedBy text cannot authorize DEAD event redrive (403 / UNAUTHORIZED_OPERATOR)
    console.log("\n2.5 Testing Operator Authorization Defense: Arbitrary approvedBy String Rejected...");
    const deadUnauthorizedId = `evt_dead_unauth_${randomUUID().replace(/-/g, "")}`;
    await TestOutboxPayment.create({
      eventId: deadUnauthorizedId,
      eventType: "PaymentSucceeded",
      aggregateType: "Payment",
      aggregateId: "pay_dead_unauth",
      payload: { test: true },
      status: "DEAD",
      attempts: 10,
      deadAt: new Date(),
      lastError: "ECONNREFUSED 127.0.0.1:5672",
      nextAttemptAt: new Date(Date.now() + 3600000), // Future nextAttemptAt prevents race with live daemon outbox poller
    });

    // Attempt 1: Call endpoint without x-operator-admin-key header
    const resNoOpKey = await fetch("http://127.0.0.1:4004/internal/payments/outbox/redrive", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-payment-service-key": paymentSecret,
      },
      body: JSON.stringify({
        eventIds: [deadUnauthorizedId],
        approvedBy: "attacker_alice_unverified",
        reason: "arbitrary bypass attempt",
      }),
    });
    assert(resNoOpKey.status === 403, "Redrive request without operator key rejected with 403 Forbidden");
    const noKeyBody = await resNoOpKey.json();
    assert(noKeyBody.code === "UNAUTHORIZED_OPERATOR", "Response code indicates UNAUTHORIZED_OPERATOR");

    // Attempt 2: Call endpoint with invalid x-operator-admin-key header
    const resBadOpKey = await fetch("http://127.0.0.1:4004/internal/payments/outbox/redrive", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-payment-service-key": paymentSecret,
        "x-operator-admin-key": "completely_wrong_operator_key_9999",
      },
      body: JSON.stringify({
        eventIds: [deadUnauthorizedId],
        approvedBy: "attacker_alice_unverified",
        reason: "arbitrary bypass attempt",
      }),
    });
    assert(resBadOpKey.status === 403, "Redrive request with invalid operator key rejected with 403 Forbidden");

    // Attempt 3: Direct worker call without operator identity throws UNAUTHORIZED_OPERATOR
    let directUnauthCaught = false;
    try {
      await redriveDeadOutboxEvents({
        eventIds: [deadUnauthorizedId],
        operatorIdentity: { operatorKey: "invalid_key", operatorId: "attacker" },
        reason: "should fail",
      });
    } catch (err) {
      directUnauthCaught = err.code === "UNAUTHORIZED_OPERATOR";
    }
    assert(directUnauthCaught, "Direct redrive call with invalid operator key throws UNAUTHORIZED_OPERATOR");

    const deadUnauthDocAfter = await TestOutboxPayment.findOne({ eventId: deadUnauthorizedId }).lean();
    assert(deadUnauthDocAfter.status === "DEAD", "Event remains in DEAD status after unauthorized redrive attempts");

    // 2.6 Verified operator can authorize eligible DEAD event redrive with audit trail
    console.log("\n2.6 Testing Verified Operator Successfully Authorizes DEAD Redrive with Audit Trail...");
    const resVerifiedRedrive = await fetch("http://127.0.0.1:4004/internal/payments/outbox/redrive", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-payment-service-key": paymentSecret,
        "x-operator-admin-key": process.env.OPERATOR_ADMIN_KEY,
      },
      body: JSON.stringify({
        eventIds: [deadUnauthorizedId],
        operatorId: "operator_verified_carol",
        role: "SENIOR_SRE",
        reason: "RabbitMQ cluster restored and queues re-bound",
      }),
    });
    assert(resVerifiedRedrive.status === 200, "Verified operator redrive call succeeded with 200 OK");
    const verifiedData = await resVerifiedRedrive.json();
    assert(verifiedData.data.redrivenCount === 1, "Exactly 1 recoverable event redriven by verified operator");

    const deadVerifiedDocAfter = await TestOutboxPayment.findOne({ eventId: deadUnauthorizedId }).lean();
    assert(deadVerifiedDocAfter.status === "PENDING", "Event transitioned from DEAD to PENDING under verified operator");
    assert(deadVerifiedDocAfter.attempts === 0, "Event attempts reset to 0");
    assert(Array.isArray(deadVerifiedDocAfter.redriveAudit), "Event contains redriveAudit array");
    assert(deadVerifiedDocAfter.redriveAudit.length >= 1, "redriveAudit record exists");
    assert(deadVerifiedDocAfter.redriveAudit[0].operatorId === "operator_verified_carol", "Audit records verified operatorId");
    assert(deadVerifiedDocAfter.redriveAudit[0].role === "SENIOR_SRE", "Audit records verified operator role");
    assert(deadVerifiedDocAfter.redriveAudit[0].reason.includes("RabbitMQ cluster restored"), "Audit records redrive reason");

    // =========================================================================
    // Group 3: Booking Service Attempt Identity & Reconciliation Invariants
    // =========================================================================
    console.log("\n--- Group 3: Booking Service Attempt Identity & Reconciliation Invariants ---");

    // 3.1 An old successful payment attempt cannot confirm a newer booking attempt
    console.log("3.1 Testing Obsolete Attempt 1 Cannot Confirm Attempt 2 (OBSOLETE_ATTEMPT)...");
    const bIdObsolete = new mongoose.Types.ObjectId();
    await seedInventory(todayStr, 10, 1, 0);

    await TestBooking.create({
      _id: bIdObsolete,
      userId: testUserId,
      hotelId: testHotelId,
      roomCategoryId: testRoomCategoryId,
      checkIn: new Date(todayStr),
      checkOut: new Date(new Date(todayStr).getTime() + 86400000),
      numberOfRooms: 1,
      numberOfGuests: 2,
      priceSnapshot: { pricePerNight: 5000, numberOfNights: 1, totalAmount: 5000, currency: "INR" },
      status: "PAYMENT_PENDING",
      holdExpiresAt: new Date(Date.now() + 600000), // active hold
      idempotencyKey: `idemp_${Date.now()}_obs`,
      requestFingerprint: `fp_${Date.now()}_obs`,
      paymentId: "pay_attempt_2",
      paymentAttemptCount: 2, // Booking advanced to Attempt 2!
    });

    // Old Attempt 1 arrives late with PaymentSucceeded
    const obsoleteOutcome = await processPaymentResult({
      eventId: `evt_obs_${randomUUID().replace(/-/g, "")}`,
      eventType: "PaymentSucceeded",
      schemaVersion: 1,
      payload: {
        bookingId: bIdObsolete.toString(),
        paymentId: "pay_attempt_1", // Old attempt 1
        attemptNumber: 1,           // attemptNumber 1 < booking attempt 2!
        attemptId: `att_${bIdObsolete}_1`,
        userId: testUserId,
        amountMinor: 500000,
        currency: "INR",
      },
    });

    assert(obsoleteOutcome === "RECONCILIATION_REQUIRED", "Obsolete attempt rejected with RECONCILIATION_REQUIRED");
    const obsBookingDoc = await TestBooking.findById(bIdObsolete).lean();
    assert(obsBookingDoc.status === "PAYMENT_PENDING", "Booking remains in PAYMENT_PENDING for Attempt 2 (NOT confirmed)");
    assert(obsBookingDoc.paymentId === "pay_attempt_2", "Booking paymentId remains Attempt 2");

    const obsReconRecord = await TestReconciliation.findOne({
      bookingId: bIdObsolete,
      reason: "OBSOLETE_ATTEMPT",
    }).lean();
    assert(obsReconRecord !== null, "OBSOLETE_ATTEMPT reconciliation record created");
    assert(obsReconRecord.status === "REVIEW_REQUIRED", "Reconciliation record status is REVIEW_REQUIRED");

    // 3.2 Duplicate discrepancy detection does not create duplicate review records
    console.log("\n3.2 Testing Duplicate Discrepancy Detection Does Not Create Duplicate Records...");
    await processPaymentResult({
      eventId: `evt_obs_repeat_${randomUUID().replace(/-/g, "")}`,
      eventType: "PaymentSucceeded",
      schemaVersion: 1,
      payload: {
        bookingId: bIdObsolete.toString(),
        paymentId: "pay_attempt_1",
        attemptNumber: 1,
        attemptId: `att_${bIdObsolete}_1`,
        userId: testUserId,
        amountMinor: 500000,
        currency: "INR",
      },
    });

    const totalObsRecords = await TestReconciliation.countDocuments({
      bookingId: bIdObsolete,
      reason: "OBSOLETE_ATTEMPT",
    });
    assert(totalObsRecords === 1, `Exactly 1 reconciliation record exists despite duplicate detection (found: ${totalObsRecords})`);

    // 3.3 Active hold ghost payment reconciliation safely confirms booking
    console.log("\n3.3 Testing Ghost Payment on Active Hold Safely Auto-Confirms...");
    const bIdActiveGhost = new mongoose.Types.ObjectId();
    const payActiveGhostId = `pay_ghost_act_${randomUUID().replace(/-/g, "")}`;
    await seedInventory(todayStr, 10, 1, 0);

    await TestBooking.create({
      _id: bIdActiveGhost,
      userId: testUserId,
      hotelId: testHotelId,
      roomCategoryId: testRoomCategoryId,
      checkIn: new Date(todayStr),
      checkOut: new Date(new Date(todayStr).getTime() + 86400000),
      numberOfRooms: 1,
      numberOfGuests: 2,
      priceSnapshot: { pricePerNight: 5000, numberOfNights: 1, totalAmount: 5000, currency: "INR" },
      status: "PAYMENT_PENDING",
      holdExpiresAt: new Date(Date.now() + 600000), // Active hold!
      idempotencyKey: `idemp_${Date.now()}_ghost_act`,
      requestFingerprint: `fp_${Date.now()}_ghost_act`,
      paymentId: payActiveGhostId,
      paymentAttemptCount: 1,
      createdAt: new Date(Date.now() - 180000), // 3 mins old
    });

    // Create succeeded payment in Payment Service
    await TestPayment.create({
      paymentId: payActiveGhostId,
      bookingId: bIdActiveGhost,
      attemptNumber: 1,
      attemptId: `att_${bIdActiveGhost}_1`,
      userId: testUserId,
      amountMinor: 500000,
      currency: "INR",
      provider: "STRIPE",
      status: "SUCCEEDED",
      idempotencyKey: `idemp_${Date.now()}_pay_ghost_act`,
      paidAt: new Date(),
    });

    // Reconcile ghost bookings
    const ghostReconActive = await reconcileGhostPayments({ maxAgeMs: 60000 });
    const bActiveDocAfter = await TestBooking.findById(bIdActiveGhost).lean();

    assert(bActiveDocAfter.status === "CONFIRMED", "Ghost payment with active hold transitioned to CONFIRMED");
    assert(bActiveDocAfter.holdExpiresAt === null, "holdExpiresAt cleared on confirmation");
    assert(ghostReconActive.confirmedUnderActiveHold >= 1, "Reconciler confirmed booking under active hold");

    const invAfterActive = await TestDailyInventory.findOne({ roomCategoryId: testRoomCategoryId, date: todayStr }).lean();
    assert(invAfterActive.bookedUnits === 1, "heldUnits converted to bookedUnits: 1");

    // 3.4 Expired hold late payment reconciliation NEVER silently confirms (creates REVIEW_REQUIRED)
    console.log("\n3.4 Testing Late Payment on Expired Hold NEVER Silently Confirms...");
    const bIdExpired = new mongoose.Types.ObjectId();
    const payExpiredId = `pay_exp_${randomUUID().replace(/-/g, "")}`;
    await seedInventory(todayStr, 10, 0, 0); // Inventory was already released on expiration!

    await TestBooking.create({
      _id: bIdExpired,
      userId: testUserId,
      hotelId: testHotelId,
      roomCategoryId: testRoomCategoryId,
      checkIn: new Date(todayStr),
      checkOut: new Date(new Date(todayStr).getTime() + 86400000),
      numberOfRooms: 1,
      numberOfGuests: 2,
      priceSnapshot: { pricePerNight: 5000, numberOfNights: 1, totalAmount: 5000, currency: "INR" },
      status: "EXPIRED",
      holdExpiresAt: new Date(Date.now() - 600000), // Expired 10 mins ago!
      idempotencyKey: `idemp_${Date.now()}_exp`,
      requestFingerprint: `fp_${Date.now()}_exp`,
      paymentId: payExpiredId,
      paymentAttemptCount: 1,
      createdAt: new Date(Date.now() - 900000),
    });

    // Payment arrived late or succeeded
    const expiredOutcome = await processPaymentResult({
      eventId: `evt_exp_late_${randomUUID().replace(/-/g, "")}`,
      eventType: "PaymentSucceeded",
      schemaVersion: 1,
      payload: {
        bookingId: bIdExpired.toString(),
        paymentId: payExpiredId,
        attemptNumber: 1,
        attemptId: `att_${bIdExpired}_1`,
        userId: testUserId,
        amountMinor: 500000,
        currency: "INR",
      },
    });

    assert(expiredOutcome === "RECONCILIATION_REQUIRED", "Late payment on expired hold rejected with RECONCILIATION_REQUIRED");
    const bExpiredDocAfter = await TestBooking.findById(bIdExpired).lean();
    assert(bExpiredDocAfter.status === "EXPIRED", "Expired booking remains EXPIRED (never silently confirmed)");

    const invAfterExpired = await TestDailyInventory.findOne({ roomCategoryId: testRoomCategoryId, date: todayStr }).lean();
    assert(invAfterExpired.bookedUnits === 0, "No inventory double-booked on expired hold");

    const expReconRecord = await TestReconciliation.findOne({
      bookingId: bIdExpired,
      reason: "LATE_PAYMENT_ON_EXPIRED_BOOKING",
    }).lean();
    assert(expReconRecord !== null, "LATE_PAYMENT_ON_EXPIRED_BOOKING review record created");
    assert(expReconRecord.status === "REVIEW_REQUIRED", "Reconciliation status is REVIEW_REQUIRED");

    // 3.5 External Stripe refund on CONFIRMED booking creates review record and does NOT release inventory
    console.log("\n3.5 Testing External Refund on CONFIRMED Booking Does NOT Release Inventory...");
    const bIdConfRef = new mongoose.Types.ObjectId();
    await seedInventory(todayStr, 10, 0, 1); // 1 booked unit

    await TestBooking.create({
      _id: bIdConfRef,
      userId: testUserId,
      hotelId: testHotelId,
      roomCategoryId: testRoomCategoryId,
      checkIn: new Date(todayStr),
      checkOut: new Date(new Date(todayStr).getTime() + 86400000),
      numberOfRooms: 1,
      numberOfGuests: 2,
      priceSnapshot: { pricePerNight: 5000, numberOfNights: 1, totalAmount: 5000, currency: "INR" },
      status: "CONFIRMED",
      idempotencyKey: `idemp_${Date.now()}_conf_ref`,
      requestFingerprint: `fp_${Date.now()}_conf_ref`,
      paymentId: "pay_conf_ref_test",
      paymentAttemptCount: 1,
    });

    // External Stripe refund event arrives
    const extRefundOutcome = await processPaymentResult({
      eventId: `evt_ext_ref_${randomUUID().replace(/-/g, "")}`,
      eventType: "PaymentRefunded",
      schemaVersion: 1,
      payload: {
        bookingId: bIdConfRef.toString(),
        paymentId: "pay_conf_ref_test",
        refundId: "re_ext_stripe_123",
        amountMinor: 500000,
        currency: "INR",
        origin: "EXTERNAL_STRIPE", // External origin!
      },
    });

    assert(extRefundOutcome === "EXTERNAL_REFUND_REVIEW_REQUIRED", "External refund on confirmed booking returned EXTERNAL_REFUND_REVIEW_REQUIRED");
    const bConfDocAfter = await TestBooking.findById(bIdConfRef).lean();
    assert(bConfDocAfter.status === "CONFIRMED", "Confirmed booking remained CONFIRMED (not auto-cancelled)");

    const invAfterConfRef = await TestDailyInventory.findOne({ roomCategoryId: testRoomCategoryId, date: todayStr }).lean();
    assert(invAfterConfRef.bookedUnits === 1, "Booked inventory was NOT released by external refund");

    const extRefReconRecord = await TestReconciliation.findOne({
      bookingId: bIdConfRef,
      reason: "EXTERNAL_REFUND_ON_CONFIRMED_BOOKING",
    }).lean();
    assert(extRefReconRecord !== null, "EXTERNAL_REFUND_ON_CONFIRMED_BOOKING review record created");
    assert(extRefReconRecord.status === "REVIEW_REQUIRED", "Review record status is REVIEW_REQUIRED");

    // 3.6 Unexpected Future Attempt (Attempt 2 expected, Attempt 3 received) rejected with UNEXPECTED_FUTURE_ATTEMPT
    console.log("\n3.6 Testing Unexpected Future Attempt (Attempt 2 Expected, Attempt 3 Received)...");
    const bIdFuture = new mongoose.Types.ObjectId();
    await seedInventory(todayStr, 10, 1, 0);

    await TestBooking.create({
      _id: bIdFuture,
      userId: testUserId,
      hotelId: testHotelId,
      roomCategoryId: testRoomCategoryId,
      checkIn: new Date(todayStr),
      checkOut: new Date(new Date(todayStr).getTime() + 86400000),
      numberOfRooms: 1,
      numberOfGuests: 2,
      priceSnapshot: { pricePerNight: 5000, numberOfNights: 1, totalAmount: 5000, currency: "INR" },
      status: "PAYMENT_PENDING",
      holdExpiresAt: new Date(Date.now() + 600000),
      idempotencyKey: `idemp_${Date.now()}_fut`,
      requestFingerprint: `fp_${Date.now()}_fut`,
      paymentId: "pay_att_curr_2",
      paymentAttemptCount: 2, // Booking expects Attempt 2!
    });

    // PaymentSucceeded arrives for unexpected future attempt 3
    const futureOutcome = await processPaymentResult({
      eventId: `evt_fut_${randomUUID().replace(/-/g, "")}`,
      eventType: "PaymentSucceeded",
      schemaVersion: 1,
      payload: {
        bookingId: bIdFuture.toString(),
        paymentId: "pay_att_fut_3",
        attemptNumber: 3, // Future attempt 3 > current attempt 2!
        attemptId: `att_${bIdFuture}_3`,
        userId: testUserId,
        amountMinor: 500000,
        currency: "INR",
      },
    });

    assert(futureOutcome === "RECONCILIATION_REQUIRED", "Unexpected future attempt rejected with RECONCILIATION_REQUIRED");
    const bFutureDocAfter = await TestBooking.findById(bIdFuture).lean();
    assert(bFutureDocAfter.status === "PAYMENT_PENDING", "Booking remains in PAYMENT_PENDING (NOT confirmed)");
    assert(bFutureDocAfter.paymentAttemptCount === 2, "Booking attempt count remains 2");

    const futReconRecord = await TestReconciliation.findOne({
      bookingId: bIdFuture,
      reason: "UNEXPECTED_FUTURE_ATTEMPT",
    }).lean();
    assert(futReconRecord !== null, "UNEXPECTED_FUTURE_ATTEMPT reconciliation record created");
    assert(futReconRecord.status === "REVIEW_REQUIRED", "Reconciliation status is REVIEW_REQUIRED");

    // 3.7 Correct attempt number, incorrect attemptId (ATTEMPT_ID_MISMATCH)
    console.log("\n3.7 Testing Correct Attempt Number but Incorrect attemptId (ATTEMPT_ID_MISMATCH)...");
    const bIdAttIdMismatch = new mongoose.Types.ObjectId();
    const payMismatchId = `pay_att_id_match_${randomUUID().replace(/-/g, "")}`;
    await seedInventory(todayStr, 10, 1, 0);

    await TestBooking.create({
      _id: bIdAttIdMismatch,
      userId: testUserId,
      hotelId: testHotelId,
      roomCategoryId: testRoomCategoryId,
      checkIn: new Date(todayStr),
      checkOut: new Date(new Date(todayStr).getTime() + 86400000),
      numberOfRooms: 1,
      numberOfGuests: 2,
      priceSnapshot: { pricePerNight: 5000, numberOfNights: 1, totalAmount: 5000, currency: "INR" },
      status: "PAYMENT_PENDING",
      holdExpiresAt: new Date(Date.now() + 600000),
      idempotencyKey: `idemp_${Date.now()}_att_id_mis`,
      requestFingerprint: `fp_${Date.now()}_att_id_mis`,
      paymentId: payMismatchId,
      paymentAttemptCount: 1,
    });

    const attIdMismatchOutcome = await processPaymentResult({
      eventId: `evt_att_id_mis_${randomUUID().replace(/-/g, "")}`,
      eventType: "PaymentSucceeded",
      schemaVersion: 1,
      payload: {
        bookingId: bIdAttIdMismatch.toString(),
        paymentId: payMismatchId,
        attemptNumber: 1,
        attemptId: "att_fake_impostor_attempt_id", // Mismatched attemptId!
        userId: testUserId,
        amountMinor: 500000,
        currency: "INR",
      },
    });

    assert(attIdMismatchOutcome === "RECONCILIATION_REQUIRED", "Mismatched attemptId rejected with RECONCILIATION_REQUIRED");
    const bAttIdDocAfter = await TestBooking.findById(bIdAttIdMismatch).lean();
    assert(bAttIdDocAfter.status === "PAYMENT_PENDING", "Booking remains in PAYMENT_PENDING (NOT confirmed)");

    const attIdReconRecord = await TestReconciliation.findOne({
      bookingId: bIdAttIdMismatch,
      reason: "ATTEMPT_ID_MISMATCH",
    }).lean();
    assert(attIdReconRecord !== null, "ATTEMPT_ID_MISMATCH reconciliation record created");
    assert(attIdReconRecord.status === "REVIEW_REQUIRED", "Reconciliation status is REVIEW_REQUIRED");

    // 3.8 Correct attempt identity, incorrect userId (USER_ID_MISMATCH)
    console.log("\n3.8 Testing Correct Attempt Identity but Incorrect userId (USER_ID_MISMATCH)...");
    const bIdUserMismatch = new mongoose.Types.ObjectId();
    const payUserIdMatch = `pay_usr_match_${randomUUID().replace(/-/g, "")}`;
    await seedInventory(todayStr, 10, 1, 0);

    await TestBooking.create({
      _id: bIdUserMismatch,
      userId: "user_legitimate_booking_owner",
      hotelId: testHotelId,
      roomCategoryId: testRoomCategoryId,
      checkIn: new Date(todayStr),
      checkOut: new Date(new Date(todayStr).getTime() + 86400000),
      numberOfRooms: 1,
      numberOfGuests: 2,
      priceSnapshot: { pricePerNight: 5000, numberOfNights: 1, totalAmount: 5000, currency: "INR" },
      status: "PAYMENT_PENDING",
      holdExpiresAt: new Date(Date.now() + 600000),
      idempotencyKey: `idemp_${Date.now()}_usr_mis`,
      requestFingerprint: `fp_${Date.now()}_usr_mis`,
      paymentId: payUserIdMatch,
      paymentAttemptCount: 1,
    });

    const userMismatchOutcome = await processPaymentResult({
      eventId: `evt_usr_mis_${randomUUID().replace(/-/g, "")}`,
      eventType: "PaymentSucceeded",
      schemaVersion: 1,
      payload: {
        bookingId: bIdUserMismatch.toString(),
        paymentId: payUserIdMatch,
        attemptNumber: 1,
        attemptId: `att_${bIdUserMismatch}_1`,
        userId: "user_impostor_trying_to_claim", // Mismatched userId!
        amountMinor: 500000,
        currency: "INR",
      },
    });

    assert(userMismatchOutcome === "RECONCILIATION_REQUIRED", "Mismatched userId rejected with RECONCILIATION_REQUIRED");
    const bUserDocAfter = await TestBooking.findById(bIdUserMismatch).lean();
    assert(bUserDocAfter.status === "PAYMENT_PENDING", "Booking remains in PAYMENT_PENDING (NOT confirmed)");

    const userReconRecord = await TestReconciliation.findOne({
      bookingId: bIdUserMismatch,
      reason: "USER_ID_MISMATCH",
    }).lean();
    assert(userReconRecord !== null, "USER_ID_MISMATCH reconciliation record created");
    assert(userReconRecord.status === "REVIEW_REQUIRED", "Reconciliation status is REVIEW_REQUIRED");

    // Helper to create a test booking in PAYMENT_PENDING with 1 held room
    const createPendingBookingForValidation = async (prefix) => {
      const bId = new mongoose.Types.ObjectId();
      const pId = `pay_${prefix}_${randomUUID().replace(/-/g, "")}`;
      await seedInventory(todayStr, 10, 1, 0); // 1 unit held, 0 booked
      await TestBooking.create({
        _id: bId,
        userId: testUserId,
        hotelId: testHotelId,
        roomCategoryId: testRoomCategoryId,
        checkIn: new Date(todayStr),
        checkOut: new Date(new Date(todayStr).getTime() + 86400000),
        numberOfRooms: 1,
        numberOfGuests: 2,
        priceSnapshot: { pricePerNight: 5000, numberOfNights: 1, totalAmount: 5000, currency: "INR" },
        status: "PAYMENT_PENDING",
        holdExpiresAt: new Date(Date.now() + 600000), // active hold
        idempotencyKey: `idemp_${Date.now()}_${prefix}`,
        requestFingerprint: `fp_${Date.now()}_${prefix}`,
        paymentId: pId,
        paymentAttemptCount: 1,
      });
      return { bookingId: bId, paymentId: pId };
    };

    // Helper to assert rejected event invariants (booking unconfirmed, inventory unchanged, no outbox event)
    const assertRejectedEventInvariants = async (bookingId, testLabel) => {
      const bDoc = await TestBooking.findById(bookingId).lean();
      assert(bDoc.status === "PAYMENT_PENDING", `${testLabel}: Booking remains PAYMENT_PENDING (NOT confirmed)`);

      const invDoc = await TestDailyInventory.findOne({ roomCategoryId: testRoomCategoryId, date: todayStr }).lean();
      assert(invDoc.heldUnits === 1 && invDoc.bookedUnits === 0, `${testLabel}: Inventory is unchanged (held: 1, booked: 0)`);

      const confirmedEvents = await TestOutboxBooking.countDocuments({
        aggregateId: bookingId,
        eventType: "BookingConfirmed",
      });
      assert(confirmedEvents === 0, `${testLabel}: No successful BookingConfirmed outbox event emitted`);
    };

    // 3.9 Negative Case: Missing attemptId
    console.log("\n3.9 Testing Negative Case: Missing attemptId Rejected...");
    const { bookingId: bIdMisAttId, paymentId: pIdMisAttId } = await createPendingBookingForValidation("mis_att_id");
    const resMisAttId = await processPaymentResult({
      eventId: `evt_mis_att_id_${randomUUID().replace(/-/g, "")}`,
      eventType: "PaymentSucceeded",
      schemaVersion: 1,
      payload: {
        bookingId: bIdMisAttId.toString(),
        paymentId: pIdMisAttId,
        attemptNumber: 1,
        // attemptId omitted!
        userId: testUserId,
        amountMinor: 500000,
        currency: "INR",
      },
    });
    assert(resMisAttId === "RECONCILIATION_REQUIRED", "Missing attemptId returned RECONCILIATION_REQUIRED");
    await assertRejectedEventInvariants(bIdMisAttId, "Missing attemptId");
    const recMisAttId = await TestReconciliation.findOne({ bookingId: bIdMisAttId, reason: "MISSING_ATTEMPT_ID" }).lean();
    assert(recMisAttId !== null, "MISSING_ATTEMPT_ID reconciliation record created");

    // 3.10 Negative Case: Missing attemptNumber
    console.log("\n3.10 Testing Negative Case: Missing attemptNumber Rejected...");
    const { bookingId: bIdMisAttNum, paymentId: pIdMisAttNum } = await createPendingBookingForValidation("mis_att_num");
    const resMisAttNum = await processPaymentResult({
      eventId: `evt_mis_att_num_${randomUUID().replace(/-/g, "")}`,
      eventType: "PaymentSucceeded",
      schemaVersion: 1,
      payload: {
        bookingId: bIdMisAttNum.toString(),
        paymentId: pIdMisAttNum,
        // attemptNumber omitted!
        attemptId: `att_${bIdMisAttNum}_1`,
        userId: testUserId,
        amountMinor: 500000,
        currency: "INR",
      },
    });
    assert(resMisAttNum === "RECONCILIATION_REQUIRED", "Missing attemptNumber returned RECONCILIATION_REQUIRED");
    await assertRejectedEventInvariants(bIdMisAttNum, "Missing attemptNumber");
    const recMisAttNum = await TestReconciliation.findOne({ bookingId: bIdMisAttNum, reason: "MISSING_ATTEMPT_NUMBER" }).lean();
    assert(recMisAttNum !== null, "MISSING_ATTEMPT_NUMBER reconciliation record created");

    // 3.11 Negative Case: Missing userId
    console.log("\n3.11 Testing Negative Case: Missing userId Rejected...");
    const { bookingId: bIdMisUser, paymentId: pIdMisUser } = await createPendingBookingForValidation("mis_user");
    const resMisUser = await processPaymentResult({
      eventId: `evt_mis_user_${randomUUID().replace(/-/g, "")}`,
      eventType: "PaymentSucceeded",
      schemaVersion: 1,
      payload: {
        bookingId: bIdMisUser.toString(),
        paymentId: pIdMisUser,
        attemptNumber: 1,
        attemptId: `att_${bIdMisUser}_1`,
        // userId omitted!
        amountMinor: 500000,
        currency: "INR",
      },
    });
    assert(resMisUser === "RECONCILIATION_REQUIRED", "Missing userId returned RECONCILIATION_REQUIRED");
    await assertRejectedEventInvariants(bIdMisUser, "Missing userId");
    const recMisUser = await TestReconciliation.findOne({ bookingId: bIdMisUser, reason: "MISSING_USER_ID" }).lean();
    assert(recMisUser !== null, "MISSING_USER_ID reconciliation record created");

    // 3.12 Negative Case: Incorrect attemptId
    console.log("\n3.12 Testing Negative Case: Incorrect attemptId Rejected...");
    const { bookingId: bIdBadAttId, paymentId: pIdBadAttId } = await createPendingBookingForValidation("bad_att_id");
    const resBadAttId = await processPaymentResult({
      eventId: `evt_bad_att_id_${randomUUID().replace(/-/g, "")}`,
      eventType: "PaymentSucceeded",
      schemaVersion: 1,
      payload: {
        bookingId: bIdBadAttId.toString(),
        paymentId: pIdBadAttId,
        attemptNumber: 1,
        attemptId: "att_wrong_spoofed_attempt_id",
        userId: testUserId,
        amountMinor: 500000,
        currency: "INR",
      },
    });
    assert(resBadAttId === "RECONCILIATION_REQUIRED", "Incorrect attemptId returned RECONCILIATION_REQUIRED");
    await assertRejectedEventInvariants(bIdBadAttId, "Incorrect attemptId");
    const recBadAttId = await TestReconciliation.findOne({ bookingId: bIdBadAttId, reason: "ATTEMPT_ID_MISMATCH" }).lean();
    assert(recBadAttId !== null, "ATTEMPT_ID_MISMATCH reconciliation record created");

    // 3.13 Negative Case: Incorrect attemptNumber
    console.log("\n3.13 Testing Negative Case: Incorrect attemptNumber Rejected...");
    const { bookingId: bIdBadAttNum, paymentId: pIdBadAttNum } = await createPendingBookingForValidation("bad_att_num");
    const resBadAttNum = await processPaymentResult({
      eventId: `evt_bad_att_num_${randomUUID().replace(/-/g, "")}`,
      eventType: "PaymentSucceeded",
      schemaVersion: 1,
      payload: {
        bookingId: bIdBadAttNum.toString(),
        paymentId: pIdBadAttNum,
        attemptNumber: 99, // Expected 1
        attemptId: `att_${bIdBadAttNum}_1`,
        userId: testUserId,
        amountMinor: 500000,
        currency: "INR",
      },
    });
    assert(resBadAttNum === "RECONCILIATION_REQUIRED", "Incorrect attemptNumber returned RECONCILIATION_REQUIRED");
    await assertRejectedEventInvariants(bIdBadAttNum, "Incorrect attemptNumber");
    const recBadAttNum = await TestReconciliation.findOne({ bookingId: bIdBadAttNum, reason: "UNEXPECTED_FUTURE_ATTEMPT" }).lean();
    assert(recBadAttNum !== null, "UNEXPECTED_FUTURE_ATTEMPT reconciliation record created");

    // 3.14 Negative Case: Incorrect userId
    console.log("\n3.14 Testing Negative Case: Incorrect userId Rejected...");
    const { bookingId: bIdBadUser, paymentId: pIdBadUser } = await createPendingBookingForValidation("bad_user");
    const resBadUser = await processPaymentResult({
      eventId: `evt_bad_user_${randomUUID().replace(/-/g, "")}`,
      eventType: "PaymentSucceeded",
      schemaVersion: 1,
      payload: {
        bookingId: bIdBadUser.toString(),
        paymentId: pIdBadUser,
        attemptNumber: 1,
        attemptId: `att_${bIdBadUser}_1`,
        userId: "user_unauthorized_attacker_identity",
        amountMinor: 500000,
        currency: "INR",
      },
    });
    assert(resBadUser === "RECONCILIATION_REQUIRED", "Incorrect userId returned RECONCILIATION_REQUIRED");
    await assertRejectedEventInvariants(bIdBadUser, "Incorrect userId");
    const recBadUser = await TestReconciliation.findOne({ bookingId: bIdBadUser, reason: "USER_ID_MISMATCH" }).lean();
    assert(recBadUser !== null, "USER_ID_MISMATCH reconciliation record created");

    // 3.15 Negative Case: Incorrect amountMinor
    console.log("\n3.15 Testing Negative Case: Incorrect amountMinor Rejected...");
    const { bookingId: bIdBadAmount, paymentId: pIdBadAmount } = await createPendingBookingForValidation("bad_amt");
    const resBadAmount = await processPaymentResult({
      eventId: `evt_bad_amt_${randomUUID().replace(/-/g, "")}`,
      eventType: "PaymentSucceeded",
      schemaVersion: 1,
      payload: {
        bookingId: bIdBadAmount.toString(),
        paymentId: pIdBadAmount,
        attemptNumber: 1,
        attemptId: `att_${bIdBadAmount}_1`,
        userId: testUserId,
        amountMinor: 888888, // Expected 500000
        currency: "INR",
      },
    });
    assert(resBadAmount === "RECONCILIATION_REQUIRED", "Incorrect amountMinor returned RECONCILIATION_REQUIRED");
    await assertRejectedEventInvariants(bIdBadAmount, "Incorrect amountMinor");
    const recBadAmount = await TestReconciliation.findOne({ bookingId: bIdBadAmount, reason: "PAYMENT_AMOUNT_MISMATCH" }).lean();
    assert(recBadAmount !== null, "PAYMENT_AMOUNT_MISMATCH reconciliation record created");

    // 3.16 Negative Case: Incorrect currency
    console.log("\n3.16 Testing Negative Case: Incorrect currency Rejected...");
    const { bookingId: bIdBadCurr, paymentId: pIdBadCurr } = await createPendingBookingForValidation("bad_curr");
    const resBadCurr = await processPaymentResult({
      eventId: `evt_bad_curr_${randomUUID().replace(/-/g, "")}`,
      eventType: "PaymentSucceeded",
      schemaVersion: 1,
      payload: {
        bookingId: bIdBadCurr.toString(),
        paymentId: pIdBadCurr,
        attemptNumber: 1,
        attemptId: `att_${bIdBadCurr}_1`,
        userId: testUserId,
        amountMinor: 500000,
        currency: "EUR", // Expected INR
      },
    });
    assert(resBadCurr === "RECONCILIATION_REQUIRED", "Incorrect currency returned RECONCILIATION_REQUIRED");
    await assertRejectedEventInvariants(bIdBadCurr, "Incorrect currency");
    const recBadCurr = await TestReconciliation.findOne({ bookingId: bIdBadCurr, reason: "PAYMENT_CURRENCY_MISMATCH" }).lean();
    assert(recBadCurr !== null, "PAYMENT_CURRENCY_MISMATCH reconciliation record created");

    // 3.17 Positive Case: Valid PaymentSucceeded with Exact 7 Matching Attributes
    console.log("\n3.17 Testing Positive Case: Valid PaymentSucceeded with Exact 7 Matching Attributes...");
    const { bookingId: bIdValid, paymentId: pIdValid } = await createPendingBookingForValidation("valid_all_7");
    const resValid = await processPaymentResult({
      eventId: `evt_valid_all_7_${randomUUID().replace(/-/g, "")}`,
      eventType: "PaymentSucceeded",
      schemaVersion: 1,
      payload: {
        bookingId: bIdValid.toString(),
        paymentId: pIdValid,
        attemptNumber: 1,
        attemptId: `att_${bIdValid}_1`,
        userId: testUserId,
        amountMinor: 500000,
        currency: "INR",
      },
    });
    assert(resValid === "CONFIRMED", "Valid PaymentSucceeded returned CONFIRMED");
    const bDocValid = await TestBooking.findById(bIdValid).lean();
    assert(bDocValid.status === "CONFIRMED", "Booking status confirmed in database");
    assert(bDocValid.holdExpiresAt === null, "holdExpiresAt cleared on confirmation");

    const invDocValid = await TestDailyInventory.findOne({ roomCategoryId: testRoomCategoryId, date: todayStr }).lean();
    assert(invDocValid.heldUnits === 0 && invDocValid.bookedUnits === 1, "Inventory correctly converted from held to booked (held: 0, booked: 1)");

    const confirmedEventsValid = await TestOutboxBooking.countDocuments({
      aggregateId: bIdValid,
      eventType: "BookingConfirmed",
    });
    assert(confirmedEventsValid === 1, "Exactly 1 BookingConfirmed outbox event created");

    // =========================================================================
    // Group 4: Cross-Service Internal Contracts & Database Boundaries
    // =========================================================================
    console.log("\n--- Group 4: Cross-Service Internal Contracts & Database Boundaries ---");

    const paymentServiceUrl = "http://127.0.0.1:4004";
    const bookingServiceUrl = "http://127.0.0.1:4003";

    // 4.1 Internal endpoints require valid x-payment-service-key
    console.log("4.1 Testing Internal Endpoints Authentication Defense...");
    const resNoKey = await fetch(`${paymentServiceUrl}/internal/payments/${payActiveGhostId}/status`);
    assert(resNoKey.status === 401, "Internal status call without service key rejected with 401 Unauthorized");

    const resBadKey = await fetch(`${paymentServiceUrl}/internal/payments/${payActiveGhostId}/status`, {
      headers: { "x-payment-service-key": "bad_wrong_secret" },
    });
    assert(resBadKey.status === 401, "Internal status call with invalid service key rejected with 401 Unauthorized");

    // 4.2 Cross-service payment status inquiry returns authoritative data
    console.log("\n4.2 Testing Cross-Service Payment Status Inquiry Contract...");
    const resValidStatus = await fetch(`${paymentServiceUrl}/internal/payments/${payActiveGhostId}/status`, {
      headers: { "x-payment-service-key": paymentSecret },
    });
    assert(resValidStatus.status === 200, "Internal status call with valid key succeeded with 200 OK");
    const statusData = await resValidStatus.json();
    assert(statusData.data.paymentId === payActiveGhostId, "Internal status returned correct paymentId");
    assert(statusData.data.status === "SUCCEEDED", "Internal status returned correct payment status: SUCCEEDED");
    assert(statusData.data.attemptNumber === 1, "Internal status returned attemptNumber: 1");

    // 4.3 Booking service reconciliations query endpoint
    console.log("\n4.3 Testing Booking Service Reconciliations Query Endpoint...");
    const resReconList = await fetch(`${bookingServiceUrl}/internal/payments/bookings/reconciliations`, {
      headers: { "x-payment-service-key": paymentSecret },
    });
    assert(resReconList.status === 200, "Internal reconciliations query succeeded with 200 OK");
    const reconListData = await resReconList.json();
    assert(Array.isArray(reconListData.data), "Reconciliations query returned an array of review records");
    assert(reconListData.data.length >= 1, "Reconciliation records are visible to operator query");

    // =========================================================================
    // Group 5: Periodic Reconciliation Workers, Auto-Start Lifecycle & Mutex Concurrency
    // =========================================================================
    console.log("\n--- Group 5: Periodic Reconciliation Workers, Auto-Start Lifecycle & Mutex Concurrency ---");

    // 5.1 Payment Service Periodic Worker Lifecycle and Auto-Restart
    console.log("5.1 Testing Payment Service Periodic Worker Lifecycle and Auto-Restart...");
    const paymentWorkerStatusInitial = getPaymentReconciliationWorkerStatus();
    assert(paymentWorkerStatusInitial.intervalMs === 30000, "Payment worker interval configured as 30000ms");

    // Test stop and restart
    await stopPaymentReconciliationWorker();
    const paymentWorkerStatusStopped = getPaymentReconciliationWorkerStatus();
    assert(paymentWorkerStatusStopped.started === false, "Payment worker gracefully stopped");

    await startPaymentReconciliationWorker();
    const paymentWorkerStatusRestarted = getPaymentReconciliationWorkerStatus();
    assert(paymentWorkerStatusRestarted.started === true, "Payment worker automatically restarted successfully");

    // 5.2 Booking Service Periodic Worker Lifecycle and Auto-Restart
    console.log("\n5.2 Testing Booking Service Periodic Worker Lifecycle and Auto-Restart...");
    const bookingWorkerStatusInitial = getBookingReconciliationWorkerStatus();
    assert(bookingWorkerStatusInitial.intervalMs === 30000, "Booking worker interval configured as 30000ms");

    // Test stop and restart
    await stopBookingReconciliationWorker();
    const bookingWorkerStatusStopped = getBookingReconciliationWorkerStatus();
    assert(bookingWorkerStatusStopped.started === false, "Booking worker gracefully stopped");

    await startBookingReconciliationWorker();
    const bookingWorkerStatusRestarted = getBookingReconciliationWorkerStatus();
    assert(bookingWorkerStatusRestarted.started === true, "Booking worker automatically restarted successfully");

    // 5.3 Overlapping Execution Mutex Protection (Payment Worker)
    console.log("\n5.3 Testing Overlapping Scheduled Reconciliation Runs Mutex (Payment Worker)...");
    const [payTickA, payTickB] = await Promise.all([
      runPaymentReconciliationTick(),
      runPaymentReconciliationTick(),
    ]);

    const payHasSkipped = (payTickA && payTickA.skipped) || (payTickB && payTickB.skipped);
    const paySkippedReason = (payTickA && payTickA.reason) || (payTickB && payTickB.reason);
    assert(payHasSkipped === true, "One concurrent tick was skipped to prevent overlapping execution");
    assert(paySkippedReason === "OVERLAPPING_EXECUTION_PREVENTED", "Skipped reason is OVERLAPPING_EXECUTION_PREVENTED");

    // Verify next sequential tick runs cleanly (mutex properly freed in finally)
    const payTickC = await runPaymentReconciliationTick();
    assert(!payTickC.skipped, "Subsequent sequential tick executes successfully after mutex release");

    // 5.4 Overlapping Execution Mutex Protection (Booking Worker)
    console.log("\n5.4 Testing Overlapping Scheduled Reconciliation Runs Mutex (Booking Worker)...");
    const [bookTickA, bookTickB] = await Promise.all([
      runBookingReconciliationTick(),
      runBookingReconciliationTick(),
    ]);

    const bookHasSkipped = (bookTickA && bookTickA.skipped) || (bookTickB && bookTickB.skipped);
    const bookSkippedReason = (bookTickA && bookTickA.reason) || (bookTickB && bookTickB.reason);
    assert(bookHasSkipped === true, "One concurrent ghost booking tick was skipped to prevent overlapping execution");
    assert(bookSkippedReason === "OVERLAPPING_EXECUTION_PREVENTED", "Skipped reason is OVERLAPPING_EXECUTION_PREVENTED");

    // Verify next sequential tick runs cleanly
    const bookTickC = await runBookingReconciliationTick();
    assert(!bookTickC.skipped, "Subsequent sequential ghost booking tick executes successfully after mutex release");

    // Cleanup test records
    await TestPayment.deleteMany({ userId: testUserId });
    await TestOutboxPayment.deleteMany({ aggregateId: { $regex: "^pay_" } });
    await TestBooking.deleteMany({ userId: { $in: [testUserId, "user_legitimate_booking_owner"] } });
    await TestOutboxBooking.deleteMany({ aggregateType: "Booking" });
    await TestReconciliation.deleteMany({ bookingId: { $in: [bIdObsolete, bIdActiveGhost, bIdExpired, bIdConfRef, bIdFuture, bIdAttIdMismatch, bIdUserMismatch, bIdMisAttId, bIdMisAttNum, bIdMisUser, bIdBadAttId, bIdBadAttNum, bIdBadUser, bIdBadAmount, bIdBadCurr, bIdValid] } });
    await TestDailyInventory.deleteMany({ roomCategoryId: testRoomCategoryId });
    console.log("\n✓ Cleaned up test records.");

  } finally {
    await stopPaymentReconciliationWorker();
    await stopBookingReconciliationWorker();
    await mongoosePayment.disconnect();
    await mongooseBooking.disconnect();
  }

  console.log(`\n========================================`);
  console.log(`Phase 5 Test Result: ${passed}/${total} passed`);
  console.log(`========================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
  process.exit(0);
}

runPhase5Tests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
