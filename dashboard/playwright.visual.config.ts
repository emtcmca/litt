import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
  },
  expect: {
    toHaveScreenshot: {
      threshold: 0.1,
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    },
  },
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
  },
  snapshotDir: './tests/visual/snapshots',
});
