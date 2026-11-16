import puppeteer from 'puppeteer-core';

async function generate() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 180, height: 180 });
  await page.setContent(`
    <html style="margin:0;padding:0;background:transparent;">
      <body style="margin:0;padding:0;background:transparent;overflow:hidden;">
        <div style="width:180px;height:180px;background:#0B1220;border-radius:40px;display:flex;align-items:center;justify-content:center;">
          <span style="font-family:system-ui, -apple-system, sans-serif;font-weight:700;font-size:105px;color:#FFFFFF;line-height:1;">P</span>
        </div>
      </body>
    </html>
  `);
  await page.screenshot({ path: '../../client/public/apple-touch-icon.png', omitBackground: true });
  await browser.close();
  console.log('✓ apple-touch-icon.png generated');
}

generate().catch(console.error);
