import { test, expect } from '@playwright/test';
import { mockAllApis } from './fixtures';

test('deadlines top — callout and timeline', async ({ page }) => {
  await mockAllApis(page);
  await page.goto('/deadlines');
  await page.waitForSelector('h1');
  await expect(page).toHaveScreenshot('02-deadlines-top.png');
});

test('deadlines book — filtered to all', async ({ page }) => {
  await mockAllApis(page);
  await page.goto('/deadlines');
  await page.waitForSelector('h1');
  await page.evaluate(() => window.scrollTo(0, 400));
  await expect(page).toHaveScreenshot('03-deadlines-book.png');
});
