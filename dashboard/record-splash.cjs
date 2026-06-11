'use strict';
/**
 * record-splash.cjs — capture /splash only, for splice into final MP4
 * Output: ../tmp/demo-videos/splash-new.webm
 * Run:    node record-splash.cjs
 */
const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const BASE      = 'http://localhost:3000';
const VIDEO_DIR = path.join(__dirname, '..', 'tmp', 'demo-videos');
const HOLD_MS   = 7_000; // 7s outro — enough for animation to settle

if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1920, height: 1080 } },
  });
  const page = await ctx.newPage();

  console.log('Navigating to /splash...');
  await page.goto(`${BASE}/splash`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Re-inject cursor element for VP8 frame generation
  await page.evaluate(() => {
    const el = document.createElement('div');
    el.id = '__demo_cursor';
    el.style.cssText = [
      'position:fixed','width:12px','height:12px',
      'border-radius:50%','background:rgba(255,255,255,0.7)',
      'pointer-events:none','z-index:99999',
      'transform:translate(-50%,-50%)',
      'transition:left 80ms linear,top 80ms linear',
    ].join(';');
    document.body.appendChild(el);
  });

  // Drift cursor to generate VP8 frames on static page
  const start = Date.now();
  while (Date.now() - start < HOLD_MS) {
    const progress = (Date.now() - start) / HOLD_MS;
    const x = Math.round(960 + Math.sin(progress * Math.PI * 4) * 60);
    const y = Math.round(540 + Math.cos(progress * Math.PI * 3) * 40);
    await page.mouse.move(x, y);
    await page.evaluate(({ x, y }) => {
      const el = document.getElementById('__demo_cursor');
      if (el) { el.style.left = x + 'px'; el.style.top = y + 'px'; }
    }, { x, y });
    await page.waitForTimeout(80);
  }

  console.log('Done — closing...');
  await ctx.close();
  await browser.close();

  const files = fs.readdirSync(VIDEO_DIR)
    .filter(f => f.endsWith('.webm') && f !== 'splash-new.webm')
    .map(f => ({ name: f, time: fs.statSync(path.join(VIDEO_DIR, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);

  if (files.length) {
    const src = path.join(VIDEO_DIR, files[0].name);
    const dst = path.join(VIDEO_DIR, 'splash-new.webm');
    fs.renameSync(src, dst);
    console.log(`✓ Saved: ${dst}`);
    console.log('\nNext: node splice-splash.cjs');
  }
})();
