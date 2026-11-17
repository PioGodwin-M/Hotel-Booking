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

async function capture() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Desktop 1920x1080
  console.log('Capturing Desktop 1920x1080 evidence...');
  await page.setViewport({ width: 1920, height: 1080 });

  // Home Desktop
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'home_full_desktop.png'),
    fullPage: true,
  });

  // Footer Desktop
  const footerEl = await page.$('footer');
  if (footerEl) {
    await footerEl.screenshot({
      path: path.join(SCREENSHOT_DIR, 'footer_desktop.png'),
    });
  }

  // About Desktop
  await page.goto(`${BASE_URL}/about`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'about_full_desktop.png'),
    fullPage: true,
  });

  // Mobile 390x844
  console.log('Capturing Mobile 390x844 evidence...');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  // Home Mobile
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'home_full_mobile_390.png'),
    fullPage: true,
  });

  // Footer Mobile
  const mobileFooterEl = await page.$('footer');
  if (mobileFooterEl) {
    await mobileFooterEl.screenshot({
      path: path.join(SCREENSHOT_DIR, 'footer_mobile_390.png'),
    });
  }

  // About Mobile
  await page.goto(`${BASE_URL}/about`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'about_full_mobile_390.png'),
    fullPage: true,
  });

  // Inspection of sections on Home
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
  const inspection = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h2')).map(h => h.innerText.trim());
    const sampleBadges = Array.from(document.querySelectorAll('span')).filter(s => s.innerText.trim() === 'Sample').length;
    const hasNewsletter = Boolean(document.querySelector('form input[aria-label*="Email address"]'));
    return {
      headings,
      sampleBadges,
      hasNewsletter,
    };
  });

  console.log('Home Page Section Inspection:', JSON.stringify(inspection, null, 2));

  await browser.close();
  console.log('Evidence capture complete! Files saved in:', SCREENSHOT_DIR);
}

capture().catch(err => {
  console.error('Capture error:', err);
  process.exit(1);
});
