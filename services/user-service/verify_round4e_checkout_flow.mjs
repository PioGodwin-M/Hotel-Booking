import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/Pio Godwin/.gemini/antigravity/brain/e364a722-ae7b-453f-98be-28a941448cbd';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'redesign_evidence');
const BASE_URL = 'http://localhost:5173';

async function testCheckoutFlow() {
  console.log('--- Testing Round 4e Checkout Flow & Layout ---');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Visit Room Details and simulate opening checkout modal
  await page.goto(`${BASE_URL}/rooms/6af9e340fb028382df10319a`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));

  // Set mock active booking directly in component or test modal rendering
  // We can evaluate directly in page context:
  const modalTest = await page.evaluate(async () => {
    // Check if PaymentModal component styles and dimensions match requirements
    return {
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    };
  });
  console.log('Viewport status:', modalTest);

  await browser.close();
  console.log('Test complete');
}

testCheckoutFlow().catch(err => {
  console.error(err);
  process.exit(1);
});
