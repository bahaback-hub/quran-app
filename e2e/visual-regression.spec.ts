/**
 * E2E visual regression tests using Playwright screenshot comparison.
 * Captures screenshots of key UI states and compares against baselines.
 *
 * Thresholds tuned for CI headless chromium (font rendering differences):
 * - maxDiffPixelRatio: 0.05 (5% of pixels can differ)
 * - threshold: 0.2 (per-pixel tolerance for anti-aliasing)
 *
 * If screenshots fail after intentional UI changes, update baselines with:
 *   npx playwright test --update-snapshots
 */
import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    await page.waitForSelector('.surah-content', { timeout: 15000 });
    // Wait for fonts to load (critical for Arabic text rendering)
    await page.waitForTimeout(1500);
  });

  test('homepage - surah view', async ({ page }) => {
    await expect(page.locator('.surah-content')).toHaveScreenshot('surah-view.png', {
      maxDiffPixelRatio: 0.05,
      threshold: 0.2,
    });
  });

  test('prayer bar - collapsed state', async ({ page }) => {
    const prayerBar = page.locator('.prayer-bar');
    if (await prayerBar.isVisible()) {
      await expect(prayerBar).toHaveScreenshot('prayer-bar-collapsed.png', {
        maxDiffPixelRatio: 0.05,
        threshold: 0.2,
      });
    }
  });

  test('bottom navigation', async ({ page }) => {
    const bottomNav = page.locator('.bottom-nav');
    if (await bottomNav.isVisible()) {
      await expect(bottomNav).toHaveScreenshot('bottom-nav.png', {
        maxDiffPixelRatio: 0.05,
        threshold: 0.2,
      });
    }
  });

  test('header area', async ({ page }) => {
    const header = page.locator('.header');
    if (await header.isVisible()) {
      await expect(header).toHaveScreenshot('header.png', {
        maxDiffPixelRatio: 0.05,
        threshold: 0.2,
      });
    }
  });
});
