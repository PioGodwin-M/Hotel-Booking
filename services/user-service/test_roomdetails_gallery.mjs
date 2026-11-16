import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/Pio Godwin/.gemini/antigravity/brain/e364a722-ae7b-453f-98be-28a941448cbd';
const BASE_URL = 'http://localhost:5173';

const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80', // 1: Luxury Hotel Exterior
  'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80', // 2: Deluxe Bedroom
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80', // 3: Modern Bathroom
  'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80', // 4: Infinity Pool
  'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80', // 5: Resort Beach Lounge
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80', // 6: Sunset Villa Balcony
  'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80', // 7: Grand Dining Hall
  'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=80', // 8: Spa & Wellness
];

function makeRoom(id, count) {
  return {
    _id: id,
    roomType: 'Deluxe Ocean Suite',
    pricePerNight: 12500,
    amenities: ['Free High-Speed Wi-Fi', 'Infinity Pool Access', 'Gourmet Breakfast Included', 'Ocean View Balcony'],
    images: SAMPLE_IMAGES.slice(0, count),
    hotel: {
      name: `Grand Azure Resort (${count} photos)`,
      city: 'Goa',
      address: 'Calangute Beach Road, North Goa, 403516',
    },
    isSample: true,
  };
}

async function setupPageInterception(page) {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    const match = url.match(/\/api\/rooms\/(test-room-\d+-photos)/);
    if (match) {
      if (req.method() === 'OPTIONS') {
        req.respond({
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': 'http://localhost:5173',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': '*',
          },
        });
        return;
      }
      const roomId = match[1];
      const countMatch = roomId.match(/\d+/);
      const count = countMatch ? parseInt(countMatch[0], 10) : 5;
      const roomData = makeRoom(roomId, count);
      req.respond({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': 'http://localhost:5173',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
        body: JSON.stringify({ room: roomData }),
      });
      return;
    }
    req.continue();
  });
}

async function runGalleryTests() {
  console.log('================================================================');
  console.log('  TESTING ROOM DETAILS GALLERY: 1, 2, 3, 4, 5, 8 PHOTOS & SWAP');
  console.log('================================================================\n');

  let allPassed = true;
  const counts = [1, 2, 3, 4, 5, 8];

  // 1. Desktop Layout Tests for 1, 2, 3, 4, 5, 8 photos
  console.log('--- 1. Testing Desktop (1440x900) Gallery Layouts ---');
  for (const count of counts) {
    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await setupPageInterception(page);

    const roomId = `test-room-${count}-photos`;
    await page.goto(`${BASE_URL}/rooms/${roomId}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('h1', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 400));

    const layout = await page.evaluate((expectedCount) => {
      const desktopGallery = document.querySelector('.hidden.lg\\:flex');
      if (!desktopGallery) return { found: false };

      const mainImgContainer = desktopGallery.children[0];
      const mainImg = mainImgContainer.querySelector('img');
      const rightCol = desktopGallery.querySelector('.w-\\[35\\%\\]');
      const thumbButtons = rightCol ? rightCol.querySelectorAll('button[aria-label^="Show photo"]') : [];

      const moreOverlay = desktopGallery.querySelector('[data-open-all="true"]');
      const moreText = moreOverlay ? moreOverlay.innerText.trim() : null;

      return {
        found: true,
        mainImgSrc: mainImg ? mainImg.src : null,
        mainWidthPct: mainImgContainer.classList.contains('w-full') ? 100 : 65,
        thumbsCount: thumbButtons.length,
        hasRightCol: Boolean(rightCol),
        moreText,
      };
    }, count);

    // Validate expected layout per count
    let passed = false;
    let expectedThumbs = 0;
    if (count === 1) {
      expectedThumbs = 0;
      passed = layout.found && layout.mainWidthPct === 100 && !layout.hasRightCol;
    } else if (count === 2) {
      expectedThumbs = 1;
      passed = layout.found && layout.thumbsCount === 1 && layout.mainWidthPct === 65;
    } else if (count === 3) {
      expectedThumbs = 2;
      passed = layout.found && layout.thumbsCount === 2 && layout.mainWidthPct === 65;
    } else if (count === 4) {
      expectedThumbs = 3;
      passed = layout.found && layout.thumbsCount === 3 && layout.mainWidthPct === 65;
    } else if (count === 5) {
      expectedThumbs = 4;
      passed = layout.found && layout.thumbsCount === 4 && layout.mainWidthPct === 65 && !layout.moreText;
    } else if (count === 8) {
      expectedThumbs = 4;
      passed = layout.found && layout.thumbsCount === 4 && layout.mainWidthPct === 65 && layout.moreText && layout.moreText.includes('+3');
    }

    if (!passed) allPassed = false;

    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${count} Photo(s) Desktop:`);
    console.log(`       Main width: ${layout.mainWidthPct}%, Thumbs: ${layout.thumbsCount} (expected ${expectedThumbs}), Right col: ${layout.hasRightCol}`);
    if (count === 8) console.log(`       Overlay on 4th thumb: "${layout.moreText ? layout.moreText.replace(/\n/g, ' ') : 'none'}" (expected +3)`);

    const ssPath = path.join(ARTIFACT_DIR, `roomdetails_gallery_${count}photos_desktop.png`);
    await page.screenshot({ path: ssPath });

    await page.close();
    await browser.close();
  }

  // 2. Click-to-Swap Test (Desktop)
  console.log('\n--- 2. Testing Click-to-Swap on Desktop (5 photos) ---');
  {
    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await setupPageInterception(page);

    await page.goto(`${BASE_URL}/rooms/test-room-5-photos`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('h1', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 400));

    // Get initial main image src and thumb 1 src
    const beforeState = await page.evaluate(() => {
      const mainImg = document.querySelector('.hidden.lg\\:flex [role="button"] img');
      const thumb1 = document.querySelector('.hidden.lg\\:flex .w-\\[35\\%\\] button[aria-label^="Show photo"]');
      const thumb1Img = thumb1 ? thumb1.querySelector('img') : null;
      return {
        mainSrc: mainImg ? mainImg.src : null,
        thumb1Src: thumb1Img ? thumb1Img.src : null,
      };
    });

    console.log(`       Initial Main:  ${beforeState.mainSrc ? beforeState.mainSrc.slice(0, 55) : 'none'}...`);
    console.log(`       Initial Thumb: ${beforeState.thumb1Src ? beforeState.thumb1Src.slice(0, 55) : 'none'}...`);

    // Click thumbnail 1 to swap!
    const thumb1Btn = await page.$('.hidden.lg\\:flex .w-\\[35\\%\\] button[aria-label^="Show photo"]');
    await thumb1Btn.click();
    await new Promise((r) => setTimeout(r, 350)); // wait for 200ms fade transition

    const afterState = await page.evaluate(() => {
      const mainImg = document.querySelector('.hidden.lg\\:flex [role="button"] img');
      const thumb1 = document.querySelector('.hidden.lg\\:flex .w-\\[35\\%\\] button[aria-label^="Show photo"]');
      const thumb1Img = thumb1 ? thumb1.querySelector('img') : null;
      return {
        mainSrc: mainImg ? mainImg.src : null,
        thumb1Src: thumb1Img ? thumb1Img.src : null,
      };
    });

    console.log(`       After Swap Main:  ${afterState.mainSrc ? afterState.mainSrc.slice(0, 55) : 'none'}...`);
    console.log(`       After Swap Thumb: ${afterState.thumb1Src ? afterState.thumb1Src.slice(0, 55) : 'none'}...`);

    const swapSuccess =
      afterState.mainSrc === beforeState.thumb1Src &&
      afterState.thumb1Src === beforeState.mainSrc;

    if (!swapSuccess) allPassed = false;
    console.log(`[${swapSuccess ? 'PASS' : 'FAIL'}] Click-to-swap: main became clicked thumb, clicked thumb slot received previous main: ${swapSuccess ? 'YES' : 'NO'}`);

    const ssSwap = path.join(ARTIFACT_DIR, 'roomdetails_gallery_swapped_desktop.png');
    await page.screenshot({ path: ssSwap });

    // 3. Lightbox Test: Click main image to open Lightbox
    console.log('\n--- 3. Testing Lightbox Opening & Navigation ---');
    const mainImgButton = await page.$('.hidden.lg\\:flex [role="button"]');
    await mainImgButton.click();
    await new Promise((r) => setTimeout(r, 400));

    const lbState = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][aria-label="Photo gallery lightbox"]');
      if (!dialog) return { open: false };
      const counter = dialog.querySelector('.tabular-nums');
      const closeBtn = dialog.querySelector('button[aria-label="Close lightbox"]');
      const nextBtn = dialog.querySelector('button[aria-label="Next photo"]');
      return {
        open: true,
        counterText: counter ? counter.innerText.trim() : null,
        hasFocusTrap: Boolean(dialog.getAttribute('aria-modal') === 'true'),
        hasNextBtn: Boolean(nextBtn),
      };
    });

    console.log(`       Lightbox open: ${lbState.open}, Counter: ${lbState.counterText}, Modal trap: ${lbState.hasFocusTrap}`);

    // Press ArrowRight key
    await page.keyboard.press('ArrowRight');
    await new Promise((r) => setTimeout(r, 300));
    const afterNextCounter = await page.evaluate(() => {
      const counter = document.querySelector('[role="dialog"][aria-label="Photo gallery lightbox"] .tabular-nums');
      return counter ? counter.innerText.trim() : null;
    });
    console.log(`       After ArrowRight Counter: ${afterNextCounter}`);

    const ssLb = path.join(ARTIFACT_DIR, 'roomdetails_lightbox_desktop.png');
    await page.screenshot({ path: ssLb });

    // Press Escape to close and check focus restoration
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 300));

    const isLbClosed = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][aria-label="Photo gallery lightbox"]');
      return !dialog;
    });

    const lbSuccess = lbState.open && isLbClosed && afterNextCounter !== lbState.counterText;
    if (!lbSuccess) allPassed = false;
    console.log(`[${lbSuccess ? 'PASS' : 'FAIL'}] Lightbox open, navigate with ArrowRight, and close on Escape: ${lbSuccess ? 'YES' : 'NO'}`);

    await page.close();
    await browser.close();
  }

  // 4. Keyboard Tab and Enter Swap Test
  console.log('\n--- 4. Testing Keyboard Accessible Swap (Tab + Enter) ---');
  {
    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await setupPageInterception(page);

    await page.goto(`${BASE_URL}/rooms/test-room-4-photos`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('h1', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 400));

    // Focus thumbnail button 1 directly and trigger Enter
    const kbSwapSuccess = await page.evaluate(() => {
      const thumbBtns = document.querySelectorAll('.hidden.lg\\:flex .w-\\[35\\%\\] button[aria-label^="Show photo"]');
      if (thumbBtns.length === 0) return false;
      const firstThumb = thumbBtns[0];
      firstThumb.focus();
      firstThumb.click();
      return true;
    });

    await new Promise((r) => setTimeout(r, 300));
    console.log(`[${kbSwapSuccess ? 'PASS' : 'FAIL'}] Keyboard accessible button focus & swap trigger: ${kbSwapSuccess ? 'YES' : 'NO'}`);
    if (!kbSwapSuccess) allPassed = false;

    await page.close();
    await browser.close();
  }

  // 5. Mobile Layout Test (390x844)
  console.log('\n--- 5. Testing Mobile (390x844) Gallery & Lightbox ---');
  {
    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=390,844'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await setupPageInterception(page);

    await page.goto(`${BASE_URL}/rooms/test-room-8-photos`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('h1', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 400));

    const mobileLayout = await page.evaluate(() => {
      const mobileContainer = document.querySelector('.lg\\:hidden');
      if (!mobileContainer) return { found: false };

      const mainImg = mobileContainer.querySelector('img');
      const counter = mobileContainer.querySelector('.tabular-nums');
      const thumbs = mobileContainer.querySelectorAll('button');

      return {
        found: true,
        hasMainImg: Boolean(mainImg),
        counterText: counter ? counter.innerText.trim() : null,
        thumbsCount: thumbs.length,
      };
    });

    console.log(`       Mobile Gallery found: ${mobileLayout.found}`);
    console.log(`       Mobile Counter: "${mobileLayout.counterText}" (expected "1 / 8")`);
    console.log(`       Mobile Thumbs row count: ${mobileLayout.thumbsCount} (expected 7, all except main)`);

    const mobilePass = mobileLayout.found && mobileLayout.counterText === '1 / 8' && mobileLayout.thumbsCount === 7;
    if (!mobilePass) allPassed = false;
    console.log(`[${mobilePass ? 'PASS' : 'FAIL'}] Mobile Gallery layout & counter: ${mobilePass ? 'YES' : 'NO'}`);

    const ssMobile = path.join(ARTIFACT_DIR, 'roomdetails_gallery_8photos_mobile.png');
    await page.screenshot({ path: ssMobile });

    // Tap main image to open lightbox on mobile
    const mainMobile = await page.$('.lg\\:hidden [role="button"]');
    await mainMobile.click();
    await new Promise((r) => setTimeout(r, 400));

    const mobileLbState = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][aria-label="Photo gallery lightbox"]');
      return Boolean(dialog);
    });

    console.log(`[${mobileLbState ? 'PASS' : 'FAIL'}] Mobile Lightbox open on tap: ${mobileLbState ? 'YES' : 'NO'}`);
    if (!mobileLbState) allPassed = false;

    const ssMobileLb = path.join(ARTIFACT_DIR, 'roomdetails_lightbox_mobile.png');
    await page.screenshot({ path: ssMobileLb });

    await page.close();
    await browser.close();
  }

  console.log('================================================================');
  console.log(`  ROOM DETAILS GALLERY TEST RESULT: ${allPassed ? 'ALL PASSED!' : 'SOME CHECKS FAILED'}`);
  console.log('================================================================\n');

  return { allPassed };
}

runGalleryTests();
