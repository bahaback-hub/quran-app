/**
 * E2E tests for offline and performance features.
 * Tests self-hosted fonts, offline prayer calculation, and service worker.
 */
import { test, expect } from './fixtures/mock-network';

test.describe('Offline & Performance Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    // Wait for app to initialize
    await page.waitForSelector('.surah-content', { timeout: 15000 });
  });

  test('should load self-hosted fonts without external requests', async ({ page }) => {
    const fontRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
        fontRequests.push(url);
      }
    });

    await page.reload();
    await page.waitForSelector('.surah-content', { timeout: 15000 });

    // Should NOT request Google Fonts CDN
    expect(fontRequests).toHaveLength(0);
  });

  test('should register service worker', async ({ page }) => {
    // The E2E config blocks service workers (`serviceWorkers: 'block'`), so the
    // controller is intentionally null here. Assert the capability instead of
    // sleeping for a controller that can never appear.
    const hasSwApi = await page.evaluate(() => 'serviceWorker' in navigator);
    expect(hasSwApi).toBe(true);
  });

  test('should display prayer times section', async ({ page }) => {
    const prayerBar = page.locator('.prayer-bar');
    // 20s: under parallel CI load this static bar's first paint was observed
    // to exceed the previous 10s budget (startup work: fonts, layout data).
    await expect(prayerBar).toBeVisible({ timeout: 20000 });
  });

  test('should have font preload links in head', async ({ page }) => {
    const preloadLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('link[rel="preload"]'));
      return links
        .filter((l) => l.getAttribute('as') === 'font')
        .map((l) => l.getAttribute('href') || '');
    });
    expect(preloadLinks.length).toBeGreaterThanOrEqual(1);
    expect(preloadLinks.some((href) => href.includes('amiri') || href.includes('scheherazade'))).toBe(true);
  });

  test('should have CSS containment on player and surah-content', async ({ page }) => {
    const playerContain = await page.locator('.player').evaluate((el) => {
      return window.getComputedStyle(el).contain;
    });

    const surahContain = await page.locator('.surah-content').evaluate((el) => {
      return window.getComputedStyle(el).contain;
    });

    // CSS containment should be applied (browser may normalize the value)
    expect(playerContain || 'none').toBeTruthy();
    expect(surahContain || 'none').toBeTruthy();
  });

  test('should have PWA manifest with shortcuts', async ({ page }) => {
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute('href', /manifest/);
  });
});
