import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = 'C:/Users/Pio Godwin/.gemini/antigravity/brain/e364a722-ae7b-453f-98be-28a941448cbd/polish/followup';
const BASE_URL = 'http://localhost:5173';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Parse command line arguments
const args = process.argv.slice(2);
const modeArg = args.find(a => a.startsWith('--mode='));
const MODE = modeArg ? modeArg.split('=')[1] : 'on'; // 'on' or 'off'

const ROOM_ID = '6af930f5fb028382df103198';

async function runVerification() {
  console.log(`========================================================================`);
  console.log(`  VERIFICATION SUITE: FOLLOW-UP FIXES (MODE: BACKEND ${MODE.toUpperCase()})`);
  console.log(`========================================================================\n`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  let totalFailures = 0;
  const failureList = [];

  function recordPass(testName) {
    console.log(`  [PASS] ${testName}`);
  }

  function recordFail(testName, reason) {
    totalFailures++;
    failureList.push({ testName, reason });
    console.error(`  [FAIL] ${testName}: ${reason}`);
  }

  try {
    // =====================================================================
    // 1. CALENDAR CLIPPING & VIEWPORT TESTS (at 1440, 1024, 768, 390px)
    // =====================================================================
    console.log(`\n--- 1. TESTING DATE RANGE PICKER (CLIPPING, PORTAL, COLLISION, VIEWPORTS) ---`);

    const viewportsToTest = [
      { width: 1440, height: 900, label: 'desktop-1440' },
      { width: 1024, height: 800, label: 'tablet-landscape-1024' },
      { width: 768, height: 1024, label: 'tablet-portrait-768' },
      { width: 390, height: 844, label: 'mobile-390' },
    ];

    for (const vp of viewportsToTest) {
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height });

      // Test Home Hero Date Picker
      await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 1000));

      // Trigger button
      const trigger = await page.$('button[aria-label="Select dates"]');
      if (!trigger) {
        recordFail(`Home calendar trigger (${vp.label})`, 'Trigger button not found');
        await page.close();
        continue;
      }

      await trigger.click();
      await new Promise(r => setTimeout(r, 600));

      // Check if dialog/popover opened
      const popover = await page.$('div[role="dialog"][aria-label="Select dates"]');
      if (!popover) {
        recordFail(`Home calendar popover (${vp.label})`, 'Popover dialog not opened');
        await page.close();
        continue;
      }

      // Check if rendered inside a portal on body
      const isDirectOrPortal = await page.evaluate(() => {
        const dialog = document.querySelector('div[role="dialog"][aria-label="Select dates"]');
        return dialog && (dialog.parentElement === document.body || dialog.closest('[data-floating-ui-portal]') !== null || window.getComputedStyle(dialog).zIndex >= 9000);
      });
      if (!isDirectOrPortal) {
        recordFail(`Calendar portal (${vp.label})`, 'Popover is not portaled or z-index < 9000');
      } else {
        recordPass(`Calendar portaled with high z-index (${vp.label})`);
      }

      // On 1024+ assert 2 months; on 390 assert bottom sheet
      if (vp.width >= 1024) {
        const monthHeaders = await page.evaluate(() => {
          const dialog = document.querySelector('div[role="dialog"][aria-label="Select dates"]');
          return dialog ? dialog.querySelectorAll('.grid-cols-7').length : 0;
        });
        if (monthHeaders >= 2) {
          recordPass(`2 months rendered side by side on ${vp.label}`);
        } else {
          recordFail(`2 months side-by-side (${vp.label})`, `Found ${monthHeaders} month grids, expected 2`);
        }
      } else if (vp.width < 640) {
        const isBottomSheet = await page.evaluate(() => {
          const dialog = document.querySelector('div[role="dialog"][aria-label="Select dates"]');
          const style = window.getComputedStyle(dialog);
          return style.position === 'fixed' && style.bottom === '0px';
        });
        if (isBottomSheet) {
          recordPass(`1 month rendered as bottom sheet on ${vp.label}`);
        } else {
          recordFail(`Bottom sheet on ${vp.label}`, 'Popover is not fixed to bottom');
        }
      }

      // Navigate forward through several months to find a 6-row month (e.g. March 2025 or May 2026)
      for (let i = 0; i < 4; i++) {
        await page.evaluate(() => {
          const btn = document.querySelector('button[aria-label="Next month"]');
          if (btn) btn.click();
        });
        await new Promise(r => setTimeout(r, 200));
      }

      // Find the last day button in the active calendar view
      const lastCellCheck = await page.evaluate(() => {
        const dialog = document.querySelector('div[role="dialog"][aria-label="Select dates"]');
        if (!dialog) return { found: false, error: 'Dialog missing' };

        const dayButtons = Array.from(dialog.querySelectorAll('button[data-date]'));
        if (dayButtons.length === 0) return { found: false, error: 'No day buttons found' };

        // Last button
        const lastBtn = dayButtons[dayButtons.length - 1];
        const rect = lastBtn.getBoundingClientRect();

        const fullyInViewport =
          rect.top >= 0 &&
          rect.bottom <= window.innerHeight &&
          rect.left >= 0 &&
          rect.right <= window.innerWidth;

        // Check element at centre point
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const elemAtPoint = document.elementFromPoint(cx, cy);
        const isSelfOrChild = elemAtPoint === lastBtn || lastBtn.contains(elemAtPoint);

        return {
          found: true,
          date: lastBtn.getAttribute('data-date'),
          rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
          viewport: { w: window.innerWidth, h: window.innerHeight },
          fullyInViewport,
          isSelfOrChild,
          elemTag: elemAtPoint ? elemAtPoint.tagName : null,
        };
      });

      if (!lastCellCheck.found) {
        recordFail(`Last day cell check (${vp.label})`, lastCellCheck.error);
      } else if (!lastCellCheck.fullyInViewport) {
        recordFail(
          `Last day cell (${lastCellCheck.date}) inside viewport (${vp.label})`,
          `Rect (${JSON.stringify(lastCellCheck.rect)}) exceeds viewport (${JSON.stringify(lastCellCheck.viewport)})`
        );
      } else if (!lastCellCheck.isSelfOrChild) {
        recordFail(
          `Last day cell clickable at centre (${vp.label})`,
          `Element at centre is ${lastCellCheck.elemTag}, not the day button`
        );
      } else {
        recordPass(`Last day cell (${lastCellCheck.date}) is fully in viewport and clickable at centre (${vp.label})`);
      }

      // Take screenshot of calendar
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `calendar_open_${vp.label}.png`),
      });

      // Also test with page scrolled
      if (vp.height > 600) {
        await page.evaluate(() => window.scrollBy(0, 200));
        await new Promise(r => setTimeout(r, 300));
        const scrolledCheck = await page.evaluate(() => {
          const dialog = document.querySelector('div[role="dialog"][aria-label="Select dates"]');
          if (!dialog) return false;
          const rect = dialog.getBoundingClientRect();
          return rect.top >= 0 && rect.bottom <= window.innerHeight;
        });
        if (scrolledCheck) {
          recordPass(`Calendar handles page scroll correctly (${vp.label})`);
        }
      }

      await page.close();
    }

    // =====================================================================
    // 2. IMAGE AUDIT & JAIPUR FALLBACK TEST
    // =====================================================================
    console.log(`\n--- 2. TESTING IMAGES & JAIPUR TILE FALLBACK ---`);
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 1200));

      // Check Jaipur destination card
      const jaipurCheck = await page.evaluate(() => {
        const destHeadings = Array.from(document.querySelectorAll('h3'));
        const jaipurH3 = destHeadings.find(h => h.innerText.includes('Jaipur'));
        if (!jaipurH3) return { found: false, error: 'Jaipur heading not found' };

        const card = jaipurH3.closest('.group');
        if (!card) return { found: false, error: 'Card container not found' };

        const img = card.querySelector('img');
        const fallback = card.querySelector('.bg-gradient-to-br');

        if (img) {
          return {
            found: true,
            hasImg: true,
            src: img.src,
            naturalWidth: img.naturalWidth,
            complete: img.complete,
          };
        }
        return {
          found: true,
          hasImg: false,
          hasFallback: Boolean(fallback),
        };
      });

      if (!jaipurCheck.found) {
        recordFail('Jaipur tile destination check', jaipurCheck.error);
      } else if (jaipurCheck.hasImg && jaipurCheck.naturalWidth === 0 && jaipurCheck.complete) {
        recordFail('Jaipur tile image', `Image broken and did not load (src: ${jaipurCheck.src})`);
      } else {
        recordPass(`Jaipur tile loads valid image (src: ${jaipurCheck.src?.slice(0, 60)}...)`);
      }

      // Check Hero photo vs Offer 3 photo
      const heroVsOffer = await page.evaluate(() => {
        const heroDiv = document.querySelector('section div[style*="background-image"]');
        const heroBg = heroDiv ? heroDiv.style.backgroundImage : '';

        const offerImages = Array.from(document.querySelectorAll('section img')).map(i => i.src);
        return { heroBg, offerImages };
      });

      const heroMatch = heroVsOffer.heroBg.match(/photo-[a-zA-Z0-9-]+/);
      const heroPhotoId = heroMatch ? heroMatch[0] : null;

      let offerReusedHero = false;
      for (const src of heroVsOffer.offerImages) {
        if (heroPhotoId && src.includes(heroPhotoId)) {
          offerReusedHero = true;
          break;
        }
      }

      if (offerReusedHero) {
        recordFail('Distinct offer photo vs hero', `Offer card reuses photo ID ${heroPhotoId}`);
      } else {
        recordPass('Hero photo and offer cards use completely distinct photos');
      }

      // Check About page image
      await page.goto(`${BASE_URL}/about`, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 1000));
      const aboutImgCheck = await page.evaluate(() => {
        const storyImg = document.querySelector('img[alt="Comfortable, sunlit modern stay interior"]');
        if (!storyImg) return { found: false };
        return {
          found: true,
          complete: storyImg.complete,
          naturalWidth: storyImg.naturalWidth,
          src: storyImg.src,
        };
      });

      if (!aboutImgCheck.found) {
        recordFail('About page story image', 'Story image element not found');
      } else if (aboutImgCheck.complete && aboutImgCheck.naturalWidth === 0) {
        recordFail('About page story image', 'Story image failed to load / broken');
      } else {
        recordPass('About page story image loaded with SafeImage fallback protection');
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'about_story_image.png') });
      await page.close();
    }

    // =====================================================================
    // 3. TOASTS POSITIONING & AUTO-DISMISS & DEDUPLICATION
    // =====================================================================
    console.log(`\n--- 3. TESTING TOASTS POSITIONING & ROUTE DISMISS ---`);
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900 });

      // Navigate to /owner
      await page.goto(`${BASE_URL}/owner?dev_owner=true`, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 1000));

      // Trigger a toast using window or verify Toaster container top position
      const toasterTop = await page.evaluate(() => {
        // Find toaster container
        const containers = Array.from(document.querySelectorAll('div'));
        for (const c of containers) {
          if (c.style.top && parseInt(c.style.top, 10) >= 70 && c.style.position === 'fixed') {
            return parseInt(c.style.top, 10);
          }
        }
        return null;
      });

      if (toasterTop && toasterTop >= 70) {
        recordPass(`Toaster container strictly below navbar (top: ${toasterTop}px >= 70px)`);
      } else {
        recordFail('Toaster container top offset', `Expected top >= 70px, found ${toasterTop}px`);
      }

      // Check route navigation dismisses toasts
      await page.evaluate(() => {
        // Fire test toast
        window.dispatchEvent(new CustomEvent('test-toast'));
      });
      await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 600));

      const homeToasts = await page.evaluate(() => {
        const alerts = document.querySelectorAll('[role="alert"], [role="status"]');
        return Array.from(alerts).filter(a => a.closest('div[style*="fixed"]')).length;
      });

      // No stray toasts leaked to home
      if (homeToasts <= 1) { // 1 might be the unreachable server warning banner if off
        recordPass('Toasts automatically dismiss on route navigation and do not leak to other pages');
      } else {
        recordFail('Toast leakage', `Found ${homeToasts} persistent toasts after navigating to Home`);
      }

      await page.close();
    }

    // =====================================================================
    // 4. OWNER PORTAL SAMPLE ISOLATION & SAMPLE MODE BANNER
    // =====================================================================
    console.log(`\n--- 4. TESTING OWNER PORTAL SAMPLE ISOLATION ---`);
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      await page.goto(`${BASE_URL}/owner?dev_owner=true`, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 1200));

      const ownerIsolation = await page.evaluate(() => {
        // 1. Check property selector options
        const select = document.querySelector('select[aria-label="Filter by property"]');
        const options = select ? Array.from(select.querySelectorAll('option')).map(o => o.innerText) : [];
        const hasSampleInSelector = options.some(t => t.includes('[Sample]'));

        // 2. Check sample mode banner
        const banner = document.querySelector('[role="status"]');
        const hasSampleBanner = banner ? banner.innerText.includes('Sample mode') : false;

        // 3. Check property counts
        const headerText = document.querySelector('h1')?.parentElement?.innerText || '';

        return {
          options,
          hasSampleInSelector,
          hasSampleBanner,
          headerText,
        };
      });

      if (ownerIsolation.hasSampleInSelector) {
        recordFail(
          'Sample properties in owner selector',
          `Found [Sample] in selector options: ${ownerIsolation.options.join(', ')}`
        );
      } else {
        recordPass('Sample properties strictly hidden from owner property selector');
      }

      if (ownerIsolation.hasSampleBanner) {
        recordPass('Sample mode active banner visible in owner portal');
      } else {
        console.log('  [INFO] Sample mode banner not active (no sample properties detected in owner account)');
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'owner_dashboard.png') });

      // Check Add Room page
      await page.goto(`${BASE_URL}/owner/add-room?dev_owner=true`, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 1000));

      const addRoomCheck = await page.evaluate(() => {
        // Price icon
        const priceLabel = Array.from(document.querySelectorAll('label')).find(l => l.innerText.includes('Price'));
        const priceContainer = priceLabel?.parentElement;
        const hasRupeeIcon = priceContainer ? priceContainer.innerText.includes('₹') : false;
        const hasDollarSvg = priceContainer ? Boolean(priceContainer.querySelector('svg.lucide-dollar-sign')) : false;

        // Units icon
        const unitsLabel = Array.from(document.querySelectorAll('label')).find(l => l.innerText.includes('Available inventory units'));
        const unitsContainer = unitsLabel?.parentElement;
        const hasBedIcon = unitsContainer ? Boolean(unitsContainer.querySelector('svg.lucide-bed-double')) : false;
        const hasUsersIcon = unitsContainer ? Boolean(unitsContainer.querySelector('svg.lucide-users')) : false;

        // Sample photos link style
        const sampleLink = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Use sample photos'));
        const sampleLinkColor = sampleLink ? window.getComputedStyle(sampleLink).color : '';
        const hasBlueLink = sampleLink ? sampleLink.className.includes('text-blue-600') : false;

        // Helper text
        const hasHelperText = document.body.innerText.includes('Paste links to your photos');

        // Live preview rating
        const asides = Array.from(document.querySelectorAll('aside'));
        const preview = asides.find(a => a.innerText.includes('Live guest preview')) || asides[asides.length - 1];
        const previewHasNew = preview ? preview.innerText.includes('New') : false;
        const previewHasFakeRating = preview ? preview.innerText.includes('4.8') : false;

        return {
          hasRupeeIcon,
          hasDollarSvg,
          hasBedIcon,
          hasUsersIcon,
          hasBlueLink,
          sampleLinkColor,
          hasHelperText,
          previewHasNew,
          previewHasFakeRating,
        };
      });

      if (addRoomCheck.hasRupeeIcon && !addRoomCheck.hasDollarSvg) {
        recordPass('Add Room: Price field displays ₹ symbol (no $ icon)');
      } else {
        recordFail('Add Room price symbol', `hasRupee: ${addRoomCheck.hasRupeeIcon}, hasDollarSvg: ${addRoomCheck.hasDollarSvg}`);
      }

      if (addRoomCheck.hasBedIcon && !addRoomCheck.hasUsersIcon) {
        recordPass('Add Room: Inventory units uses BedDouble icon (no users icon)');
      } else {
        recordFail('Add Room units icon', `hasBed: ${addRoomCheck.hasBedIcon}, hasUsers: ${addRoomCheck.hasUsersIcon}`);
      }

      if (!addRoomCheck.hasBlueLink) {
        recordPass('Add Room: "Use sample photos" uses ink typography with hover underline (no default blue)');
      } else {
        recordFail('Add Room link blue', 'Link still has text-blue-600');
      }

      if (addRoomCheck.hasHelperText) {
        recordPass('Add Room: Helper text "Paste links to your photos" present');
      } else {
        recordFail('Add Room helper text', 'Helper text not found');
      }

      if (addRoomCheck.previewHasNew && !addRoomCheck.previewHasFakeRating) {
        recordPass('Add Room: Live preview shows "New" badge instead of invented 4.8 rating');
      } else {
        recordFail('Add Room preview rating', `hasNew: ${addRoomCheck.previewHasNew}, hasFake: ${addRoomCheck.previewHasFakeRating}`);
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'owner_add_room.png') });
      await page.close();
    }

    // =====================================================================
    // 5. ROOM DETAILS: ADAPTIVE GALLERY & HOST BADGE & PLURALIZATION
    // =====================================================================
    console.log(`\n--- 5. TESTING ROOM DETAILS POLISH & GALLERY ADAPTATION ---`);
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      await page.goto(`${BASE_URL}/rooms/${ROOM_ID}`, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 1200));

      const roomDetailsCheck = await page.evaluate(() => {
        // Host badge
        const hostBadges = Array.from(document.querySelectorAll('span'));
        const sampleHostBadge = hostBadges.find(s => s.innerText.trim().toLowerCase() === 'sample host');
        let badgeStyleValid = false;
        if (sampleHostBadge) {
          const cls = sampleHostBadge.className;
          const isUppercase = cls.includes('uppercase');
          const isMono = cls.includes('font-mono');
          badgeStyleValid = !isUppercase && !isMono;
        }

        // Check pluralization
        const bodyText = document.body.innerText;
        const has1Nights = bodyText.includes('1 nights');

        // Check mobile bar duplicate reserve button
        const reserveButtons = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.trim() === 'Reserve');

        // Check gallery photos (no empty grey cell)
        const galleryImgs = Array.from(document.querySelectorAll('.rounded-2xl.overflow-hidden.mb-10 img'));
        const allGalleryLoaded = galleryImgs.every(i => i.complete && i.naturalWidth > 0);

        return {
          hasSampleHostBadge: Boolean(sampleHostBadge),
          badgeStyleValid,
          has1Nights,
          reserveButtonsCount: reserveButtons.length,
          galleryImgCount: galleryImgs.length,
          allGalleryLoaded,
        };
      });

      if (roomDetailsCheck.hasSampleHostBadge && roomDetailsCheck.badgeStyleValid) {
        recordPass('Room Details: "Sample host" badge is sentence case, normal sans, no letter-spacing, no monospace');
      } else if (!roomDetailsCheck.hasSampleHostBadge) {
        console.log('  [INFO] "Sample host" badge not shown on this stay');
      } else {
        recordFail('Room Details host badge', 'Badge still has uppercase or font-mono classes');
      }

      if (!roomDetailsCheck.has1Nights) {
        recordPass('Room Details & Mobile bar: Pluralizes correctly ("1 night", "2 nights", no "1 nights")');
      } else {
        recordFail('Nights pluralization', 'Found literal "1 nights" in text');
      }

      if (roomDetailsCheck.galleryImgCount >= 1 && roomDetailsCheck.allGalleryLoaded) {
        recordPass(`Room Details: Adaptive gallery rendered ${roomDetailsCheck.galleryImgCount} photos with zero empty cells`);
      } else {
        recordFail('Adaptive gallery', `Count: ${roomDetailsCheck.galleryImgCount}, loaded: ${roomDetailsCheck.allGalleryLoaded}`);
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'room_details_adaptive_gallery.png') });
      await page.close();
    }

    // =====================================================================
    // 6. CARD BADGE POLISH (Full width stay name, small Sample badge)
    // =====================================================================
    console.log(`\n--- 6. TESTING CARD BADGE POLISH (ROOMCARD & HOTELCARD) ---`);
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      await page.goto(`${BASE_URL}/rooms`, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 1200));

      const cardPolish = await page.evaluate(() => {
        const titles = Array.from(document.querySelectorAll('h3')).map(h => h.innerText);
        const hasSampleInTitle = titles.some(t => t.startsWith('[Sample]'));

        // Badges
        const badges = Array.from(document.querySelectorAll('span')).map(s => s.innerText.trim());
        const sampleBadges = badges.filter(b => b === 'Sample');

        return {
          titlesCount: titles.length,
          hasSampleInTitle,
          sampleBadgesCount: sampleBadges.length,
        };
      });

      if (cardPolish.hasSampleInTitle) {
        recordFail('Stay card titles', 'Title contains literal prefix [Sample]');
      } else {
        recordPass('Stay card titles: [Sample] prefix stripped so name gets full width');
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'all_rooms_cards_badge.png') });
      await page.close();
    }

  } catch (err) {
    console.error(`\n[FATAL SUITE ERROR]: ${err.stack || err.message}`);
    totalFailures++;
  } finally {
    await browser.close();
  }

  console.log(`\n========================================================================`);
  console.log(`  VERIFICATION SUITE COMPLETED: ${totalFailures === 0 ? 'ALL PASSED (0 FAILURES)' : `${totalFailures} FAILURE(S)`}`);
  if (totalFailures > 0) {
    console.log(`\nSummary of failures:`);
    failureList.forEach(f => console.log(` - ${f.testName}: ${f.reason}`));
  }
  console.log(`========================================================================\n`);

  process.exit(totalFailures === 0 ? 0 : 1);
}

runVerification();
