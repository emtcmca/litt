// node verify-checklist.js
// Playwright browser verification for v1.1.5 checklist
// Requires dev server running on http://localhost:3000

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const SS_DIR = path.join(__dirname, '..', 'tmp', 'verify-screenshots');
fs.mkdirSync(SS_DIR, { recursive: true });

const results = [];
let idx = 0;

function pass(label, note = '') {
  results.push({ status: 'PASS', label, note });
  console.log(`PASS  [${++idx}] ${label}${note ? ' — ' + note : ''}`);
}
function fail(label, note = '') {
  results.push({ status: 'FAIL', label, note });
  console.log(`FAIL  [${++idx}] ${label}${note ? ' — ' + note : ''}`);
}

async function ss(page, name) {
  const p = path.join(SS_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // ── 1. JudgeProofStrip ──────────────────────────────────────────────
  await page.goto(`${BASE}/agents`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const stripText = await page.locator('text=Track 1').first().isVisible().catch(() => false);
  const adkChip   = await page.locator('text=ADK').first().isVisible().catch(() => false);
  const mcpChip   = await page.locator('text=MCP adapters').first().isVisible().catch(() => false);
  const gemChip   = await page.locator('text=Gemini via Vertex').first().isVisible().catch(() => false);
  const crChip    = await page.locator('text=Cloud Run').first().isVisible().catch(() => false);
  await ss(page, '01-judge-proof-strip');
  if (stripText && adkChip && mcpChip && gemChip && crChip)
    pass('JudgeProofStrip — 5 chips visible');
  else
    fail('JudgeProofStrip — 5 chips visible', `Track1=${stripText} ADK=${adkChip} MCP=${mcpChip} Gemini=${gemChip} CR=${crChip}`);

  // ── 2. SweepStatusBar on click ─────────────────────────────────────
  const runBtn = page.locator('button', { hasText: /run closeout/i });
  const btnVisible = await runBtn.isVisible().catch(() => false);
  if (!btnVisible) {
    fail('SweepStatusBar — "Run Closeout" button visible', 'button not found');
  } else {
    await runBtn.click();
    await page.waitForTimeout(600);
    const chipText = await page.locator('text=Starting closeout sweep').isVisible().catch(() => false);
    await ss(page, '02-sweep-status-loading');
    chipText ? pass('SweepStatusBar — "Starting closeout sweep..." chip appears') : fail('SweepStatusBar — chip appears', 'text not found after click');
  }

  // ── 3. Timeline completes + SweepStatusBar updates ──────────────────
  // Fixture: 4.5s fallback + 20 steps × 640ms = 17.3s total. Wait 20s.
  await page.waitForTimeout(20000);
  const completeChip = await page.locator('text=/complete|Demo trace/i').first().isVisible().catch(() => false);
  await ss(page, '03-sweep-complete');
  completeChip ? pass('SweepStatusBar — updates to complete state') : fail('SweepStatusBar — complete state', 'complete chip not found after 20s');

  // ── 4. "Replay sweep" button appears ──────────────────────────────
  const replayBtn = await page.locator('button').filter({ hasText: /replay sweep/i }).first().isVisible().catch(() => false);
  await ss(page, '04-replay-button');
  replayBtn ? pass('"Replay sweep" button visible in header') : fail('"Replay sweep" button', 'not found after completion');

  // ── 5. ArchitectureLegend in Technical mode ────────────────────────
  const techToggle = page.locator('button', { hasText: /technical/i });
  const techVisible = await techToggle.isVisible().catch(() => false);
  if (techVisible) {
    await techToggle.click();
    await page.waitForTimeout(400);
  }
  // Legend items: forest solid line, teal dashed, gold solid, lock, danger circle
  const legendVisible = await page.locator('text=/legend|tool layer|gemini|coordinator/i').first().isVisible().catch(() => false);
  await ss(page, '05-architecture-legend');
  legendVisible ? pass('ArchitectureLegend visible in Technical mode') : fail('ArchitectureLegend', 'legend text not found in technical mode');

  // ── 6 & 7. Mercer ESCALATION modal — ProofBlock open by default ─────
  await page.goto(`${BASE}/brief`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  // ESCALATION item is Mercer Industries v. Dunlap (dl-mercer-001)
  const mercerItem = page.locator('text=/mercer|dunlap|summary judgment/i').first();
  const mercerVisible = await mercerItem.isVisible().catch(() => false);
  if (!mercerVisible) {
    fail('Mercer modal — ProofBlock open by default', 'Mercer ESCALATION item not found on Brief page');
    fail('"What will be logged" audit panel', 'Mercer item not found');
  } else {
    await mercerItem.click();
    await page.waitForTimeout(1000);
    // ProofBlock should be open — look for "Why Litt held" or gate chip
    const proofOpen = await page.locator('text=/why litt held|source, route|gate/i').first().isVisible().catch(() => false);
    const escalationChip = await page.locator('text=ESCALATION').first().isVisible().catch(() => false);
    await ss(page, '06-mercer-proof-block');
    proofOpen ? pass('Mercer ProofBlock open by default') : fail('Mercer ProofBlock open by default', 'proof block appears closed');
    escalationChip ? pass('Gate row shows ESCALATION chip') : fail('Gate row ESCALATION chip', 'chip not visible');

    // "What will be logged" panel
    const auditPanel = await page.locator('text=/what will be logged|creates an audit event/i').first().isVisible().catch(() => false);
    await ss(page, '07-audit-panel');
    auditPanel ? pass('"What will be logged" audit panel visible') : fail('"What will be logged" panel', 'panel text not found in modal');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // ── 8. Budget REVIEW_REQUIRED item — ProofBlock closed by default ───
  // Must navigate back to brief (previous test may have navigated away)
  const currentUrl = page.url();
  if (!currentUrl.includes('/brief')) {
    await page.goto(`${BASE}/brief`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
  }
  // Budget items headline: "Budget at 82.7% — Acme Commercial RE" — click the % text not client name
  const budgetCard = page.locator('text=/budget at \\d/i').first();
  const budgetVisible = await budgetCard.isVisible().catch(() => false);
  if (!budgetVisible) {
    fail('Budget REVIEW ProofBlock closed', 'Acme Commercial budget card not found on Brief page');
  } else {
    await budgetCard.click();
    await page.waitForTimeout(800);
    const toggleLabel = await page.locator('text=/show source, route/i').first().isVisible().catch(() => false);
    const expandedContent = await page.locator('text=/why litt held/i').first().isVisible().catch(() => false);
    await ss(page, '08-budget-review-proof-closed');
    (toggleLabel && !expandedContent) ? pass('Budget REVIEW ProofBlock closed by default') : fail('Budget REVIEW ProofBlock closed', `toggleLabel=${toggleLabel} expandedContent=${expandedContent}`);
  }

  // ── 9 & 10. Integrations ────────────────────────────────────────────
  await page.goto(`${BASE}/integrations`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const scopeChip  = await page.getByText('gmail.readonly', { exact: true }).first().isVisible().catch(() => false);
  const dirChip    = await page.locator('text=read-only').first().isVisible().catch(() => false);
  const toolChip   = await page.locator('text=scan_inbox').isVisible().catch(() => false);
  await ss(page, '09-integrations-tiles');
  (scopeChip && dirChip && toolChip) ? pass('Integrations — scope, direction, tool chips on Gmail tile') : fail('Integrations tile chips', `scope=${scopeChip} direction=${dirChip} tool=${toolChip}`);

  const mcpPanel = await page.locator('text=/how litt connects|mcp adapter|external system/i').first().isVisible().catch(() => false);
  const flowArrow = await page.locator('text=→').first().isVisible().catch(() => false);
  await ss(page, '10-mcp-boundary-panel');
  (mcpPanel && flowArrow) ? pass('MCP boundary panel visible with flow arrows') : fail('MCP boundary panel', `panel=${mcpPanel} arrows=${flowArrow}`);

  await browser.close();

  // ── Summary ─────────────────────────────────────────────────────────
  console.log('\n────────────────────────────────');
  const passes = results.filter(r => r.status === 'PASS').length;
  const fails  = results.filter(r => r.status === 'FAIL').length;
  console.log(`${passes} PASS  ${fails} FAIL  (${results.length} total)`);
  console.log(`Screenshots: ${SS_DIR}`);
  if (fails > 0) process.exit(1);
})();
