import { test, expect } from '@playwright/test';
import { mockAllApis } from './fixtures';

test('relationships — inbound + summary strip', async ({ page }) => {
  await mockAllApis(page);
  await page.goto('/relationships');
  await page.waitForSelector('h1');
  await expect(page).toHaveScreenshot('24-relationships-inbound.png', { animations: 'disabled' });
});

test('relationships — commitments section', async ({ page }) => {
  await mockAllApis(page);
  await page.goto('/relationships');
  await page.waitForSelector('h1');
  await page.evaluate(() => window.scrollTo(0, 800));
  await expect(page).toHaveScreenshot('25-relationships-commitments.png', { animations: 'disabled' });
});

test('relationships — going quiet + board', async ({ page }) => {
  await mockAllApis(page);
  await page.goto('/relationships');
  await page.waitForSelector('h1');
  await page.evaluate(() => window.scrollTo(0, 2000));
  await expect(page).toHaveScreenshot('26-relationships-quiet.png', { animations: 'disabled' });
});
