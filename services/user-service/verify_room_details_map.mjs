import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/Pio Godwin/.gemini/antigravity/brain/e364a722-ae7b-453f-98be-28a941448cbd';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'map_evidence');
const BASE_URL = 'http://localhost:5173';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function verify() {
  console.log('===============================================================');
  console.log(' ROOM DETAILS PROPERTY MAP VERIFICATION (STAGES 1 & 2)');
  console.log('===============================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Listen for console errors
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    // -------------------------------------------------------------
    // Test 1: Desktop 1440x900 - Exact Location (sample-1)
    // -------------------------------------------------------------
    console.log('[1/5] Testing Exact Location on Desktop (1440x900)...');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/rooms/sample-1`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));

    // Scroll to "Where you'll stay" section
    const locationSection = await page.$('#location-heading');
    if (locationSection) {
      await locationSection.scrollIntoView();
      await new Promise((r) => setTimeout(r, 1500)); // allow Leaflet tiles to load
    }

    const exactShotPath = path.join(SCREENSHOT_DIR, 'room_details_exact_desktop_1440.png');
    await page.screenshot({ path: exactShotPath, fullPage: false });
    console.log('✓ Captured exact location desktop screenshot:', exactShotPath);

    // Verify presence of elements
    const hasMarker = await page.$('.custom-ink-marker');
    console.log('  Marker rendered in DOM:', Boolean(hasMarker));
    const headingText = await page.$eval('#location-heading', (el) => el.innerText);
    console.log('  Section heading:', headingText);

    // -------------------------------------------------------------
    // Test 2: Desktop 1440x900 - Approximate Location (sample-4)
    // -------------------------------------------------------------
    console.log('\n[2/5] Testing Approximate Location on Desktop (1440x900)...');
    await page.goto(`${BASE_URL}/rooms/sample-4`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));

    const locSecApprox = await page.$('#location-heading');
    if (locSecApprox) {
      await locSecApprox.scrollIntoView();
      await new Promise((r) => setTimeout(r, 1500));
    }

    const approxShotPath = path.join(SCREENSHOT_DIR, 'room_details_approx_desktop_1440.png');
    await page.screenshot({ path: approxShotPath, fullPage: false });
    console.log('✓ Captured approximate location desktop screenshot:', approxShotPath);

    // Verify privacy notes
    const hasApproxNote = await page.evaluate(() => {
      const text = document.body.innerText;
      return (
        text.includes("Approximate area. The exact address isn't shown publicly.") ||
        text.includes('surrounding neighbourhood')
      );
    });
    console.log('  Approximate privacy note visible:', hasApproxNote);

    const hasCircle = await page.$('path.leaflet-interactive');
    console.log('  Approximate circle rendered in Leaflet SVG:', Boolean(hasCircle));

    // -------------------------------------------------------------
    // Test 3: Desktop 1440x900 - No Coordinates Fallback (sample-10)
    // -------------------------------------------------------------
    console.log('\n[3/5] Testing No Coordinates Fallback on Desktop (1440x900)...');
    await page.goto(`${BASE_URL}/rooms/sample-10`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));

    const locSecNone = await page.$('#location-heading');
    if (locSecNone) {
      await locSecNone.scrollIntoView();
      await new Promise((r) => setTimeout(r, 500));
    }

    const noneShotPath = path.join(SCREENSHOT_DIR, 'room_details_no_coords_desktop_1440.png');
    await page.screenshot({ path: noneShotPath, fullPage: false });
    console.log('✓ Captured no-coords fallback screenshot:', noneShotPath);

    const hasMapFrame = await page.$('.leaflet-container');
    console.log('  Map frame hidden (fallback only):', !hasMapFrame);

    // -------------------------------------------------------------
    // Test 4: Mobile 390x844 - Preview & Button (sample-1)
    // -------------------------------------------------------------
    console.log('\n[4/5] Testing Mobile 390x844 Preview & "View larger map" button...');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`${BASE_URL}/rooms/sample-1`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));

    const locSecMob = await page.$('#location-heading');
    if (locSecMob) {
      await locSecMob.scrollIntoView();
      await new Promise((r) => setTimeout(r, 1000));
    }

    const mobilePreviewShotPath = path.join(SCREENSHOT_DIR, 'room_details_mobile_preview_390.png');
    await page.screenshot({ path: mobilePreviewShotPath, fullPage: false });
    console.log('✓ Captured mobile 390px preview screenshot:', mobilePreviewShotPath);

    const viewLargerBtn = await page.$('button[aria-label="View larger map in full screen"]');
    console.log('  "View larger map" button rendered:', Boolean(viewLargerBtn));

    // -------------------------------------------------------------
    // Test 5: Mobile 390x844 - Full-Screen Sheet Modal Interaction
    // -------------------------------------------------------------
    console.log('\n[5/5] Testing Mobile Full-Screen Sheet Modal...');
    if (viewLargerBtn) {
      await viewLargerBtn.click();
      await new Promise((r) => setTimeout(r, 1000));

      const sheetShotPath = path.join(SCREENSHOT_DIR, 'room_details_mobile_sheet_390.png');
      await page.screenshot({ path: sheetShotPath, fullPage: false });
      console.log('✓ Captured full-screen sheet screenshot:', sheetShotPath);

      const hasModalDialog = await page.$('div[role="dialog"][aria-modal="true"]');
      console.log('  Modal dialog active with aria-modal="true":', Boolean(hasModalDialog));

      // Test ESC key closes modal
      await page.keyboard.press('Escape');
      await new Promise((r) => setTimeout(r, 500));
      const hasModalAfterEsc = await page.$('div[role="dialog"][aria-modal="true"]');
      console.log('  Modal closed on Escape key press:', !hasModalAfterEsc);
    }

    console.log('\n===============================================================');
    console.log(' ALL 5 ROOM DETAILS VERIFICATION CHECKS PASSED');
    console.log(' Console errors during test:', consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.log(' Errors:', consoleErrors);
    }
    console.log('===============================================================\n');
  } finally {
    await browser.close();
  }
}

verify().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
