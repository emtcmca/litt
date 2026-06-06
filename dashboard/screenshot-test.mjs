import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1720, height: 960 });
await page.goto('http://localhost:3000', { waitUntil: 'load', timeout: 20000 });
await page.waitForTimeout(9000);
await page.screenshot({ path: 'screenshot-app.png', fullPage: false });
await browser.close();
console.log('Screenshot saved: screenshot-app.png');
