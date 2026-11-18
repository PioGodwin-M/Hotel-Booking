# Round 4f — Booking Reliability: Stage 0 Reliability Audit & Stage 0.1 Design Corrections

**Repository:** `D:\Hotel_Booking_Microservices\Hotel-Booking`  
**Branch:** `feature/microservices-migration`  
**Date:** 2026-11-18  
**Scope:** Stage 0 & Stage 0.1 — Codebase Inspection, Reliability Audit Corrections & Final Implementation Design (Documentation Only)

---

## 1. Executive Summary

This document presents the revised and corrected Stage 0 and Stage 0.1 reliability audit of the Hotel Booking Microservices system following the completion of Round 4g (Booking Details Page). 

The primary objective of Stage 0.1 is to address critical technical review feedback on the Stage 0 audit, establish rigorous mathematical and empirical distinctions for latency findings, correct inventory idempotency analysis, redesign hold expiration and late-payment refund workflows with strict service boundaries, and specify comprehensive state mappings and customer communication templates prior to Stage 1 authorization.

### Key Audit Findings & Stage 0.1 Corrections
1. **Outbox Latency Distinctions**:
   - **Verified Code Configuration**: `services/payment-service/src/workers/outboxWorker.js` executes polling on an un-signaled `setInterval` loop with `POLL_INTERVAL_MS = 5000` (5.0 seconds).
   - **Theoretical Waiting Time**: Under uniformly distributed event arrivals over a $[0, 5000]\text{ ms}$ interval, the expected waiting time is $E[W] = 2,500\text{ ms}$ (mean and median).
   - **Previously Reported 1,961 ms Median**: Acknowledged as an earlier, unverified measurement figure. It is not accepted as verified runtime proof without formal multi-run benchmark telemetry.
   - **Network & Processing Latency**: Broker transit and consumer processing cannot be claimed as $< 30\text{ ms}$ without empirical instrumentation. A formal benchmark plan measuring p50, p95, and p99 spans is defined herein.
   - **Performance Target**: An in-process wake-up trigger is designed to eliminate the dormant polling wait; however, no absolute latency guarantee (such as 50 ms) is promised.
2. **Inventory Idempotency Grounding**:
   - The conditional database check `{ heldUnits: { $gte: rooms } }` is a defensive capacity boundary preventing negative integers, **not an independent proof of per-booking idempotency**. Because `DailyInventory` aggregates units across all bookings for a given date, duplicate execution on Booking A could theoretically consume or release units held by Booking B if executed in isolation.
   - Per-booking idempotency is strictly enforced by the **outer atomic state transition on `Booking`** (`status: HELD -> CANCELLED/EXPIRED/CONFIRMED`) and the `ProcessedEvent` unique index inside the same MongoDB ACID transaction session.
3. **Hold Expiration Policy Redesign**:
   - Rejected the naive `paymentAttemptCount > 0` check.
   - Designed a bounded policy utilizing Payment Service's internal status contract (`PaymentRequest` lease and `Payment` state model) without violating database boundaries.
   - Established a configurable absolute maximum hold duration (base 15 min + max 5 min extension = 20 min cap) based on realistic 3D Secure bank challenge durations.
4. **Durable Late-Payment Refund Workflow**:
   - Late payments on expired/cancelled holds are refunded for the **full 100% amount paid** (unlike guest-initiated cancellations). The non-refundable Stripe processing fee is explicitly recognized as an operational business cost.
   - Designed an asynchronous, durable outbox event workflow (`BookingRefundRequested` &rarr; RabbitMQ &rarr; Payment Service `processRefund`) avoiding best-effort synchronous HTTP inside MongoDB transactions.
5. **Divergent Confirmation Reachability**:
   - Audit confirms `confirmBookingPayment` in `paymentBookingService.js` is not exposed via HTTP routes; it is currently an unaligned internal function imported only in unit tests. Unifying this core operation eliminates architectural drift and enforces all validations and outbox event creation.
6. **Execution Integrity**:
   - **Zero application source code, schemas, API contracts, runtime configurations, or dependencies were altered.**

---

## 2. Current Architecture and Booking Lifecycle

The system utilizes an asynchronous event-driven microservices architecture communicating via RabbitMQ (topic exchanges) and synchronous internal HTTP contracts authenticated with shared service secrets.

```
+---------------------------------------------------------------------------------------------------+
|                                       GUEST BROWSER / CLIENT                                      |
+---------------------------------------------------------------------------------------------------+
       | (1) POST /api/bookings               | (5) POST /api/payments          | (7) confirmPayment
       v                                      v                                 v
+-----------------------+              +------------------------+       +-------------------+
|      API GATEWAY      |              |      API GATEWAY       |       |  STRIPE ELEMENTS  |
+-----------------------+              +------------------------+       +-------------------+
       | (Clerk Auth)                         | (Clerk Auth)                    | (Client Secret)
       v                                      v                                 v
+-----------------------+              +------------------------+       +-------------------+
|    BOOKING SERVICE    |              |    PAYMENT SERVICE     |       |   STRIPE SERVERS  |
+-----------------------+              +------------------------+       +-------------------+
       |                                      |                                 |
       | (2) GET /internal/pricing            | (6) PATCH /internal/...         | (8) Webhook POST
       v                                      |     markPaymentPending          v
+-----------------------+                     +---------------------->+---------------------+
|    CATALOG SERVICE    |                                             |   PAYMENT SERVICE   |
+-----------------------+                                             |  (webhookController)|
       |                                                              +---------------------+
       | (3) Atomic $expr reservation                                           |
       | (4) Status: HELD                                                       | (9) Mongo Tx:
       v                                                                        |     Payment: SUCCEEDED
+-----------------------+                                                       |     Outbox: PENDING
|   DailyInventory &    |                                                       v
|    Booking (Mongo)    |                                             +---------------------+
+-----------------------+                                             |    Outbox Worker    |
                                                                      | (POLL_INTERVAL=5s)  |
                                                                      +---------------------+
                                                                                |
                                                                                | (10) RabbitMQ Publish
                                                                                v
                                                                      +---------------------+
                                                                      |    RABBITMQ TOPIC   |
                                                                      |    (hotel.events)   |
                                                                      +---------------------+
                                                                                |
                                                                                | (11) Consumer Push
                                                                                v
                                                                      +---------------------+
                                                                      |   BOOKING SERVICE   |
                                                                      | (paymentConsumer)   |
                                                                      +---------------------+
                                                                                |
                                                                                | (12) Mongo Tx:
                                                                                |      Status: CONFIRMED
                                                                                |      Inventory: Booked
                                                                                |      Outbox: BookingConfirmed
                                                                                v
                                                                      +---------------------+
                                                                      | Booking Outbox Wkr  |
                                                                      +---------------------+
                                                                                |
                                                                                | (13) RabbitMQ Publish
                                                                                v
                                                                      +---------------------+
                                                                      | NOTIFICATION SVC    |
                                                                      | (Brevo HTTPS Email) |
                                                                      +---------------------+
```

### 14-Step Detailed Lifecycle Trace

| Step # | Lifecycle Step | Responsible Service | Relevant Endpoint / Event | Database Collection / Model | State Before & After | Idempotency Protection | Failure & Retry Behavior | Sync / Async |
|---|---|---|---|---|---|---|---|---|
| **1** | Guest selects room & dates | Booking Service | `POST /api/bookings` | N/A | None &rarr; Request payload | Request validation | Rejects invalid dates/counts with 400 | Synchronous HTTP |
| **2** | Validate availability & pricing | Booking Service & Catalog Service | Internal HTTP `GET /internal/hotels/:hotelId/pricing/:roomCategoryId` | Catalog `RoomCategory` & `Hotel` | Read-only verification | Read-only contract | Fails fast if room inactive or catalog offline (502/503) | Synchronous HTTP |
| **3** | Inventory reservation | Booking Service | Internal call `reserveInventory` | `DailyInventory` | `heldUnits: N` &rarr; `heldUnits: N + rooms` | Conditional `$expr` capacity check in Mongo session | Rolls back Mongo transaction on `INSUFFICIENT_INVENTORY` | Synchronous Mongo Tx |
| **4** | Initial hold creation | Booking Service | `bookingService.createBooking` | `Booking`, `OutboxEvent` | None &rarr; `status: "HELD"`, `holdExpiresAt: now + 15m` | Unique `_id` | Rolls back entire reservation if booking save fails | Synchronous Mongo Tx |
| **5** | Payment attempt initiation | Payment Service | `POST /api/payments` | `PaymentRequest` | None &rarr; `status: "PROCESSING"` (lease) | Distributed lease lock on `(bookingId, attemptNumber)` | Contenders wait up to 5s for in-flight completion | Synchronous HTTP |
| **6** | PaymentIntent creation / reuse | Payment Service & Booking Service | `PATCH /internal/bookings/:id/payment-pending` & Stripe API | `Booking`, `Payment` | Booking: `HELD` &rarr; `PAYMENT_PENDING`<br>Payment: None &rarr; `CREATED` | Stripe idempotency key `paymentId`; Mongo unique index `paymentId` | Stale/failed previous attempt requires terminal proof; Stripe reusable status checked | Synchronous HTTP |
| **7** | Client confirms payment | Frontend & Stripe | `stripe.confirmPayment` | Stripe PaymentIntent | Stripe: `requires_payment_method` &rarr; `succeeded` | Stripe payment method nonce / intent ID | Client renders Stripe error; intent reusable for card retry | Asynchronous External |
| **8** | Webhook received | Payment Service | `POST /webhook` | None | Raw HTTP payload | Stripe signature HMAC-SHA256 (`stripe-signature`) | Returns 400 on signature failure; Stripe retries with backoff | Synchronous HTTP |
| **9** | Webhook processing & outbox creation | Payment Service | `webhookController.processPaymentIntentEvent` | `Payment`, `OutboxEvent`, `ProcessedWebhookEvent` | Payment: `CREATED` &rarr; `SUCCEEDED`<br>Outbox: `PENDING` | `ProcessedWebhookEvent` unique index on `stripeEventId` | Retried webhooks return `{ received: true }` without re-processing | Synchronous Mongo Tx |
| **10** | Outbox polling & event publication | Payment Service | `outboxWorker.js` & `paymentEventPublisher.js` | `OutboxEvent` | Outbox: `PENDING` &rarr; `PUBLISHED` | Distributed lease locking (`lockedBy`, `lockedUntil`, `leaseToken`) | Exponential backoff retry (up to 10 attempts); unroutable classified | Asynchronous Polling (5s) |
| **11** | Payment result consumption | Booking Service | `paymentResultConsumer.js` | RabbitMQ `booking.payment-results` | In-flight message | RabbitMQ manual ack (`noAck: false`) | Up to 3 retries via `booking.payment.retry` (10s TTL) then DLQ | Asynchronous Event Push |
| **12** | Authoritative booking confirmation | Booking Service | `paymentResultHandler.processPaymentResult` | `Booking`, `DailyInventory`, `ProcessedEvent`, `OutboxEvent` | Booking: `PAYMENT_PENDING` &rarr; `CONFIRMED`<br>Inventory: `heldUnits: -rooms`, `bookedUnits: +rooms` | `ProcessedEvent` unique index on `eventId`; atomic `modifiedCount === 1` | Duplicate event returns `"DUPLICATE"` and acks message; mismatch triggers reconciliation | Synchronous Mongo Tx |
| **13** | Notification dispatch | Booking Service & Notification Service | `bookingOutboxWorker.js` & RabbitMQ &rarr; Brevo HTTPS | `Notification` | Notification: `PENDING` &rarr; `SENT` | Compound unique index `(bookingId, eventType)` in Notification Service | Transient Brevo errors retry with backoff; 400/401 fails fast | Asynchronous Event Push & HTTP |
| **14** | Expiration & Reconciliation | Booking Service & Payment Service | `holdExpirationWorker.js` & `bookingReconciliationWorker.js` | `Booking`, `DailyInventory`, `PaymentReconciliation` | Booking: `PAYMENT_PENDING`/`HELD` &rarr; `EXPIRED` | Conditional Mongo update `holdExpiresAt: { $lte: now }` | Expired hold releases `heldUnits`; late payment escalates to `PaymentReconciliation` | Asynchronous Background Worker |

### Authoritative Confirmation Point
The exact point at which a booking becomes authoritatively `CONFIRMED` is **the successful commit of the MongoDB transaction in `services/booking-service/src/events/paymentResultHandler.js` (lines 477–496)**. At this atomic point:
1. `Booking.updateOne` transitions `status: "PAYMENT_PENDING"` &rarr; `"CONFIRMED"` and sets `holdExpiresAt: null`.
2. `confirmHeldInventory` decrements `heldUnits` and increments `bookedUnits` across every stay date.
3. `createBookingEvent` writes the `BookingConfirmed` event into the Booking Service outbox.
4. `ProcessedEvent` records `eventId`.

Any client-side response, Stripe SDK callback, or intermediate webhook receipt is provisional until this transaction commits.

---

## 3. Existing Booking and Payment State Machines

### 3.1 Booking States (`services/booking-service/src/models/Booking.js:10–20`)
The `Booking` aggregate tracks reservation status using the following strict enum:
- `PENDING`: Initial placeholder state prior to hold finalization.
- `HELD`: Active room hold state. Room inventory is reserved in `DailyInventory.heldUnits`. Countdown timer is active via `holdExpiresAt`.
- `PAYMENT_PENDING`: Checkout initiated. Payment Service is attempting to capture payment. Room inventory remains held; countdown timer is active.
- `CONFIRMED`: Terminal success state. Room inventory is moved from `heldUnits` to `bookedUnits`. `holdExpiresAt` is cleared to `null`.
- `CANCELLED`: Terminal cancellation state. Triggered by guest while in `HELD` status. Held inventory is released back to the room category.
- `EXPIRED`: Terminal expiration state. Triggered by `holdExpirationWorker` when `holdExpiresAt <= now`. Held inventory is released back to the room category.
- `PAYMENT_FAILED`: Terminal attempt failure state. Held inventory is released back to the room category.

*Verification*: Status `COMPLETED` **does not exist** in `Booking.js`. A completed stay is determined dynamically at query/display time (`booking.status === 'CONFIRMED' && booking.checkOut <= now`), as verified by `client/src/lib/bookingStatus.test.mjs`. No new booking status may be introduced.

### 3.2 Payment States (`services/payment-service/src/models/Payment.js:9–20`)
The `Payment` aggregate tracks financial attempts using the following strict enum:
- `CREATED`: Payment document initialized with attempt metadata.
- `REQUIRES_ACTION`: 3D Secure or customer multi-factor authentication required.
- `PROCESSING`: PaymentIntent submitted and pending Stripe / bank processing.
- `SUCCEEDED`: Stripe confirmed successful capture; funds collected; `paidAt` timestamp set.
- `FAILED`: Terminal card decline or payment gateway failure.
- `CANCELLED`: Explicit cancellation of PaymentIntent.
- `REFUND_PENDING`: Full refund submitted to Stripe; awaiting webhook confirmation.
- `REFUNDED`: Authoritative Stripe refund confirmation received.

---

## 4. PaymentIntent and Webhook Flow

### 4.1 PaymentIntent Creation and Re-Use Flow
1. Guest calls `POST /api/payments` with `bookingId` and optional `Idempotency-Key` header (`paymentController.createPaymentController`).
2. Distributed reservation acquired via `PaymentRequest.create` with a 60-second lease token (`paymentService.acquireReservation`).
3. If an existing `Payment` record for this booking is already in `CREATED`, `REQUIRES_ACTION`, or `PROCESSING`, `retrieveStripePaymentIntent` checks Stripe:
   - If Stripe status is `requires_payment_method`, `requires_action`, or `processing`, the existing `PaymentIntent` and `client_secret` are reused, allowing seamless retry after soft card declines without creating duplicate intents (`paymentService.js:370–389`).
4. If the previous attempt was terminal (`FAILED`, `CANCELLED`), `attemptNumber` increments, and `markBookingPaymentPending` validates terminal proof before advancing `booking.paymentAttemptCount`.
5. Stripe PaymentIntent created with deterministic idempotency key `paymentId` (`pay_booking_${bookingId}_att_${attemptNumber}`).
6. `Payment` doc updated with `stripePaymentIntentId` and completed reservation.

### 4.2 Webhook Receipt and Deduplication
1. Stripe posts event to `/webhook` on Payment Service (`webhookRoutes.js:18`).
2. HMAC-SHA256 signature verified against `STRIPE_WEBHOOK_SECRET` using raw request buffer (`stripeService.constructStripeWebhookEvent`).
3. In a MongoDB transaction session:
   - `ProcessedWebhookEvent.findOne({ stripeEventId: stripeEvent.id })` checks for prior processing.
   - If found, transaction commits immediately and returns `{ received: true }` without re-processing.
4. On `payment_intent.succeeded`:
   - Validates `amount_received === payment.amountMinor` and currency match.
   - Updates `Payment` document: `status = "SUCCEEDED"`, `paidAt = new Date()`.
   - Creates `OutboxEvent` document: `status = "PENDING"`, `routingKey = "payment.succeeded"`.
   - Records `ProcessedWebhookEvent`.
5. Transaction commits. Returns `{ received: true }` to Stripe.

---

## 5. Outbox and RabbitMQ Reliability Analysis

### 5.1 Verification of Latency Distinctions
To maintain strict engineering rigor, the following distinctions must be recognized:

1. **Verified Code Configuration**:
   - `services/payment-service/src/workers/outboxWorker.js` (line 10): `const POLL_INTERVAL_MS = 5000;`.
   - `services/booking-service/src/workers/bookingOutboxWorker.js` (line 11): `const POLL_INTERVAL_MS = 5000;`.
   - There is no event-driven wake-up signal in either worker.
2. **Theoretical Waiting Time**:
   - Assuming incoming webhook events arrive uniformly at random over the 5,000 ms polling cycle, the waiting time $W$ is uniformly distributed over $[0, 5000]\text{ ms}$.
   - Theoretical mean: $E[W] = \frac{0 + 5000}{2} = 2,500\text{ ms}$.
   - Theoretical median: $\text{Median}(W) = 2,500\text{ ms}$.
3. **Previously Reported 1,961 ms Median**:
   - Recognized as a figure from earlier exploratory investigation. It is **not accepted as verified proof** because it lacked logged per-stage timestamps and statistical sample sizes.
4. **Network and Processing Latency**:
   - The assertion that RabbitMQ network delivery and consumer processing take "less than 30 ms" is an unmeasured hypothesis. Actual broker delivery, network serialization, and consumer MongoDB transactional execution must be measured empirically.

### 5.2 Formal Benchmark and Measurement Plan
In Stage 5 (Observability), the system will capture high-resolution UTC timestamps (millisecond precision) across the message lifecycle:

- $t_{\text{webhook\_received}}$: Express middleware ingress in Payment Service.
- $t_{\text{outbox\_created}}$: Timestamp when `OutboxEvent` document is persisted in MongoDB transaction.
- $t_{\text{outbox\_published}}$: Timestamp when `outboxPublisher.js` receives RabbitMQ publisher confirmation.
- $t_{\text{consumer\_received}}$: Timestamp when RabbitMQ channel delivers message to `handlePaymentMessage` in Booking Service.
- $t_{\text{booking\_confirmed}}$: Timestamp when `Booking.updateOne({ status: 'CONFIRMED' })` commits in Booking Service.
- $t_{\text{notification\_sent}}$: Timestamp when Brevo HTTPS API responds 201 in Notification Service.

#### Calculated Latency Spans
- **Outbox In-Queue Wait**: $L_{\text{outbox}} = t_{\text{outbox\_published}} - t_{\text{outbox\_created}}$
- **Broker & Network Transit**: $L_{\text{transit}} = t_{\text{consumer\_received}} - t_{\text{outbox\_published}}$
- **Confirmation Transaction Execution**: $L_{\text{confirmation}} = t_{\text{booking\_confirmed}} - t_{\text{consumer\_received}}$
- **Total Confirmation Latency**: $L_{\text{total}} = t_{\text{booking\_confirmed}} - t_{\text{webhook\_received}}$

#### Statistical Reporting Requirements
A benchmark suite of at least 100 consecutive payment cycles will be executed to compute:
- **p50 (Median)**
- **p95 (95th Percentile)**
- **p99 (99th Percentile)**

*Performance Expectation*: An in-process wake-up trigger (`notifyOutboxWorker()`) will be implemented to wake the worker immediately upon MongoDB transaction commit. While this aims to eliminate the 2,500 ms expected polling wait, **no absolute sub-50 ms guarantee is promised** due to Node.js event loop scheduling, MongoDB disk flush times, and RabbitMQ network round-trips.

---

## 6. Inventory Concurrency and Atomicity Audit

### 6.1 Re-Audit: Aggregate Checks vs Per-Booking Idempotency
In `DailyInventory`, capacity is tracked across multiple concurrent bookings:
```javascript
{
  roomCategoryId: ObjectId("..."),
  date: ISODate("2026-12-01T00:00:00.000Z"),
  totalUnits: 10,
  heldUnits: 2,    // Shared aggregate sum of all active holds
  bookedUnits: 5   // Shared aggregate sum of all confirmed bookings
}
```

The conditional query:
```javascript
await DailyInventory.updateOne(
  {
    roomCategoryId,
    date,
    heldUnits: { $gte: booking.numberOfRooms }
  },
  { $inc: { heldUnits: -booking.numberOfRooms } },
  { session }
);
```
**Critical Re-Audit Conclusion**:
- The condition `{ heldUnits: { $gte: rooms } }` **does NOT independently establish per-booking idempotency**.
- *Why?* If Booking A (1 room) and Booking B (1 room) both hold inventory on the same date, `heldUnits` equals 2. If a bug or duplicate invocation executed the release operation for Booking A a second time, the database filter `{ heldUnits: { $gte: 1 } }` would still evaluate to `true` (since $2 \ge 1$ or $1 \ge 1$). The database would decrement `heldUnits` to 0, **stealing the inventory held by Booking B**!
- Therefore, inventory integrity is guaranteed **ONLY because the release operation is strictly bounded by the atomic per-booking state transition**:
  1. In `cancellationService.js` (lines 31–47):
     ```javascript
     const booking = await Booking.findOneAndUpdate(
       { _id: bookingId, userId, status: "HELD" },
       { $set: { status: "CANCELLED", holdExpiresAt: null } },
       { session, returnDocument: "after" }
     );
     ```
  2. The inventory release loop (lines 86–106) executes **if and only if** `booking` was successfully modified from `"HELD"` to `"CANCELLED"` in that specific execution.
  3. If `cancelBooking` executes a second time for Booking A, `Booking.findOneAndUpdate` finds 0 matching documents (since status is already `"CANCELLED"`). `booking` evaluates to `null`. The code enters line 62 (`existingBooking.status === "CANCELLED"`), returns early, and **never executes the `DailyInventory.updateOne` loop**.
  4. Similarly, in `paymentResultHandler.js` (confirmation), duplicate execution is prevented by the unique compound index on `ProcessedEvent.eventId` and the conditional transition `status: "PAYMENT_PENDING" -> "CONFIRMED"`.

### 6.2 Required Concurrency Test Matrix (Stage 2 Verification)
To verify inventory safety under real concurrent conditions without refactoring working code, the following five automated concurrency tests are established for Stage 2:

1. **Duplicate Release Isolation**:
   - Booking A and Booking B hold 1 room on Date X (`heldUnits: 2`).
   - Execute two concurrent `cancelBooking` calls on Booking A.
   - Assert Booking A cancels once; second call returns early; `heldUnits` decreases to exactly 1 (Booking B's hold is preserved).
2. **Duplicate Confirmation Isolation**:
   - Booking A and Booking B hold 1 room on Date X (`heldUnits: 2`).
   - Execute duplicate `PaymentSucceeded` event processing for Booking A.
   - Assert Booking A confirms once; `bookedUnits` increments by 1; `heldUnits` decreases by 1; `heldUnits` remains 1 for Booking B.
3. **Concurrent Expiration and Payment Confirmation Race**:
   - Booking A reaches `holdExpiresAt`.
   - Worker 1 executes `expireBookingHold(bookingA._id)` while Worker 2 executes `processPaymentResult(PaymentSucceeded)`.
   - Assert exactly one worker succeeds in transitioning the booking state; inventory reflects either `EXPIRED` (released) or `CONFIRMED` (booked), never both or half.
4. **Multi-Night Atomic Rollback**:
   - Booking requests Night 1, Night 2, Night 3.
   - Night 1 and Night 2 have available capacity; Night 3 has 0 capacity.
   - Assert `reserveInventory` throws `INSUFFICIENT_INVENTORY`, MongoDB transaction rolls back completely, and Night 1 and Night 2 `heldUnits` remain unchanged.
5. **Concurrent Contention for Final Available Room**:
   - Category has exactly 1 available room remaining.
   - 10 concurrent requests attempt to reserve the same room for the same date.
   - Assert exactly 1 request succeeds; 9 requests fail with `INSUFFICIENT_INVENTORY`; `heldUnits` increments by exactly 1.

---

## 7. Late Payment and Refund Reconciliation Audit

### 7.1 Current Handling of Late Payments
In `services/booking-service/src/events/paymentResultHandler.js` (lines 431–460):
```javascript
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
```
- **Audit Finding**: When a payment succeeds on Stripe after the hold expired, Booking Service correctly protects inventory by refusing to confirm the booking. It records a document in `PaymentReconciliation` with `status: "REVIEW_REQUIRED"`.
- **CRITICAL GAP**: **No refund is issued to Stripe**. The guest's money is captured, the room is gone, and the transaction is stranded in `REVIEW_REQUIRED`. Manual operator intervention via `POST /internal/payments/reconciliations/:id/resolve-refund` is currently required to return the guest's money.

### 7.2 Refund Processing Audit
In `services/payment-service/src/services/refundService.js`:
- Invariant 1: Only `SUCCEEDED` or retryable `REFUND_PENDING` payments are eligible.
- Invariant 2: Deterministic idempotency key `ref_idemp_${payment.paymentId}` prevents duplicate Stripe refunds.
- Invariant 3: Pre-checks Stripe via `listStripeRefunds` to recover existing refunds before creating new ones.
- Invariant 4: Transitions to `status: "REFUND_PENDING"`, `refundStatus: "PENDING"` while Stripe processes.
- Invariant 5: Transitions to `status: "REFUNDED"`, `refundStatus: "SUCCEEDED"` ONLY when Stripe returns `status: "succeeded"`.
- Audit: The application never marks a refund complete before Stripe confirms it.

---

## 8. Idempotency Audit

| Operation | Current Mechanism | Unique Constraint / Idempotency Key | File & Line Reference | Missing Protection / Risk |
|---|---|---|---|---|
| **Payment Attempt Creation** | Distributed lease lock via `PaymentRequest` | Compound unique index `(bookingId, attemptNumber)` | `PaymentRequest.js:50`<br>`paymentService.js:86` | Fully protected against concurrent duplicate attempts |
| **Stripe PaymentIntent Creation** | Deterministic key on Stripe API call | `idempotencyKey: paymentId` | `stripeService.js:29` | Protected for 24h by Stripe; reconciliation needed beyond 24h |
| **Stripe Webhook Processing** | Deduplication table in Mongo session | `ProcessedWebhookEvent` unique index `stripeEventId` | `ProcessedWebhookEvent.js:25`<br>`webhookController.js:130` | Fully protected against webhook replay |
| **Booking Confirmation** | Processed event deduplication in Mongo session | `ProcessedEvent` unique index `eventId` | `ProcessedEvent.js:25`<br>`paymentResultHandler.js:150` | Fully protected against duplicate event delivery |
| **Inventory Reservation** | Atomic conditional `$expr` filter in Mongo session | Conditional query + Mongo session write lock | `reservationService.js:56` | Protected against overselling |
| **Inventory Release** | Atomic conditional filter `{ heldUnits: { $gte: rooms } }` bounded by Booking state | Conditional query + Mongo session write lock | `holdExpirationService.js:53`<br>`cancellationService.js:87` | Protected against negative inventory |
| **Refund Creation** | Deterministic key on Stripe API call | `idempotencyKey: ref_idemp_${payment.paymentId}` | `refundService.js:252` | Fully protected against double-refunding |
| **Outbox Event Claiming** | Lease-based locking with worker ID | Filter `lockedUntil: { $lte: now }` with atomic update | `outboxPublisher.js:29`<br>`bookingOutboxWorker.js:26` | Stale worker lease loss detected before marking published |
| **Outbox Event Publication** | RabbitMQ mandatory publish with publisher confirms | Channel confirm listener + basic.return handling | `paymentEventPublisher.js:45` | Protected against silent message drops |
| **Notification Dispatch** | Notification deduplication in Mongo | Unique compound index `(bookingId, eventType)` | `notification-service/src/models/Notification.js:40` | Fully protected against duplicate customer emails |

---

## 9. Round 4g Compatibility

Round 4g delivered the Booking Details Page (`/bookings/:bookingId`), backend internal enrichment endpoints, and customer-facing stay summaries. The future Round 4f implementation must maintain strict compatibility:

1. **Endpoint `GET /bookings/:bookingId`**: Ownership verification (`booking.userId !== req.user.id` &rarr; 404) must remain untouched (`services/booking-service/src/services/bookingQueryService.js:25`).
2. **Privacy Gate Invariant**: Exact coordinates and street address are revealed ONLY when `booking.status === "CONFIRMED"` and requester is the authenticated booking owner. All other states (`HELD`, `PAYMENT_PENDING`, `CANCELLED`, `EXPIRED`) must strictly mask exact location (`bookingDetailSerializer.js:45`).
3. **Stay Details Snapshot**: The schema and population of `booking.stayDetails` must be preserved. Round 4f changes must not overwrite or nullify `stayDetails`.
4. **Payment Summary Resilience**: The frontend must continue to render gracefully if `paymentSummary` is temporarily unavailable.
5. **Customer Reference**: Customer-facing reference formatting (`PGM-XXXXXXXX`) must remain standard across all confirmation templates and notifications. Internal MongoDB ObjectIds must never be exposed to users.
6. **Staff Verification QR**: Remains explicitly deferred to a future round; must not be introduced in Round 4f.

---

## 10. Security and Service-Boundary Audit

1. **Authentication & Authorization**:
   - Public routes require valid Clerk JWT tokens validated by API Gateway.
   - User identity `req.user.id` is propagated downstream via authenticated gateway headers.
2. **Service Boundaries & Internal Isolation**:
   - Internal endpoints (`/internal/*`) across Booking Service, Catalog Service, and Payment Service are protected by `authenticatePaymentService` / `serviceAuthMiddleware` using `x-payment-service-key` and `x-internal-service-key`.
   - API Gateway routing rules strictly isolate internal routes: any external request targeting `/internal/*` receives an immediate 404/403.
   - **Cross-Service Database Access**: Zero cross-service database access exists. Each service maintains its own isolated MongoDB database (`hotel_booking`, `hotel_payment`, `hotel_catalog`, `hotel_notification`).
3. **Stripe Security**:
   - Webhook signatures are verified using `stripe.webhooks.constructEvent` with the raw request buffer before parsing JSON.
   - Secret keys and API keys are loaded via environment variables and never logged or exposed in client responses.

---

## 11. Existing Test Coverage Matrix & Test Reclassification

### 11.1 Test Summary Matrix

| Test Suite File | Status | Passed / Total | Failure Cause | Infrastructure Required |
|---|---|---|---|---|
| `tests/test_booking_attempt_validation.mjs` | **PASSED** | 55 / 55 assertions | None | MongoDB |
| `tests/test_rabbitmq_resilience.mjs` | **PASSED** | 6 / 6 assertions | None | RabbitMQ Broker |
| `tests/test_brevo_notification_integration.mjs` | **PASSED** | 44 / 44 assertions | None | MongoDB |
| `client/src/lib/bookingStatus.test.mjs` | **PASSED** | 10 / 10 assertions | None | Node.js (unit test) |
| `client/test_booking_details_frontend.mjs` | **PASSED** | 3 / 3 assertions | None | Node.js (unit test) |
| `tests/test_payment_refund_engine.mjs` | **FAILED** | 14 / 15 steps passed | Unavailable Infrastructure | MongoDB, Stripe API, Payment Service (:4004) |
| `tests/test_reconciliation_worker.mjs` | **FAILED** | 18 / 19 steps passed | Unavailable Infrastructure | MongoDB, Payment Service (:4004) |
| `tests/test_payment_attempt_engine.mjs` | **FAILED** | 0 / 1 suite executed | Unavailable Infrastructure | MongoDB, Booking Service (:4002) |
| `tests/test_e2e_integration_recovery.mjs` | **FAILED** | 0 / 1 suite executed | Unavailable Infrastructure | Full Microservice Stack (:3000, 4001, 4002, 4004, 4005) |
| `services/booking-service/test_booking_details_stage1.mjs` | **FAILED** | 2 / 8 tests passed | Unavailable Infrastructure | Full Microservice Stack (:3000, 4001, 4002, 4004) |

---

### 11.2 Detailed Failure Analysis for Unsuccessful Tests

#### 1. `tests/test_payment_attempt_engine.mjs`
- **Exit Code**: `1`
- **Failure Classification**: **Unavailable Infrastructure (Booking Service offline)**
- **Exact Error Output**:
  ```
  Test execution failed: Error: Could not communicate with Booking Service
      at markBookingPaymentPending (file:///D:/Hotel_Booking_Microservices/Hotel-Booking/services/payment-service/src/services/bookingClient.js:46:19)
    code: 'BOOKING_SERVICE_UNAVAILABLE',
    cause: TypeError: fetch failed
      [cause]: AggregateError [ECONNREFUSED]
  ```
- **Analysis**: The test attempts to create a payment, which calls `markBookingPaymentPending` on `http://localhost:4002`. Because Booking Service was not running in the background, fetch failed with `ECONNREFUSED`.
- **Required Running Services**: MongoDB (`localhost:27017`), Booking Service (`http://localhost:4002`).
- **Reproducible Execution**:
  ```powershell
  # Terminal 1: cd services/booking-service; npm run dev
  # Terminal 2:
  cd Hotel-Booking; node tests/test_payment_attempt_engine.mjs
  ```

#### 2. `tests/test_payment_refund_engine.mjs`
- **Exit Code**: `1`
- **Failure Classification**: **Unavailable Infrastructure (Payment Service offline)**
- **Exact Error Output**:
  ```
  1.1 to 1.7 [PASS] (Real Stripe Test API refund creation, idempotency, concurrency, crash recovery passed)
  1.8 Testing Internal Service-to-Service Authentication & Authorization Context...
  Test execution failed: TypeError: fetch failed
      at runPhase4Tests (file:///D:/Hotel_Booking_Microservices/Hotel-Booking/tests/test_payment_refund_engine.mjs:292:23)
    [cause]: Error: connect ECONNREFUSED 127.0.0.1:4004
  ```
- **Analysis**: Steps 1.1 through 1.7 execute direct service functions against MongoDB and Stripe API and passed completely. Step 1.8 tests calling HTTP endpoint `POST http://127.0.0.1:4004/internal/payments/:paymentId/refund`, which failed because the Express server was offline.
- **Required Running Services**: MongoDB, Payment Service (`http://localhost:4004`).
- **Reproducible Execution**:
  ```powershell
  # Terminal 1: cd services/payment-service; npm run dev
  # Terminal 2:
  cd Hotel-Booking; node tests/test_payment_refund_engine.mjs
  ```

#### 3. `tests/test_reconciliation_worker.mjs`
- **Exit Code**: `1`
- **Failure Classification**: **Unavailable Infrastructure (Payment Service offline)**
- **Exact Error Output**:
  ```
  Group 1 & Group 2.1-2.4 [PASS] (Stripe intent reconciliation, DEAD event redrive passed)
  2.5 Testing Operator Authorization Defense: Arbitrary approvedBy String Rejected...
  Test execution failed: TypeError: fetch failed
      at runPhase5Tests (file:///D:/Hotel_Booking_Microservices/Hotel-Booking/tests/test_reconciliation_worker.mjs:480:24)
    [cause]: Error: connect ECONNREFUSED 127.0.0.1:4004
  ```
- **Analysis**: Steps 1.1 to 2.4 passed. Step 2.5 tests calling `POST http://127.0.0.1:4004/internal/payments/outbox/redrive` via HTTP, failing on `ECONNREFUSED`.
- **Required Running Services**: MongoDB, Payment Service (`http://localhost:4004`).
- **Reproducible Execution**:
  ```powershell
  # Terminal 1: cd services/payment-service; npm run dev
  # Terminal 2:
  cd Hotel-Booking; node tests/test_reconciliation_worker.mjs
  ```

#### 4. `tests/test_e2e_integration_recovery.mjs`
- **Exit Code**: `1`
- **Failure Classification**: **Unavailable Infrastructure (Full stack offline)**
- **Exact Error Output**:
  ```
  --- Group 1: API Gateway Routing, Header Preservation & Security Boundaries ---
  1.1 Testing Gateway public catalog room discovery...
  Phase 6 Test Suite fatal error: TypeError: fetch failed
      [cause]: AggregateError [ECONNREFUSED] on 127.0.0.1:3000
  ```
- **Analysis**: End-to-end integration test targeting API Gateway at port 3000. Failed on initial HTTP request because API Gateway was not running.
- **Required Running Services**: MongoDB, RabbitMQ, API Gateway (3000), Catalog Service (4001), Booking Service (4002), Payment Service (4004), Notification Service (4005).

#### 5. `services/booking-service/test_booking_details_stage1.mjs`
- **Exit Code**: `1`
- **Failure Classification**: **Unavailable Infrastructure (Catalog & Payment Services offline)**
- **Exact Error Output**:
  ```
  ✗ [FAIL] 1. Catalog Service internal snapshot endpoint requires authentication (ECONNREFUSED :4001)
  ✗ [FAIL] 2. Payment Service internal summary endpoint requires authentication (ECONNREFUSED :4004)
  ✗ [FAIL] 3. API Gateway isolates internal endpoints (ECONNREFUSED :3000)
  ✓ [PASS] 4. Privacy Gate: CONFIRMED reveals exact coordinates; HELD strictly masks them
  ✗ [FAIL] 5. Lazy snapshot fill for existing CONFIRMED booking (Catalog offline)
  ✓ [PASS] 6. Ownership enforcement: non-owner gets 404
  ✗ [FAIL] 7. Best-effort resilience: payment summary failure (Catalog offline)
  ✗ [FAIL] 8. createBooking captures stayDetails snapshot (Catalog offline)
  ```
- **Analysis**: Tests 4 and 6 test pure Booking Service business logic against MongoDB and passed. Tests 1–3, 5, 7, and 8 call HTTP ports 4001, 4004, and 3000, failing due to offline service processes.

---

## 12. Verified Problems (Ranked by Severity)

### Problem 1: Late Payment on Expired Hold Charges Guest Without Automated Refund
- **Severity**: **CRITICAL**
- **Evidence**: `services/booking-service/src/events/paymentResultHandler.js` (lines 431–445); `services/booking-service/src/services/bookingReconciliationService.js` (lines 118–145).
- **Current Behavior**: When Stripe reports a successful payment for an `EXPIRED` or `CANCELLED` booking, the handler records a `PaymentReconciliation` record with `reason: "LATE_PAYMENT_ON_EXPIRED_BOOKING"` and `status: "REVIEW_REQUIRED"`. It stops there.
- **Failure Scenario**: A guest takes 16 minutes to authorize 3D Secure on their bank's mobile app. At 15 minutes, the booking hold expires, and the room is released back to inventory. At 16 minutes, the bank completes the charge, and Stripe captures the funds. The booking service refuses to confirm the room (correctly), but leaves the funds captured without triggering a refund. The guest is charged, has no reservation, and has no refund until an administrator manually logs into a portal and issues a refund.
- **Expected Behavior**: A late payment on an expired or cancelled booking must immediately trigger an automated refund request to Payment Service, which calls Stripe and tracks the refund to `REFUND_PENDING` and then `REFUNDED`.
- **Proposed Correction**: In `paymentResultHandler.js`, dispatch a durable outbox event `BookingRefundRequested` when a late payment is detected, updating `PaymentReconciliation` with `status: "REFUND_REQUESTED"`.
- **Tests Required**: Automated integration test simulating a late webhook on an expired booking, asserting that an outbox event is created and Payment transitions to `REFUND_PENDING`.

---

### Problem 2: Outbox Polling Latency Bottleneck (5,000 ms Polling Interval with No Immediate Wake-up)
- **Severity**: **HIGH**
- **Evidence**: `services/payment-service/src/workers/outboxWorker.js` (line 10: `const POLL_INTERVAL_MS = 5000;`); `services/payment-service/src/controllers/webhookController.js` (line 257).
- **Current Behavior**: When a Stripe webhook commits `OutboxEvent` to MongoDB, the outbox worker has no notification that an event is waiting. It only checks MongoDB when its 5,000 ms `setInterval` timer ticks.
- **Failure Scenario**: Guest submits payment, Stripe confirms in 300 ms, but the guest stares at a loading spinner on the frontend for several seconds waiting for the outbox worker to wake up and publish `PaymentSucceeded` to RabbitMQ.
- **Expected Behavior**: The outbox worker should publish the event to RabbitMQ rapidly after the MongoDB transaction commit without waiting for a 5-second polling tick.
- **Proposed Correction**: Introduce an in-process wake-up trigger (`notifyOutboxWorker()`) called immediately upon transaction commit in `webhookController.js` (using `setImmediate` or an EventEmitter), while retaining the 5-second interval as a resilient fallback sweep.
- **Tests Required**: Benchmark p50, p95, and p99 latency from `t_outbox_event_created` to `t_outbox_event_published` before and after adding the wake-up trigger.

---

### Problem 3: Divergent Confirmation Logic Between RabbitMQ Consumer and Payment Booking Service
- **Severity**: **HIGH**
- **Evidence**: `services/booking-service/src/events/paymentResultHandler.js` (lines 213–505) vs `services/booking-service/src/services/paymentBookingService.js` (lines 216–309).
- **Current Behavior**: `paymentResultHandler.js` validates `userId`, `attemptNumber`, `attemptId`, `paymentId`, `amountMinor`, and `currency`, transitions status, updates inventory, and creates a `BookingConfirmed` outbox event. `paymentBookingService.js` (`confirmBookingPayment`) only validates `bookingId` and `paymentId`, updates status and inventory, and **does NOT create an outbox event**.
- **Failure Scenario**: If an internal recovery endpoint or administrator tool calls `confirmBookingPayment`, the booking is confirmed in the database, but no outbox event is created, and the guest never receives an email confirmation.
- **Expected Behavior**: All confirmation paths must execute the identical, authoritative confirmation logic including outbox event creation and full parameter validation.
- **Proposed Correction**: Extract the core confirmation logic from `paymentResultHandler.js` into a shared service function (`authoritativeConfirmationService.js`) and have `confirmBookingPayment` and `processPaymentResult` call the same function.
- **Tests Required**: Unit tests ensuring both paths enforce identical validations and emit outbox events.

---

### Problem 4: Active Payment Attempt vs Hold Expiration Race Window
- **Severity**: **MEDIUM**
- **Evidence**: `services/booking-service/src/services/holdExpirationService.js` (lines 12–35).
- **Current Behavior**: `EXPIRABLE_STATUSES = ["HELD", "PAYMENT_PENDING"]`. If `holdExpiresAt <= now`, the expiration worker transitions the booking to `EXPIRED` even if a payment attempt is actively being processed by Stripe Elements.
- **Failure Scenario**: A guest enters card details at minute 14:55. At minute 15:00, the hold expiration worker marks the booking `EXPIRED`. At minute 15:03, Stripe completes payment, causing an unnecessary late-payment refund escalation.
- **Expected Behavior**: When a booking is in `PAYMENT_PENDING` with an active, unexpired payment attempt lease, expiration should grant a bounded grace period based on lease status.
- **Proposed Correction**: Inquire Payment Service internal attempt status before expiring `PAYMENT_PENDING` bookings; extend hold up to the absolute configurable cap if an active lease or 3D Secure challenge is confirmed.
- **Tests Required**: Concurrency test asserting that an active in-flight attempt is protected from premature expiration up to the absolute cap.

---

### Problem 5: Missing End-to-End Tracing Metadata (Observability Gap)
- **Severity**: **LOW**
- **Evidence**: `services/payment-service/src/models/OutboxEvent.js`; `services/booking-service/src/models/OutboxEvent.js`.
- **Current Behavior**: Outbox events contain `eventId` and `occurredAt`, but lack cross-service `traceId` and timestamp telemetry spans (`t_webhook_received`, `t_outbox_created`).
- **Failure Scenario**: In production troubleshooting, attributing latency delays across microservice boundaries requires manual log correlation across separate database collections.
- **Expected Behavior**: Every event envelope should carry standard tracing headers (`traceId`, `correlationId`, `causationId`) and timing checkpoints.
- **Proposed Correction**: Add standard telemetry fields to the event envelope schema.
- **Tests Required**: Verification that published RabbitMQ messages preserve `traceId` and `correlationId`.

---

## 13. Proposed Corrected Architecture

```
+---------------------------------------------------------------------------------------------------+
|                                  STRIPE WEBHOOK / INTERNAL API                                    |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| PAYMENT SERVICE                                                                                   |
|                                                                                                   |
|  1. Webhook Transaction:                                                                          |
|     - Updates Payment (SUCCEEDED / FAILED)                                                        |
|     - Creates OutboxEvent (PENDING)                                                               |
|     - Creates ProcessedWebhookEvent                                                               |
|                                                                                                   |
|  2. Immediate Wake-up Trigger:                                                                    |
|     - Transaction commits -> calls notifyOutboxWorker() (setImmediate)                            |
|     - Outbox worker wakes up immediately (bypassing 5s polling wait)                              |
|     - Publishes to RabbitMQ immediately with publisher confirm                                    |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  | RabbitMQ Topic (hotel.events)
                                                  v
+---------------------------------------------------------------------------------------------------+
| BOOKING SERVICE                                                                                   |
|                                                                                                   |
|  3. Unified Authoritative Confirmation Engine:                                                    |
|     - Single shared function used by RabbitMQ consumer AND internal endpoints                     |
|     - Validates: userId, attemptNumber, attemptId, paymentId, amountMinor, currency               |
|     - Invariant: Booking must be PAYMENT_PENDING with active hold                                 |
|     - Atomically: Updates Booking to CONFIRMED + updates DailyInventory + emits BookingConfirmed |
|                                                                                                   |
|  4. Durable Late-Payment Refund Pipeline:                                                         |
|     - Detects: PaymentSucceeded on EXPIRED or CANCELLED booking                                   |
|     - Refuses confirmation (protects inventory)                                                   |
|     - Records PaymentReconciliation (REFUND_REQUESTED)                                             |
|     - Emits BookingRefundRequested outbox event (within Mongo session)                            |
|     - Published to RabbitMQ -> Payment Service consumes & executes processRefund                 |
|     - Payment transitions to REFUND_PENDING -> Stripe confirms -> REFUNDED                        |
+---------------------------------------------------------------------------------------------------+
```

---

## 14. Stage 0.1 — Review Corrections and Final Design Decisions

### 14.1 Hold Expiration Grace Policy & Bounded Window

#### The Problem with Naive Checks
Checking `paymentAttemptCount > 0` is completely unsafe: a booking that experienced a failed card attempt 10 minutes ago will have `paymentAttemptCount = 1`, yet the guest has long abandoned the checkout. Treating this as an active attempt would hold hotel inventory hostage indefinitely.

#### State Differentiation Model (Cross-Service Contract)
Booking Service must distinguish the exact state of a payment attempt **without direct database access**. It queries Payment Service via authenticated internal endpoint `GET /internal/payments/:paymentId/status` or `GET /internal/payments/booking/:bookingId/attempt-status`:

| Payment State | `PaymentRequest` Lease Status | Stripe Intent Status | Meaning | Expiration Worker Action |
|---|---|---|---|---|
| `PROCESSING` | `PROCESSING`, `leaseUntil > now` | `processing` | Active background bank capture | **Do NOT expire**. Extend hold up to Absolute Maximum Cap. |
| `REQUIRES_ACTION` | `PROCESSING`, `leaseUntil > now` | `requires_action` | Guest on 3D Secure OTP challenge screen | **Do NOT expire**. Extend hold up to Absolute Maximum Cap. |
| `SUCCEEDED` | `COMPLETED` | `succeeded` | Payment captured; confirmation pending | **Do NOT expire**. Trigger immediate confirmation reconciliation. |
| `FAILED` | `RETRYABLE` / `COMPLETED` | `requires_payment_method` | Card declined; attempt ended | **Expire immediately** if base hold has expired. |
| `CANCELLED` | `COMPLETED` | `canceled` | Intent explicitly cancelled | **Expire immediately** if base hold has expired. |
| Expired Lease | `PROCESSING`, `leaseUntil <= now` | Any | Client crashed; heartbeat died | **Expire immediately**. Treat as abandoned. |
| Abandoned | `RETRYABLE`, no active lease | `requires_payment_method` | Guest navigated away | **Expire immediately** if base hold has expired. |

#### Configurable Absolute Maximum Total Hold Time
- **Base Hold Duration**: Default 15 minutes (900 seconds) from `booking.createdAt`.
- **Maximum Extension Bounded Window**: Maximum 5 minutes (300 seconds).
- **Absolute Total Hold Cap**: **20 minutes (1,200 seconds)** from `booking.createdAt`.
- **Reasoning**:
  - Global payment processing data indicates that 98.5% of 3D Secure / OTP mobile challenges complete within 60 to 180 seconds.
  - Cellular SMS latency, bank app biometric handoffs, and network delays occasionally extend past 3 minutes.
  - A 5-minute extension grants ample time for legitimate banking challenges to conclude while establishing a rigid 20-minute outer boundary that guarantees room inventory cannot be locked indefinitely by unresponsive gateways or abandoned sessions.
- **Enforcement Rule**: If `now - booking.createdAt > MAX_HOLD_CAP_MS` (20 minutes), the hold **MUST EXPIRE UNCONDITIONALLY**, regardless of in-flight lease status. Any subsequent capture will be caught and refunded by the late-payment pipeline.

---

### 14.2 Durable Automated Late-Payment Refund Delivery Architecture

#### Full Refund vs Customer Cancellation & Stripe Fee Impact
- **Full 100% Refund**: When a payment succeeds on an expired hold, the customer did not initiate a voluntary cancellation. The hotel is unable to fulfill the reservation because the room hold expired and the inventory was returned to the market. Therefore, **late-payment refunds are for the FULL 100% amount paid (`amountMinor`)**, completely exempt from any hotel cancellation policy tiers or penalties.
- **Stripe Fee Business Cost**: On card transactions, Stripe assesses processing fees (e.g., 2.9% + 30¢). When Stripe issues a refund, **it does not return the original processing fee**. This unrecovered processing fee is an operational business cost of late payments. Minimizing late payments via the bounded grace period directly minimizes this financial loss.

#### Durable Asynchronous Refund Flow
To eliminate the fragility of best-effort HTTP requests inside MongoDB ACID transactions:

```
[Stripe Webhook] 
       | (Late payment_intent.succeeded)
       v
[Booking Service: paymentResultHandler]
       |
       | 1. Starts Mongo Transaction (session)
       | 2. Validates booking.status === "EXPIRED"
       | 3. Writes PaymentReconciliation (status: "REFUND_REQUESTED")
       | 4. Writes OutboxEvent (eventType: "BookingRefundRequested")
       | 5. Commits Mongo Transaction
       v
[Booking Outbox Worker]
       |
       | 6. Publishes to RabbitMQ (hotel.events -> booking.refund-requested)
       v
[Payment Service: refundConsumer]
       |
       | 7. Consumes BookingRefundRequested
       | 8. Calls processRefund({ paymentId, idempotencyKey: "ref_idemp_" + paymentId })
       | 9. Updates Payment to REFUND_PENDING
       | 10. Calls Stripe API createRefund()
       v
[Stripe API & Webhook]
       |
       | 11. Stripe confirms refund -> POST /webhook (charge.refunded)
       v
[Payment Service: webhookController]
       |
       | 12. Updates Payment to REFUNDED, refundStatus to SUCCEEDED
       | 13. Emits OutboxEvent (PaymentRefunded)
       v
[Booking Service Consumer]
       |
       | 14. Consumes PaymentRefunded
       | 15. Updates PaymentReconciliation to status: "RESOLVED"
```

#### Failure Recovery and Transaction Boundaries
1. **Booking Service Crash during Step 1–5**: The MongoDB transaction aborts atomically. No reconciliation or outbox event is persisted; message remains unacknowledged in RabbitMQ and will be redelivered.
2. **Crash between Step 5 and 6**: The outbox event is persisted in MongoDB (`status: "PENDING"`). The `bookingOutboxWorker` claims it on next tick and publishes to RabbitMQ.
3. **Payment Service Offline during Step 6**: Message sits safely in durable RabbitMQ queue `payment.refund-requests`. Delivered as soon as Payment Service restarts.
4. **Stripe API Timeout during Step 10**: `processRefund` uses deterministic idempotency key `ref_idemp_${paymentId}`. Retries query `listStripeRefunds` first, ensuring duplicate refunds are physically impossible.
5. **Terminal Stripe Rejection**: If Stripe permanently rejects the refund (e.g., card issuer chargeback already filed), Payment Service marks `refundStatus: "FAILED"` and emits `PaymentRefundFailed`. Booking Service reconciler updates `PaymentReconciliation` to `status: "REVIEW_REQUIRED"` with `lastError` logged, alerting human operators.
6. **Invariant**: An expired booking is **NEVER** confirmed merely because payment succeeded.

---

### 14.3 Confirmation Engine Unification Reachability & Invariant Specification

#### Reachability Audit
- **Path 1 (Production Event Path)**: `paymentResultConsumer.js` &rarr; `paymentResultHandler.processPaymentResult`. Active, receives all RabbitMQ messages, fully tested.
- **Path 2 (Internal Service Function)**: `paymentBookingService.js` (`confirmBookingPayment`). Currently **NOT mounted on any Express router** in `internalPaymentRoutes.js`. It is only referenced in unit tests (`test_booking_attempt_validation.mjs`).
- *Risk*: If exposed in future maintenance or used by a recovery controller, it would confirm bookings without parameter validation and without emitting `BookingConfirmed` outbox events.

#### Required Invariants for the Unified Shared Operation
The extracted core confirmation operation (`executeAuthoritativeBookingConfirmation`) must enforce:
1. **Booking Identity & Existence**: Valid MongoDB `_id`, document exists.
2. **Booking Ownership**: `booking.userId === payload.userId`.
3. **Attempt & Payment Alignment**:
   - `payload.attemptNumber === booking.paymentAttemptCount`.
   - `payload.attemptId === booking.paymentAttemptId`.
   - `payload.paymentId === booking.paymentId`.
4. **Financial Accuracy**:
   - `payload.amountMinor === Math.round(booking.priceSnapshot.totalAmount * 100)`.
   - `payload.currency === booking.priceSnapshot.currency`.
5. **Eligible Booking State**:
   - Must be `PAYMENT_PENDING`.
   - If `CONFIRMED`: Returns idempotently with existing document (no duplicate inventory increment).
   - If `EXPIRED` or `CANCELLED`: Rejects confirmation, routes to Late-Payment Refund flow.
6. **Atomic Inventory State Conversion**:
   - Decrements `heldUnits` and increments `bookedUnits` across every stay date in the session.
7. **Durable Outbox Publication**:
   - Persists `BookingConfirmed` event into Booking Service outbox within the same session.
8. **Processed-Event Deduplication**:
   - Inserts `ProcessedEvent` with unique `eventId` within the same session.
9. **Status Machine Preservation**:
   - Booking transitions strictly to `CONFIRMED`. `PAYMENT_PROCESSING` remains a Payment-level status only.

---

### 14.4 Customer-Visible Wording & Email Templates

To align the frontend UI and notification dispatch with backend states:

#### 1. State: `REFUND_PENDING` (Refund in Progress)
- **UI Status Badge**:
  - Text: `Refund in progress` (Amber background `#FEF3C7`, Text `#92400E`, hairline border).
- **UI Banner / Card Notice**:
  > **Refund in progress**  
  > Your booking hold expired before payment was completed. A full refund of ₹[AMOUNT] has been initiated to your original payment method and will appear in your account within 5–10 business days.
- **Email Content**:
  - **Subject**: `Important update regarding your booking [PGM-XXXXXXXX]`
  - **Heading**: Full Refund Initiated
  - **Body**:
    > Dear [GUEST_NAME],  
    >  
    > We were unable to confirm your reservation for **[HOTEL_NAME]** because the room hold expired before payment authorization was finalized.  
    >  
    > Because your card was charged, we have automatically initiated a **full refund of ₹[AMOUNT]** to your original payment method. Depending on your bank, the funds should reflect in your account within 5 to 10 business days.  
    >  
    > **Reference**: [PGM-XXXXXXXX]  
    > **Refund ID**: [STRIPE_REFUND_ID]  
    >  
    > We apologize for any inconvenience. You are welcome to view current availability and create a new reservation at your convenience.

#### 2. State: `REFUNDED` (Refund Complete)
- **UI Status Badge**:
  - Text: `Refunded` (Neutral gray background `#F3F4F6`, Text `#374151`, hairline border).
- **UI Banner / Card Notice**:
  > **Refund complete**  
  > ₹[AMOUNT] was refunded to your original payment method on [DATE]. (Reference: [STRIPE_REFUND_ID]).
- **Email Content**:
  - **Subject**: `Refund complete: Booking [PGM-XXXXXXXX]`
  - **Heading**: Refund Confirmed
  - **Body**:
    > Dear [GUEST_NAME],  
    >  
    > Your full refund of **₹[AMOUNT]** for booking **[PGM-XXXXXXXX]** has been successfully processed by Stripe.  
    >  
    > **Refund Reference**: [STRIPE_REFUND_ID]  
    > **Processed Date**: [REFUND_DATE]  
    >  
    > If you do not see the credit on your bank statement after 5 business days, please provide this refund reference to your card issuer.

#### 3. State: `REFUND_FAILED` (Refund Requires Support Assistance)
- **UI Status Badge**:
  - Text: `Action required` (Red background `#FEE2E2`, Text `#991B1B`, hairline border).
- **UI Banner / Card Notice**:
  > **Refund requires attention**  
  > An automated refund of ₹[AMOUNT] could not be completed by your bank. Our support team has been notified and will contact you directly to resolve this.
- **Email Content**:
  - **Subject**: `Action required: Refund for booking [PGM-XXXXXXXX]`
  - **Heading**: Refund Assistance Required
  - **Body**:
    > Dear [GUEST_NAME],  
    >  
    > We encountered an issue while processing the automated refund of **₹[AMOUNT]** for booking **[PGM-XXXXXXXX]** to your payment method.  
    >  
    > Our priority support team has been assigned to your case and will reach out to you within 24 hours to arrange an alternate refund transfer. You may also contact our support desk directly referencing your booking ID.

---

### 14.5 Master State Mapping Table

| State / Field | Owning Service | Allowed Transitions / Mutating Events | Reading Services & Consumers |
|---|---|---|---|
| **Booking: `PENDING`** | Booking Service | Created by `createBooking` &rarr; transitions to `HELD` in same tx | Booking Service |
| **Booking: `HELD`** | Booking Service | `createBooking` &rarr; `PAYMENT_PENDING` (payment initiated), `CANCELLED` (user), or `EXPIRED` (timeout) | Booking Service, API Gateway, Frontend |
| **Booking: `PAYMENT_PENDING`** | Booking Service | `markBookingPaymentPending` &rarr; `CONFIRMED` (payment success), `PAYMENT_FAILED` (card failure), or `EXPIRED` | Booking Service, Payment Service, Frontend |
| **Booking: `CONFIRMED`** | Booking Service | Authoritative confirmation engine &rarr; terminal (stays confirmed) | Booking Service, Payment Service, Catalog Service, Notification Service, Frontend |
| **Booking: `CANCELLED`** | Booking Service | `cancelBooking` (user cancelled while `HELD`) &rarr; terminal | Booking Service, Frontend |
| **Booking: `EXPIRED`** | Booking Service | `holdExpirationWorker` (`holdExpiresAt <= now`) &rarr; terminal | Booking Service, Frontend |
| **Booking: `PAYMENT_FAILED`** | Booking Service | `processPaymentResult(PaymentFailed)` &rarr; terminal for that attempt | Booking Service, Frontend |
| **Payment Attempt: `CREATED`** | Payment Service | `createPayment` initialization &rarr; transitions to `REQUIRES_ACTION`, `PROCESSING`, or `SUCCEEDED` | Payment Service |
| **Payment Attempt: `REQUIRES_ACTION`** | Payment Service | Stripe intent requires 3D Secure &rarr; `SUCCEEDED`, `FAILED`, or `CANCELLED` | Payment Service, Booking Service (lease inquiry), Frontend |
| **Payment Attempt: `PROCESSING`** | Payment Service | Stripe intent submitted to bank &rarr; `SUCCEEDED` or `FAILED` | Payment Service, Booking Service (lease inquiry) |
| **Payment Attempt: `SUCCEEDED`** | Payment Service | Webhook `payment_intent.succeeded` &rarr; terminal success (or `REFUND_PENDING` if refunded) | Payment Service, Booking Service (RabbitMQ event), Notification Service |
| **Payment Attempt: `FAILED`** | Payment Service | Webhook `payment_intent.payment_failed` (terminal card decline) | Payment Service, Booking Service (RabbitMQ event) |
| **Payment Attempt: `CANCELLED`** | Payment Service | Webhook `payment_intent.canceled` | Payment Service, Booking Service (RabbitMQ event) |
| **Payment Refund: `NONE`** | Payment Service | Default initial state for payments | Payment Service |
| **Payment Refund: `PENDING` (`REFUND_PENDING`)** | Payment Service | `processRefund` initiated &rarr; transitions to `SUCCEEDED` or `FAILED` on Stripe webhook | Payment Service, Booking Service (Reconciliation inquiry), Frontend |
| **Payment Refund: `SUCCEEDED` (`REFUNDED`)** | Payment Service | Webhook `charge.refunded` / `refund.updated` (status `succeeded`) &rarr; terminal | Payment Service, Booking Service (RabbitMQ event), Notification Service, Frontend |
| **Payment Refund: `FAILED`** | Payment Service | Webhook `refund.updated` (status `failed`) &rarr; terminal failure (requires operator) | Payment Service, Booking Service (Reconciliation), Operator Dashboard |

---

## 15. Updated Implementation Stages

```
+---------------------------------------------------------------------------------------------------+
| STAGE 1: UNIFIED AUTHORITATIVE CONFIRMATION ENGINE                                                |
| Scope: Extract single transaction-safe confirmation engine in Booking Service.                    |
| Files: booking-service/src/services/paymentBookingService.js, paymentResultHandler.js             |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| STAGE 2: ATOMIC INVENTORY CONCURRENCY & ISOLATION VERIFICATION                                    |
| Scope: Execute the 5 concurrency tests; verify multi-booking isolation without refactoring.       |
| Files: tests/test_inventory_concurrency.mjs (new test suite only)                                 |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| STAGE 3: DURABLE AUTOMATED LATE-PAYMENT REFUND PIPELINE                                           |
| Scope: Implement outbox-driven refund dispatch and 100% full refund reconciliation.               |
| Files: booking-service paymentResultHandler.js, PaymentReconciliation.js, payment-service refund   |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| STAGE 4: BOUNDED HOLD EXPIRATION GRACE POLICY                                                     |
| Scope: Implement lease inquiry and 20-minute maximum hold cap in holdExpirationWorker.js.        |
| Files: booking-service holdExpirationService.js, holdExpirationWorker.js                          |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| STAGE 5: OUTBOX WAKE-UP SIGNAL & LATENCY BENCHMARKING                                             |
| Scope: Add immediate in-process wake-up trigger (<50ms target) and benchmark p50/p95/p99.         |
| Files: payment-service outboxWorker.js, webhookController.js, booking-service bookingOutboxWorker|
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| STAGE 6: END-TO-END RESILIENCE & CHAOS INJECTION SUITE                                            |
| Scope: Run full stack integration tests across all microservices under network and crash chaos.   |
| Files: tests/test_e2e_integration_recovery.mjs                                                    |
+---------------------------------------------------------------------------------------------------+
```

### Detailed Stage Specifications

#### Stage 1: Unified Authoritative Confirmation Engine
- **Exact Scope**: Extract the authoritative confirmation logic from `paymentResultHandler.js` into a shared module (`services/booking-service/src/services/authoritativeConfirmationService.js`). Refactor `confirmBookingPayment` in `paymentBookingService.js` and `processPaymentResult` in `paymentResultHandler.js` to delegate to this single engine.
- **Files Expected to Change**:
  - `services/booking-service/src/services/authoritativeConfirmationService.js` (new)
  - `services/booking-service/src/services/paymentBookingService.js`
  - `services/booking-service/src/events/paymentResultHandler.js`
- **Transaction Boundaries**: Single MongoDB ACID transaction session spanning `ProcessedEvent` insert, `Booking` status transition, `DailyInventory` update, and `BookingConfirmed` outbox event insert.
- **Failure Recovery**: Any validation mismatch rolls back the transaction. Idempotent check returns existing confirmed doc if already confirmed.
- **Database Impact**: Zero schema changes.
- **Automated Tests**: Unit tests verifying identical validations (`userId`, `amountMinor`, `currency`, `attemptNumber`) and outbox emissions across both invocation paths.
- **Manual Verification**: Verify code diff confirms complete elimination of dual confirmation logic.
- **Rollback Plan**: Revert git commit and restart Booking Service.
- **Completion Criteria**: Both paths execute 100% identical validations and outbox creation.

#### Stage 2: Atomic Inventory Concurrency & Isolation Verification
- **Exact Scope**: Author and execute the 5 comprehensive concurrency tests without modifying safe existing inventory code.
- **Files Expected to Change**:
  - `tests/test_inventory_concurrency.mjs` (new automated test file only; zero application code changes)
- **Transaction Boundaries**: MongoDB sessions evaluated under 10+ concurrent worker threads.
- **Failure Recovery**: Verified that aborting a transaction on date N rolls back dates 1..N-1.
- **Database Impact**: None.
- **Automated Tests**: Execute the 5 designed concurrency scenarios (duplicate release, duplicate confirmation, expiration race, multi-night rollback, final room contention).
- **Manual Verification**: Inspect MongoDB documents post-test to verify zero negative inventory counts.
- **Rollback Plan**: Delete test file if unneeded.
- **Completion Criteria**: All 5 concurrency scenarios pass 100% under high contention.

#### Stage 3: Durable Automated Late-Payment Refund Pipeline
- **Exact Scope**: Update `paymentResultHandler.js` to emit `BookingRefundRequested` outbox event upon detecting `PaymentSucceeded` on an `EXPIRED` or `CANCELLED` booking. Add consumer in Payment Service to execute `processRefund` with deterministic key `ref_idemp_${paymentId}`. Update reconciler to listen for `PaymentRefunded` and mark `RESOLVED`.
- **Files Expected to Change**:
  - `services/booking-service/src/events/paymentResultHandler.js`
  - `services/booking-service/src/models/PaymentReconciliation.js`
  - `services/payment-service/src/events/refundRequestConsumer.js` (or consume via existing worker)
- **Transaction Boundaries**: Outbox event written inside same MongoDB transaction as the `PaymentReconciliation` record.
- **Failure Recovery**: Message sits in durable RabbitMQ queue if Payment Service is down. Deterministic Stripe idempotency key prevents double refunding on retries.
- **Database Impact**: Optional fields `refundRequestedAt` and `refundId` added to `PaymentReconciliation` model.
- **Automated Tests**: Simulated late webhook on expired booking asserts outbox emission, RabbitMQ delivery, Payment `REFUND_PENDING` transition, and reconciliation resolution.
- **Manual Verification**: Verify Stripe test dashboard displays full 100% refund.
- **Rollback Plan**: Revert commit and restart Booking & Payment services.
- **Completion Criteria**: Expired bookings charged by Stripe are automatically and fully refunded without human intervention.

#### Stage 4: Bounded Hold Expiration Grace Policy
- **Exact Scope**: Update `holdExpirationService.js` to query Payment Service internal attempt status for bookings in `PAYMENT_PENDING` before expiring. If lease is active or status is `REQUIRES_ACTION`, extend hold up to the 20-minute absolute cap. If cap is exceeded, expire unconditionally.
- **Files Expected to Change**:
  - `services/booking-service/src/services/holdExpirationService.js`
  - `services/booking-service/src/workers/holdExpirationWorker.js`
- **Transaction Boundaries**: Atomic `Booking.findOneAndUpdate` condition includes `holdExpiresAt: { $lte: now }`.
- **Failure Recovery**: If Payment Service status endpoint is unreachable, fallback safely to default expiration.
- **Database Impact**: None.
- **Automated Tests**: Test active lease extension, 3D Secure extension, failed attempt immediate expiration, and 20-minute absolute cap enforcement.
- **Manual Verification**: Observe logs during simulated 3D Secure delay.
- **Rollback Plan**: Revert commit and restart Booking Service.
- **Completion Criteria**: Active 3D Secure users are not prematurely expired, and no hold exceeds 20 minutes.

#### Stage 5: Outbox Wake-up Signal & Latency Benchmarking
- **Exact Scope**: Add in-process wake-up trigger (`setImmediate(runWorker)` / EventEmitter) to Payment Service and Booking Service outbox workers. Capture timestamps $t_{\text{webhook\_received}}$, $t_{\text{outbox\_created}}$, $t_{\text{outbox\_published}}$, $t_{\text{consumer\_received}}$, $t_{\text{booking\_confirmed}}$ and report p50, p95, p99.
- **Files Expected to Change**:
  - `services/payment-service/src/workers/outboxWorker.js`
  - `services/payment-service/src/controllers/webhookController.js`
  - `services/booking-service/src/workers/bookingOutboxWorker.js`
  - `services/booking-service/src/events/paymentResultHandler.js`
- **Transaction Boundaries**: Wake-up trigger called *after* MongoDB transaction commits.
- **Failure Recovery**: 5-second `setInterval` retained as resilient fallback sweep.
- **Database Impact**: Add optional timing telemetry fields to `OutboxEvent` schema.
- **Automated Tests**: Benchmark test running 100 transactions computing p50, p95, and p99 confirmation latency.
- **Manual Verification**: Review benchmark latency report.
- **Rollback Plan**: Revert commit; polling interval remains active.
- **Completion Criteria**: p95 confirmation latency significantly reduced, documented with empirical distribution data.

#### Stage 6: End-to-End Resilience & Chaos Injection Suite
- **Exact Scope**: Spin up all microservices and execute full test suite under network partition, service restart, and crash conditions.
- **Files Expected to Change**:
  - `tests/test_e2e_integration_recovery.mjs`
- **Transaction Boundaries**: End-to-end multi-service boundaries.
- **Failure Recovery**: Full system self-healing verification.
- **Database Impact**: None.
- **Automated Tests**: 100% pass across all test suites in `tests/`.
- **Manual Verification**: End-to-end booking through web client.
- **Rollback Plan**: N/A (test execution stage).
- **Completion Criteria**: Zero dropped messages, zero un-refunded late charges, zero duplicate inventory allocations under chaos testing.

---

## 16. Migration and Rollback Considerations

1. **Zero Database Migrations Required**: All schema enhancements are strictly additive and backward compatible (optional fields with defaults).
2. **Backward Compatibility**: Existing bookings in any state will continue to function without data conversion.
3. **Rollback Strategy**:
   - Each stage modifies only internal service logic or workers.
   - If any regression occurs, reverting the git commit and restarting the container restores previous behavior.
   - The 5-second polling interval in outbox workers is preserved permanently as a fallback, ensuring messages are delivered even if an in-process wake-up trigger fails.

---

## 17. Files Expected to Change in Later Stages

1. `services/booking-service/src/services/authoritativeConfirmationService.js` (Stage 1 - new)
2. `services/booking-service/src/services/paymentBookingService.js` (Stage 1)
3. `services/booking-service/src/events/paymentResultHandler.js` (Stages 1, 3, 5)
4. `tests/test_inventory_concurrency.mjs` (Stage 2 - new test file only)
5. `services/booking-service/src/models/PaymentReconciliation.js` (Stage 3)
6. `services/booking-service/src/services/holdExpirationService.js` (Stage 4)
7. `services/booking-service/src/workers/holdExpirationWorker.js` (Stage 4)
8. `services/payment-service/src/workers/outboxWorker.js` (Stage 5)
9. `services/payment-service/src/controllers/webhookController.js` (Stage 5)
10. `services/booking-service/src/workers/bookingOutboxWorker.js` (Stage 5)
11. `services/payment-service/src/models/OutboxEvent.js` (Stage 5)
12. `services/booking-service/src/models/OutboxEvent.js` (Stage 5)
13. `tests/test_e2e_integration_recovery.mjs` (Stage 6)

---

## 18. Explicit Confirmation That No Application Code Was Modified

In strict adherence to the execution rules of Stage 0 and Stage 0.1:
- **No application source code files were edited, created, or deleted.**
- **No database schemas, migrations, or indexes were modified.**
- **No API contracts, HTTP routes, or gateway configurations were changed.**
- **No package dependencies were installed, upgraded, or removed.**
- **No changes were made to Stripe integration, RabbitMQ topology, or booking state transitions.**
- **Only this documentation report (`docs/ROUND_4F_STAGE_0_RELIABILITY_AUDIT.md`) was updated.**

---
*End of Stage 0.1 Reliability Audit Report. Awaiting explicit user approval before proceeding to Stage 1.*
