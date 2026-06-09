// Run: node scripts/capture-architecture.js
// Requires dev server running on http://localhost:3000
// Saves to docs/architecture.png at 1920x1080

const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://localhost:3000/architecture', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500); // let fonts settle
  const out = path.join(__dirname, '..', 'docs', 'architecture.png');
  await page.screenshot({ path: out, fullPage: false });
  console.log('Saved:', out);
  await browser.close();
})();
