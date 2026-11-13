
import nodemailer from "nodemailer";

const requiredEnv = ["SMPT_USER", "SMPT_PASS", "SENDER_EMAIL"];

const missingEnv = requiredEnv.filter(
  (key) => !process.env[key]
);

if (missingEnv.length > 0) {
  throw new Error(
    `Missing SMTP environment variables: ${missingEnv.join(", ")}`
  );
}

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMPT_USER,
    pass: process.env.SMPT_PASS,
  },
});

export const verifyEmailTransport = async () => {
  await transporter.verify();
  console.log("Brevo SMTP connection verified");
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

  const result = await transporter.sendMail({
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
