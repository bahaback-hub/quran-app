/**
 * E2E visual regression tests using Playwright screenshot comparison.
 * Captures screenshots of key UI states and compares against baselines.
 *
 * Thresholds tuned for CI headless chromium (font rendering differences):
 * - maxDiffPixelRatio: 0.15 (15% of pixels can differ — CI font rendering variance)
 * - threshold: 0.3 (per-pixel tolerance for anti-aliasing)
 *
 * If screenshots fail after intentional UI changes, update baselines with:
 *   npx playwright test --update-snapshots
 */
import { test, expect } from './fixtures/mock-network';

test.describe('Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });
    // Wait for Arabic fonts to load only after the reader has actual content.
    // Waiting for `.surah-content` alone can capture either a skeleton or a
    // fully rendered surah, producing different snapshot dimensions in CI.
    await page.waitForFunction(() => document.fonts.status === 'loaded');
  });

  test('homepage - surah view', async ({ page }) => {
    await expect(page.locator('.surah-content')).toHaveScreenshot('surah-view.png', {
      maxDiffPixelRatio: 0.15,
      threshold: 0.3,
    });
  });

  test('prayer bar - collapsed state', async ({ page }) => {
    const prayerBar = page.locator('.prayer-bar');
    if (await prayerBar.isVisible()) {
      await expect(prayerBar).toHaveScreenshot('prayer-bar-collapsed.png', {
        maxDiffPixelRatio: 0.3,
        threshold: 0.4,
      });
    }
  });

  test('bottom navigation', async ({ page }) => {
    const bottomNav = page.locator('.bottom-nav');
    if (await bottomNav.isVisible()) {
      await expect(bottomNav).toHaveScreenshot('bottom-nav.png', {
        maxDiffPixelRatio: 0.15,
        threshold: 0.3,
      });
    }
  });

  test('header area', async ({ page }) => {
    const header = page.locator('.header');
    if (await header.isVisible()) {
      await expect(header).toHaveScreenshot('header.png', {
        maxDiffPixelRatio: 0.15,
        threshold: 0.3,
      });
    }
  });
});
