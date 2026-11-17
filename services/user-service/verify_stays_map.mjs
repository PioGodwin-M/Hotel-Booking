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
  console.log(' STAYS PAGE MAP VIEW VERIFICATION (STAGE 3 & 5.1)');
  console.log('===============================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const pages = await browser.pages();
  const page = pages.length > 0 ? pages[0] : await browser.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    // -------------------------------------------------------------
    // Test 1: Desktop 1440x900 - Stays Map View Split Layout
    // -------------------------------------------------------------
    console.log('[1/5] Testing Desktop Stays Map View (1440x900) split layout...');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/rooms?view=map&sample=true`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.leaflet-container', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 2000)); // Allow Leaflet map and tiles to load

    const desktopMapShot = path.join(SCREENSHOT_DIR, 'stays_map_desktop_split_1440.png');
    await page.screenshot({ path: desktopMapShot, fullPage: false });
    console.log('✓ Captured desktop split layout screenshot:', desktopMapShot);

    // Verify price markers rendered
    const priceMarkers = await page.$$('.custom-price-marker');
    console.log('  Price markers rendered on map:', priceMarkers.length);

    // Verify missing location notice is present
    const noticeText = await page.evaluate(() => {
      const el = document.body.innerText;
      return el.includes('no map location');
    });
    console.log('  Missing-location notice rendered:', noticeText);

    // -------------------------------------------------------------
    // Test 2: Card to Marker and Marker to Card Synchronization
    // -------------------------------------------------------------
    console.log('\n[2/5] Testing Marker-Card Two-Way Synchronization...');
    // Hover on first card
    const firstCard = await page.$('div[tabindex="0"]');
    if (firstCard) {
      await firstCard.hover();
      await new Promise((r) => setTimeout(r, 600));
      console.log('✓ Hovered over first stay card');
    }

    // Click on a price marker on the map
    await page.waitForSelector('.custom-price-marker', { timeout: 5000 });
    await page.click('.custom-price-marker');
    await new Promise((r) => setTimeout(r, 1000));
    console.log('✓ Clicked on price marker');

    const hasPopup = await page.$('.custom-property-popup');
    console.log('  Marker popup preview open:', Boolean(hasPopup));

    const syncShot = path.join(SCREENSHOT_DIR, 'stays_map_marker_sync_1440.png');
    await page.screenshot({ path: syncShot, fullPage: false });
    console.log('✓ Captured marker synchronization screenshot:', syncShot);

    // -------------------------------------------------------------
    // Test 3: "Search this area" client-side filter
    // -------------------------------------------------------------
    console.log('\n[3/5] Testing "Search this area" floating button and filter...');
    // Drag/pan the map container
    const mapElement = await page.$('.leaflet-container');
    if (mapElement) {
      const box = await mapElement.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 100, { steps: 5 });
        await page.mouse.up();
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // Check if 'Search this area' button appeared
    const searchAreaBtn = await page.$('button ::-p-text(Search this area)');
    console.log('  "Search this area" button visible:', Boolean(searchAreaBtn));

    const searchAreaShot = path.join(SCREENSHOT_DIR, 'stays_map_search_area_prompt_1440.png');
    await page.screenshot({ path: searchAreaShot, fullPage: false });
    console.log('✓ Captured search area button screenshot:', searchAreaShot);

    if (searchAreaBtn) {
      await searchAreaBtn.click();
      await new Promise((r) => setTimeout(r, 800));
      const resetBtn = await page.$('button ::-p-text(Reset area)');
      console.log('  "Reset area" button visible after clicking:', Boolean(resetBtn));
    }

    // -------------------------------------------------------------
    // Test 4: Mobile 390x844 - Full Screen Map & Swipeable Carousel
    // -------------------------------------------------------------
    console.log('\n[4/5] Testing Mobile 390x844 Full-Screen Map with Carousel...');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`${BASE_URL}/rooms?view=map&sample=true`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.leaflet-container', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 2000));

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise((r) => setTimeout(r, 600));

    const mobileMapShot = path.join(SCREENSHOT_DIR, 'stays_map_mobile_carousel_390.png');
    await page.screenshot({ path: mobileMapShot, fullPage: false });
    console.log('✓ Captured mobile full-screen map screenshot:', mobileMapShot);

    const listBtn = await page.$('button[aria-label="Switch to list view"]');
    console.log('  Floating "List" button present on mobile:', Boolean(listBtn));

    // -------------------------------------------------------------
    // Test 5: 100 Sample Stays Clustering Stress Test (Section 5.1)
    // -------------------------------------------------------------
    console.log('\n[5/5] Testing 100 Sample Stays Clustering (>30 markers)...');
    await page.setViewport({ width: 1440, height: 900 });
    const startTime = Date.now();
    await page.goto(`${BASE_URL}/rooms?view=map&sample100=true`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.leaflet-container', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 2000));
    const renderTimeMs = Date.now() - startTime;
    console.log(`  Loaded and clustered 100 stays in ${renderTimeMs}ms`);

    const clusterElements = await page.$$('.custom-cluster-marker');
    console.log('  Cluster marker elements rendered in DOM:', clusterElements.length);

    const clusterShot = path.join(SCREENSHOT_DIR, 'stays_map_100_clusters_1440.png');
    await page.screenshot({ path: clusterShot, fullPage: false });
    console.log('✓ Captured 100 markers cluster screenshot:', clusterShot);

    if (clusterElements.length > 0) {
      // Click cluster to test zoom to bounds
      const firstCluster = clusterElements[0];
      const clusterLabel = await page.evaluate(
        (el) => el.querySelector('[aria-label]')?.getAttribute('aria-label') || el.getAttribute('aria-label'),
        firstCluster
      );
      console.log(`  First cluster accessible aria-label: "${clusterLabel}"`);
      await firstCluster.click();
      await new Promise((r) => setTimeout(r, 1200));
      console.log('✓ Zoomed into cluster on click');
    }

    console.log('\n===============================================================');
    console.log(' ALL 5 STAYS MAP VIEW CHECKS COMPLETED');
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
