import { test, expect } from '@playwright/test';
import { mockAllApis } from './fixtures';

test('overview page', async ({ page }) => {
  await mockAllApis(page);
  await page.goto('/');
  await page.waitForSelector('h1');
  await expect(page).toHaveScreenshot('01-overview.png');
});
