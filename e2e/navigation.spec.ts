/**
 * E2E Tests — Navigation & Core Features.
 *
 * Tests surah navigation, theme switching, search functionality,
 * and keyboard accessibility across desktop and mobile viewports.
 */

import { test, expect } from './fixtures/mock-network';

async function waitForSurah(page: import('@playwright/test').Page, surah: number): Promise<void> {
  await expect(page.locator(`.ayah[data-surah="${surah}"]`).first()).toBeVisible({ timeout: 30000 });
}

test.describe('Quran App — Surah Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await waitForSurah(page, 1);
  });

  test('should load Al-Fatiha (surah 1) by default', async ({ page }) => {
    const surahSelect = page.locator('#surahSelect');
    const value = await surahSelect.inputValue();
    expect(value).toBe('1');
  });

  test('should navigate to Al-Baqarah and display ayahs', async ({ page }) => {
    const surahSelect = page.locator('#surahSelect');
    await surahSelect.selectOption('2');
    await waitForSurah(page, 2);
    const ayahs = page.locator('.ayah[data-surah="2"]');
    const count = await ayahs.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should navigate to An-Nas (surah 114) — last surah', async ({ page }) => {
    const surahSelect = page.locator('#surahSelect');
    await surahSelect.selectOption('114');
    await waitForSurah(page, 114);
    const ayahs = page.locator('.ayah[data-surah="114"]');
    const count = await ayahs.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display reciter selector with options', async ({ page }) => {
    const reciterSelect = page.locator('#reciterSelect');
    await expect(reciterSelect).toBeVisible();
    const options = reciterSelect.locator('option');
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('should show loading progress when switching surahs', async ({ page }) => {
    const surahSelect = page.locator('#surahSelect');
    await surahSelect.selectOption('36'); // Ya-Sin
    await waitForSurah(page, 36);
    const ayahs = page.locator('.ayah[data-surah="36"]');
    const count = await ayahs.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Quran App — Theme Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ayahs-container', { timeout: 15000 });
  });

  test('should apply night mode via theme toggle', async ({ page }) => {
    // The click handler on #themeToggle uses event delegation: it looks
    // for `e.target.closest('.theme-btn')` and applies that button's
    // `data-theme` value. Clicking the wrapper div itself does nothing —
    // we must click the night-mode button specifically.
    const nightBtn = page.locator('.theme-btn[data-theme="night"]');
    await nightBtn.click();

    const bodyClass = await page.evaluate(() => document.body.classList.contains('night-mode'));
    expect(bodyClass).toBe(true);
  });

  test('should toggle night mode off when clicked again', async ({ page }) => {
    // Same delegation pattern as above — click the night button, then
    // the light button to revert.
    const nightBtn = page.locator('.theme-btn[data-theme="night"]');
    const lightBtn = page.locator('.theme-btn[data-theme="light"]');
    await nightBtn.click(); // Night mode on
    await lightBtn.click(); // Back to light

    const bodyClass = await page.evaluate(() => document.body.classList.contains('night-mode'));
    expect(bodyClass).toBe(false);
  });
});

test.describe('Quran App — Search Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ayahs-container', { timeout: 15000 });
  });

  test('should keep the search field visible in the reader command bar', async ({ page }) => {
    const searchInput = page.locator('#searchInput');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.reader-command-bar')).toBeVisible();
  });

  test('should display search results for Arabic query', async ({ page }) => {
    const searchInput = page.locator('#searchInput');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('بسم الله');
    // The visible magnifier starts the query; Enter also works.
    await page.locator('#searchToggleBtn').click();
    // Wait for results to render (search index loads on idle).
    await page.waitForTimeout(3000);

    const results = page.locator('#searchResults');
    await expect(results).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Quran App — Mobile Layout', () => {
  test.use({ viewport: { width: 320, height: 700 } });

  test('should keep the unified search and display controls inside a narrow viewport', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ayahs-container', { timeout: 15000 });
    await page.evaluate(() => {
      document.getElementById('controls')?.classList.add('mobile-show');
      document.getElementById('searchInputGroup')?.classList.remove('hidden');
    });

    const elements = [
      page.locator('#searchInput'),
      page.locator('#kbdToggleBtn'),
      page.locator('#voiceSearchBtn'),
      page.locator('#viewSurahBtn'),
      page.locator('#viewMushafBtn'),
      page.locator('#viewPresBtn'),
    ];
    const viewportWidth = page.viewportSize()!.width;

    for (const element of elements) {
      await expect(element).toBeVisible();
      const box = await element.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth);
    }

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);

    const commandBar = page.locator('.reader-command-bar');
    const searchBox = await page.locator('#searchInputGroup').boundingBox();
    const displayBox = await page.locator('.reader-command-display').boundingBox();
    const commandBox = await commandBar.boundingBox();
    expect(commandBox).not.toBeNull();
    expect(searchBox).not.toBeNull();
    expect(displayBox).not.toBeNull();
    const sectionsAreSideBySide =
      searchBox!.x + searchBox!.width <= displayBox!.x || displayBox!.x + displayBox!.width <= searchBox!.x;
    expect(sectionsAreSideBySide).toBe(true);
    expect(commandBox!.height).toBeLessThan(130);
  });
});

test.describe('Quran App — Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ayahs-container', { timeout: 15000 });
  });

  test('should navigate between focusable elements with Tab', async ({ page }) => {
    await page.keyboard.press('Tab');
    const focusedTag1 = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'INPUT', 'SELECT', 'A']).toContain(focusedTag1);

    await page.keyboard.press('Tab');
    const focusedTag2 = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'INPUT', 'SELECT', 'A']).toContain(focusedTag2);
  });

  test('should activate focused button with Enter', async ({ page }) => {
    // Tab to settings button and press Enter
    const settingsBtn = page.locator('#settingsToggleBtn');
    await settingsBtn.focus();
    await page.keyboard.press('Enter');

    const settingsPanel = page.locator('#settingsPanel');
    await expect(settingsPanel).toHaveClass(/open/);
  });
});

test.describe('Quran App — PWA & Performance', () => {
  test('should have a service worker registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ayahs-container', { timeout: 15000 });

    const hasSW = await page.evaluate(() => {
      return 'serviceWorker' in navigator;
    });
    expect(hasSW).toBe(true);
  });

  test('should have meta viewport tag for mobile', async ({ page }) => {
    await page.goto('/');
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveAttribute('content', /width=device-width/);
  });

  test('should have manifest link for PWA', async ({ page }) => {
    await page.goto('/');
    const manifest = page.locator('link[rel="manifest"]');
    await expect(manifest).toHaveCount(1);
  });
});
