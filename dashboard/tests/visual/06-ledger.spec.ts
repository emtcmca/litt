import { test, expect } from '@playwright/test';
import { mockAllApis } from './fixtures';

test('audit ledger — default view (first row open)', async ({ page }) => {
  await mockAllApis(page);
  await page.goto('/audit');
  await page.waitForSelector('h1');
  await expect(page).toHaveScreenshot('18-ledger-default.png', { animations: 'disabled' });
});

test('audit ledger — legal tier filter', async ({ page }) => {
  await mockAllApis(page);
  await page.goto('/audit');
  await page.waitForSelector('h1');
  await page.getByText('Legal record').first().click();
  await expect(page).toHaveScreenshot('19-ledger-legal-filter.png', { animations: 'disabled' });
});

test('audit ledger — row expand (metadata + diff)', async ({ page }) => {
  await mockAllApis(page);
  await page.goto('/audit');
  await page.waitForSelector('[data-testid="ledger-row"]');
  await page.getByTestId('ledger-row').nth(1).click();
  await expect(page).toHaveScreenshot('20-ledger-row-expand.png', { animations: 'disabled' });
});
