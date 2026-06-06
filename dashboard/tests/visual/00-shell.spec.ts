import { test, expect } from '@playwright/test';
import { mockAllApis } from './fixtures';

test('rail renders correctly on overview', async ({ page }) => {
  await mockAllApis(page);
  await page.goto('/');
  await page.waitForSelector('nav');
  await expect(page).toHaveScreenshot('00-shell-overview.png', {
    clip: { x: 0, y: 0, width: 232, height: 900 },
  });
});

test('active state updates on navigation', async ({ page }) => {
  await mockAllApis(page);
  await page.goto('/deadlines');
  await page.waitForSelector('nav');
  await expect(page).toHaveScreenshot('00-shell-deadlines-active.png', {
    clip: { x: 0, y: 0, width: 232, height: 900 },
  });
});
