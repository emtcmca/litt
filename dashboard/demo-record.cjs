/**
 * demo-record.cjs — Playwright demo recording driver for Litt v1.1.5
 *
 * WORKFLOW:
 *   1.  cd dashboard && npm run dev          (port 3000)
 *   2.  POST http://localhost:8002/api/demo/reset  (firm_id + confirm:true)
 *   3.  Run calibration sequence (see CLAUDE.md — 10 API calls)
 *   4.  GET  http://localhost:8002/api/demo/ready  → all ok: True
 *   5.  node demo-record.cjs
 *   6.  node demo-merge.cjs  → tmp/demo-videos/litt-demo-final.mp4
 *
 * SCENE ORDER (brief-first; sweep runs AFTER brief is shown):
 *   Scene 1  0:00–0:30  /brief — 11 decisions, scroll Mercer/Acme/Whitmore
 *   Scene 2  0:12–0:30  Mercer modal — ProofBlock + "What will be logged"
 *   Scene 3  0:30–0:42  Close modal → /agents
 *   Scene 4  0:42–0:45  Click Run Closeout
 *   Scene 5  0:45–1:05  Sweep animation + architecture lower-thirds
 *   Scene 6  1:05–1:42  /splash end card
 *
 * WHY BRIEF-FIRST: Running the live sweep creates new Firestore escalations,
 * inflating the brief decision count. By showing the brief BEFORE clicking
 * Run Closeout, the 11/6 count is visible as intended. The brief is never
 * re-fetched after the sweep in this flow.
 */

'use strict';
const path = require('path');
const fs   = require('fs');
const { chromium } = require('playwright');

const BASE             = 'http://localhost:3000';
const VIDEO_OUTPUT_DIR = path.join(__dirname, '..', 'tmp', 'demo-videos');

// ── Fixed scene start times (ms from recording start) ─────────────────────────
const ABS = {
  MERCER_CLICK:  15_000,   // 0:15 — click Mercer deadline card
  CLOSE_MODAL:   37_000,   // 0:37 — close modal, navigate to /agents
};

// ── Relative delays ────────────────────────────────────────────────────────────
const REL = {
  // Brief scroll timing
  BRIEF_INITIAL_PAUSE: 2000,  // hold on brief before scrolling
  PAUSE_ON_MERCER:     1500,
  PAUSE_ON_ACME:       1200,
  PAUSE_ON_WHITMORE:   1000,
  SCROLL_TO_ACME:       530,
  SCROLL_TO_WHITMORE:   190,

  // Modal timing
  MODAL_SETTLE:         900,   // wait after modal opens
  MODAL_TO_AUDIT:     13_000,  // hold on ProofBlock before audit panel scroll

  // Agents / sweep timing
  AGENTS_SETTLE:       1500,   // wait after /agents loads before starting
  HOVER_PROOF_STRIP:   2500,   // hover JudgeProofStrip before moving to button
  PRE_CLICK_PAUSE:     1500,   // pause on Run Closeout before clicking
  SWEEP_TIMEOUT:      20_000,  // max wait for "Replay sweep" to appear

  // Post-sweep lower-thirds (shown while sweep timeline animates)
  LT1_DURATION:        5000,   // "Google ADK — Coordinator + 4 Sub-Agents"
  LT2_DURATION:        5000,   // "Billing · Deadlines · Client Comms · Anomalies"
  LT3_DURATION:        4500,   // "Routing is a Python dict — not an LLM call"
  POST_SWEEP_SETTLE:   2000,   // hold on completed sweep before splash

  // Splash — long hold for visual outro; narration ends ~10s before video
  TITLE_HOLD:         37_000,
};

// ── Intra-scene timing (ms) ────────────────────────────────────────────────────
const T = {
  MOUSE_STEP_DELAY:    12,
  MOUSE_STEPS:         28,
  CLICK_HOVER_PAUSE:  380,
  NAV_SETTLE:          700,
  LOWER_THIRD_FADE:    300,
  SCROLL_STEPS:         10,
  SCROLL_STEP_DELAY:    35,
};

// ── Mouse tracking ─────────────────────────────────────────────────────────────
const mouse = { x: 960, y: 540 };

// ── Fake cursor ────────────────────────────────────────────────────────────────

async function initCursor(page) {
  await page.evaluate(() => {
    if (document.getElementById('litt-cursor')) return;
    const el = document.createElement('div');
    el.id = 'litt-cursor';
    el.style.cssText = [
      'position:fixed', 'width:20px', 'height:20px', 'border-radius:50%',
      'background:rgba(255,255,255,0.93)',
      'border:2px solid rgba(255,255,255,0.32)',
      'pointer-events:none', 'z-index:999998',
      'transform:translate(-50%,-50%)',
      'box-shadow:0 2px 10px rgba(0,0,0,0.5)',
      'left:960px', 'top:540px',
    ].join(';');
    document.body.appendChild(el);
  });
}

function updateCursor(page, x, y) {
  page.evaluate(({ x, y }) => {
    const el = document.getElementById('litt-cursor');
    if (el) { el.style.left = x + 'px'; el.style.top = y + 'px'; }
  }, { x, y }).catch(() => {});
}

function clickFlash(page, x, y) {
  page.evaluate(({ x, y }) => {
    const ring = document.createElement('div');
    ring.style.cssText = [
      'position:fixed',
      `left:${x}px`, `top:${y}px`,
      'width:34px', 'height:34px', 'border-radius:50%',
      'border:2.5px solid rgba(13,148,136,0.85)',
      'pointer-events:none', 'z-index:999997',
      'transform:translate(-50%,-50%) scale(0.3)',
      'transition:transform 0.32s ease-out,opacity 0.32s ease-out',
      'opacity:1',
    ].join(';');
    document.body.appendChild(ring);
    requestAnimationFrame(() => {
      ring.style.transform = 'translate(-50%,-50%) scale(1.5)';
      ring.style.opacity = '0';
    });
    setTimeout(() => ring.remove(), 380);
  }, { x, y }).catch(() => {});
}

// ── Lower-third overlay ────────────────────────────────────────────────────────

async function showLowerThird(page, text) {
  await page.evaluate((txt) => {
    let el = document.getElementById('litt-lower-third');
    if (!el) {
      el = document.createElement('div');
      el.id = 'litt-lower-third';
      el.style.cssText = [
        'position:fixed',
        'bottom:68px',
        'left:72px',
        'background:rgba(8,10,16,0.94)',
        'border-left:3px solid #0D9488',
        'border-radius:0 6px 6px 0',
        'padding:10px 22px 10px 16px',
        "font-family:'IBM Plex Mono',monospace",
        'font-size:15px',
        'font-weight:500',
        'color:#F1F5F9',
        'z-index:99999',
        'pointer-events:none',
        'white-space:nowrap',
        'backdrop-filter:blur(8px)',
        'box-shadow:0 4px 20px rgba(0,0,0,0.55)',
        'transition:opacity 0.25s ease',
        'opacity:0',
      ].join(';');
      document.body.appendChild(el);
    }
    el.textContent = txt;
    requestAnimationFrame(() => { el.style.opacity = '1'; });
  }, text);
  await page.waitForTimeout(T.LOWER_THIRD_FADE);
}

async function hideLowerThird(page) {
  await page.evaluate(() => {
    const el = document.getElementById('litt-lower-third');
    if (el) el.style.opacity = '0';
  });
  await page.waitForTimeout(T.LOWER_THIRD_FADE);
}

// ── Smooth mouse + scroll helpers ─────────────────────────────────────────────

async function smoothMove(page, x2, y2) {
  const x1 = mouse.x, y1 = mouse.y;
  const dx = x2 - x1, dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 2) return;
  const nx = -dy / dist, ny = dx / dist;
  const steps = Math.max(10, Math.min(T.MOUSE_STEPS, Math.floor(dist / 8)));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const arc = Math.sin(Math.PI * t) * (Math.random() * 5 - 2.5);
    const px = Math.round(x1 + dx * ease + nx * arc);
    const py = Math.round(y1 + dy * ease + ny * arc);
    await page.mouse.move(px, py);
    updateCursor(page, px, py);
    await page.waitForTimeout(T.MOUSE_STEP_DELAY);
  }
  mouse.x = x2; mouse.y = y2;
  updateCursor(page, x2, y2);
}

async function naturalClick(page, locator, label = '') {
  await locator.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {
    throw new Error(`[naturalClick] not visible: ${label}`);
  });
  const box = await locator.boundingBox();
  if (!box) throw new Error(`[naturalClick] no bounding box: ${label}`);
  const cx = Math.round(box.x + box.width / 2);
  const cy = Math.round(box.y + box.height / 2);
  await smoothMove(page, cx, cy);
  await page.waitForTimeout(T.CLICK_HOVER_PAUSE);
  clickFlash(page, cx, cy);
  await locator.click();
  mouse.x = cx; mouse.y = cy;
}

async function smoothScroll(page, deltaY) {
  const perStep = deltaY / T.SCROLL_STEPS;
  for (let i = 0; i < T.SCROLL_STEPS; i++) {
    await page.mouse.wheel(0, perStep);
    await page.waitForTimeout(T.SCROLL_STEP_DELAY);
  }
}

function waitUntil(ms, recordingStart) {
  const remaining = recordingStart + ms - Date.now();
  if (remaining <= 0) return Promise.resolve();
  return new Promise(r => setTimeout(r, remaining));
}

async function reinitOverlays(page) {
  await initCursor(page);
  updateCursor(page, mouse.x, mouse.y);
}

function elapsed(recordingStart) {
  const s = (Date.now() - recordingStart) / 1000;
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return `${m}:${sec.padStart(4, '0')}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  fs.mkdirSync(VIDEO_OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized', '--disable-infobars', '--no-default-browser-check'],
  });

  // ── Pre-warm (not recorded) ──────────────────────────────────────────────────
  console.log('[pre-warm] Loading routes...');
  const warmCtx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const warmPage = await warmCtx.newPage();
  await warmPage.goto(`${BASE}/brief`,   { waitUntil: 'networkidle' });
  await warmPage.goto(`${BASE}/agents`,  { waitUntil: 'networkidle' });
  await warmPage.goto(`${BASE}/splash`,  { waitUntil: 'networkidle' });
  await warmPage.goto(`${BASE}/brief`,   { waitUntil: 'networkidle' });
  await warmCtx.close();
  console.log('[pre-warm] Done.\n');

  for (let i = 3; i >= 1; i--) { console.log(`  ${i}...`); await new Promise(r => setTimeout(r, 1000)); }
  console.log('  GO\n');

  // ── Recording context ─────────────────────────────────────────────────────────
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: VIDEO_OUTPUT_DIR,
      size: { width: 1920, height: 1080 },
    },
  });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });

  await page.addInitScript(() => {
    document.documentElement.style.background = '#0B0E14';
  });

  await page.goto(`${BASE}/brief`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const T0 = Date.now();

  // ── SCENE 1: 0:00–0:12 — /brief, scroll through decisions ────────────────────
  console.log(`[${elapsed(T0)}] Scene 1: /brief`);
  await reinitOverlays(page);
  await showLowerThird(page, '11 decisions  ·  6 critical  ·  prioritized by urgency');

  // Initial pause — let the brief and lower-third settle before scrolling
  await page.waitForTimeout(REL.BRIEF_INITIAL_PAUSE);

  // Locate Mercer card
  const mercerCard = page.locator('text=/opposition.*summary judgment|mercer.*dunlap/i').first();
  await mercerCard.waitFor({ state: 'visible', timeout: 6000 });
  const mercerBox = await mercerCard.boundingBox();
  if (mercerBox) {
    await smoothMove(page, mercerBox.x + mercerBox.width * 0.4, mercerBox.y + mercerBox.height / 2);
  }
  await page.waitForTimeout(REL.PAUSE_ON_MERCER);

  await smoothScroll(page, REL.SCROLL_TO_ACME);
  await page.waitForTimeout(200);
  await page.waitForTimeout(REL.PAUSE_ON_ACME);

  await smoothScroll(page, REL.SCROLL_TO_WHITMORE);
  await page.waitForTimeout(200);
  await page.waitForTimeout(REL.PAUSE_ON_WHITMORE);

  // Scroll back to top before clicking Mercer
  await smoothScroll(page, -(REL.SCROLL_TO_ACME + REL.SCROLL_TO_WHITMORE + 40));
  await page.waitForTimeout(400);
  await hideLowerThird(page);

  // ── SCENE 2: 0:12–0:30 — Mercer modal ────────────────────────────────────────
  await waitUntil(ABS.MERCER_CLICK, T0);
  console.log(`[${elapsed(T0)}] Scene 2: Mercer modal`);

  await showLowerThird(page, 'HARD_LEGAL  ·  6 days  ·  unconfirmed source');
  await mercerCard.waitFor({ state: 'visible', timeout: 4000 });
  await naturalClick(page, mercerCard, 'Mercer deadline card');
  await page.waitForTimeout(REL.MODAL_SETTLE);

  await smoothMove(page, 960, 420);  // ProofBlock area
  await page.waitForTimeout(800);

  await smoothScroll(page, 130);     // scroll to "What will be logged"
  await page.waitForTimeout(400);
  await smoothMove(page, 960, 560);
  await page.waitForTimeout(REL.MODAL_TO_AUDIT);

  // ── SCENE 3: 0:30 — close modal, navigate to /agents ─────────────────────────
  await waitUntil(ABS.CLOSE_MODAL, T0);
  console.log(`[${elapsed(T0)}] Scene 3: closing modal → /agents`);

  await hideLowerThird(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  await page.goto(`${BASE}/agents`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(T.NAV_SETTLE);
  await reinitOverlays(page);
  mouse.x = 100; mouse.y = 300;

  // ── SCENE 4: hover proof strip, then click Run Closeout ───────────────────────
  console.log(`[${elapsed(T0)}] Scene 4: /agents — clicking Run Closeout`);

  await smoothMove(page, 760, 195);       // JudgeProofStrip
  await page.waitForTimeout(REL.HOVER_PROOF_STRIP);

  const runBtn = page.locator('button').filter({ hasText: /run closeout/i }).first();
  await runBtn.waitFor({ state: 'visible', timeout: 5000 });
  const runBtnBox = await runBtn.boundingBox().catch(() => null);
  if (runBtnBox) {
    await smoothMove(page, runBtnBox.x + runBtnBox.width / 2, runBtnBox.y + runBtnBox.height / 2);
    await page.waitForTimeout(REL.PRE_CLICK_PAUSE);
  }

  // CLICK — live sweep runs from here
  await naturalClick(page, runBtn, 'Run Closeout');
  await page.waitForTimeout(500);

  // ── SCENE 5: sweep animates, architecture lower-thirds ────────────────────────
  console.log(`[${elapsed(T0)}] Scene 5: sweep running`);

  // Lower-thirds play while timeline observations animate in
  await showLowerThird(page, 'Google ADK — Coordinator + 4 Sub-Agents');
  await page.waitForTimeout(REL.LT1_DURATION);
  await smoothMove(page, 1380, 680);

  await hideLowerThird(page);
  await showLowerThird(page, 'Billing · Deadlines · Client Comms · Anomalies');
  await page.waitForTimeout(REL.LT2_DURATION);
  await smoothMove(page, 1350, 700);

  await hideLowerThird(page);
  await showLowerThird(page, 'Routing is a Python dict — not an LLM call');
  await page.waitForTimeout(REL.LT3_DURATION);
  await smoothMove(page, 960, 540);

  await hideLowerThird(page);

  // Wait for "Replay sweep" if not yet visible — confirms sweep completed
  await page.waitForSelector('text=/replay sweep/i', { timeout: REL.SWEEP_TIMEOUT })
    .catch(() => console.log('[sweep] timeout — proceeding'));

  await page.waitForTimeout(REL.POST_SWEEP_SETTLE);

  // ── SCENE 6: splash end card ──────────────────────────────────────────────────
  console.log(`[${elapsed(T0)}] Scene 6: /splash`);
  await page.goto(`${BASE}/splash`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);

  // Re-inject cursor after navigation (page DOM was replaced)
  await initCursor(page);
  await smoothMove(page, 960, 540);

  // VP8 drops frames on completely static pages — drift the cursor slowly to
  // keep frame generation running for the full TITLE_HOLD duration.
  // initCursor must be called first so the element exists on this page.
  const splashStart = Date.now();
  while (Date.now() - splashStart < REL.TITLE_HOLD) {
    const progress = (Date.now() - splashStart) / REL.TITLE_HOLD;
    const x = Math.round(960 + Math.sin(progress * Math.PI * 4) * 60);
    const y = Math.round(540 + Math.cos(progress * Math.PI * 3) * 40);
    await page.mouse.move(x, y);
    updateCursor(page, x, y);
    await page.waitForTimeout(80);
  }

  console.log(`[${elapsed(T0)}] Done — closing browser`);
  await browser.close();

  await new Promise(r => setTimeout(r, 2000));
  const files = fs.readdirSync(VIDEO_OUTPUT_DIR)
    .filter(f => f.endsWith('.webm'))
    .map(f => ({ name: f, time: fs.statSync(path.join(VIDEO_OUTPUT_DIR, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);

  if (files.length > 0) {
    const outPath = path.join(VIDEO_OUTPUT_DIR, files[0].name);
    console.log(`\n✓ Video: ${outPath}`);
    console.log('\nNext: node demo-merge.cjs  →  litt-demo-final.mp4');
  }

  process.exit(0);
})().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
