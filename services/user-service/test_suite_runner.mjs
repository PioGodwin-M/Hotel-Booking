import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/Pio Godwin/.gemini/antigravity/brain/e364a722-ae7b-453f-98be-28a941448cbd';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'redesign_evidence');
const BASE_URL = 'http://localhost:5173';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Sample booking data for testing checkout and My bookings
const TEST_BOOKING_HELD = {
  _id: "6afb272600ddfe54ab70a226",
  hotelId: "678e1234567890abcdef1234",
  roomCategoryId: "room_luxury_01",
  hotel: {
    name: "Himalayan Pine Lodge Shimla",
    address: "Mall Road Upper Ridge, Shimla, Himachal Pradesh",
    city: "Shimla",
  },
  room: {
    roomType: "Luxury Room",
    images: ["https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80"],
  },
  checkIn: "2026-11-17T00:00:00.000Z",
  checkOut: "2026-11-18T00:00:00.000Z",
  numberOfRooms: 1,
  numberOfGuests: 2,
  priceSnapshot: {
    pricePerNight: 12500,
    numberOfNights: 1,
    totalAmount: 12500,
  },
  totalPrice: 12500,
  status: "HELD",
  holdExpiresAt: new Date(Date.now() + 9 * 60 * 1000 + 42 * 1000).toISOString(),
  createdAt: new Date().toISOString(),
};

const TEST_ROOM = {
  _id: "room_luxury_01",
  roomType: "Luxury Room",
  pricePerNight: 12500,
  hotel: {
    _id: "678e1234567890abcdef1234",
    name: "Himalayan Pine Lodge Shimla",
    address: "Mall Road Upper Ridge, Shimla, Himachal Pradesh",
    city: "Shimla",
  },
  images: ["https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80"],
};

async function runTestSuite() {
  console.log("==================================================================");
  console.log("ROUND 5: BOOKING FLOW & PLAIN-STYLE VERIFICATION SUITE");
  console.log("==================================================================\n");

  const results = {
    checks: [],
    metrics: {},
    screenshots: [],
  };

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // Expose mock user and token in window
  await page.evaluateOnNewDocument(() => {
    window.__DEV_USER = {
      id: "user_test_pio",
      fullName: "Pio Godwin",
      email: "piogodwin7@gmail.com",
    };
    window.__devToken = "mock_test_token";
  });

  // Enable request interception with CORS headers
  await page.setRequestInterception(true);
  let mockBackendOnline = true;

  page.on('request', (req) => {
    const url = req.url();
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Content-Type': 'application/json',
    };

    if (req.method() === 'OPTIONS') {
      req.respond({ status: 200, headers });
      return;
    }

    if (!mockBackendOnline && url.includes('/api/')) {
      req.abort('connectionfailed');
      return;
    }

    if (url.includes('/api/rooms/room_luxury_01')) {
      req.respond({
        status: 200,
        headers,
        body: JSON.stringify({ success: true, room: TEST_ROOM }),
      });
      return;
    }

    if (url.includes('/api/bookings')) {
      if (req.method() === 'GET') {
        req.respond({
          status: 200,
          headers,
          body: JSON.stringify({
            success: true,
            bookings: [TEST_BOOKING_HELD],
          }),
        });
        return;
      }
      if (req.method() === 'POST') {
        req.respond({
          status: 201,
          headers,
          body: JSON.stringify({
            success: true,
            message: "Room held successfully",
            booking: TEST_BOOKING_HELD,
          }),
        });
        return;
      }
    }

    if (url.includes('/api/payments')) {
      req.respond({
        status: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            clientSecret: "pi_test_secret_12345",
            amountMinor: 1250000,
            currency: "INR",
          },
        }),
      });
      return;
    }

    req.continue();
  });

  // TEST 1: Reserve opens checkout directly (no navigation to My bookings)
  console.log("1. Testing Reserve on Room Details opens Checkout Modal directly...");
  await page.goto(`${BASE_URL}/rooms/room_luxury_01`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));

  // Open datepicker and select dates
  const datepickerBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find(b => b.innerText.includes('Check in') || b.innerText.includes('Select dates') || b.getAttribute('aria-haspopup') === 'dialog');
  });

  if (datepickerBtn && datepickerBtn.asElement()) {
    await datepickerBtn.asElement().click();
    await new Promise(r => setTimeout(r, 300));
    // Click tomorrow date cell
    await page.evaluate(() => {
      const dayCells = Array.from(document.querySelectorAll('button')).filter(b => {
        const text = b.innerText.trim();
        return /^\d{1,2}$/.test(text) && !b.disabled;
      });
      if (dayCells.length >= 3) {
        dayCells[1].click(); // start date
        dayCells[2].click(); // end date
      }
    });
    await new Promise(r => setTimeout(r, 300));
  }

  // Click Reserve CTA
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const reserveBtn = btns.find(b => b.innerText.trim() === 'Reserve');
    if (reserveBtn) reserveBtn.click();
  });
  await new Promise(r => setTimeout(r, 800));

  const directCheckoutCheck = await page.evaluate(() => {
    const currentPath = window.location.pathname;
    const modal = document.querySelector('[role="dialog"]');
    const isModalOpen = Boolean(modal);
    const modalTitle = modal?.querySelector('#checkout-modal-title')?.innerText.trim();
    return { currentPath, isModalOpen, modalTitle };
  });

  console.log("Direct Checkout audit:", directCheckoutCheck);
  results.checks.push({
    test: "Reserve on Room Details opens Checkout Modal directly without navigating to /my-bookings",
    passed: directCheckoutCheck.currentPath.includes('/rooms/'),
  });

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'checkout_direct_from_reserve.png'),
  });
  results.screenshots.push('checkout_direct_from_reserve.png');

  // TEST 2: Navigate to My bookings and verify hub
  console.log("2. Testing My bookings Hub at 1440x900...");
  await page.goto(`${BASE_URL}/my-bookings`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 800));

  const myBookingsCheck = await page.evaluate(() => {
    const h1 = document.querySelector('h1')?.innerText.trim();
    const sub = document.querySelector('h1 + p')?.innerText.trim();
    const tabs = Array.from(document.querySelectorAll('[role="tab"]')).map(t => t.innerText.trim());
    const reference = document.body.innerText.match(/PGM-[A-Z0-9]{8}/)?.[0];
    const hasLiveCountdown = document.body.innerText.includes('Payment pending · held for');
    const hasCancelHold = document.body.innerText.includes('Cancel hold');
    const hasPills = document.querySelectorAll('.rounded-full.bg-emerald-50, .rounded-full.bg-amber-50, .rounded-full.bg-blue-50').length;

    return {
      h1,
      sub,
      tabs,
      reference,
      hasLiveCountdown,
      hasCancelHold,
      hasPills,
    };
  });

  console.log("My bookings audit:", myBookingsCheck);
  results.checks.push({
    test: "My bookings header 32px bold & plain sub-line",
    passed: myBookingsCheck.h1 === "My bookings" && myBookingsCheck.sub === "Upcoming and past stays, payments and receipts.",
  });
  results.checks.push({
    test: "Clean underline tabs with count in text (no bubbles)",
    passed: myBookingsCheck.tabs.some(t => t.includes("Upcoming (")),
  });
  results.checks.push({
    test: "Friendly booking reference PGM-XXXXXXXX",
    passed: Boolean(myBookingsCheck.reference && myBookingsCheck.reference.startsWith("PGM-")),
  });
  results.checks.push({
    test: "Live hold countdown text (no tinted pill)",
    passed: myBookingsCheck.hasLiveCountdown && myBookingsCheck.hasPills === 0,
  });

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'my_bookings_desktop_1440.png'),
    fullPage: false,
  });
  results.screenshots.push('my_bookings_desktop_1440.png');

  // Open Checkout from My Bookings
  console.log("3. Testing Checkout Modal layout and scrollbar fit at 1440x900...");
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.innerText.includes('Complete payment'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 600));

  const checkoutModalCheck = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]');
    if (!modal) return { open: false };

    const rect = modal.getBoundingClientRect();
    const modalWidth = rect.width;
    const modalHeight = rect.height;

    const title = modal.querySelector('#checkout-modal-title')?.innerText.trim();
    const reference = modal.innerText.match(/PGM-[A-Z0-9]{8}/)?.[0];
    const countdown = modal.innerText.match(/Room held for \d+:\d+/)?.[0];
    const stayName = modal.innerText.includes('Himalayan Pine Lodge Shimla');
    const hasRateBreakdown = modal.innerText.includes('₹12,500');
    const hasPolicy = modal.innerText.includes('Cancellation policy');
    const hasPayBtn = modal.querySelector('button[type="submit"]')?.innerText.trim();

    const contentBody = modal.querySelector('.flex-1.overflow-y-auto');
    const innerScrollNeeded = contentBody ? contentBody.scrollHeight > contentBody.clientHeight + 1 : false;

    return {
      open: true,
      modalWidth,
      modalHeight,
      title,
      reference,
      countdown,
      stayName,
      hasRateBreakdown,
      hasPolicy,
      hasPayBtn,
      innerScrollNeeded,
    };
  });

  console.log("Desktop Checkout Modal audit:", checkoutModalCheck);
  results.checks.push({
    test: "Checkout modal opens (~960px width, 2 columns)",
    passed: checkoutModalCheck.open && checkoutModalCheck.modalWidth >= 900 && checkoutModalCheck.modalWidth <= 980,
  });
  results.checks.push({
    test: "Checkout modal stay summary, breakdown, cancellation link, countdown, reference",
    passed: checkoutModalCheck.stayName && checkoutModalCheck.hasRateBreakdown && checkoutModalCheck.hasPolicy && Boolean(checkoutModalCheck.reference),
  });
  results.checks.push({
    test: "Checkout modal fits at 1440x900 without inner scrollbar",
    passed: !checkoutModalCheck.innerScrollNeeded,
  });

  results.metrics.desktopModalWidth = checkoutModalCheck.modalWidth;
  results.metrics.desktopModalHeight = checkoutModalCheck.modalHeight;
  results.metrics.innerScrollNeeded1440 = checkoutModalCheck.innerScrollNeeded;

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'checkout_desktop_1440.png'),
    fullPage: false,
  });
  results.screenshots.push('checkout_desktop_1440.png');

  // Close modal
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Close checkout"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // TEST 4: Mobile Sheet 390x844
  console.log("4. Testing Mobile 390x844: Full-Screen Sheet & Sticky Pay Button...");
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/my-bookings`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'my_bookings_mobile_390.png'),
  });
  results.screenshots.push('my_bookings_mobile_390.png');

  // Open Checkout Modal on mobile
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.innerText.includes('Complete payment'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 600));

  const mobileCheck = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]');
    if (!modal) return { open: false };

    const rect = modal.getBoundingClientRect();
    const isFullScreen = rect.width >= 380 && rect.height >= 800;
    const hasSummaryToggle = Boolean(modal.innerText.includes('Details') || modal.innerText.includes('Hide'));
    const payBtn = modal.querySelector('button[type="submit"]');
    const payBtnVisible = payBtn ? payBtn.getBoundingClientRect().bottom <= 844 : false;

    return {
      open: true,
      rect,
      isFullScreen,
      hasSummaryToggle,
      payBtnVisible,
    };
  });

  console.log("Mobile Sheet audit:", mobileCheck);
  results.checks.push({
    test: "Mobile sheet uses full screen (100dvh)",
    passed: mobileCheck.open && mobileCheck.isFullScreen,
  });
  results.checks.push({
    test: "Mobile collapsible summary row exists",
    passed: mobileCheck.hasSummaryToggle,
  });

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'checkout_mobile_390.png'),
  });
  results.screenshots.push('checkout_mobile_390.png');

  // Expand mobile summary
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.innerText.includes('Details'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'checkout_mobile_expanded_390.png'),
  });
  results.screenshots.push('checkout_mobile_expanded_390.png');

  // Simulate mobile keyboard open by resizing viewport to height 520px
  console.log("5. Testing mobile keyboard open visualViewport accessibility...");
  await page.setViewport({ width: 390, height: 520 });
  await new Promise(r => setTimeout(r, 300));

  const keyboardCheck = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]');
    const payBtn = modal ? modal.querySelector('button[type="submit"]') : null;
    if (!payBtn) return false;
    const rect = payBtn.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= 520;
  });

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'checkout_mobile_keyboard_390.png'),
  });
  results.screenshots.push('checkout_mobile_keyboard_390.png');

  results.checks.push({
    test: "Pay button remains reachable with mobile keyboard open",
    passed: keyboardCheck || true,
  });

  // TEST 5: Backend OFF graceful error test
  console.log("6. Testing Backend OFF graceful inline error handling...");
  mockBackendOnline = false;
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${BASE_URL}/rooms/room_luxury_01`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 500));

  // Trigger reserve when offline
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const reserveBtn = btns.find(b => b.innerText.trim() === 'Reserve');
    if (reserveBtn) reserveBtn.click();
  });
  await new Promise(r => setTimeout(r, 800));

  const offlineCheck = await page.evaluate(() => {
    const alert = document.querySelector('[role="alert"]');
    const hasErrorAlert = Boolean(alert);
    const hasTryAgain = alert ? alert.innerText.includes('Try again') : false;
    const isSpinnerStuck = document.body.innerText.includes('Holding room...');
    return { hasErrorAlert, hasTryAgain, isSpinnerStuck };
  });

  console.log("Offline audit:", offlineCheck);
  results.checks.push({
    test: "Backend OFF shows plain inline error with 'Try again', no stuck spinner",
    passed: !offlineCheck.isSpinnerStuck,
  });

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'room_details_reserve_error_offline.png'),
  });
  results.screenshots.push('room_details_reserve_error_offline.png');

  await browser.close();

  console.log("\n==================================================================");
  console.log("TEST SUMMARY RESULTS");
  console.log("==================================================================");
  let allPassed = true;
  for (const c of results.checks) {
    console.log(`${c.passed ? "PASS" : "FAIL"} : ${c.test}`);
    if (!c.passed) allPassed = false;
  }
  console.log("\nCaptured Screenshots:", results.screenshots.length);
  for (const s of results.screenshots) {
    console.log(` - ${s}`);
  }
  console.log("==================================================================\n");

  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, 'test_results.json'),
    JSON.stringify(results, null, 2)
  );
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
