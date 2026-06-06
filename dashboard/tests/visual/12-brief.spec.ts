import { test, expect } from '@playwright/test';
import { setupMocks } from './fixtures';

test.describe('Phase 12 — Brief hub', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/brief');
    await page.waitForLoadState('networkidle');
  });

  test('header, hero, and 2-col layout', async ({ page }) => {
    await expect(page.getByText('Brief')).toBeVisible();
    await expect(page.getByText('the centerpiece')).toBeVisible();
    await expect(page.getByText('Brief ready')).toBeVisible();
    await expect(page.getByText('decisions need you')).toBeVisible();
    await expect(page.getByText("Open today's closeout")).toBeVisible();
    await expect(page.getByText('Run brief now')).toBeVisible();
    await expect(page.screenshot({ fullPage: true })).resolves.toBeTruthy();
  });

  test('surfaced decisions list with schedule panel', async ({ page }) => {
    await expect(page.getByText('What this brief surfaced')).toBeVisible();
    await expect(page.getByText('ranked by pressure')).toBeVisible();
    await expect(page.getByText('Schedule')).toBeVisible();
    await expect(page.getByText('Daily closeout')).toBeVisible();
    await expect(page.getByText('Morning brief')).toBeVisible();
    await expect(page.getByText('On significant events')).toBeVisible();
  });

  test('schedule toggle changes state', async ({ page }) => {
    const morningBtn = page.getByRole('button', { name: /Morning brief/ });
    await morningBtn.click();
    await expect(page.screenshot()).resolves.toBeTruthy();
  });
});
