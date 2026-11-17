import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/Pio Godwin/.gemini/antigravity/brain/e364a722-ae7b-453f-98be-28a941448cbd/screenshots_before';
const BASE_URL = 'http://localhost:5173';

if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: '360x740', width: 360, height: 740, isMobile: true },
  { name: '390x844', width: 390, height: 844, isMobile: true },
  { name: '414x896', width: 414, height: 896, isMobile: true },
  { name: '768x1024', width: 768, height: 1024, isMobile: false },
  { name: '844x390', width: 844, height: 390, isMobile: true },
  { name: '1900x950', width: 1900, height: 950, isMobile: false },
];

async function capture() {
  console.log('Capturing before screenshots...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  for (const vp of VIEWPORTS) {
    await page.setViewport({
      width: vp.width,
      height: vp.height,
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
    });

    // Home
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `home_${vp.name}.png`), fullPage: false });
    console.log(`Saved home_${vp.name}.png`);
  }

  // Stays & About & Room Details at 390x844
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  await page.goto(`${BASE_URL}/rooms`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, `stays_390x844.png`), fullPage: false });
  console.log(`Saved stays_390x844.png`);

  await page.goto(`${BASE_URL}/about`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, `about_390x844.png`), fullPage: false });
  console.log(`Saved about_390x844.png`);

  await browser.close();
  console.log('Finished capturing before screenshots.');
}

capture().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
