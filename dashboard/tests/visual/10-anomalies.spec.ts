import { test, expect } from '@playwright/test';
import { mockAllApis } from './fixtures';

test.describe('Phase 10 — Anomalies', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/anomalies');
    await page.waitForLoadState('networkidle');
  });

  test('elevated callout and detector roster', async ({ page }) => {
    await expect(page.getByText('Anomalies')).toBeVisible();
    await expect(page.getByText('Detectors')).toBeVisible();
    await expect(page.getByText('Cleared today')).toBeVisible();
    await expect(page.getByText('Missing narrative')).toBeVisible();
    await expect(page.screenshot({ fullPage: true })).resolves.toBeTruthy();
  });

  test('all 13 detectors rendered', async ({ page }) => {
    const detectorNames = [
      'Missing narrative', 'Vague narrative', 'Duplicate entry', 'Round hours, no session',
      'Rate deviation', 'Block-billing', 'Forbidden phrases', 'Stale pending (>30d)',
      'After-hours spike', 'Excessive daily hours', 'Weekend anomaly', 'Negative duration', 'Budget overrun',
    ];
    for (const name of detectorNames) {
      await expect(page.getByText(name)).toBeVisible();
    }
  });

  test('cleared today entries visible', async ({ page }) => {
    await expect(page.getByText('Duplicate of te-014')).toBeVisible();
    await expect(page.getByText('Round-hours entry te-009')).toBeVisible();
  });
});
