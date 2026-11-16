import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/Pio Godwin/.gemini/antigravity/brain/e364a722-ae7b-453f-98be-28a941448cbd/polish';

async function captureExtras() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox'],
  });

  // 1. Mobile Drawer Logo
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  const menuBtn = await page.$('button[aria-label="Toggle navigation menu"]');
  if (menuBtn) {
    await menuBtn.click();
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: `${ARTIFACT_DIR}/logo_mobile_drawer.png` });
    console.log('Mobile drawer logo captured');
  }

  // 2. Owner Sidebar Logo
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:5173/owner?dev_owner=true', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: `${ARTIFACT_DIR}/logo_owner_sidebar.png` });
  console.log('Owner sidebar logo captured');

  // 3. DateRangePicker Open
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  const dateBtn = await page.$('button[aria-label="Select dates"]');
  if (dateBtn) {
    await dateBtn.click();
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: `${ARTIFACT_DIR}/hero_datepicker_open.png` });
    console.log('DatePicker open captured');
  }

  await browser.close();
}

captureExtras().catch(console.error);
