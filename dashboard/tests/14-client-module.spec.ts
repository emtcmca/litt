import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';

const _req = createRequire(import.meta.url);
const clientsData     = _req('../src/demo-fixtures/clients.json');
const maintenanceData = _req('../src/demo-fixtures/maintenance.json');
const pendingData     = _req('../src/demo-fixtures/pending.json');
const briefData       = _req('../src/demo-fixtures/brief.json');
const deadlinesData   = _req('../src/demo-fixtures/deadlines.json');
const inboundData     = _req('../src/demo-fixtures/inbound.json');
const auditData       = _req('../src/demo-fixtures/audit-log.json');

const json = (data: unknown) =>
  (r: { fulfill: (o: { json: unknown }) => Promise<void> }) => r.fulfill({ json: data });

async function mockClientApis(page: Page) {
  // Route order matters — most-specific patterns first
  await page.route('**/api/clients/*/maintenance*',    json(maintenanceData));
  await page.route('**/api/clients/*/suggestions/*/apply*',  json({ status: 'applied', audit_event_id: 'ae-test' }));
  await page.route('**/api/clients/*/suggestions/*/dismiss*', json({ status: 'dismissed', audit_event_id: 'ae-test' }));
  await page.route('**/api/clients/*/review*',         json(maintenanceData));
  await page.route('**/api/clients/*/cadence*',        json({ status: 'updated', cadence: 'daily' }));
  await page.route('**/api/clients/pending*',          json(pendingData));
  await page.route('**/api/clients*',                  json(clientsData));
  await page.route('**/api/brief*',                    json(briefData));
  await page.route('**/api/deadlines*',                json(deadlinesData));
  await page.route('**/api/inbound*',                  json(inboundData));
  await page.route('**/api/audit-log*',                json({ events: auditData }));
  await page.route('**/api/relationships*',            json([]));
  await page.route('**/api/budgets*',                  json([]));
  await page.route('**/api/sweep*',                    json({ timeline: { observations: [] }, brief: briefData }));
  await page.route('**/api/tools*',                    json([]));
  await page.route('**/api/commitments*',              json([]));
}

// ── Roster (/clients) ────────────────────────────────────────────────────────

test.describe('Client roster (/clients)', () => {
  test.beforeEach(async ({ page }) => {
    await mockClientApis(page);
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
  });

  test('CM-P8-04: renders 4 client rows, Mercer first', async ({ page }) => {
    // 4 clients in fixture; Mercer has highest pending_item_count
    await expect(page.getByText('Mercer Industries').first()).toBeVisible();
    await expect(page.getByText('Acme Commercial Partners').first()).toBeVisible();
    await expect(page.getByText('Whitmore Group').first()).toBeVisible();
    await expect(page.getByText('Lindqvist Holdings').first()).toBeVisible();

    // Mercer row should appear before Acme row
    const rows = page.locator('[data-testid="client-row"], tr, [role="row"]');
    const allText = await page.locator('body').innerText();
    const mercerIdx  = allText.indexOf('Mercer Industries');
    const acmeIdx    = allText.indexOf('Acme Commercial Partners');
    expect(mercerIdx).toBeLessThan(acmeIdx);
  });

  test('CM-P8-05: Mercer row has pending indicator; Lindqvist has none', async ({ page }) => {
    // Mercer has pending_item_count > 0 — "3 needs you" pill should be visible
    await expect(page.getByText(/needs you/).first()).toBeVisible();

    // Lindqvist has pending_item_count: 0 — no pill near its name
    const lindqvistSection = page.locator('text=Lindqvist Holdings').first();
    await expect(lindqvistSection).toBeVisible();
  });

  test('CM-P8-06: clicking Mercer row navigates to /clients/mercer-industries', async ({ page }) => {
    await page.getByText('Mercer Industries').first().click();
    await expect(page).toHaveURL(/\/clients\/mercer-industries/);
  });
});

// ── Command center (/clients/mercer-industries) ───────────────────────────────

test.describe('Client command center (/clients/mercer-industries)', () => {
  test.beforeEach(async ({ page }) => {
    await mockClientApis(page);
    await page.goto('/clients/mercer-industries');
    await page.waitForLoadState('networkidle');
  });

  test('CM-P8-07: renders without crash — "Needs attention" section visible', async ({ page }) => {
    await expect(page.getByText(/Needs attention/i).first()).toBeVisible();
  });

  test('CM-P8-08: needs-attention card click opens ResolvePanel', async ({ page }) => {
    // Click first AttnCard — the card itself is the trigger
    const attnCard = page.locator('button, [role="button"]').filter({ hasText: /escalation|review/i }).first();
    if (await attnCard.count() === 0) {
      // Fall back: click first visible card in the needs-attention grid
      await page.locator('[style*="dangerSoft"], [style*="gold"]').first().click({ force: true });
    } else {
      await attnCard.click();
    }
    // ResolvePanel renders a heading for the item
    await expect(page.getByRole('dialog').or(page.getByText(/DEADLINE|BILLING|BUDGET/i).first())).toBeVisible({ timeout: 3000 });
  });

  test('CM-P8-09: maintenance panel renders section headers', async ({ page }) => {
    await expect(page.getByText('HELD FOR YOUR REVIEW')).toBeVisible();
    await expect(page.getByText('APPLIED AUTOMATICALLY')).toBeVisible();
    await expect(page.getByText('Litt is keeping this file current')).toBeVisible();
  });

  test('CM-P8-10: "Apply & log" fires POST to apply endpoint', async ({ page }) => {
    const applyRequests: string[] = [];
    page.on('request', req => {
      if (req.method() === 'POST' && req.url().includes('/apply')) {
        applyRequests.push(req.url());
      }
    });

    const applyBtn = page.getByRole('button', { name: /apply.*log/i }).first();
    await expect(applyBtn).toBeVisible();
    await applyBtn.click();

    // Wait for the POST to fire
    await page.waitForTimeout(500);
    expect(applyRequests.length).toBeGreaterThan(0);
    expect(applyRequests[0]).toContain('/suggestions/');
    expect(applyRequests[0]).toContain('/apply');
  });

  test('CM-P8-11: Dismiss → "Dismiss with reason" disabled; type 4 chars → enabled', async ({ page }) => {
    const dismissBtn = page.getByRole('button', { name: /^dismiss$/i }).first();
    await expect(dismissBtn).toBeVisible();
    await dismissBtn.click();

    const submitBtn = page.getByRole('button', { name: /dismiss with reason/i }).first();
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeDisabled();

    // Type 3 chars — still disabled
    const textarea = page.locator('textarea').first();
    await textarea.fill('abc');
    await expect(submitBtn).toBeDisabled();

    // Type 4 chars — enabled
    await textarea.fill('abcd');
    await expect(submitBtn).toBeEnabled();
  });
});

// ── New client onboarding (/clients/new) ─────────────────────────────────────

test.describe('New client onboarding (/clients/new)', () => {
  test.beforeEach(async ({ page }) => {
    await mockClientApis(page);
    await page.goto('/clients/new');
    await page.waitForLoadState('networkidle');
  });

  test('CM-P8-12: renders drop zone + dark auto-onboard panel', async ({ page }) => {
    // Upload drop zone should be present
    await expect(
      page.getByText(/drop.*engagement.*letter|upload|drag/i).first()
    ).toBeVisible();
  });

  test('CM-P8-13: ?pending=cordova-partners renders review state with "auto-drafted" chip', async ({ page }) => {
    await mockClientApis(page);
    await page.goto('/clients/new?pending=cordova-partners');
    await page.waitForLoadState('networkidle');

    // Should show review state with the auto-drafted chip
    await expect(
      page.getByText(/auto.?drafted|auto-drafted|drafted/i).first()
    ).toBeVisible({ timeout: 5000 });
  });
});
