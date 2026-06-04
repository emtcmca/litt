import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'desktop', width: 1720, height: 960 },
  { name: 'tablet', width: 900, height: 900 },
  { name: 'phone', width: 390, height: 844 },
];

for (const viewport of viewports) {
  test(`closeout dashboard keeps primary content reachable on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Closeout docket' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run closeout sweep' })).toBeVisible();

    const metrics = await page.evaluate(() => {
      const viewportWidth = window.innerWidth;
      const heading = document.querySelector('main h2')?.getBoundingClientRect();
      const sweepButton = Array.from(document.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Run closeout sweep'))
        ?.getBoundingClientRect();

      return {
        viewportWidth,
        headingLeft: heading?.left ?? -1,
        headingRight: heading?.right ?? -1,
        sweepLeft: sweepButton?.left ?? -1,
        sweepRight: sweepButton?.right ?? -1,
      };
    });

    expect(metrics.headingLeft).toBeGreaterThanOrEqual(0);
    expect(metrics.headingRight).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.sweepLeft).toBeGreaterThanOrEqual(0);
    expect(metrics.sweepRight).toBeLessThanOrEqual(metrics.viewportWidth);
  });
}
