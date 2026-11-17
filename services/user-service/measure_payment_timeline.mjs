import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: 'D:/Hotel_Booking_Microservices/Hotel-Booking/services/booking-service/.env' });
dotenv.config({ path: 'D:/Hotel_Booking_Microservices/Hotel-Booking/services/payment-service/.env' });
dotenv.config({ path: 'D:/Hotel_Booking_Microservices/Hotel-Booking/client/.env' });

import mongoose from 'mongoose';
import { clerkClient } from '@clerk/express';
import Stripe from '../payment-service/node_modules/stripe/esm/stripe.esm.node.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const MONGO_URI = process.env.MONGODB_URI;
const API_BASE = 'http://localhost:4000';

async function runTimelineAudit() {
  console.log('================================================================');
  console.log('   STAGE 0.2: REAL PAYMENT TIMELINE AUDIT (5 RUNS)              ');
  console.log('================================================================\n');

  // 1. Authenticate user via Clerk
  const userId = 'user_31jw610bhxmvhNMFcSE6N1YEmXY';
  const session = await clerkClient.sessions.createSession({ userId });
  const tokenData = await clerkClient.sessions.getToken(session.id);
  const jwt = tokenData.jwt;
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwt}`,
  };

  // Connect to DBs
  const bookingConn = await mongoose.createConnection(MONGO_URI, { dbName: 'hotel_booking' }).asPromise();
  const paymentConn = await mongoose.createConnection(MONGO_URI, { dbName: 'hotel_payment' }).asPromise();
  const catalogConn = await mongoose.createConnection(MONGO_URI, { dbName: 'hotel_catalog' }).asPromise();

  const roomInv = await bookingConn.collection('roominventories').findOne({ isActive: true });
  const room = await catalogConn.collection('rooms').findOne({ _id: new mongoose.Types.ObjectId(roomInv.roomCategoryId) });
  const hotel = await catalogConn.collection('hotels').findOne({ _id: new mongoose.Types.ObjectId(roomInv.hotelId) });

  console.log(`Using Hotel: ${hotel.name} | Room: ${room.roomType} (Rate: ₹${room.pricePerNight})`);

  const results = [];

  for (let run = 1; run <= 5; run++) {
    console.log(`\n--- RUN ${run}/5 ---`);
    const timeline = { run };

    // 1. Hold creation
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 10 + run);
    const checkout = new Date(tomorrow);
    checkout.setDate(checkout.getDate() + 2);

    const tHoldStart = Date.now();
    const bookRes = await fetch(`${API_BASE}/api/bookings`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        hotelId: hotel._id.toString(),
        roomCategoryId: room._id.toString(),
        checkIn: tomorrow.toISOString(),
        checkOut: checkout.toISOString(),
        numberOfRooms: 1,
        numberOfGuests: 2,
        idempotencyKey: `audit_hold_${Date.now()}_${run}`,
      }),
    });
    const bookData = await bookRes.json();
    if (!bookRes.ok || !bookData.success) {
      throw new Error(`Hold failed: ${JSON.stringify(bookData)}`);
    }
    const booking = bookData.booking;
    timeline.bookingId = booking._id;
    timeline.tHoldCreated = Date.now();
    console.log(`  ✓ Booking held: ${booking._id} in ${timeline.tHoldCreated - tHoldStart}ms`);

    // 2. Payment initiation
    const tPayInitStart = Date.now();
    const payRes = await fetch(`${API_BASE}/api/payments/`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Idempotency-Key': `pay_audit_${booking._id}`,
      },
      body: JSON.stringify({ bookingId: booking._id }),
    });
    const payData = await payRes.json();
    if (!payRes.ok || !payData.success) {
      throw new Error(`Payment init failed: ${JSON.stringify(payData)}`);
    }
    timeline.tPaymentInitiated = Date.now();
    const payment = payData.data;
    timeline.paymentId = payment.paymentId;
    console.log(`  ✓ Payment session created: ${payment.paymentId} in ${timeline.tPaymentInitiated - tPayInitStart}ms`);

    // 3. Confirm payment with Stripe test card
    const tStripeStart = Date.now();
    // Retrieve PaymentIntent to find ID
    const paymentDoc = await paymentConn.collection('payments').findOne({ paymentId: payment.paymentId });
    const paymentIntentId = paymentDoc.stripePaymentIntentId;
    timeline.paymentIntentId = paymentIntentId;

    // Confirm PaymentIntent via Stripe API directly (simulating client card confirmation)
    const confirmedPi = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: 'pm_card_visa',
      return_url: 'http://localhost:5173/my-bookings',
    });
    timeline.tStripeSucceeded = Date.now();
    timeline.stripeStatus = confirmedPi.status;
    console.log(`  ✓ Stripe PaymentIntent succeeded: ${paymentIntentId} in ${timeline.tStripeSucceeded - tStripeStart}ms (Status: ${confirmedPi.status})`);

    // 4. Dispatch Stripe Webhook event to Gateway /api/webhooks/stripe (normal webhook path)
    const tWebhookStart = Date.now();
    // Fetch latest event or construct simulated webhook event payload with valid signature
    const stripeEvent = {
      id: `evt_test_audit_${Date.now()}_${run}`,
      object: 'event',
      type: 'payment_intent.succeeded',
      created: Math.floor(timeline.tStripeSucceeded / 1000),
      data: {
        object: confirmedPi,
      },
    };

    const webhookPayload = JSON.stringify(stripeEvent);
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const signature = stripe.webhooks.generateTestHeaderString({
      payload: webhookPayload,
      secret: webhookSecret,
    });

    const webhookRes = await fetch(`${API_BASE}/api/webhooks/stripe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature,
      },
      body: webhookPayload,
    });
    const webhookData = await webhookRes.json();
    timeline.tWebhookReceived = Date.now();
    console.log(`  ✓ Webhook delivered & received by Payment Service in ${timeline.tWebhookReceived - tWebhookStart}ms (Response: ${JSON.stringify(webhookData)})`);

    // 5. Track Payment record updated timestamp
    let paymentUpdated = false;
    const pollStart = Date.now();
    while (Date.now() - pollStart < 10000) {
      const p = await paymentConn.collection('payments').findOne({ paymentId: payment.paymentId });
      if (p.status === 'SUCCEEDED') {
        timeline.tPaymentUpdated = p.paidAt ? new Date(p.paidAt).getTime() : Date.now();
        timeline.paymentRecordUpdated = p.updatedAt ? new Date(p.updatedAt).getTime() : Date.now();
        paymentUpdated = true;
        break;
      }
      await new Promise(r => setTimeout(r, 50));
    }
    console.log(`  ✓ Payment record updated to SUCCEEDED: ${paymentUpdated ? 'YES' : 'TIMEOUT'}`);

    // 6. Track Outbox publication in Payment Service
    let outboxPublished = false;
    const outboxPollStart = Date.now();
    while (Date.now() - outboxPollStart < 10000) {
      const o = await paymentConn.collection('outboxevents').findOne({ aggregateId: payment.paymentId });
      if (o && o.status === 'PUBLISHED') {
        timeline.tOutboxPublished = o.publishedAt ? new Date(o.publishedAt).getTime() : Date.now();
        outboxPublished = true;
        break;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    console.log(`  ✓ Payment outbox published to RabbitMQ: ${outboxPublished ? 'YES' : 'PENDING'}`);

    // 7. Track Booking consumption & CONFIRMED status
    let bookingConfirmed = false;
    const bookingPollStart = Date.now();
    while (Date.now() - bookingPollStart < 15000) {
      const b = await bookingConn.collection('bookings').findOne({ _id: new mongoose.Types.ObjectId(booking._id) });
      if (b.status === 'CONFIRMED') {
        timeline.tBookingConfirmed = b.updatedAt ? new Date(b.updatedAt).getTime() : Date.now();
        bookingConfirmed = true;
        break;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    console.log(`  ✓ Booking confirmed in Booking Service: ${bookingConfirmed ? 'YES' : 'TIMEOUT'}`);

    // 8. Track Frontend Polling confirmation (what frontend would see)
    const tFrontendPollStart = Date.now();
    let feConfirmed = false;
    while (Date.now() - tFrontendPollStart < 10000) {
      const pollRes = await fetch(`${API_BASE}/api/bookings/${booking._id}`, { headers: authHeaders });
      const pollJson = await pollRes.json();
      if (pollJson.booking && pollJson.booking.status === 'CONFIRMED') {
        timeline.tFrontendConfirmed = Date.now();
        feConfirmed = true;
        break;
      }
      await new Promise(r => setTimeout(r, 200));
    }
    console.log(`  ✓ Frontend polling perceived CONFIRMED: ${feConfirmed ? 'YES' : 'TIMEOUT'} in ${timeline.tFrontendConfirmed - timeline.tStripeSucceeded}ms after Stripe pay`);

    results.push(timeline);
  }

  console.log('\n================================================================');
  console.log('   TIMELINE AUDIT RESULTS                                       ');
  console.log('================================================================\n');

  console.log(JSON.stringify(results, null, 2));

  await bookingConn.close();
  await paymentConn.close();
  await catalogConn.close();
}

runTimelineAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
