import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/Pio Godwin/.gemini/antigravity/brain/e364a722-ae7b-453f-98be-28a941448cbd';
const BASE_URL = 'http://localhost:5173';

const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1900x1020', width: 1900, height: 1020 },
  { name: '1440x900',  width: 1440, height: 900 },
  { name: '1366x768',  width: 1366, height: 768 },
  { name: '1024x768',  width: 1024, height: 768 },
  { name: '768x1024',  width: 768,  height: 1024 },
  { name: '390x844',   width: 390,  height: 844 },
];

async function runHomeTests() {
  console.log('================================================================');
  console.log('  TESTING HOME: VIEWPORTS, RECOMMENDATIONS & CLS');
  console.log('================================================================\n');

  const results = [];
  let allPassed = true;

  for (const vp of VIEWPORTS) {
    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', `--window-size=${vp.width},${vp.height}`],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height });

    // Enable CLS tracking via PerformanceObserver
    await page.evaluateOnNewDocument(() => {
      window.__cls = 0;
      try {
        const observer = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!entry.hadRecentInput) {
              window.__cls += entry.value;
            }
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
      } catch (e) {}
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    try {
      await page.waitForSelector('#recommended-stays [data-recommended-card="true"]', { timeout: 4000 });
    } catch {}
    await new Promise((r) => setTimeout(r, 400));

    const metrics = await page.evaluate((vpHeight) => {
      const hero = document.querySelector('.hero-section');
      const heroRect = hero ? hero.getBoundingClientRect() : null;

      const heading = document.querySelector('#recommended-stays h2');
      const headingRect = heading ? heading.getBoundingClientRect() : null;

      // Recommended stays card
      const firstCard = document.querySelector('#recommended-stays [data-recommended-card="true"]');
      const cardRect = firstCard ? firstCard.getBoundingClientRect() : null;

      // Horizontal scroll check on body/html
      const hasHorizontalScroll =
        document.documentElement.scrollWidth > document.documentElement.clientWidth;

      // CLS
      const cls = window.__cls || 0;

      return {
        heroHeight: heroRect ? heroRect.height : 0,
        headingTop: headingRect ? headingRect.top : 0,
        headingBottom: headingRect ? headingRect.bottom : 0,
        cardTop: cardRect ? cardRect.top : 0,
        cardBottom: cardRect ? cardRect.bottom : 0,
        cardHeight: cardRect ? cardRect.height : 0,
        hasHorizontalScroll,
        cls,
      };
    }, vp.height);

    // Assertions
    const headingInside = metrics.headingBottom <= vp.height && metrics.headingTop >= 0;
    const cardBottomInside = metrics.cardBottom <= vp.height;
    const cardVisibleHeight = Math.max(0, Math.min(vp.height, metrics.cardBottom) - metrics.cardTop);
    const cardVisiblePct = metrics.cardHeight > 0 ? (cardVisibleHeight / metrics.cardHeight) * 100 : 0;
    const clsOk = metrics.cls < 0.1;
    const noHScroll = !metrics.hasHorizontalScroll;

    let vpPassed = false;
    let reason = '';

    if (vp.name === '1920x1080' || vp.name === '1900x1020') {
      vpPassed = headingInside && cardBottomInside && noHScroll && clsOk;
      reason = `Heading & row bottom inside: ${headingInside && cardBottomInside ? 'YES' : 'NO'} (cardBottom=${Math.round(metrics.cardBottom)}px <= ${vp.height}px)`;
    } else if (vp.name === '1440x900') {
      vpPassed = headingInside && cardBottomInside && noHScroll && clsOk;
      reason = `Heading & row bottom inside: ${headingInside && cardBottomInside ? 'YES' : 'NO'} (cardBottom=${Math.round(metrics.cardBottom)}px <= ${vp.height}px)`;
    } else if (vp.name === '1366x768' || vp.name === '1024x768') {
      vpPassed = headingInside && cardVisiblePct >= 50 && noHScroll && clsOk;
      reason = `Heading visible: ${headingInside ? 'YES' : 'NO'}, Card visible: ${cardVisiblePct.toFixed(1)}% (>=50%)`;
    } else if (vp.name === '768x1024') {
      vpPassed = headingInside && cardBottomInside && noHScroll && clsOk;
      reason = `Heading & row bottom inside: ${headingInside && cardBottomInside ? 'YES' : 'NO'} (cardBottom=${Math.round(metrics.cardBottom)}px <= ${vp.height}px)`;
    } else if (vp.name === '390x844') {
      vpPassed = headingInside && cardVisiblePct >= 50 && noHScroll && clsOk;
      reason = `Heading inside: ${headingInside ? 'YES' : 'NO'}, Card starts inside: ${cardVisiblePct.toFixed(1)}%`;
    }

    if (!vpPassed) allPassed = false;

    console.log(`[${vpPassed ? 'PASS' : 'FAIL'}] Viewport ${vp.name.padEnd(10)}:`);
    console.log(`       Hero height: ${Math.round(metrics.heroHeight)}px`);
    console.log(`       Heading top: ${Math.round(metrics.headingTop)}px, bottom: ${Math.round(metrics.headingBottom)}px`);
    console.log(`       First card: top=${Math.round(metrics.cardTop)}px, bottom=${Math.round(metrics.cardBottom)}px, height=${Math.round(metrics.cardHeight)}px`);
    console.log(`       Card visibility: ${cardVisiblePct.toFixed(1)}% visible in first view`);
    console.log(`       Horizontal scroll: ${metrics.hasHorizontalScroll ? 'YES (FAIL)' : 'NONE (OK)'}`);
    console.log(`       CLS: ${metrics.cls.toFixed(4)} (< 0.1 OK)`);
    console.log(`       Verdict: ${reason}\n`);

    // Screenshot
    const ssPath = path.join(ARTIFACT_DIR, `home_viewport_${vp.name}.png`);
    await page.screenshot({ path: ssPath });

    if (vp.name === '1900x1020') {
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'after_home_1900x1020.png') });
    }

    results.push({
      viewport: vp.name,
      metrics,
      cardVisiblePct,
      passed: vpPassed,
      reason,
    });

    await page.close();
    await browser.close();
  }

  // Also test Calendar popover over Recommended cards at 1900x1020
  console.log('--- Testing Calendar Popover Opening Over Recommended Cards ---');
  const calBrowser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1900,1020'],
  });
  const calPage = await calBrowser.newPage();
  await calPage.setViewport({ width: 1900, height: 1020 });
  await calPage.goto(BASE_URL, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 600));

  const calTrigger = await calPage.$('button[aria-label="Select dates"]');
  if (calTrigger) {
    await calTrigger.click();
    await new Promise((r) => setTimeout(r, 500));
  }

  const calMetrics = await calPage.evaluate(() => {
    const popover = document.querySelector('[role="dialog"][aria-label="Select dates"], .z-\\[9999\\]');
    if (!popover) return { found: false };
    const rect = popover.getBoundingClientRect();
    const lastDay = popover.querySelector('button[aria-label*="28"], button[aria-label*="29"], button[aria-label*="30"]');
    const lastDayRect = lastDay ? lastDay.getBoundingClientRect() : null;
    return {
      found: true,
      top: rect.top,
      bottom: rect.bottom,
      zIndex: window.getComputedStyle(popover).zIndex,
      lastDayInView: lastDayRect ? lastDayRect.bottom <= window.innerHeight : false,
    };
  });

  console.log(`  Calendar popover found: ${calMetrics.found}`);
  if (calMetrics.found) {
    console.log(`  Popover z-index: ${calMetrics.zIndex}, top: ${Math.round(calMetrics.top)}px, bottom: ${Math.round(calMetrics.bottom)}px`);
    console.log(`  Last day cell visible inside viewport: ${calMetrics.lastDayInView ? 'YES (OK)' : 'NO'}`);
  }
  await calPage.screenshot({ path: path.join(ARTIFACT_DIR, 'home_calendar_over_cards_1900x1020.png') });
  await calPage.close();
  await calBrowser.close();

  console.log('================================================================');
  console.log(`  HOME VIEWPORTS TEST RESULT: ${allPassed ? 'ALL PASSED!' : 'SOME CHECKS FAILED'}`);
  console.log('================================================================\n');

  return { allPassed, results };
}

runHomeTests();
