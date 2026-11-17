import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/Pio Godwin/.gemini/antigravity/brain/e364a722-ae7b-453f-98be-28a941448cbd';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'redesign_evidence');
const BASE_URL = 'http://localhost:5173';

async function testBackendOffline() {
  console.log('Testing with backend network blocked (API requests aborted)...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setRequestInterception(true);

  page.on('request', req => {
    const url = req.url();
    // Block API calls to backend ports 4000-4005
    if (url.includes(':4000') || url.includes(':4002') || url.includes('/api/')) {
      req.abort('connectionfailed');
    } else {
      req.continue();
    }
  });

  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1200));

  const inspection = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h2')).map(h => h.innerText.trim());
    const errorBoundary = Boolean(document.querySelector('[role="alert"]') || document.body.innerText.includes('Something went wrong'));
    const isServerBanner = Boolean(document.body.innerText.includes("We can't reach the server"));
    const scrollWidth = document.documentElement.scrollWidth;
    const clientWidth = window.innerWidth;

    return {
      headings,
      errorBoundary,
      isServerBanner,
      horizontalOverflow: scrollWidth > clientWidth,
    };
  });

  console.log('Backend Offline Result:', JSON.stringify(inspection, null, 2));

  // Save screenshot of graceful degradation
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'backend_offline_graceful_home.png'),
    fullPage: true,
  });

  await browser.close();
}

testBackendOffline().catch(err => {
  console.error('Offline test error:', err);
  process.exit(1);
});
