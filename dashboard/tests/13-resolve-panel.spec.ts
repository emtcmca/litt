import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';

// Node.js 22+ ESM requires `with { type: "json" }` for JSON imports,
// which esbuild doesn't emit. Use createRequire (CJS path) instead.
const _req = createRequire(import.meta.url);
const briefData  = _req('../src/demo-fixtures/brief.json');
const inboundData = _req('../src/demo-fixtures/inbound.json');

async function mockApis(page: Page) {
  const json = (data: unknown) =>
    (r: { fulfill: (o: { json: unknown }) => Promise<void> }) => r.fulfill({ json: data });
  await page.route('**/api/brief*',         json(briefData));
  await page.route('**/api/inbound*',       json(inboundData));
  await page.route('**/api/sweep*',         json({ timeline: { observations: [] }, brief: briefData }));
  await page.route('**/api/tools*',         json([]));
  await page.route('**/api/deadlines*',     json([]));
  await page.route('**/api/commitments*',   json([]));
  await page.route('**/api/relationships*', json([]));
  await page.route('**/api/budgets*',       json([]));
  await page.route('**/api/audit-log*',     json([]));
}

/**
 * Phase 8 smoke tests — ResolvePanel
 *
 * Verifies:
 *   - All 5 seed decision variants open the correct panel from Brief
 *   - Destructive actions are blocked until a reason is provided
 *   - Audit preview event name updates when switching actions
 *   - Inbound triage shape fetches and renders without crash
 */
test.describe('Phase 8 — ResolvePanel smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    await mockApis(page);
    await page.goto('/brief');
    await page.waitForLoadState('networkidle');
  });

  // ── Variant 1: Deadline ───────────────────────────────────────────────────

  test('deadline panel opens, shows confirm action and audit event, closes', async ({ page }) => {
    await page.getByText('Opposition to MSJ').first().click();
    await expect(page.getByRole('heading', { name: 'Opposition to MSJ' })).toBeVisible();
    await expect(page.getByText('DEADLINE', { exact: true })).toBeVisible();
    await expect(page.getByText('deadline.confirmed')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Opposition to MSJ' })).not.toBeVisible();
  });

  // ── Variant 2: Billing ────────────────────────────────────────────────────

  test('billing panel opens with correct headline and kind label', async ({ page }) => {
    // Brief headline: narrative is null → "${hours}h — ${matter_name}"
    await page.getByText('4h — Mercer Industries v. Dunlap Construction').click();
    await expect(page.getByRole('heading', { name: 'Billing entry has no narrative' })).toBeVisible();
    await expect(page.getByText('BILLING & WIP', { exact: true })).toBeVisible();
    await expect(page.getByText('billing.approved')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Billing entry has no narrative' })).not.toBeVisible();
  });

  // ── Variant 3: Budget ─────────────────────────────────────────────────────

  test('budget panel opens with correct headline', async ({ page }) => {
    await page.getByText('Budget at 78% — Acme Commercial Partners').click();
    await expect(page.getByRole('heading', { name: 'Acme Commercial Partners is at 78% of budget' })).toBeVisible();
    await expect(page.getByText('BUDGET RISK', { exact: true })).toBeVisible();
    await expect(page.getByText('budget.reviewed')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  // ── Variant 4: Anomaly ────────────────────────────────────────────────────

  test('anomaly panel opens with dismiss action', async ({ page }) => {
    // Both the Brief button and panel heading use what_is_happening
    await page.getByText('Missing narrative on te-001').first().click();
    await expect(page.getByRole('heading', { name: /Missing narrative on te-001/ })).toBeVisible();
    await expect(page.getByText('ANOMALY', { exact: true })).toBeVisible();
    await expect(page.getByText('anomaly.dismissed')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  // ── Variant 5: Silence ────────────────────────────────────────────────────

  test('silence panel opens with client comms kind and comms action', async ({ page }) => {
    await page.getByText('16d since last contact').click();
    await expect(page.getByRole('heading', { name: '16 days without contact — Whitmore Group' })).toBeVisible();
    await expect(page.getByText('CLIENT COMMS')).toBeVisible();
    await expect(page.getByText('comms.approved')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  // ── Destructive action blocked without reason ─────────────────────────────

  test('write-off button disabled until reason provided, enabled after', async ({ page }) => {
    await page.getByText('4h — Mercer Industries v. Dunlap Construction').click();
    await expect(page.getByRole('heading', { name: 'Billing entry has no narrative' })).toBeVisible();
    // Switch to destructive Write off action (div with role=radio, not a button element)
    await page.getByRole('radio', { name: 'Write off' }).click();
    // Footer submit button: disabled — reason textarea is empty
    await expect(page.getByRole('button', { name: 'Write off' })).toBeDisabled();
    // Provide ≥ 4 char reason → button becomes enabled
    await page.getByPlaceholder('Reason for this action…').fill('Duplicate entry');
    await expect(page.getByRole('button', { name: 'Write off' })).not.toBeDisabled();
  });

  // ── Audit preview updates on radio switch ─────────────────────────────────

  test('audit event name updates when switching billing actions', async ({ page }) => {
    await page.getByText('4h — Mercer Industries v. Dunlap Construction').click();
    // Default primary action: billing.approved
    await expect(page.getByText('billing.approved')).toBeVisible();
    // Switch to Write off → audit shows billing.written_off
    await page.getByRole('radio', { name: 'Write off' }).click();
    await expect(page.getByText('billing.written_off')).toBeVisible();
    // Switch to Write down → audit shows billing.written_down
    await page.getByRole('radio', { name: 'Write down' }).click();
    await expect(page.getByText('billing.written_down')).toBeVisible();
  });

  // ── Inbound shape loads without crash ────────────────────────────────────

  test('inbound panel fetches and renders message content', async ({ page }) => {
    // Brief shows BriefInboundItem.summary for Sandra Mercer (HIGH urgency)
    await page.getByText(/Client requesting position on Dunlap exhibits/).click();
    await expect(page.getByRole('heading', { name: 'Inbound message awaiting triage' })).toBeVisible();
    // InboundMessage fetched via mocked /api/inbound — resolves synchronously
    await expect(page.getByText('from Gmail · read-only')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/MSJ hearing is Thursday/)).toBeVisible();
    await expect(page.getByText('Approve & send')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Snooze' })).toBeVisible();
    // Hand off placeholder is disabled (v1.2)
    await expect(page.getByRole('button', { name: 'Hand off' })).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel' }).click();
  });
});
