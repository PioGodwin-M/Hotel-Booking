import Stripe from "stripe";

let stripeClient;

const getStripeClient = () => {
  if (stripeClient) return stripeClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    const error = new Error("STRIPE_SECRET_KEY is not configured");
    error.code = "STRIPE_CONFIGURATION_ERROR";
    throw error;
  }

  stripeClient = new Stripe(secretKey);
  return stripeClient;
};

export const createStripePaymentIntent = async ({
  paymentId,
  bookingId,
  userId,
  amountMinor,
  currency,
}) => {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    const error = new Error("Invalid payment amount");
    error.code = "INVALID_PAYMENT_AMOUNT";
    throw error;
  }

  return getStripeClient().paymentIntents.create(
    {
      amount: amountMinor,
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        paymentId,
        bookingId: bookingId.toString(),
        userId,
      },
    },
    { idempotencyKey: paymentId }
  );
};

export const retrieveStripePaymentIntent = async (id) => {
  return getStripeClient().paymentIntents.retrieve(id);
};

export const constructStripeWebhookEvent = (
  rawBody,
  signature
) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    const error = new Error("STRIPE_WEBHOOK_SECRET is not configured");
    error.code = "STRIPE_CONFIGURATION_ERROR";
    throw error;
  }

  return getStripeClient().webhooks.constructEvent(
    rawBody,
    signature,
    webhookSecret
  );
};

export default getStripeClient;