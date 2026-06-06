import { test, expect } from '@playwright/test';
import { mockAllApis } from './fixtures';

test('collect page — pipeline and held', async ({ page }) => {
  await mockAllApis(page);
  await page.goto('/collect');
  await page.waitForSelector('h1');
  await expect(page).toHaveScreenshot('04-collect-top.png');
});

test('collect page — scrubber and realization', async ({ page }) => {
  await mockAllApis(page);
  await page.goto('/collect');
  await page.waitForSelector('h1');
  await page.evaluate(() => window.scrollTo(0, 300));
  await expect(page).toHaveScreenshot('05-collect-bottom.png');
});
