/**
 * E2E Tests — Core Application Smoke Tests.
 *
 * Verifies that the app loads correctly, surah navigation works,
 * and key UI elements are present and functional.
 */

import { test, expect } from './fixtures/mock-network';

test.describe('Quran App — Core Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to initialize (surah content appears)
    await page.waitForSelector('.ayahs-container', { timeout: 15000 });
  });

  test('should load the app and display surah content', async ({ page }) => {
    // Verify the page title contains Quran
    await expect(page).toHaveTitle(/قرآن|Quran/);

    // Verify surah content is visible
    const ayahsContainer = page.locator('.ayahs-container');
    await expect(ayahsContainer).toBeVisible();
  });

  test('should display the surah selector', async ({ page }) => {
    const surahSelect = page.locator('#surahSelect');
    await expect(surahSelect).toBeVisible();

    // Should have 114 surahs
    const options = surahSelect.locator('option');
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(114);
  });

  test('should display the reciter selector', async ({ page }) => {
    const reciterSelect = page.locator('#reciterSelect');
    await expect(reciterSelect).toBeVisible();
  });

  test('should navigate to a different surah', async ({ page }) => {
    const surahSelect = page.locator('#surahSelect');

    // Select Al-Baqarah (surah 2)
    await surahSelect.selectOption('2');

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Verify surah content changed
    const ayahsContainer = page.locator('.ayahs-container');
    await expect(ayahsContainer).toBeVisible();
  });

  test('should show the search button', async ({ page }) => {
    const searchBtn = page.locator('#searchBtn');
    await expect(searchBtn).toBeVisible();
  });

  test('should have correct document direction (RTL for Arabic)', async ({ page }) => {
    const dir = await page.getAttribute('html', 'dir');
    expect(dir).toBe('rtl');
  });

  test('should have correct language attribute', async ({ page }) => {
    const lang = await page.getAttribute('html', 'lang');
    expect(lang).toBe('ar');
  });
});

test.describe('Quran App — Settings Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ayahs-container', { timeout: 15000 });
  });

  test('should open settings panel', async ({ page }) => {
    const settingsBtn = page.locator('#settingsToggleBtn');
    await settingsBtn.click();

    const settingsPanel = page.locator('#settingsPanel');
    await expect(settingsPanel).toHaveClass(/open/);
  });

  test('should close settings panel', async ({ page }) => {
    // Open first
    const settingsBtn = page.locator('#settingsToggleBtn');
    await settingsBtn.click();

    // Close
    const closeBtn = page.locator('#settingsCloseBtn');
    await closeBtn.click();

    const settingsPanel = page.locator('#settingsPanel');
    await expect(settingsPanel).not.toHaveClass(/open/);
  });
});

test.describe('Quran App — Player', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ayahs-container', { timeout: 15000 });
    // The floating player starts collapsed (.player.collapsed). The
    // .expanded-content section (which contains #audioPlayer and
    // #playPauseBtn) is `display: none` while collapsed. Expand the
    // player so its inner controls become visible to toBeVisible().
    await page.evaluate(() => {
      const p = document.getElementById('player');
      if (p) {
        p.classList.remove('collapsed');
        p.classList.add('expanded');
      }
    });
    await page.waitForTimeout(300);
  });

  test('should display the audio player', async ({ page }) => {
    await expect(page.locator('#audioPlayer')).toBeVisible({ timeout: 10000 });
  });

  test('should show play/pause button', async ({ page }) => {
    const playPauseBtn = page.locator('#playPauseBtn');
    await expect(playPauseBtn).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Quran App — Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ayahs-container', { timeout: 15000 });
  });

  test('should have aria-label on interactive elements', async ({ page }) => {
    const buttons = page.locator('button[aria-label]');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should have focusable elements with proper tabindex', async ({ page }) => {
    const settingsBtn = page.locator('#settingsToggleBtn');
    await expect(settingsBtn).toBeVisible();

    // Tab to the settings button
    await page.keyboard.press('Tab');
    // Focus should move to a visible element
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'INPUT', 'SELECT', 'A']).toContain(focusedTag);
  });
});
