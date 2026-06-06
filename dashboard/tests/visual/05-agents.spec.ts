import { test, expect } from '@playwright/test';
import { mockAllApis } from './fixtures';

test('agent console — idle state (frozen)', async ({ page }) => {
  await mockAllApis(page);
  await page.goto('/agents?frozen=1');
  await page.waitForSelector('h1');
  await page.waitForTimeout(500);
  await expect(page).toHaveScreenshot('14-agents-idle.png', {
    animations: 'disabled',
    mask: [page.locator('[data-dynamic]')],
  });
});

test('agent console — plain/technical toggle', async ({ page }) => {
  await mockAllApis(page);
  await page.goto('/agents?frozen=1');
  await page.waitForSelector('h1');
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Technical' }).click();
  await expect(page).toHaveScreenshot('14-agents-technical.png', { animations: 'disabled' });
});

test('agent console — tool-call step (billing scrubber)', async ({ page }) => {
  await mockAllApis(page);
  await page.goto('/agents?frozen=1');
  await page.waitForSelector('h1');
  await page.waitForTimeout(500);
  await page.getByTestId('sweep-step').nth(13).click();
  await expect(page).toHaveScreenshot('15-agents-toolcall.png', {
    animations: 'disabled',
    mask: [page.locator('[data-dynamic]')],
  });
});

test('agent console — cross-agent hand-off', async ({ page }) => {
  await mockAllApis(page);
  await page.goto('/agents?frozen=1');
  await page.waitForSelector('h1');
  await page.waitForTimeout(500);
  await page.getByTestId('sweep-step').nth(5).click();
  await expect(page).toHaveScreenshot('16-agents-handoff.png', { animations: 'disabled' });
});

test('agent console — tool catalog', async ({ page }) => {
  await mockAllApis(page);
  await page.goto('/agents?frozen=1');
  await page.waitForSelector('h1');
  await page.waitForTimeout(500);
  await page.getByText('Tool layer').first().click();
  await expect(page).toHaveScreenshot('17-agents-toollayer.png', { animations: 'disabled' });
});
