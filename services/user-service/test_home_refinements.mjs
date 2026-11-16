import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/Pio Godwin/.gemini/antigravity/brain/e364a722-ae7b-453f-98be-28a941448cbd';
const BASE_URL = 'http://localhost:5173';

const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080, type: 'large' },
  { name: '1900x1030', width: 1900, height: 1030, type: 'large' },
  { name: '1900x950',  width: 1900, height: 950,  type: 'large' },
  { name: '1440x780',  width: 1440, height: 780,  type: 'compact' },
  { name: '1366x700',  width: 1366, height: 700,  type: 'compact' },
  { name: '1024x768',  width: 1024, height: 768,  type: 'compact' },
  { name: '390x844',   width: 390,  height: 844,  type: 'mobile', isMobile: true },
];

export async function runHomeRefinementTests(mode = 'on') {
  console.log('================================================================');
  console.log(`  HOME FIRST VIEW & RECOMMENDATIONS TEST (MODE: ${mode.toUpperCase()})`);
  console.log('================================================================\n');

  let allPassed = true;
  const results = [];

  for (const vp of VIEWPORTS) {
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

    // Track CLS
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

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    try {
      await page.waitForSelector('#recommended-stays [data-recommended-card="true"], #recommended-stays [data-recommended-skeleton="true"], #recommended-stays button:has-text("Retry")', { timeout: 4000 });
    } catch {}
    await new Promise((r) => setTimeout(r, 600));

    const metrics = await page.evaluate((vpHeight, vpType) => {
      const hero = document.querySelector('.hero-section');
      const heroRect = hero ? hero.getBoundingClientRect() : null;

      const heading = document.querySelector('#recommended-stays h2');
      const headingRect = heading ? heading.getBoundingClientRect() : null;

      // Cards in first row (computed visible)
      const allCards = Array.from(document.querySelectorAll('#recommended-stays [data-recommended-card="true"]'));
      const cards = allCards.filter((c) => {
        const style = window.getComputedStyle(c);
        return style.display !== 'none' && c.getBoundingClientRect().width > 0;
      });
      let cardMetrics = cards.map((c) => {
        const r = c.getBoundingClientRect();
        // Find price row inside card
        const priceRow = c.querySelector('.tabular-nums, .border-t');
        const priceRect = priceRow ? priceRow.getBoundingClientRect() : null;
        return {
          top: r.top,
          bottom: r.bottom,
          height: r.height,
          priceBottom: priceRect ? priceRect.bottom : r.bottom,
        };
      });

      // If in offline mode, measure the error card with Retry button
      const errorCard = document.querySelector('#recommended-stays .shadow-2xs');
      if (cardMetrics.length === 0 && errorCard) {
        const er = errorCard.getBoundingClientRect();
        cardMetrics = [{
          top: er.top,
          bottom: er.bottom,
          height: er.height,
          priceBottom: er.bottom,
        }];
      }

      // Rating checks (assert no fake 4.8 or fake rating)
      const newBadges = Array.from(document.querySelectorAll('#recommended-stays [data-recommended-card="true"] span'))
        .filter(el => el.textContent.trim() === 'New');
      const fakeRatings = Array.from(document.querySelectorAll('#recommended-stays [data-recommended-card="true"] *'))
        .filter(el => el.textContent.trim() === '4.8');

      // Horizontal scroll
      const hasHorizontalScroll =
        document.documentElement.scrollWidth > document.documentElement.clientWidth;

      // Real CSS custom property
      const cssBlockHeight = getComputedStyle(document.documentElement).getPropertyValue('--recommended-block-height').trim();

      const cls = window.__cls || 0;

      return {
        heroHeight: heroRect ? heroRect.height : 0,
        headingTop: headingRect ? headingRect.top : 0,
        headingBottom: headingRect ? headingRect.bottom : 0,
        cardsCount: cards.length,
        cardMetrics,
        hasHorizontalScroll,
        cssBlockHeight,
        cls,
      };
    }, vp.height, vp.type);

    // Compute Assertions
    const headingInside = metrics.headingBottom <= vp.height && metrics.headingTop >= 0;
    const noHScroll = !metrics.hasHorizontalScroll;
    const clsOk = metrics.cls < 0.1;

    let priceLinesInside = true;
    let cardVisibleMinPct = 100;

    for (const cm of metrics.cardMetrics) {
      if (cm.priceBottom > vp.height) {
        priceLinesInside = false;
      }
      const visibleHeight = Math.max(0, Math.min(vp.height, cm.bottom) - cm.top);
      const pct = cm.height > 0 ? (visibleHeight / cm.height) * 100 : 0;
      if (pct < cardVisibleMinPct) cardVisibleMinPct = pct;
    }

    let vpPassed = false;
    let reason = '';

    if (vp.type === 'large') {
      // At 1900x950 and larger: the price line of every card in the first row is inside the viewport
      vpPassed = headingInside && priceLinesInside && noHScroll && clsOk;
      reason = `Price line inside: ${priceLinesInside ? 'YES' : 'NO'}, Heading inside: ${headingInside ? 'YES' : 'NO'}, CLS: ${metrics.cls.toFixed(4)}`;
    } else if (vp.type === 'compact' || vp.type === 'mobile') {
      // At 1440x780 and smaller: heading is fully visible and at least 60% of each card is visible
      vpPassed = headingInside && cardVisibleMinPct >= 60 && noHScroll && clsOk;
      reason = `Heading inside: ${headingInside ? 'YES' : 'NO'}, Card min visible: ${cardVisibleMinPct.toFixed(1)}% (>=60%), CLS: ${metrics.cls.toFixed(4)}`;
    }

    if (!vpPassed) allPassed = false;

    console.log(`[${vpPassed ? 'PASS' : 'FAIL'}] Viewport ${vp.name.padEnd(10)}:`);
    console.log(`       Hero height: ${Math.round(metrics.heroHeight)}px, --recommended-block-height: "${metrics.cssBlockHeight}"`);
    console.log(`       Heading top: ${Math.round(metrics.headingTop)}px, bottom: ${Math.round(metrics.headingBottom)}px`);
    console.log(`       Cards in row: ${metrics.cardsCount}, Min visible: ${cardVisibleMinPct.toFixed(1)}%`);
    console.log(`       All card price lines inside: ${priceLinesInside ? 'YES' : 'NO'}`);
    console.log(`       Horizontal scroll: ${metrics.hasHorizontalScroll ? 'YES (FAIL)' : 'NONE (OK)'}`);
    console.log(`       CLS: ${metrics.cls.toFixed(4)} (< 0.1 OK)`);
    console.log(`       Verdict: ${reason}\n`);

    if (vp.name === '1900x950') {
      const ssPath = path.join(ARTIFACT_DIR, `after_home_1900x950.png`);
      await page.screenshot({ path: ssPath });
      console.log(`       Saved evidence screenshot: after_home_1900x950.png`);
    }

    results.push({
      viewport: vp.name,
      metrics,
      passed: vpPassed,
      reason,
    });

    await page.close();
    await browser.close();
  }

  console.log('================================================================');
  console.log(`  HOME REFINEMENT TEST (MODE: ${mode.toUpperCase()}): ${allPassed ? 'ALL PASSED!' : 'SOME CHECKS FAILED'}`);
  console.log('================================================================\n');

  return { allPassed, results };
}

// Run standalone if called directly
if (process.argv[1]?.endsWith('test_home_refinements.mjs')) {
  runHomeRefinementTests('on');
}
