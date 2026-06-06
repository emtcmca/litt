import { test, expect } from '@playwright/test';
import { setupMocks } from './fixtures';

test.describe('Phase 11 — Integrations', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/integrations');
    await page.waitForLoadState('networkidle');
  });

  test('all 4 tiles rendered with status pills', async ({ page }) => {
    await expect(page.getByText('Integrations')).toBeVisible();
    await expect(page.getByText('Gmail')).toBeVisible();
    await expect(page.getByText('Google Calendar')).toBeVisible();
    await expect(page.getByText('LEDES 1998B export')).toBeVisible();
    await expect(page.getByText('Clio')).toBeVisible();
    await expect(page.screenshot({ fullPage: true })).resolves.toBeTruthy();
  });

  test('Clio shows Connect button, others show status', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Connect' })).toBeVisible();
    await expect(page.getByText('Connected').first()).toBeVisible();
    await expect(page.getByText('Ready')).toBeVisible();
    await expect(page.getByText('Available')).toBeVisible();
  });

  test('Connect button updates Clio tile to connected', async ({ page }) => {
    await page.getByRole('button', { name: 'Connect' }).click();
    await expect(page.getByText('Synced just now')).toBeVisible();
  });
});
