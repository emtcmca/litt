import { test, expect } from '@playwright/test';
import { setupMocks } from './fixtures';

test.describe('Phase 9 — Budgets', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/budgets');
    await page.waitForLoadState('networkidle');
  });

  test('stat strip and utilization list', async ({ page }) => {
    await expect(page.getByText('Budgets')).toBeVisible();
    await expect(page.getByText('Budgeted matters')).toBeVisible();
    await expect(page.getByText('Over 75% warn')).toBeVisible();
    await expect(page.getByText('75 / 90%')).toBeVisible();
    await expect(page.getByText('Utilization by matter')).toBeVisible();
    await expect(page.screenshot({ fullPage: true })).resolves.toBeTruthy();
  });

  test('WARN row shows threshold indicator and CTA', async ({ page }) => {
    await expect(page.getByText('WARN').first()).toBeVisible();
    await expect(page.getByText('Review budget').first()).toBeVisible();
  });

  test('rows sorted by utilization descending', async ({ page }) => {
    const pcts = await page.locator('text=/%$/').allInnerTexts();
    const nums = pcts.map(t => parseInt(t)).filter(n => !isNaN(n));
    for (let i = 1; i < nums.length; i++) {
      expect(nums[i]).toBeLessThanOrEqual(nums[i - 1]);
    }
  });
});
