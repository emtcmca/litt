import { test, expect } from '@playwright/test';
import { mockAllApis } from './fixtures';

test('policy — dial and scope banner', async ({ page }) => {
  await mockAllApis(page);
  await page.goto('/policy');
  await page.waitForSelector('h1');
  await expect(page).toHaveScreenshot('21-policy-dial.png', { animations: 'disabled' });
});

test('policy — domain rules', async ({ page }) => {
  await mockAllApis(page);
  await page.goto('/policy');
  await page.waitForSelector('h1');
  await page.evaluate(() => window.scrollTo(0, 400));
  await expect(page).toHaveScreenshot('22-policy-domains.png', { animations: 'disabled' });
});

test('policy — toggle auto (dl_soft)', async ({ page }) => {
  await mockAllApis(page);
  await page.goto('/policy');
  await page.waitForSelector('h1');
  await page.getByRole('button', { name: 'Auto + log' }).first().click();
  await expect(page).toHaveScreenshot('23-policy-toggled.png', { animations: 'disabled' });
});
