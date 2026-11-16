import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/Pio Godwin/.gemini/antigravity/brain/e364a722-ae7b-453f-98be-28a941448cbd/polish';
const BASE_URL = 'http://localhost:5173';

// Parse command line arguments
const args = process.argv.slice(2);
const modeArg = args.find(a => a.startsWith('--mode='));
const MODE = modeArg ? modeArg.split('=')[1] : 'on'; // 'on' or 'off'

const ROUTES = [
  { name: 'Home', path: '/' },
  { name: 'AllRooms', path: '/rooms' },
  { name: 'RoomDetails', path: '/rooms/6af930f5fb028382df103198' },
  { name: 'MyBookings', path: '/my-bookings' },
  { name: 'About', path: '/about' },
  { name: 'OwnerDashboard', path: '/owner?dev_owner=true' },
  { name: 'OwnerAddRoom', path: '/owner/add-room?dev_owner=true' },
  { name: 'OwnerListRoom', path: '/owner/list-room?dev_owner=true' },
  { name: 'NotFound404', path: '/non-existent-random-route' },
];

const VIEWPORTS = [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'mobile', width: 390, height: 844 },
];

async function runSmokeTests() {
  console.log(`================================================================`);
  console.log(`  RUNNING SMOKE TEST SUITE - MODE: BACKEND ${MODE.toUpperCase()}`);
  console.log(`================================================================\n`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  const results = [];
  let totalErrors = 0;

  for (const vp of VIEWPORTS) {
    console.log(`\n--- TESTING AT VIEWPORT: ${vp.label.toUpperCase()} (${vp.width}x${vp.height}) ---`);

    for (const route of ROUTES) {
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height });

      const pageErrors = [];
      const consoleErrors = [];

      page.on('pageerror', (err) => {
        pageErrors.push(err.toString());
      });

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Filter out benign network / CORS errors when backend is off
          if (MODE === 'off') {
            if (
              text.includes('ERR_CONNECTION_REFUSED') ||
              text.includes('Failed to load resource') ||
              text.includes('net::ERR_') ||
              text.includes('Network Error') ||
              text.includes('AxiosError') ||
              text.includes('status of 500') ||
              text.includes('status of 404')
            ) {
              return;
            }
          }
          // Filter out Clerk analytics/cookie noise if any
          if (text.includes('clerk') || text.includes('Cookie')) {
            return;
          }
          consoleErrors.push(text);
        }
      });

      const url = `${BASE_URL}${route.path}`;
      let navigationSuccess = false;

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise((r) => setTimeout(r, 1200));
        navigationSuccess = true;
      } catch (navErr) {
        pageErrors.push(`Navigation failed: ${navErr.message}`);
      }

      // Check for ErrorBoundary crash on page
      let hasReactCrash = false;
      let crashText = '';
      if (navigationSuccess) {
        try {
          const bodyText = await page.evaluate(() => document.body.innerText);
          if (
            bodyText.includes('Something went wrong') &&
            (bodyText.includes('An unexpected error occurred') || bodyText.includes('Reload page'))
          ) {
            hasReactCrash = true;
            crashText = 'ErrorBoundary screen triggered';
          }
        } catch {}
      }

      // Filter fatal errors
      const fatalErrors = [
        ...pageErrors,
        ...consoleErrors.filter((e) =>
          e.includes('TypeError') ||
          e.includes('ReferenceError') ||
          e.includes('not a function') ||
          e.includes('Cannot read properties')
        ),
      ];

      if (hasReactCrash) {
        fatalErrors.push(crashText);
      }

      const passed = fatalErrors.length === 0;
      if (!passed) totalErrors++;

      const statusStr = passed ? 'PASS' : 'FAIL';
      console.log(`  [${statusStr}] ${route.name.padEnd(16)} (${route.path})`);
      if (!passed) {
        fatalErrors.forEach((e) => console.log(`         -> ERROR: ${e}`));
      }

      // Capture screenshots for evidence in backend ON mode (or offline error state in OFF mode)
      if (
        (MODE === 'on' && vp.label === 'desktop') ||
        (MODE === 'off' && route.name === 'AllRooms' && vp.label === 'desktop') ||
        (MODE === 'on' && route.name === 'Home' && vp.label === 'mobile') ||
        (MODE === 'on' && route.name === 'RoomDetails' && vp.label === 'mobile')
      ) {
        const screenshotName = `${MODE}_${route.name.toLowerCase()}_${vp.label}.png`;
        const screenshotPath = path.join(ARTIFACT_DIR, screenshotName);
        try {
          await page.screenshot({ path: screenshotPath, fullPage: false });
        } catch {}
      }

      // If Home desktop, also capture logo after scroll
      if (MODE === 'on' && route.name === 'Home' && vp.label === 'desktop') {
        try {
          // Hero top screenshot
          await page.screenshot({ path: path.join(ARTIFACT_DIR, 'logo_hero_desktop.png') });
          // Scroll down to test navbar solid background & logo
          await page.evaluate(() => window.scrollTo(0, 600));
          await new Promise((r) => setTimeout(r, 500));
          await page.screenshot({ path: path.join(ARTIFACT_DIR, 'logo_scrolled_desktop.png') });
          // Scroll to footer to test footer logo
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await new Promise((r) => setTimeout(r, 500));
          await page.screenshot({ path: path.join(ARTIFACT_DIR, 'logo_footer_desktop.png') });
        } catch {}
      }

      results.push({
        mode: MODE,
        viewport: vp.label,
        route: route.name,
        path: route.path,
        passed,
        errors: fatalErrors,
      });

      await page.close();
    }
  }

  await browser.close();

  console.log(`\n================================================================`);
  console.log(`  TEST RESULTS SUMMARY (${MODE.toUpperCase()}): ${results.filter(r => r.passed).length}/${results.length} PASSED`);
  if (totalErrors > 0) {
    console.log(`  FAILED TESTS: ${totalErrors}`);
  } else {
    console.log(`  ALL ${results.length} TESTS PASSED CLEANLY! ZERO CRASHES.`);
  }
  console.log(`================================================================\n`);

  return { totalErrors, results };
}

runSmokeTests().then(({ totalErrors }) => {
  if (totalErrors > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}).catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
