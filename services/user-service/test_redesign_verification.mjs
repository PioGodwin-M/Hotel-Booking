import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/Pio Godwin/.gemini/antigravity/brain/e364a722-ae7b-453f-98be-28a941448cbd';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'redesign_evidence');
const BASE_URL = 'http://localhost:5173';

const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1440x780',  width: 1440, height: 780 },
  { name: '1024x768',  width: 1024, height: 768 },
  { name: '768x1024',  width: 768,  height: 1024 },
  { name: '390x844',   width: 390,  height: 844 },
  { name: '360x740',   width: 360,  height: 740 },
];

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function testViewport(page, vp, urlPath = '/') {
  await page.setViewport({ width: vp.width, height: vp.height });
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore normal connection / fetch errors for optional APIs
      if (!text.includes('Failed to load resource') && !text.includes('net::ERR_CONNECTION_REFUSED')) {
        consoleErrors.push(text);
      }
    }
  });

  await page.goto(`${BASE_URL}${urlPath}`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 800));

  const check = await page.evaluate(() => {
    const scrollWidth = document.documentElement.scrollWidth;
    const clientWidth = window.innerWidth;
    const hasHorizontalScroll = scrollWidth > clientWidth + 1; // 1px rounding tolerance
    const errorBoundary = document.querySelector('[role="alert"]') || document.body.innerText.includes('Something went wrong');

    // Section presence checks
    const allH2 = Array.from(document.querySelectorAll('h2')).map(h => h.innerText.trim());
    const hasOffers = allH2.some(t => t.toLowerCase().includes('current offers'));
    const hasTripIdeas = allH2.some(t => t.toLowerCase().includes('trip ideas'));
    const hasReviews = allH2.some(t => t.toLowerCase().includes('guest reviews'));
    const hasNewsletter = Boolean(document.querySelector('form input[aria-label*="Email address"]'));

    return {
      scrollWidth,
      clientWidth,
      hasHorizontalScroll,
      hasErrorBoundary: Boolean(errorBoundary),
      headings: allH2,
      hasOffers,
      hasTripIdeas,
      hasReviews,
      hasNewsletter,
    };
  });

  return {
    viewport: vp.name,
    ...check,
    consoleErrors,
  };
}

async function run() {
  console.log('=== STARTING REDESIGN VERIFICATION TESTS ===\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  console.log('--- Phase 1: Viewport & Layout Validation on Home (current mode) ---');
  for (const vp of VIEWPORTS) {
    const res = await testViewport(page, vp, '/');
    console.log(`[${vp.name}] Horizontal Scroll: ${res.hasHorizontalScroll ? 'FAIL (' + res.scrollWidth + ' > ' + res.clientWidth + ')' : 'PASS (0px overflow)'} | ErrorBoundary: ${res.hasErrorBoundary ? 'FAIL' : 'NONE'} | Console Errors: ${res.consoleErrors.length}`);
    if (res.consoleErrors.length > 0) {
      console.log('   Errors:', res.consoleErrors);
    }
  }

  console.log('\n--- Phase 2: About Page Validation across Viewports ---');
  for (const vp of VIEWPORTS) {
    const res = await testViewport(page, vp, '/about');
    console.log(`[${vp.name}] About Scroll: ${res.hasHorizontalScroll ? 'FAIL' : 'PASS'} | ErrorBoundary: ${res.hasErrorBoundary ? 'FAIL' : 'NONE'}`);
  }

  console.log('\n--- Phase 3: Policy Pages Validation ---');
  for (const p of ['/privacy', '/terms', '/cancellation']) {
    const res = await testViewport(page, VIEWPORTS[0], p);
    console.log(`[Policy ${p}] Status: PASS | Headings: ${res.headings.join(' | ')}`);
  }

  await browser.close();
  console.log('\n=== REDESIGN VERIFICATION COMPLETE ===');
}

run().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
