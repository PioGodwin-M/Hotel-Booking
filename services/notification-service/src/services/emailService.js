import nodemailer from "nodemailer";

/**
 * Structured delivery error with error classification.
 * - PERMANENT: Unrecoverable errors (invalid API key, unverified sender, bad request, schema error).
 *              Should fail immediately without retrying.
 * - RETRYABLE: Transient infrastructure errors (rate limits, 5xx server errors, network connection drops).
 *              Should be retried with exponential backoff.
 * - AMBIGUOUS: In-flight request timeouts where the remote server may or may not have dispatched the email.
 *              Should be retried cautiously acknowledging duplicate delivery risk.
 */
export class DeliveryError extends Error {
  constructor(message, classification = "RETRYABLE", details = {}) {
    super(message);
    this.name = "DeliveryError";
    this.classification = classification;
    this.statusCode = details.statusCode || null;
    this.code = details.code || null;
    this.details = details.details || null;
  }
}

// Configuration accessors (never expose secret values)
export const getBrevoApiKey = () => process.env.BREVO_API_KEY || null;
export const getSenderEmail = () => process.env.SENDER_EMAIL || null;
export const getSenderName = () => process.env.SENDER_NAME || "PGM Stays";

export const getSmtpHost = () => process.env.SMTP_HOST || "smtp-relay.brevo.com";
export const getSmtpPort = () => Number(process.env.SMTP_PORT || 587);
// Prefer SMTP_USER / SMTP_PASS; fallback to legacy misspelled SMPT_USER / SMPT_PASS
export const getSmtpUser = () => process.env.SMTP_USER || process.env.SMPT_USER || null;
export const getSmtpPass = () => process.env.SMTP_PASS || process.env.SMPT_PASS || null;

let customTransporter = null;

/**
 * Resolves current email transport type:
 * "api" (Brevo HTTPS REST API) | "smtp" (Nodemailer SMTP) | "mock" (Test mode)
 */
export const getTransportType = () => {
  if (customTransporter) return "mock";
  const explicit = (process.env.EMAIL_TRANSPORT_TYPE || "").toLowerCase().trim();
  if (explicit === "api") return "api";
  if (explicit === "smtp") return "smtp";

  // Auto-detection: prefer API if key is set; else fallback to SMTP if credentials exist
  if (getBrevoApiKey()) return "api";
  if (getSmtpUser() && getSmtpPass()) return "smtp";
  return "api";
};

// Startup configuration validation: reports missing variable names only
(() => {
  const transport = getTransportType();
  const missing = [];

  if (!getSenderEmail()) {
    missing.push("SENDER_EMAIL");
  }

  if (transport === "api" && !getBrevoApiKey()) {
    missing.push("BREVO_API_KEY");
  } else if (transport === "smtp") {
    if (!getSmtpUser()) missing.push("SMTP_USER");
    if (!getSmtpPass()) missing.push("SMTP_PASS");
  }

  if (missing.length > 0) {
    console.warn(
      `[Notification Service] Email configuration incomplete. Missing variables: ${missing.join(", ")}. Email delivery jobs will fail fast or remain deferred until configured.`
    );
  }
})();

// Lazy SMTP transporter instantiation
let smtpTransporter = null;
const getSmtpTransporter = () => {
  const user = getSmtpUser();
  const pass = getSmtpPass();
  if (!user || !pass) return null;

  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: getSmtpHost(),
      port: getSmtpPort(),
      secure: getSmtpPort() === 465,
      auth: { user, pass },
      connectionTimeout: 3000,
      greetingTimeout: 3000,
      socketTimeout: 5000,
    });
  }
  return smtpTransporter;
};

/**
 * Injects a test-only mock transport adapter for deterministic pipeline verification.
 * The production Brevo HTTPS API or SMTP transport remains the default at all other times.
 */
export const setTestEmailTransport = (mockTransport) => {
  customTransporter = mockTransport;
};

export const resetEmailTransport = () => {
  customTransporter = null;
};

export const getActiveTransporter = () => customTransporter || smtpTransporter;

/**
 * Brevo HTTPS REST API delivery adapter (POST https://api.brevo.com/v3/smtp/email)
 * Uses native fetch with timeout.
 */
export const sendViaBrevoApi = async ({ to, subject, html, text }) => {
  const apiKey = getBrevoApiKey();
  const senderEmail = getSenderEmail();
  const senderName = getSenderName();

  if (!apiKey) {
    throw new DeliveryError(
      "Brevo API key is not configured (missing BREVO_API_KEY)",
      "PERMANENT",
      { code: "MISSING_API_KEY" }
    );
  }
  if (!senderEmail) {
    throw new DeliveryError(
      "Sender email is not configured (missing SENDER_EMAIL)",
      "PERMANENT",
      { code: "MISSING_SENDER_EMAIL" }
    );
  }

  const payload = {
    sender: {
      name: senderName,
      email: senderEmail,
    },
    to: [
      {
        email: to,
      },
    ],
    subject,
    htmlContent: html || undefined,
    textContent: text || undefined,
  };

  const timeoutMs = Number(process.env.EMAIL_API_TIMEOUT_MS || 10000);
  let response;

  try {
    response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (networkError) {
    if (networkError.name === "TimeoutError" || networkError.name === "AbortError") {
      // NOTE ON AMBIGUOUS TIMEOUT:
      // An HTTP request timeout means the connection was interrupted after transmission.
      // Brevo may have received and dispatched the email before the client timed out.
      // Retrying acknowledges a potential duplicate delivery risk, which is safer than dropping confirmation.
      throw new DeliveryError(
        `Brevo API request timed out after ${timeoutMs}ms. Delivery state is ambiguous; potential duplicate on retry.`,
        "AMBIGUOUS",
        { code: "TIMEOUT" }
      );
    }

    throw new DeliveryError(
      `Brevo API network connection failure: ${networkError.message}`,
      "RETRYABLE",
      { code: networkError.code || "NETWORK_ERROR" }
    );
  }

  let data = null;
  const rawText = await response.text();
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    if (response.ok) {
      throw new DeliveryError(
        "Malformed non-JSON response from Brevo API",
        "RETRYABLE",
        { statusCode: response.status }
      );
    }
  }

  if (response.status === 201) {
    return {
      messageId: data?.messageId || `brevo_${Date.now()}`,
      accepted: [to],
      rejected: [],
    };
  }

  // Handle Brevo HTTP errors with strict classification
  const errorMsg = data?.message || data?.error || rawText || `HTTP ${response.status}`;

  if (response.status === 400) {
    throw new DeliveryError(
      `Brevo API 400 Bad Request: ${errorMsg}`,
      "PERMANENT",
      { statusCode: 400, details: data }
    );
  }

  if (response.status === 401) {
    throw new DeliveryError(
      `Brevo API 401 Unauthorized: Invalid or inactive API key (${errorMsg})`,
      "PERMANENT",
      { statusCode: 401 }
    );
  }

  if (response.status === 403) {
    throw new DeliveryError(
      `Brevo API 403 Forbidden: Account blocked or unauthorized (${errorMsg})`,
      "PERMANENT",
      { statusCode: 403 }
    );
  }

  if (response.status === 429) {
    throw new DeliveryError(
      `Brevo API 429 Rate Limit Exceeded: ${errorMsg}`,
      "RETRYABLE",
      { statusCode: 429 }
    );
  }

  if (response.status >= 500) {
    throw new DeliveryError(
      `Brevo API ${response.status} Server Error: ${errorMsg}`,
      "RETRYABLE",
      { statusCode: response.status }
    );
  }

  throw new DeliveryError(
    `Brevo API unexpected status ${response.status}: ${errorMsg}`,
    response.status >= 400 && response.status < 500 ? "PERMANENT" : "RETRYABLE",
    { statusCode: response.status }
  );
};

/**
 * Fallback Nodemailer SMTP delivery adapter
 */
export const sendViaSmtp = async ({ to, subject, html, text }) => {
  const client = getSmtpTransporter();
  if (!client) {
    throw new DeliveryError(
      "SMTP transporter is not configured or unavailable",
      "PERMANENT",
      { code: "SMTP_NOT_CONFIGURED" }
    );
  }

  const senderEmail = getSenderEmail();
  const senderName = getSenderName();
  const from = senderName ? `"${senderName}" <${senderEmail}>` : senderEmail;

  try {
    const result = await client.sendMail({
      from,
      to,
      subject,
      html,
      text,
    });

    return {
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
    };
  } catch (smtpErr) {
    const isAuth = smtpErr.responseCode === 535 || (smtpErr.message && /auth/i.test(smtpErr.message));
    const isPermanent = isAuth || (smtpErr.responseCode && smtpErr.responseCode >= 500 && smtpErr.responseCode < 600 && smtpErr.responseCode !== 535);
    const isTimeout = smtpErr.code === "ETIMEDOUT" || /timeout/i.test(smtpErr.message);

    const classification = isAuth ? "PERMANENT" : isTimeout ? "AMBIGUOUS" : isPermanent ? "PERMANENT" : "RETRYABLE";

    throw new DeliveryError(
      `SMTP error: ${smtpErr.message}`,
      classification,
      { code: smtpErr.code, responseCode: smtpErr.responseCode }
    );
  }
};

/**
 * Primary sendEmail interface. Dispatches via mock, Brevo HTTPS API, or SMTP fallback.
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  if (!to || !subject || (!html && !text)) {
    throw new DeliveryError("Invalid email delivery parameters", "PERMANENT");
  }

  // 1. Mock adapter takes absolute priority for testing
  if (customTransporter) {
    if (typeof customTransporter.sendMail === "function") {
      const result = await customTransporter.sendMail({
        from: getSenderEmail() || "noreply@pgmstays.com",
        to,
        subject,
        html,
        text,
      });
      return {
        messageId: result.messageId || `mock_${Date.now()}`,
        accepted: result.accepted || [to],
        rejected: result.rejected || [],
      };
    }
    if (typeof customTransporter.sendEmail === "function") {
      return customTransporter.sendEmail({ to, subject, html, text });
    }
  }

  // 2. Transport routing based on configuration
  const transportType = getTransportType();

  if (transportType === "api") {
    return sendViaBrevoApi({ to, subject, html, text });
  }

  if (transportType === "smtp") {
    return sendViaSmtp({ to, subject, html, text });
  }

  throw new DeliveryError(
    `Unsupported EMAIL_TRANSPORT_TYPE: '${transportType}'`,
    "PERMANENT",
    { code: "INVALID_TRANSPORT_TYPE" }
  );
};

/**
 * Transport verification helper for startup and health checks.
 */
export const verifyEmailTransport = async () => {
  if (customTransporter) {
    if (typeof customTransporter.verify === "function") {
      await customTransporter.verify();
    }
    return;
  }

  const transportType = getTransportType();

  if (transportType === "api") {
    const apiKey = getBrevoApiKey();
    if (!apiKey) {
      console.warn("Brevo API key not configured; skipping live API verification");
      return;
    }

    try {
      const res = await fetch("https://api.brevo.com/v3/account", {
        method: "GET",
        headers: {
          "api-key": apiKey,
          accept: "application/json",
        },
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        console.log("Brevo HTTPS API authentication verified successfully");
      } else if (res.status === 401) {
        throw new DeliveryError(
          "Brevo API authentication failed (HTTP 401): Invalid API key",
          "PERMANENT",
          { statusCode: 401 }
        );
      } else {
        console.warn(`Brevo API verification returned HTTP ${res.status}`);
      }
    } catch (err) {
      if (err.classification === "PERMANENT") throw err;
      console.warn(`Brevo API verification unreachable: ${err.message}`);
    }
  } else if (transportType === "smtp") {
    const client = getSmtpTransporter();
    if (client && typeof client.verify === "function") {
      await client.verify();
      console.log("Brevo SMTP connection verified");
    }
  }
};

export default {
  sendEmail,
  sendViaBrevoApi,
  sendViaSmtp,
  verifyEmailTransport,
  setTestEmailTransport,
  resetEmailTransport,
  getTransportType,
  DeliveryError,
};
