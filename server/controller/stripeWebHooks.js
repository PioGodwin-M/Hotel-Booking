import Stripe from "stripe";
import Booking from "../models/booking.js";

const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);

export const stripeWebHooks = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripeInstance.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook Error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;

    try {
      // ✅ bookingId should be passed in metadata when creating PaymentIntent
      const bookingId = paymentIntent.metadata?.bookingId;

      if (bookingId) {
        await Booking.findByIdAndUpdate(bookingId, {
          isPaid: true,
          paymentMethod: "Stripe",
        });
        console.log(`✅ Booking ${bookingId} marked as paid`);
      } else {
        console.warn("⚠️ No bookingId in metadata");
      }
    } catch (err) {
      console.error("❌ Failed to update booking:", err);
    }
  }

  // Always send response to Stripe
  res.json({ received: true });
};
