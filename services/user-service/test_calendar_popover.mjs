import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/Pio Godwin/.gemini/antigravity/brain/e364a722-ae7b-453f-98be-28a941448cbd';
const BASE_URL = 'http://localhost:5173';

const CAL_VIEWPORTS = [
  { name: '1900x950',  width: 1900, height: 950,  mode: 'desktop' },
  { name: '1440x780',  width: 1440, height: 780,  mode: 'desktop' },
  { name: '1024x768',  width: 1024, height: 768,  mode: 'desktop' },
  { name: '768x1024',  width: 768,  height: 1024, mode: 'tablet' },
  { name: '390x844',   width: 390,  height: 844,  mode: 'mobile', isMobile: true },
];

function rectsIntersect(r1, r2) {
  if (!r1 || !r2) return false;
  return !(
    r2.left >= r1.right ||
    r2.right <= r1.left ||
    r2.top >= r1.bottom ||
    r2.bottom <= r1.top
  );
}

export async function runCalendarPopoverTests() {
  console.log('================================================================');
  console.log('  TESTING COMPACT CALENDAR POPOVER & ANCHORING');
  console.log('================================================================\n');

  let allPassed = true;
  const results = [];

  for (const vp of CAL_VIEWPORTS) {
    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', `--window-size=${vp.width},${vp.height}`],
    });

    const page = await browser.newPage();
    await page.setViewport({
      width: vp.width,
      height: vp.height,
      isMobile: Boolean(vp.isMobile),
      hasTouch: Boolean(vp.isMobile),
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('button[aria-label="Select dates"]', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 400));

    // Open calendar picker
    const trigger = await page.$('button[aria-label="Select dates"]');
    await trigger.click();
    await new Promise((r) => setTimeout(r, 350));

    const metrics = await page.evaluate((vpWidth, vpHeight, vpMode) => {
      // Find popover dialog
      const dialog = document.querySelector('[role="dialog"][aria-label="Select dates"]');
      if (!dialog) return { found: false };

      const popoverRect = dialog.getBoundingClientRect();

      // Navbar rect
      const navbar = document.querySelector('header, nav, [role="navigation"]') || document.querySelector('.navbar, header');
      const navbarEl = document.querySelector('header') || document.querySelector('.max-w-7xl.mx-auto')?.parentElement;
      const navRect = navbarEl ? navbarEl.getBoundingClientRect() : null;

      // Search bar elements
      const triggerBtn = document.querySelector('button[aria-label="Select dates"]');
      const triggerRect = triggerBtn ? triggerBtn.getBoundingClientRect() : null;

      const searchBtn = document.querySelector('button[type="submit"]') || document.querySelector('form button:has-text("Search")');
      const searchBtnRect = searchBtn ? searchBtn.getBoundingClientRect() : null;

      // Month titles
      const monthTitles = Array.from(dialog.querySelectorAll('h3')).map(h => h.innerText.trim());

      // Sample day aria-label
      const dayBtn = dialog.querySelector('button[data-date]');
      const dayAriaLabel = dayBtn ? dayBtn.getAttribute('aria-label') : null;
      const dayRect = dayBtn ? dayBtn.getBoundingClientRect() : null;

      return {
        found: true,
        popover: {
          top: popoverRect.top,
          bottom: popoverRect.bottom,
          left: popoverRect.left,
          right: popoverRect.right,
          width: popoverRect.width,
          height: popoverRect.height,
        },
        navRect: navRect ? { top: navRect.top, bottom: navRect.bottom, left: navRect.left, right: navRect.right } : null,
        triggerRect: triggerRect ? { top: triggerRect.top, bottom: triggerRect.bottom, left: triggerRect.left, right: triggerRect.right } : null,
        searchBtnRect: searchBtnRect ? { top: searchBtnRect.top, bottom: searchBtnRect.bottom, left: searchBtnRect.left, right: searchBtnRect.right } : null,
        monthTitles,
        dayAriaLabel,
        dayCellSize: dayRect ? { width: Math.round(dayRect.width), height: Math.round(dayRect.height) } : null,
      };
    }, vp.width, vp.height, vp.mode);

    if (!metrics.found) {
      console.log(`[FAIL] Viewport ${vp.name}: Calendar popover not found!`);
      allPassed = false;
      await browser.close();
      continue;
    }

    const p = metrics.popover;

    // Assertions
    const fullyInsideViewport = p.top >= 0 && p.bottom <= vp.height && p.left >= 0 && p.right <= vp.width;
    const widthUnder700 = vp.mode === 'desktop' ? p.width <= 700 : true;

    // Collision checks:
    // Popover must NOT intersect navbar on any viewport
    const intersectsNavbar = rectsIntersect(p, metrics.navRect);

    // On desktop and tablet, anchored popover must NOT intersect Dates field or Search button
    const intersectsDatesField = vp.mode !== 'mobile' ? rectsIntersect(p, metrics.triggerRect) : false;
    const intersectsSearchBtn = vp.mode !== 'mobile' ? rectsIntersect(p, metrics.searchBtnRect) : false;

    // On mobile, assert 44px day cells for touch targets
    const touchTargetOk = vp.mode === 'mobile' ? (metrics.dayCellSize?.width >= 44 && metrics.dayCellSize?.height >= 44) : true;

    const noBadOverlap = !intersectsNavbar && !intersectsDatesField && !intersectsSearchBtn && touchTargetOk;

    let vpPassed = fullyInsideViewport && widthUnder700 && noBadOverlap;

    if (!vpPassed) allPassed = false;

    console.log(`[${vpPassed ? 'PASS' : 'FAIL'}] Calendar Popover @ ${vp.name.padEnd(10)}:`);
    console.log(`       Popover bounds: top=${Math.round(p.top)}px, bottom=${Math.round(p.bottom)}px, width=${Math.round(p.width)}px, height=${Math.round(p.height)}px`);
    console.log(`       Inside viewport: ${fullyInsideViewport ? 'YES' : 'NO'}`);
    console.log(`       Width <= 700px (desktop): ${widthUnder700 ? 'YES' : 'NO'} (${Math.round(p.width)}px)`);
    console.log(`       Intersects navbar: ${intersectsNavbar ? 'YES (FAIL)' : 'NONE (OK)'}`);
    console.log(`       Intersects Dates field: ${intersectsDatesField ? 'YES (FAIL)' : 'NONE (OK)'}`);
    console.log(`       Intersects Search button: ${intersectsSearchBtn ? 'YES (FAIL)' : 'NONE (OK)'}`);
    console.log(`       Month titles: [${metrics.monthTitles.join(', ')}]`);
    console.log(`       Sample day aria-label: "${metrics.dayAriaLabel}"`);
    console.log(`       Day cell size: ${metrics.dayCellSize?.width}x${metrics.dayCellSize?.height}px\n`);

    // Screenshot
    const ssPath = path.join(ARTIFACT_DIR, `calendar_popover_${vp.name}.png`);
    await page.screenshot({ path: ssPath });

    // Test Esc key closes popover and returns focus to Dates field
    if (vp.name === '1900x950') {
      console.log('       Testing Esc key and focus restoration...');
      await page.keyboard.press('Escape');
      await new Promise((r) => setTimeout(r, 200));

      const isClosed = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"][aria-label="Select dates"]');
        const trigger = document.querySelector('button[aria-label="Select dates"]');
        return {
          closed: !dialog,
          focusRestored: document.activeElement === trigger,
        };
      });

      console.log(`       Popover closed on Esc: ${isClosed.closed ? 'YES' : 'NO'}`);
      console.log(`       Focus restored to trigger: ${isClosed.focusRestored ? 'YES' : 'NO'}\n`);
      if (!isClosed.closed) allPassed = false;
    }

    results.push({
      viewport: vp.name,
      metrics,
      passed: vpPassed,
    });

    await page.close();
    await browser.close();
  }

  console.log('================================================================');
  console.log(`  CALENDAR POPOVER TEST RESULT: ${allPassed ? 'ALL PASSED!' : 'SOME CHECKS FAILED'}`);
  console.log('================================================================\n');

  return { allPassed, results };
}

if (process.argv[1]?.endsWith('test_calendar_popover.mjs')) {
  runCalendarPopoverTests();
}
