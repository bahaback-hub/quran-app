/**
 * E2E visual regression tests using Playwright screenshot comparison.
 * Captures screenshots of key UI states and compares against baselines.
 */
import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    await page.waitForSelector('.surah-content', { timeout: 15000 });
    // Wait for fonts to load
    await page.waitForTimeout(1000);
  });

  test('homepage - surah view', async ({ page }) => {
    await expect(page.locator('.surah-content')).toHaveScreenshot('surah-view.png', {
      maxDiffPixelRatio: 0.1,
      threshold: 0.3,
    });
  });

  test('prayer bar - collapsed state', async ({ page }) => {
    const prayerBar = page.locator('.prayer-bar');
    if (await prayerBar.isVisible()) {
      await expect(prayerBar).toHaveScreenshot('prayer-bar-collapsed.png', {
        maxDiffPixelRatio: 0.1,
        threshold: 0.3,
      });
    }
  });

  test('bottom navigation', async ({ page }) => {
    const bottomNav = page.locator('.bottom-nav');
    if (await bottomNav.isVisible()) {
      await expect(bottomNav).toHaveScreenshot('bottom-nav.png', {
        maxDiffPixelRatio: 0.1,
        threshold: 0.3,
      });
    }
  });

  test('header area', async ({ page }) => {
    const header = page.locator('.header');
    if (await header.isVisible()) {
      await expect(header).toHaveScreenshot('header.png', {
        maxDiffPixelRatio: 0.1,
        threshold: 0.3,
      });
    }
  });
});
