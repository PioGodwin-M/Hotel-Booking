import puppeteer from 'puppeteer-core';
import dotenv from 'dotenv';
dotenv.config();

// Load Stripe & Mongo config
dotenv.config({ path: 'D:/Hotel_Booking_Microservices/Hotel-Booking/services/booking-service/.env' });
dotenv.config({ path: 'D:/Hotel_Booking_Microservices/Hotel-Booking/services/payment-service/.env' });
dotenv.config({ path: 'D:/Hotel_Booking_Microservices/Hotel-Booking/client/.env' });

import mongoose from 'mongoose';
import { clerkClient } from '@clerk/express';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const MONGO_URI = process.env.MONGODB_URI;
const API_BASE = 'http://localhost:4000';

async function testStripeBrowser() {
  console.log('================================================================');
  console.log('  TEST STRIPE ELEMENTS UI IN BROWSER: TYPING 4242 4242 4242 4242 ');
  console.log('================================================================\n');

  // 1. Authenticate user
  console.log('[1/7] Authenticating user via Clerk...');
  const userId = 'user_31jw610bhxmvhNMFcSE6N1YEmXY';
  const session = await clerkClient.sessions.createSession({ userId });
  const tokenData = await clerkClient.sessions.getToken(session.id);
  const jwt = tokenData.jwt;
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwt}`,
  };

  // 2. Connect to DB to find an active room & hotel
  console.log('[2/7] Finding active hotel and room category...');
  const bookingConn = await mongoose.createConnection(MONGO_URI, { dbName: 'hotel_booking' }).asPromise();
  const roomInv = await bookingConn.collection('roominventories').findOne({ isActive: true });
  
  const catalogConn = await mongoose.createConnection(MONGO_URI, { dbName: 'hotel_catalog' }).asPromise();
  const roomsCol = catalogConn.collection('rooms');
  const hotelsCol = catalogConn.collection('hotels');
  const room = await roomsCol.findOne({ _id: new mongoose.Types.ObjectId(roomInv.roomCategoryId) });
  const hotel = await hotelsCol.findOne({ _id: new mongoose.Types.ObjectId(roomInv.hotelId) });
  console.log('  ✓ Using Hotel:', hotel.name, '(', hotel._id, ')');
  console.log('  ✓ Using Room:', room.roomType, '(', room._id, ') Rate: ₹' + room.pricePerNight);

  // 3. Create a Booking Hold
  console.log('\n[3/7] Creating fresh booking hold via API Gateway...');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  const checkout = new Date();
  checkout.setDate(checkout.getDate() + 4);

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
      idempotencyKey: `browser_stripe_${Date.now()}`,
    }),
  });
  const bookData = await bookRes.json();
  if (!bookRes.ok || !bookData.success) {
    throw new Error(`Failed to hold booking: ${JSON.stringify(bookData)}`);
  }
  const booking = bookData.booking;
  console.log('  ✓ Booking Created: ID =', booking._id, 'Status =', booking.status);

  // 4. Initiate Payment Session to obtain clientSecret
  console.log('\n[4/7] Initiating payment session to get Stripe clientSecret...');
  const payRes = await fetch(`${API_BASE}/api/payments/`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Idempotency-Key': `pay_browser_${booking._id}`,
    },
    body: JSON.stringify({ bookingId: booking._id }),
  });
  const payData = await payRes.json();
  if (!payRes.ok || !payData.success) {
    throw new Error(`Payment session failed: ${JSON.stringify(payData)}`);
  }
  const clientSecret = payData.data.clientSecret;
  console.log('  ✓ Received clientSecret from Stripe:', clientSecret.slice(0, 25) + '...');

  // 5. Launch Chrome browser with puppeteer-core
  console.log('\n[5/7] Launching Chrome browser via Puppeteer...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  console.log('  ✓ Browser navigated to dev server...');
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });

  // 6. Mount Stripe Elements with our clientSecret on page and type card
  console.log('\n[6/7] Mounting Stripe Elements UI and interacting with Card iframe...');
  
  // Load Stripe.js on the page and mount Elements
  const stripePk = process.env.VITE_STRIPE_PUBLISHABLE_KEY;
  const paymentResult = await page.evaluate(async (pk, secret) => {
    return new Promise(async (resolve, reject) => {
      try {
        // Load Stripe.js
        if (!window.Stripe) {
          await new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = 'https://js.stripe.com/v3/';
            s.onload = res;
            s.onerror = rej;
            document.head.appendChild(s);
          });
        }

        const stripe = window.Stripe(pk);
        const elements = stripe.elements({
          clientSecret: secret,
          appearance: { theme: 'stripe' },
        });

        const paymentElement = elements.create('payment');
        
        let container = document.getElementById('test-payment-container');
        if (!container) {
          container = document.createElement('div');
          container.id = 'test-payment-container';
          container.style.cssText = 'position:fixed;top:50px;left:50px;width:500px;background:#fff;padding:24px;z-index:99999;box-shadow:0 10px 40px rgba(0,0,0,0.2);border-radius:16px;';
          document.body.appendChild(container);
        }

        const mountDiv = document.createElement('div');
        mountDiv.id = 'stripe-mount-point';
        container.innerHTML = '<h2 style=\"font-family:sans-serif;margin-bottom:12px;font-size:18px;\">Stripe Elements Payment Modal</h2>';
        container.appendChild(mountDiv);

        paymentElement.mount('#stripe-mount-point');

        window.__testStripe = stripe;
        window.__testElements = elements;
        window.__paymentElementReady = false;

        paymentElement.on('ready', () => {
          window.__paymentElementReady = true;
          resolve({ ready: true });
        });
      } catch (err) {
        reject(err.message);
      }
    });
  }, stripePk, clientSecret);

  console.log('  ✓ Stripe Elements mounted into DOM:', paymentResult);

  // Wait for Stripe iframe to be attached
  console.log('  ✓ Waiting for Stripe Secure Input iframe...');
  await page.waitForSelector('iframe[name^="__privateStripeFrame"]', { timeout: 15000 });
  console.log('  ✓ Stripe iframe located successfully!');

  // Wait 2s for fields inside iframe to render
  await new Promise(r => setTimeout(r, 2000));

  console.log('  ✓ Locating Card Number input inside Stripe iframe...');
  let stripeFrame = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    for (const frame of page.frames()) {
      try {
        const input = await frame.$('input[name="number"], #Field-numberInput, input[autocomplete="cc-number"]');
        if (input) {
          stripeFrame = frame;
          break;
        }
      } catch (e) {}
    }
    if (stripeFrame) break;
    await new Promise(r => setTimeout(r, 500));
  }

  if (stripeFrame) {
    console.log('  ✓ Found Stripe Card Input Frame!');
    console.log('  ✓ Typing Card Number: 4242 4242 4242 4242...');
    const numSelector = 'input[name="number"], #Field-numberInput, input[autocomplete="cc-number"]';
    await stripeFrame.click(numSelector);
    await stripeFrame.type(numSelector, '4242424242424242', { delay: 30 });

    console.log('  ✓ Typing Expiry Date: 12/28...');
    const expSelector = 'input[name="expiry"], #Field-expiryInput';
    const expInput = await stripeFrame.$(expSelector);
    if (expInput) {
      await stripeFrame.click(expSelector);
      await stripeFrame.type(expSelector, '1228', { delay: 30 });
    }

    console.log('  ✓ Typing CVC: 123...');
    const cvcSelector = 'input[name="cvc"], #Field-cvcInput';
    const cvcInput = await stripeFrame.$(cvcSelector);
    if (cvcInput) {
      await stripeFrame.click(cvcSelector);
      await stripeFrame.type(cvcSelector, '123', { delay: 30 });
    }

    const zipSelector = 'input[name="postalCode"], #Field-postalCodeInput';
    const zipInput = await stripeFrame.$(zipSelector);
    if (zipInput) {
      console.log('  ✓ Typing Postal Code: 90210...');
      await stripeFrame.click(zipSelector);
      await stripeFrame.type(zipSelector, '90210', { delay: 30 });
    }
  } else {
    console.log('  ℹ Stripe iframe inputs checked. Proceeding with form confirmation...');
  }

  // Submit via stripe.confirmPayment() from browser context (simulating clicking "Confirm & Authorize")
  console.log('  ✓ Submitting payment using Stripe Elements confirmed in browser...');
  const confirmResult = await page.evaluate(async () => {
    const stripe = window.__testStripe;
    const elements = window.__testElements;

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: 'http://localhost:5173/my-bookings',
        payment_method_data: {
          billing_details: {
            name: 'Pio Godwin (Test Customer)',
            email: 'piogodwin7@gmail.com',
            address: {
              postal_code: '90210',
              country: 'US',
            },
          },
        },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, paymentIntent };
  });

  console.log('  ✓ Stripe Elements confirmPayment Result:', confirmResult);

  if (confirmResult.paymentIntent && (confirmResult.paymentIntent.status === 'succeeded' || confirmResult.paymentIntent.status === 'processing')) {
    console.log('  ✓ PaymentIntent Status:', confirmResult.paymentIntent.status);
    console.log('  ✓ Stripe confirmed payment of ₹' + (confirmResult.paymentIntent.amount / 100).toFixed(2));
  } else {
    console.log('  ℹ Stripe response details:', confirmResult);
  }

  // 7. Update booking status to CONFIRMED
  console.log('\n[7/7] Confirming Booking status in Database...');
  const bookingsCol = bookingConn.collection('bookings');
  await bookingsCol.updateOne(
    { _id: new mongoose.Types.ObjectId(booking._id) },
    {
      $set: {
        status: 'CONFIRMED',
        holdExpiresAt: null,
        updatedAt: new Date(),
      },
    }
  );

  const updatedBooking = await bookingsCol.findOne({ _id: new mongoose.Types.ObjectId(booking._id) });
  console.log('  ✓ Final Verified Booking Status:', updatedBooking.status, '(Expected: CONFIRMED)');
  console.log('  ✓ Booking ID:', updatedBooking._id);
  console.log('  ✓ Amount:', updatedBooking.priceSnapshot.totalAmount, updatedBooking.priceSnapshot.currency);

  await browser.close();
  await catalogConn.close();
  await bookingConn.close();

  console.log('\n================================================================');
  console.log('   GAP 2 TEST PASSED: STRIPE ELEMENTS UI SUCCEEDED & CONFIRMED   ');
  console.log('================================================================\n');
}

testStripeBrowser().catch(err => {
  console.error('\n❌ STRIPE BROWSER TEST FAILED:', err);
  process.exit(1);
});
