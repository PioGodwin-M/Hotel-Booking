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

async function runVerification() {
  console.log('--- Launching Chrome for Round 4e Verification ---');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Test 1: Desktop 1440x900
  console.log('\n--- 1. Desktop 1440x900 Verification ---');
  await page.setViewport({ width: 1440, height: 900 });

  // Navigate to My bookings
  await page.goto(`${BASE_URL}/my-bookings`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'my_bookings_desktop_1440.png'),
    fullPage: false,
  });
  console.log('✓ Saved my_bookings_desktop_1440.png');

  // Inspect My Bookings DOM
  const myBookingsAudit = await page.evaluate(() => {
    const cancelHoldButtons = Array.from(document.querySelectorAll('button')).filter(
      b => b.innerText.toLowerCase().includes('cancel hold')
    );
    const monoRefs = Array.from(document.querySelectorAll('.font-mono')).map(el => el.innerText);
    const regularRefs = Array.from(document.querySelectorAll('.font-sans')).filter(
      el => el.innerText.startsWith('BK-')
    ).map(el => el.innerText);

    return {
      cancelHoldCount: cancelHoldButtons.length,
      hasCancelHoldButton: cancelHoldButtons.length > 0,
      monoRefsCount: monoRefs.length,
      regularRefsCount: regularRefs.length,
      regularRefsSample: regularRefs.slice(0, 3),
    };
  });
  console.log('My Bookings DOM Audit:', JSON.stringify(myBookingsAudit, null, 2));

  // Navigate to a room details page
  console.log('\n--- 2. Room Details 1440x900 Verification ---');
  await page.goto(`${BASE_URL}/rooms`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));

  const firstRoomLink = await page.$('a[href^="/rooms/"]');
  if (firstRoomLink) {
    const roomHref = await page.evaluate(el => el.getAttribute('href'), firstRoomLink);
    console.log('Navigating to room:', roomHref);
    await page.goto(`${BASE_URL}${roomHref}`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1200));

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'room_details_desktop_1440.png'),
      fullPage: false,
    });
    console.log('✓ Saved room_details_desktop_1440.png');

    // Inspect Room Details CTA
    const ctaAudit = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim());
      const hasReserve = buttons.some(t => t.includes('Reserve'));
      const hasContinueToPayment = buttons.some(t => t.includes('Continue to payment'));
      return { hasReserve, hasContinueToPayment, allButtons: buttons.filter(b => b.length > 0 && b.length < 30) };
    });
    console.log('Room Details CTA Audit:', JSON.stringify(ctaAudit, null, 2));
  }

  // Test 3: Mobile 390x844
  console.log('\n--- 3. Mobile 390x844 Verification ---');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(`${BASE_URL}/my-bookings`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'my_bookings_mobile_390.png'),
    fullPage: false,
  });
  console.log('✓ Saved my_bookings_mobile_390.png');

  await browser.close();
  console.log('\n--- All Browser Verifications Completed Successfully ---');
}

runVerification().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
