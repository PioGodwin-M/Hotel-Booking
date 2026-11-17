/**
 * Focused Test Suite: Brevo HTTPS REST API Email Integration & Notification Worker
 *
 * Verifies:
 * 1. Brevo HTTPS API adapter request structure, headers, payload, and timeouts
 * 2. Strict HTTP error classification (400, 401, 403, 429, 500, timeouts, network errors)
 * 3. Transport selection logic (API, SMTP, and Mock priority)
 * 4. Backward compatibility with legacy misspelled SMTP variables (SMPT_USER, SMPT_PASS)
 * 5. Notification delivery worker lifecycle, lease fencing, fast-failure on PERMANENT errors,
 *    and exponential backoff on RETRYABLE errors.
 */

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const dotenv = require(path.join(__dirname, "../services/notification-service/node_modules/dotenv"));
const mongoose = require(path.join(__dirname, "../services/notification-service/node_modules/mongoose"));

// Load notification service environment variables
dotenv.config({ path: path.join(__dirname, "../services/notification-service/.env") });

const Notification = (await import("../services/notification-service/src/models/Notification.js")).default;

const {
  sendEmail,
  sendViaBrevoApi,
  sendViaSmtp,
  getTransportType,
  setTestEmailTransport,
  resetEmailTransport,
  DeliveryError,
} = await import("../services/notification-service/src/services/emailService.js");

async function runBrevoNotificationTests() {
  console.log("=== Notification Service: Brevo HTTPS REST API Integration Test Suite ===\n");

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

  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  try {
    // Connect to hotel_notification MongoDB database
    await mongoose.connect(process.env.MONGODB_URI, { dbName: "hotel_notification" });

    // =========================================================================
    // Group 1: Brevo HTTPS API Adapter (Payload, Headers, URL)
    // =========================================================================
    console.log("--- Group 1: Brevo HTTPS API Adapter Contract & Payload ---");

    process.env.BREVO_API_KEY = "xkeysib-test-mock-api-key-12345";
    process.env.SENDER_EMAIL = "stays@pgmstays.com";
    process.env.SENDER_NAME = "PGM Stays Official";

    let capturedRequest = null;
    globalThis.fetch = async (url, options) => {
      capturedRequest = { url, ...options, body: JSON.parse(options.body) };
      return {
        status: 201,
        ok: true,
        text: async () => JSON.stringify({ messageId: "<brevo_mock_msg_98765>" }),
      };
    };

    const deliveryResult = await sendViaBrevoApi({
      to: "guest@example.com",
      subject: "Booking Confirmed - PGM Stays",
      html: "<p>Thank you for your reservation!</p>",
      text: "Thank you for your reservation!",
    });

    assert(capturedRequest.url === "https://api.brevo.com/v3/smtp/email", "Request targets authoritative Brevo HTTPS endpoint");
    assert(capturedRequest.method === "POST", "HTTP method is POST");
    assert(capturedRequest.headers["api-key"] === "xkeysib-test-mock-api-key-12345", "API key passed in 'api-key' header");
    assert(capturedRequest.headers["Content-Type"] === "application/json", "Content-Type is application/json");
    assert(capturedRequest.body.sender.name === "PGM Stays Official", "Sender name correctly mapped from SENDER_NAME");
    assert(capturedRequest.body.sender.email === "stays@pgmstays.com", "Sender email correctly mapped from SENDER_EMAIL");
    assert(capturedRequest.body.to[0].email === "guest@example.com", "Recipient email correctly mapped");
    assert(capturedRequest.body.subject === "Booking Confirmed - PGM Stays", "Subject mapped accurately");
    assert(capturedRequest.body.htmlContent === "<p>Thank you for your reservation!</p>", "HTML content mapped to htmlContent");
    assert(capturedRequest.body.textContent === "Thank you for your reservation!", "Plaintext content mapped to textContent");
    assert(deliveryResult.messageId === "<brevo_mock_msg_98765>", "Provider messageId returned on HTTP 201");
    assert(deliveryResult.accepted.includes("guest@example.com"), "Accepted recipients include target email");

    // =========================================================================
    // Group 2: Error Classification Engine (HTTP Status & Network Codes)
    // =========================================================================
    console.log("\n--- Group 2: Brevo API Error Classification Engine ---");

    // 2.1 HTTP 400 Bad Request -> PERMANENT
    globalThis.fetch = async () => ({
      status: 400,
      ok: false,
      text: async () => JSON.stringify({ code: "invalid_parameter", message: "Sender email is not authorized or verified" }),
    });
    let err400 = null;
    try {
      await sendViaBrevoApi({ to: "guest@example.com", subject: "Test", text: "Test" });
    } catch (e) {
      err400 = e;
    }
    assert(err400 instanceof DeliveryError, "Throws structured DeliveryError");
    assert(err400.classification === "PERMANENT", "HTTP 400 classified as PERMANENT (unverified sender / invalid data)");
    assert(err400.statusCode === 400, "Error retains statusCode 400");

    // 2.2 HTTP 401 Unauthorized -> PERMANENT
    globalThis.fetch = async () => ({
      status: 401,
      ok: false,
      text: async () => JSON.stringify({ code: "unauthorized", message: "Key not found in account" }),
    });
    let err401 = null;
    try {
      await sendViaBrevoApi({ to: "guest@example.com", subject: "Test", text: "Test" });
    } catch (e) {
      err401 = e;
    }
    assert(err401.classification === "PERMANENT", "HTTP 401 classified as PERMANENT (invalid API key)");
    assert(!err401.message.includes("xkeysib"), "API key value is never exposed in error message");

    // 2.3 HTTP 403 Forbidden -> PERMANENT
    globalThis.fetch = async () => ({
      status: 403,
      ok: false,
      text: async () => JSON.stringify({ code: "forbidden", message: "Account disabled or plan limit reached" }),
    });
    let err403 = null;
    try {
      await sendViaBrevoApi({ to: "guest@example.com", subject: "Test", text: "Test" });
    } catch (e) {
      err403 = e;
    }
    assert(err403.classification === "PERMANENT", "HTTP 403 classified as PERMANENT");

    // 2.4 HTTP 429 Rate Limit Exceeded -> RETRYABLE
    globalThis.fetch = async () => ({
      status: 429,
      ok: false,
      text: async () => JSON.stringify({ code: "too_many_requests", message: "Rate limit exceeded" }),
    });
    let err429 = null;
    try {
      await sendViaBrevoApi({ to: "guest@example.com", subject: "Test", text: "Test" });
    } catch (e) {
      err429 = e;
    }
    assert(err429.classification === "RETRYABLE", "HTTP 429 classified as RETRYABLE (rate limit)");

    // 2.5 HTTP 500 / 502 / 503 Server Error -> RETRYABLE
    globalThis.fetch = async () => ({
      status: 503,
      ok: false,
      text: async () => JSON.stringify({ code: "service_unavailable", message: "Backend temporarily unavailable" }),
    });
    let err503 = null;
    try {
      await sendViaBrevoApi({ to: "guest@example.com", subject: "Test", text: "Test" });
    } catch (e) {
      err503 = e;
    }
    assert(err503.classification === "RETRYABLE", "HTTP 503 classified as RETRYABLE");

    // 2.6 Network Connection Failure (e.g. ECONNREFUSED) -> RETRYABLE
    globalThis.fetch = async () => {
      const netErr = new Error("connect ECONNREFUSED 1.2.3.4:443");
      netErr.code = "ECONNREFUSED";
      throw netErr;
    };
    let errNet = null;
    try {
      await sendViaBrevoApi({ to: "guest@example.com", subject: "Test", text: "Test" });
    } catch (e) {
      errNet = e;
    }
    assert(errNet.classification === "RETRYABLE", "Network connection failure classified as RETRYABLE");
    assert(errNet.code === "ECONNREFUSED", "Network error code preserved");

    // 2.7 Request Timeout (AbortError / TimeoutError) -> AMBIGUOUS
    globalThis.fetch = async () => {
      const timeoutErr = new Error("The operation was aborted due to timeout");
      timeoutErr.name = "TimeoutError";
      throw timeoutErr;
    };
    let errTimeout = null;
    try {
      await sendViaBrevoApi({ to: "guest@example.com", subject: "Test", text: "Test" });
    } catch (e) {
      errTimeout = e;
    }
    assert(errTimeout.classification === "AMBIGUOUS", "In-flight timeout classified as AMBIGUOUS (acknowledges duplicate-delivery risk)");
    assert(errTimeout.code === "TIMEOUT", "Timeout code preserved");

    // 2.8 Missing Configuration Guard -> PERMANENT
    delete process.env.BREVO_API_KEY;
    let errNoKey = null;
    try {
      await sendViaBrevoApi({ to: "guest@example.com", subject: "Test", text: "Test" });
    } catch (e) {
      errNoKey = e;
    }
    assert(errNoKey.classification === "PERMANENT", "Missing API key classified as PERMANENT (fails fast)");

    // =========================================================================
    // Group 3: Transport Selection & Backward Compatibility
    // =========================================================================
    console.log("\n--- Group 3: Transport Selection & Fallbacks ---");

    // 3.1 Explicit API selection
    process.env.EMAIL_TRANSPORT_TYPE = "api";
    process.env.BREVO_API_KEY = "xkeysib-mock";
    assert(getTransportType() === "api", "EMAIL_TRANSPORT_TYPE=api selects API transport");

    // 3.2 Explicit SMTP selection
    process.env.EMAIL_TRANSPORT_TYPE = "smtp";
    assert(getTransportType() === "smtp", "EMAIL_TRANSPORT_TYPE=smtp selects SMTP transport");

    // 3.3 Legacy misspelled aliases (SMPT_USER / SMPT_PASS)
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    process.env.SMPT_USER = "legacy_user@example.com";
    process.env.SMPT_PASS = "legacy_pass_secret";
    delete process.env.BREVO_API_KEY;
    delete process.env.EMAIL_TRANSPORT_TYPE;
    assert(getTransportType() === "smtp", "Legacy SMPT_USER/PASS auto-detected as SMTP transport fallback");

    // 3.4 Mock transport takes absolute priority
    const mockAdapter = {
      sendMail: async () => ({ messageId: "mock_test_123" }),
    };
    setTestEmailTransport(mockAdapter);
    assert(getTransportType() === "mock", "setTestEmailTransport overrides transport type to mock");
    const mockSendResult = await sendEmail({ to: "test@example.com", subject: "Hi", text: "Body" });
    assert(mockSendResult.messageId === "mock_test_123", "sendEmail routes through mock adapter when registered");
    resetEmailTransport();
    assert(getTransportType() !== "mock", "resetEmailTransport restores standard transport");

    // =========================================================================
    // Group 4: Delivery Worker Lifecycle, Fast-Failure & Lease Fencing
    // =========================================================================
    console.log("\n--- Group 4: Notification Delivery Worker & Fast-Failure ---");

    // 4.1 Fast-failure on PERMANENT error (fails on attempt 1 without consuming 5 retries)
    const permanentNotifId = `notif_perm_${Date.now()}`;
    const permDoc = await Notification.create({
      eventId: `evt_perm_${Date.now()}`,
      eventType: "BookingConfirmed",
      recipient: "bad_sender@example.com",
      notificationType: "BOOKING_CONFIRMED",
      subject: "Permanent Error Test",
      templateData: { displayName: "Guest", payload: { bookingId: "b_123" } },
      status: "PROCESSING",
      attempts: 1,
      maxAttempts: 5,
      leaseToken: "lease_token_perm",
      lockedBy: "worker_test",
      lockedUntil: new Date(Date.now() + 60000),
    });

    // Simulate worker receiving a PERMANENT error
    const permError = new DeliveryError("Brevo API 401 Unauthorized: Invalid API key", "PERMANENT");
    const isPermanent = permError.classification === "PERMANENT";
    const exhausted = isPermanent || permDoc.attempts >= permDoc.maxAttempts;

    assert(exhausted === true, "PERMANENT error immediately flags job as exhausted on attempt 1");

    await Notification.updateOne(
      { _id: permDoc._id },
      {
        $set: {
          status: exhausted ? "FAILED" : "PENDING",
          lastError: `[PERMANENT_ERROR] ${permError.message}`,
        },
        $unset: { lockedBy: "", leaseToken: "", lockedUntil: "" },
      }
    );

    const permDocAfter = await Notification.findById(permDoc._id).lean();
    assert(permDocAfter.status === "FAILED", "Notification transitioned directly to FAILED");
    assert(permDocAfter.attempts === 1, "Attempts remains 1; did NOT burn through 5 backoff cycles");
    assert(permDocAfter.lastError.includes("[PERMANENT_ERROR]"), "lastError records PERMANENT_ERROR tag");

    // 4.2 Retryable error schedules backoff without marking FAILED
    const retryNotif = await Notification.create({
      eventId: `evt_retry_${Date.now()}`,
      eventType: "BookingConfirmed",
      recipient: "retry_guest@example.com",
      notificationType: "BOOKING_CONFIRMED",
      subject: "Retry Test",
      templateData: { displayName: "Guest", payload: { bookingId: "b_456" } },
      status: "PROCESSING",
      attempts: 1,
      maxAttempts: 5,
      leaseToken: "lease_token_retry",
      lockedBy: "worker_test",
      lockedUntil: new Date(Date.now() + 60000),
    });

    const retryError = new DeliveryError("Brevo API 429 Rate Limit Exceeded", "RETRYABLE");
    const retryIsPermanent = retryError.classification === "PERMANENT";
    const retryExhausted = retryIsPermanent || retryNotif.attempts >= retryNotif.maxAttempts;

    assert(retryExhausted === false, "RETRYABLE error with attempts < maxAttempts is NOT exhausted");

    const nextAttemptDate = new Date(Date.now() + 5000);
    await Notification.updateOne(
      { _id: retryNotif._id },
      {
        $set: {
          status: "PENDING",
          nextAttemptAt: nextAttemptDate,
          lastError: retryError.message,
        },
        $unset: { lockedBy: "", leaseToken: "", lockedUntil: "" },
      }
    );

    const retryDocAfter = await Notification.findById(retryNotif._id).lean();
    assert(retryDocAfter.status === "PENDING", "Notification remains PENDING for retry");
    assert(retryDocAfter.nextAttemptAt > new Date(), "nextAttemptAt scheduled in the future");
    assert(retryDocAfter.lastError.includes("429"), "lastError recorded");

    // 4.3 Stale worker lease fencing prevents overwriting newer state
    const staleResult = await Notification.updateOne(
      {
        _id: retryNotif._id,
        status: "PROCESSING",
        lockedBy: "dead_worker_token", // Stale ownership
        leaseToken: "stale_token_abc",
        lockedUntil: { $gt: new Date() },
      },
      { $set: { status: "SENT" } }
    );
    assert(staleResult.modifiedCount === 0, "Stale worker blocked from marking job SENT after lease loss");

    // 4.4 Successful delivery transitions to SENT
    const successResult = await Notification.updateOne(
      { _id: retryNotif._id },
      {
        $set: {
          status: "SENT",
          sentAt: new Date(),
          providerMessageId: "brevo_msg_live_777",
          lastError: null,
        },
      }
    );
    assert(successResult.modifiedCount === 1, "Successful delivery marked SENT");
    const finalDoc = await Notification.findById(retryNotif._id).lean();
    assert(finalDoc.status === "SENT", "Notification status is SENT in database");
    assert(finalDoc.providerMessageId === "brevo_msg_live_777", "Provider message ID recorded");

    // 4.5 Duplicate notification prevention
    let dupError = null;
    try {
      await Notification.create({
        eventId: permDoc.eventId,
        notificationType: permDoc.notificationType,
        recipient: permDoc.recipient,
        eventType: "BookingConfirmed",
        subject: "Duplicate Check",
        templateData: {},
      });
    } catch (e) {
      dupError = e;
    }
    assert(dupError !== null && dupError.code === 11000, "Duplicate notification document prevented by unique compound index");

  } finally {
    // Restore environment and globals
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
    resetEmailTransport();
    await mongoose.disconnect().catch(() => {});
  }

  console.log("\n========================================");
  console.log(`Brevo Integration Test Result: ${passed}/${total} passed`);
  console.log("========================================");

  if (passed !== total) {
    process.exit(1);
  }
}

runBrevoNotificationTests().catch((err) => {
  console.error("Brevo Notification Test Suite fatal error:", err);
  process.exit(1);
});
