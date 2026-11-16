
import nodemailer from "nodemailer";

const hasSmtpConfig = Boolean(
  process.env.SMPT_USER && process.env.SMPT_PASS && process.env.SENDER_EMAIL
);

if (!hasSmtpConfig) {
  console.warn(
    "Brevo SMTP environment variables not fully configured; email jobs will be deferred or use test adapter."
  );
}

const transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMPT_USER,
        pass: process.env.SMPT_PASS,
      },
      connectionTimeout: 3000,
      greetingTimeout: 3000,
      socketTimeout: 5000,
    })
  : null;

let customTransporter = null;

/**
 * Injects a test-only mock transport adapter for deterministic pipeline verification.
 * The production Brevo SMTP transport remains the default at all other times.
 */
export const setTestEmailTransport = (mockTransport) => {
  customTransporter = mockTransport;
};

export const resetEmailTransport = () => {
  customTransporter = null;
};

const getActiveTransporter = () => customTransporter || transporter;

export const verifyEmailTransport = async () => {
  const client = getActiveTransporter();
  if (client && typeof client.verify === "function") {
    await client.verify();
    console.log("Brevo SMTP connection verified");
  }
};

export const sendEmail = async ({
  to,
  subject,
  html,
  text,
}) => {
  if (!to || !subject || (!html && !text)) {
    throw new Error("Invalid email delivery parameters");
  }

  const client = getActiveTransporter();
  if (!client) {
    throw new Error("SMTP transporter is not configured or unavailable");
  }

  const result = await client.sendMail({
    from: process.env.SENDER_EMAIL,
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
};

export default transporter;
