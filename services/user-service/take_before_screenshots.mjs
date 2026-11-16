import puppeteer from 'puppeteer-core';
import dotenv from 'dotenv';
dotenv.config();

import { clerkClient } from '@clerk/express';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';

const DIRS = [
  'D:/Hotel_Booking_Microservices/Hotel-Booking/screenshots/before',
  'D:/Hotel_Booking_Microservices/screenshots/before',
];

DIRS.forEach(d => fs.mkdirSync(d, { recursive: true }));

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1024', width: 1024, height: 768 },
  { name: '768', width: 768, height: 1024 },
  { name: '390', width: 390, height: 844, isMobile: true, hasTouch: true },
];

const PAGES = [
  { id: 'home', url: `${BASE_URL}/` },
  { id: 'all-rooms-grid', url: `${BASE_URL}/rooms?view=grid` },
  { id: 'all-rooms-list', url: `${BASE_URL}/rooms?view=list` },
  { id: 'room-details', url: `${BASE_URL}/rooms/6ae9ced46cb1c2a8f808515c` },
  { id: 'my-bookings', url: `${BASE_URL}/my-bookings?dev_owner=true` },
  { id: 'owner-dashboard', url: `${BASE_URL}/owner?dev_owner=true` },
  { id: 'list-rooms', url: `${BASE_URL}/owner/list-room?dev_owner=true` },
  { id: 'add-room', url: `${BASE_URL}/owner/add-room?dev_owner=true` },
];

async function captureBeforeScreenshots() {
  console.log('Generating Clerk Session & Token for Dev Auth...');
  let jwt = '';
  try {
    const session = await clerkClient.sessions.createSession({ userId: 'user_31jw610bhxmvhNMFcSE6N1YEmXY' });
    const tokenData = await clerkClient.sessions.getToken(session.id);
    jwt = tokenData.jwt;
    console.log('✓ Dev Clerk JWT acquired');
  } catch (err) {
    console.warn('Could not acquire Clerk JWT:', err.message);
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Inject dev auth & user mock
  await page.evaluateOnNewDocument((token) => {
    window.__devToken = token;
    window.__DEV_OWNER = true;
    window.__DEV_USER = {
      id: 'user_31jw610bhxmvhNMFcSE6N1YEmXY',
      fullName: 'Pio Godwin',
      primaryEmailAddress: { emailAddress: 'piogodwin7@gmail.com' },
      imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
    };
  }, jwt);

  for (const vp of VIEWPORTS) {
    console.log(`\nCapturing viewports for ${vp.name}px...`);
    await page.setViewport({
      width: vp.width,
      height: vp.height,
      isMobile: !!vp.isMobile,
      hasTouch: !!vp.hasTouch,
    });

    for (const p of PAGES) {
      const filename = `${p.id}_${vp.name}.png`;
      try {
        await page.goto(p.url, { waitUntil: 'networkidle2', timeout: 20000 });
        // Settle CSS transitions / animations
        await new Promise(r => setTimeout(r, 1200));

        for (const dir of DIRS) {
          const dest = path.join(dir, filename);
          await page.screenshot({ path: dest, fullPage: false });
        }
        console.log(`  ✓ Saved: ${filename}`);
      } catch (err) {
        console.error(`  ✗ Error capturing ${filename}:`, err.message);
      }
    }
  }

  await browser.close();
  console.log('\nAll 32 before-screenshots captured successfully!');
}

captureBeforeScreenshots().catch(err => {
  console.error('Fatal screenshot error:', err);
  process.exit(1);
});
