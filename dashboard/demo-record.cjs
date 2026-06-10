/**
 * demo-record.cjs — Playwright demo recording driver for Litt v1.1.5
 *
 * WORKFLOW (no OBS or DaVinci needed):
 *   1.  cd dashboard && npm run dev          (port 3000)
 *   2.  cd backend && python -m uvicorn app.main:app --reload --port 8002
 *   3.  POST http://localhost:8002/api/demo/reset  (firm_id + confirm:true)
 *   4.  GET  http://localhost:8002/api/demo/ready  → all checks ok: True
 *   5.  node demo-record.cjs
 *   6.  Generate ElevenLabs audio → save as demo-narration.mp3 in dashboard/
 *   7.  node demo-merge.cjs  → tmp/demo-videos/litt-demo-final.mp4
 *
 * TIMING: Sweep completion is detected dynamically (watches for "Replay sweep"
 * button). Scenes 4–8 run on relative delays. No dead time after sweep.
 */

'use strict';
const path = require('path');
const fs   = require('fs');
const { chromium } = require('playwright');

const BASE             = 'http://localhost:3000';
const VIDEO_OUTPUT_DIR = path.join(__dirname, '..', 'tmp', 'demo-videos');

// ── Fixed scene start times (ms from recording start) ─────────────────────────
// Only Scenes 1–3 use absolute timing. Scenes 4–8 use relative delays.
const ABS = {
  TRIGGER: 12_000,   // 0:12 — navigate to /agents
  SWEEP:   20_000,   // 0:20 — click Run Closeout
};

// ── Relative delays for Scenes 4–8 (ms from when each prior scene completes) ──
const REL = {
  BRIEF_BUFFER:    4_000,  // hold on completed sweep before navigating to Brief
  BRIEF_TO_MERCER: 13_000, // dwell on Brief before clicking Mercer
  MODAL_SETTLE:      900,  // wait after modal opens
  MODAL_TO_AUDIT:  13_000, // hold on modal ProofBlock before audit panel
  AUDIT_HOLD:       3_000, // hold on audit panel
  CLOSE_HOLD:       7_000, // hold on closed modal
  TITLE_HOLD:       7_000, // title card display duration
};

// ── Intra-scene timing (ms) ────────────────────────────────────────────────────
const T = {
  MOUSE_STEP_DELAY:    12,
  MOUSE_STEPS:         28,
  CLICK_HOVER_PAUSE:  380,
  NAV_SETTLE:          700,
  LOWER_THIRD_FADE:    300,

  SCROLL_TO_ACME:      530,
  SCROLL_TO_WHITMORE:  190,
  SCROLL_STEPS:         10,
  SCROLL_STEP_DELAY:    35,

  PAUSE_ON_MERCER:    1200,
  PAUSE_ON_ACME:      1200,
  PAUSE_ON_WHITMORE:  1100,
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

// ── Lower-third overlay (bottom-left, left-accent style) ──────────────────────

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

// ── Title card (full-screen, branded, animated) ────────────────────────────────

async function showTitleCard(page) {
  await page.evaluate(() => {
    if (document.getElementById('litt-title-card')) return;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes litt-tc-fade { from{opacity:0} to{opacity:1} }
      @keyframes litt-tc-up   { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
      #litt-title-card { animation: litt-tc-fade 0.6s ease forwards; }
      .ltc { opacity:0; animation: litt-tc-up 0.55s ease forwards; }
      .ltc-1 { animation-delay:0.15s }
      .ltc-2 { animation-delay:0.30s }
      .ltc-3 { animation-delay:0.45s }
      .ltc-4 { animation-delay:0.60s }
      .ltc-5 { animation-delay:0.75s }
    `;
    document.head.appendChild(style);

    const tc = document.createElement('div');
    tc.id = 'litt-title-card';
    tc.style.cssText = [
      'position:fixed', 'inset:0',
      'background:#0B0E14',
      'background-image:' +
        'linear-gradient(rgba(13,148,136,0.055) 1px,transparent 1px),' +
        'linear-gradient(90deg,rgba(13,148,136,0.055) 1px,transparent 1px)',
      'background-size:52px 52px',
      'display:flex', 'flex-direction:column', 'align-items:center', 'justify-content:center',
      'z-index:9999999',
      "font-family:'IBM Plex Sans',system-ui,sans-serif",
    ].join(';');

    const pillStyle = (color, border, text) =>
      `style="background:rgba(${color},0.14);border:1px solid rgba(${border},0.38);color:${text};` +
      `font-size:13px;font-family:'IBM Plex Mono',monospace;padding:6px 16px;border-radius:20px;"`;

    tc.innerHTML = `
      <div style="text-align:center;max-width:860px;padding:0 48px;">

        <!-- Litt wordmark -->
        <div class="ltc ltc-1" style="margin-bottom:6px;">
          <span style="color:#0D9488;font-size:80px;font-weight:700;letter-spacing:-4px;line-height:1;">Litt</span>
        </div>

        <!-- Tagline -->
        <div class="ltc ltc-2" style="margin-bottom:44px;">
          <span style="color:#94A3B8;font-size:22px;font-weight:400;letter-spacing:0.1px;">
            Autonomous Operations Agent for Small Law Firms
          </span>
        </div>

        <!-- Rule -->
        <div class="ltc ltc-3" style="margin-bottom:36px;">
          <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(13,148,136,0.55) 30%,rgba(13,148,136,0.55) 70%,transparent);width:520px;margin:0 auto;"></div>
        </div>

        <!-- Tech stack pills -->
        <div class="ltc ltc-4" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:28px;">
          <span ${pillStyle('13,148,136','13,148,136','#5EEAD4')}>Google ADK</span>
          <span ${pillStyle('13,148,136','13,148,136','#5EEAD4')}>Gemini 2.5 Pro</span>
          <span ${pillStyle('13,148,136','13,148,136','#5EEAD4')}>Cloud Run</span>
          <span ${pillStyle('13,148,136','13,148,136','#5EEAD4')}>Firestore</span>
        </div>

        <!-- Hackathon + GitHub -->
        <div class="ltc ltc-5" style="display:flex;align-items:center;justify-content:center;gap:20px;">
          <span ${pillStyle('217,119,6','217,119,6','#F59E0B')}>Track 1 — Net-New Agents</span>
          <span style="color:#1F2937;font-size:16px;">·</span>
          <span style="color:#374151;font-size:13px;font-family:'IBM Plex Mono',monospace;">github.com/emtcmca/litt</span>
        </div>

      </div>
    `;
    document.body.appendChild(tc);
  });
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

  // ── Pre-warm in a throw-away context (not recorded) ──────────────────────────
  // Vite compiles route modules server-side on first request. Warming here means
  // the recording context's first navigation hits already-compiled bundles.
  console.log('[pre-warm] Loading routes (not recorded)...');
  const warmCtx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const warmPage = await warmCtx.newPage();
  await warmPage.goto(`${BASE}/clients/mercer-industries`, { waitUntil: 'networkidle' });
  await warmPage.goto(`${BASE}/agents`,                    { waitUntil: 'networkidle' });
  await warmPage.goto(`${BASE}/brief`,                     { waitUntil: 'networkidle' });
  await warmPage.goto(`${BASE}/clients/mercer-industries`, { waitUntil: 'networkidle' });
  await warmCtx.close();
  console.log('[pre-warm] Done.\n');

  // ── 3s countdown ─────────────────────────────────────────────────────────────
  for (let i = 3; i >= 1; i--) { console.log(`  ${i}...`); await new Promise(r => setTimeout(r, 1000)); }
  console.log('  GO\n');

  // ── Recording context starts here ─────────────────────────────────────────────
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: VIDEO_OUTPUT_DIR,
      size: { width: 1920, height: 1080 },
    },
  });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });

  // Prevent white flash on first navigation — app background is dark anyway
  await page.addInitScript(() => {
    document.documentElement.style.background = '#0B0E14';
  });

  await page.goto(`${BASE}/clients/mercer-industries`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600); // brief settle before Scene 1

  const T0 = Date.now();

  // ── SCENE 1: 0:00–0:12 — maintenance panel ───────────────────────────────────
  console.log(`[${elapsed(T0)}] Scene 1: maintenance panel`);
  await reinitOverlays(page);
  await showLowerThird(page, 'SAFE → auto-applied  ·  JUDGMENT → held for review');

  await smoothMove(page, 1180, 430);
  await page.waitForTimeout(800);
  await smoothMove(page, 1100, 480);
  await page.waitForTimeout(400);
  await smoothMove(page, 1150, 450);

  await waitUntil(ABS.TRIGGER, T0);

  // ── SCENE 2: 0:12–0:20 — navigate to /agents, show architecture ───────────────
  console.log(`[${elapsed(T0)}] Scene 2: /agents`);
  await hideLowerThird(page);
  await page.goto(`${BASE}/agents`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(T.NAV_SETTLE);
  await reinitOverlays(page);
  mouse.x = 100; mouse.y = 300;

  await smoothMove(page, 760, 195); // hover on JudgeProofStrip
  await page.waitForTimeout(600);

  // Hover the Run Closeout button to show it — but do NOT click (would inflate decisions)
  const runBtn = page.locator('button').filter({ hasText: /run closeout/i }).first();
  const runBtnBox = await runBtn.boundingBox().catch(() => null);
  if (runBtnBox) {
    await smoothMove(page, runBtnBox.x + runBtnBox.width / 2, runBtnBox.y + runBtnBox.height / 2);
    await page.waitForTimeout(400);
  }

  await waitUntil(ABS.SWEEP, T0);

  // ── SCENE 3: agent architecture — fixed 20s, no live sweep ───────────────────
  console.log(`[${elapsed(T0)}] Scene 3: agent architecture`);
  await showLowerThird(page, 'Google ADK — Coordinator + 4 Sub-Agents');
  await page.waitForTimeout(4000);
  await smoothMove(page, 1380, 680);
  await page.waitForTimeout(3000);

  await hideLowerThird(page);
  await showLowerThird(page, 'Billing · Deadlines · Client Comms · Anomalies — each has its own specialist');
  await page.waitForTimeout(5000);
  await smoothMove(page, 1350, 700);

  await hideLowerThird(page);
  await showLowerThird(page, 'Routing is a Python dict — not an LLM call');
  await page.waitForTimeout(4000);
  await smoothMove(page, 960, 540);
  await page.waitForTimeout(2000);
  await hideLowerThird(page);
  await page.waitForTimeout(1500);

  // ── SCENE 4: Brief — scroll Mercer → Acme → Whitmore ─────────────────────────
  console.log(`[${elapsed(T0)}] Scene 4: /brief`);
  await page.goto(`${BASE}/brief`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(T.NAV_SETTLE);
  await reinitOverlays(page);
  mouse.x = 960; mouse.y = 540;

  await showLowerThird(page, 'HARD_LEGAL  ·  6 days  ·  unconfirmed');

  const mercerCard = page.locator('text=/opposition.*summary judgment|mercer.*dunlap/i').first();
  await mercerCard.waitFor({ state: 'visible', timeout: 6000 });
  const mercerBox = await mercerCard.boundingBox();
  if (mercerBox) {
    await smoothMove(page, mercerBox.x + mercerBox.width * 0.4, mercerBox.y + mercerBox.height / 2);
  }
  await page.waitForTimeout(T.PAUSE_ON_MERCER);

  await smoothScroll(page, T.SCROLL_TO_ACME);
  await page.waitForTimeout(300);
  await page.waitForTimeout(T.PAUSE_ON_ACME);

  await smoothScroll(page, T.SCROLL_TO_WHITMORE);
  await page.waitForTimeout(300);
  await page.waitForTimeout(T.PAUSE_ON_WHITMORE);

  // Scroll back to Mercer
  await smoothScroll(page, -(T.SCROLL_TO_ACME + T.SCROLL_TO_WHITMORE + 40));
  await page.waitForTimeout(400);
  await hideLowerThird(page);

  // Dwell on Brief until BRIEF_TO_MERCER ms has elapsed since Brief loaded
  // (most time already used by scroll sequence; this catches up if scroll was fast)
  const briefScrollTime = T.PAUSE_ON_MERCER + T.PAUSE_ON_ACME + T.PAUSE_ON_WHITMORE + 2000;
  const briefRemaining  = REL.BRIEF_TO_MERCER - briefScrollTime;
  if (briefRemaining > 0) await page.waitForTimeout(briefRemaining);

  // ── SCENE 5: click Mercer — ProofBlock + source excerpt ──────────────────────
  console.log(`[${elapsed(T0)}] Scene 5: Mercer modal`);
  await showLowerThird(page, 'ESCALATION — escalated, not auto-confirmed');
  await mercerCard.waitFor({ state: 'visible', timeout: 4000 });
  await naturalClick(page, mercerCard, 'Mercer deadline card');
  await page.waitForTimeout(REL.MODAL_SETTLE);

  await smoothMove(page, 960, 420); // ProofBlock area — Gate row visible
  await page.waitForTimeout(800);

  await smoothScroll(page, 130); // scroll modal to show "What will be logged" panel
  await page.waitForTimeout(400);
  await smoothMove(page, 960, 560);

  await page.waitForTimeout(REL.MODAL_TO_AUDIT);

  // ── SCENE 6: audit panel — CREATE-only proof ──────────────────────────────────
  console.log(`[${elapsed(T0)}] Scene 6: audit panel`);
  await hideLowerThird(page);
  await showLowerThird(page, 'CREATE-only  ·  tier: legal_defensibility  ·  append-only');

  const auditPanel = page.locator('text=/what will be logged/i').first();
  const auditVisible = await auditPanel.isVisible().catch(() => false);
  if (auditVisible) {
    await auditPanel.scrollIntoViewIfNeeded();
    const box = await auditPanel.boundingBox();
    if (box) await smoothMove(page, box.x + box.width / 2, box.y + box.height / 2 + 28);
  } else {
    await smoothScroll(page, 100);
    await smoothMove(page, 960, 570);
  }
  await page.waitForTimeout(REL.AUDIT_HOLD);

  // ── SCENE 7: close modal ──────────────────────────────────────────────────────
  console.log(`[${elapsed(T0)}] Scene 7: close modal`);
  await hideLowerThird(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  await smoothMove(page, 960, 400);
  await page.waitForTimeout(REL.CLOSE_HOLD);

  // ── SCENE 8: splash end card ──────────────────────────────────────────────────
  console.log(`[${elapsed(T0)}] Scene 8: splash end card`);
  await page.goto(`${BASE}/splash`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  await smoothMove(page, 960, 540);
  await page.waitForTimeout(REL.TITLE_HOLD);

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
