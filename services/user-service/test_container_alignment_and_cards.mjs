import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/Pio Godwin/.gemini/antigravity/brain/e364a722-ae7b-453f-98be-28a941448cbd';
const BASE_URL = 'http://localhost:5173';

const ALIGNMENT_VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1440x900',  width: 1440, height: 900 },
  { name: '1024x768',  width: 1024, height: 768 },
];

const CARD_VIEWPORTS = [
  { name: '1917x1032', width: 1917, height: 1032, mustFitPrice: true },
  { name: '1900x950',  width: 1900, height: 950,  mustFitPrice: true },
  { name: '1440x780',  width: 1440, height: 780,  mustFitPrice: false },
];

async function runAlignmentAndCardTests() {
  console.log('================================================================');
  console.log('  SECTION D: ONE SHARED CONTAINER & ALIGNMENT VERIFICATION');
  console.log('================================================================\n');

  let allAlignmentPassed = true;

  for (const vp of ALIGNMENT_VIEWPORTS) {
    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', `--window-size=${vp.width},${vp.height}`],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 600));

    const measurements = await page.evaluate(() => {
      // 1. Logo
      const logoEl = document.querySelector('header a');
      const logoRect = logoEl ? logoEl.getBoundingClientRect() : null;

      // 2. Headline
      const h1El = document.querySelector('h1');
      const h1Rect = h1El ? h1El.getBoundingClientRect() : null;

      // 3. Subtitle
      const subEl = document.querySelector('h1 + p') || document.querySelector('section.hero-section p');
      const subRect = subEl ? subEl.getBoundingClientRect() : null;

      // 4. Search bar
      const searchEl = document.querySelector('form');
      const searchRect = searchEl ? searchEl.getBoundingClientRect() : null;

      // 5. Section Heading: Recommended stays
      const h2El = document.querySelector('#recommended-stays h2');
      const h2Rect = h2El ? h2El.getBoundingClientRect() : null;

      // 6. First Card
      const firstCardEl = document.querySelector('[data-recommended-card="true"]') ||
                          document.querySelector('#recommended-stays a[href^="/rooms/"]');
      const firstCardRect = firstCardEl ? firstCardEl.getBoundingClientRect() : null;

      // RIGHT EDGES:
      // A. Navbar right actions (Owner dashboard / User button / Sign in)
      const navRightContainer = document.querySelector('header .page-container > div:last-child');
      const navRightRect = navRightContainer ? navRightContainer.getBoundingClientRect() : null;

      // B. "View all stays" link
      const viewAllEl = document.querySelector('#recommended-stays a[href="/rooms"]');
      const viewAllRect = viewAllEl ? viewAllEl.getBoundingClientRect() : null;

      // C. Last Card (4th card)
      const allCards = document.querySelectorAll('[data-recommended-card="true"]');
      const lastCardEl = allCards.length >= 4 ? allCards[3] : (allCards[allCards.length - 1] || null);
      const lastCardRect = lastCardEl ? lastCardEl.getBoundingClientRect() : null;

      return {
        logo: logoRect ? { x: Math.round(logoRect.left * 10) / 10, right: Math.round(logoRect.right * 10) / 10 } : null,
        headline: h1Rect ? { x: Math.round(h1Rect.left * 10) / 10 } : null,
        subtitle: subRect ? { x: Math.round(subRect.left * 10) / 10 } : null,
        searchBar: searchRect ? { x: Math.round(searchRect.left * 10) / 10 } : null,
        sectionHeading: h2Rect ? { x: Math.round(h2Rect.left * 10) / 10 } : null,
        firstCard: firstCardRect ? { x: Math.round(firstCardRect.left * 10) / 10 } : null,
        navRight: navRightRect ? { right: Math.round(navRightRect.right * 10) / 10 } : null,
        viewAllStays: viewAllRect ? { right: Math.round(viewAllRect.right * 10) / 10 } : null,
        lastCard: lastCardRect ? { right: Math.round(lastCardRect.right * 10) / 10 } : null,
      };
    });

    const leftEdges = [
      { name: 'Logo', x: measurements.logo?.x },
      { name: 'Headline', x: measurements.headline?.x },
      { name: 'Subtitle', x: measurements.subtitle?.x },
      { name: 'Search bar', x: measurements.searchBar?.x },
      { name: 'Section Heading', x: measurements.sectionHeading?.x },
      { name: 'First Card', x: measurements.firstCard?.x },
    ];

    const rightEdges = [
      { name: 'Navbar Right Actions', right: measurements.navRight?.right },
      { name: 'View all stays link', right: measurements.viewAllStays?.right },
      { name: 'Last Card (4th)', right: measurements.lastCard?.right },
    ];

    const leftXValues = leftEdges.map(e => e.x).filter(x => typeof x === 'number');
    const minLeft = Math.min(...leftXValues);
    const maxLeft = Math.max(...leftXValues);
    const leftDiff = Math.abs(maxLeft - minLeft);

    const rightXValues = rightEdges.map(e => e.right).filter(r => typeof r === 'number');
    const minRight = Math.min(...rightXValues);
    const maxRight = Math.max(...rightXValues);
    const rightDiff = Math.abs(maxRight - minRight);

    const leftPass = leftDiff <= 1.0;
    const rightPass = rightDiff <= 1.0;

    console.log(`[${leftPass && rightPass ? 'PASS' : 'FAIL'}] Viewport ${vp.name}:`);
    console.log('   Left Edges (must match within 1px):');
    leftEdges.forEach(e => console.log(`     - ${e.name.padEnd(20)}: x = ${e.x}px`));
    console.log(`     => Delta (max - min): ${leftDiff.toFixed(1)}px (PASS: ${leftPass})`);

    console.log('   Right Edges (must match within 1px):');
    rightEdges.forEach(e => console.log(`     - ${e.name.padEnd(20)}: right = ${e.right}px`));
    console.log(`     => Delta (max - min): ${rightDiff.toFixed(1)}px (PASS: ${rightPass})\n`);

    if (!leftPass || !rightPass) allAlignmentPassed = false;

    // Screenshot for artifact
    const screenshotPath = path.join(ARTIFACT_DIR, `alignment_${vp.width}.png`);
    await page.screenshot({ path: screenshotPath });

    await browser.close();
  }

  console.log('================================================================');
  console.log('  SECTION E: RECOMMENDED CARDS & FIRST VIEW VERIFICATION');
  console.log('================================================================\n');

  let allCardTestsPassed = true;

  for (const vp of CARD_VIEWPORTS) {
    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', `--window-size=${vp.width},${vp.height}`],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 600));

    const cardDetails = await page.evaluate((vpHeight) => {
      const headingEl = document.querySelector('#recommended-stays h2');
      const headingRect = headingEl ? headingEl.getBoundingClientRect() : null;
      const headingVisible = headingRect ? (headingRect.top >= 0 && headingRect.bottom <= vpHeight) : false;

      const cardEls = document.querySelectorAll('[data-recommended-card="true"]');
      const results = [];

      cardEls.forEach((card, idx) => {
        const cardRect = card.getBoundingClientRect();
        
        // Photo Container & Badge
        const photoContainer = card.querySelector('div.aspect-video') || (photoEl ? photoEl.closest('div.relative') : null);
        const photoRect = photoContainer ? photoContainer.getBoundingClientRect() : null;

        // Sample Badge (top-left of photo)
        const sampleBadgeOnPhoto = photoContainer ? photoContainer.querySelector('div[class*="left-"] span') : null;
        const sampleBadgeText = sampleBadgeOnPhoto ? sampleBadgeOnPhoto.textContent.trim() : null;
        const isSampleTopLeft = sampleBadgeOnPhoto ? (
          sampleBadgeOnPhoto.closest('div').classList.contains('top-2') ||
          sampleBadgeOnPhoto.closest('div').classList.contains('top-2.5') ||
          sampleBadgeOnPhoto.closest('div').classList.contains('top-3')
        ) : false;

        // Name
        const nameEl = card.querySelector('h3');
        const nameText = nameEl ? nameEl.textContent.trim() : '';
        const nameTitle = nameEl ? nameEl.getAttribute('title') : null;
        const isNameTruncated = nameEl ? nameEl.classList.contains('truncate') : false;

        // Sample badge inside name row?
        const nameRow = nameEl ? nameEl.closest('div.flex') : null;
        const sampleInNameRow = nameRow ? nameRow.textContent.includes('Sample') : false;

        // Rating or "New"
        const newBadge = nameRow ? Array.from(nameRow.querySelectorAll('span')).find(s => s.textContent.trim() === 'New') : null;

        // Location
        const locEl = card.querySelector('span.truncate');
        const locText = locEl ? locEl.textContent.trim() : '';

        // Amenities
        const amenitiesEl = card.querySelector('div.overflow-hidden');
        const amenitiesText = amenitiesEl ? amenitiesEl.textContent.trim() : '';

        // Price Line
        const priceEl = card.querySelector('span.font-bold');
        const priceText = priceEl ? priceEl.textContent.trim() : '';
        const priceLineContainer = priceEl ? priceEl.closest('div.border-t') : null;
        const priceLineRect = priceLineContainer ? priceLineContainer.getBoundingClientRect() : null;
        const priceLineInside = priceLineRect ? (priceLineRect.bottom <= vpHeight) : false;

        results.push({
          idx,
          cardWidth: Math.round(cardRect.width * 10) / 10,
          cardHeight: Math.round(cardRect.height * 10) / 10,
          photoWidth: photoRect ? Math.round(photoRect.width * 10) / 10 : null,
          photoHeight: photoRect ? Math.round(photoRect.height * 10) / 10 : null,
          hasSampleOnPhoto: Boolean(sampleBadgeText && sampleBadgeText.toLowerCase().includes('sample')),
          sampleInNameRow,
          isNameTruncated,
          nameTitlePresent: Boolean(nameTitle),
          hasNewOrRating: Boolean(newBadge || nameRow?.querySelector('svg')),
          priceText,
          priceLineBottom: priceLineRect ? Math.round(priceLineRect.bottom) : null,
          priceLineInside,
        });
      });

      return {
        headingVisible,
        headingBottom: headingRect ? Math.round(headingRect.bottom) : null,
        cards: results,
      };
    }, vp.height);

    const headingPass = cardDetails.headingVisible;
    const allPriceInside = cardDetails.cards.every(c => c.priceLineInside);
    const passForViewport = vp.mustFitPrice ? (headingPass && allPriceInside) : headingPass;

    console.log(`[${passForViewport ? 'PASS' : 'FAIL'}] Viewport ${vp.name}:`);
    console.log(`   - Heading visible: ${headingPass} (bottom: ${cardDetails.headingBottom}px <= ${vp.height}px)`);
    console.log(`   - Cards in row: ${cardDetails.cards.length}`);
    if (cardDetails.cards.length > 0) {
      const c1 = cardDetails.cards[0];
      console.log(`   - Card 1 width: ${c1.cardWidth}px (~302-312px) | Total card height: ${c1.cardHeight}px`);
      console.log(`   - Photo size: ${c1.photoWidth}x${c1.photoHeight}px (16:9 aspect ratio)`);
      console.log(`   - "Sample" badge on photo top-left: ${c1.hasSampleOnPhoto} | Not in name row: ${!c1.sampleInNameRow}`);
      console.log(`   - Name 1-line truncate: ${c1.isNameTruncated} | Hover title attr: ${c1.nameTitlePresent}`);
      console.log(`   - Plain "New" or verified rating: ${c1.hasNewOrRating}`);
      console.log(`   - Price line: ${c1.priceText} (bottom: ${c1.priceLineBottom}px <= ${vp.height}px: ${c1.priceLineInside})`);
      console.log(`   - All card price lines inside viewport: ${allPriceInside ? 'YES' : 'NO'}`);
    }
    console.log('');

    if (!passForViewport) allCardTestsPassed = false;

    // Save screenshots
    if (vp.name === '1900x950') {
      const screenshotPath = path.join(ARTIFACT_DIR, 'after_home_1900x950.png');
      await page.screenshot({ path: screenshotPath });
    } else if (vp.name === '1917x1032') {
      const screenshotPath = path.join(ARTIFACT_DIR, 'after_home_1917x1032.png');
      await page.screenshot({ path: screenshotPath });
    }

    await browser.close();
  }

  console.log('================================================================');
  console.log(`  VERIFICATION RESULT: ALL TESTS ${allAlignmentPassed && allCardTestsPassed ? 'PASSED!' : 'FAILED!'}`);
  console.log('================================================================\n');

  if (!allAlignmentPassed || !allCardTestsPassed) {
    process.exit(1);
  }
}

runAlignmentAndCardTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
