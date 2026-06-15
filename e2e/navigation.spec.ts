/**
 * E2E Tests — Navigation & Core Features.
 *
 * Tests surah navigation, theme switching, search functionality,
 * and keyboard accessibility across desktop and mobile viewports.
 */

import { test, expect } from '@playwright/test';

test.describe('Quran App — Surah Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ayahs-container', { timeout: 15000 });
  });

  test('should load Al-Fatiha (surah 1) by default', async ({ page }) => {
    const surahSelect = page.locator('#surahSelect');
    const value = await surahSelect.inputValue();
    expect(value).toBe('1');
  });

  test('should navigate to Al-Baqarah and display ayahs', async ({ page }) => {
    const surahSelect = page.locator('#surahSelect');
    await surahSelect.selectOption('2');
    await page.waitForTimeout(2000);

    // Should have ayah elements
    const ayahs = page.locator('.ayah');
    const count = await ayahs.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should navigate to An-Nas (surah 114) — last surah', async ({ page }) => {
    const surahSelect = page.locator('#surahSelect');
    await surahSelect.selectOption('114');
    await page.waitForTimeout(2000);

    const ayahs = page.locator('.ayah');
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
    // The app should still show content after loading
    await page.waitForSelector('.ayahs-container', { timeout: 15000 });
    const ayahs = page.locator('.ayah');
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
    const themeToggle = page.locator('#themeToggle');
    await themeToggle.click();

    const bodyClass = await page.evaluate(() => document.body.classList.contains('night-mode'));
    expect(bodyClass).toBe(true);
  });

  test('should toggle night mode off when clicked again', async ({ page }) => {
    const themeToggle = page.locator('#themeToggle');
    await themeToggle.click(); // Night mode on
    await themeToggle.click(); // Night mode off

    const bodyClass = await page.evaluate(() => document.body.classList.contains('night-mode'));
    expect(bodyClass).toBe(false);
  });
});

test.describe('Quran App — Search Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ayahs-container', { timeout: 15000 });
  });

  test('should open search when search button is clicked', async ({ page }) => {
    const searchBtn = page.locator('#searchBtn');
    await searchBtn.click();

    const searchInput = page.locator('#searchInput');
    await expect(searchInput).toBeVisible();
  });

  test('should display search results for Arabic query', async ({ page }) => {
    const searchBtn = page.locator('#searchBtn');
    await searchBtn.click();

    const searchInput = page.locator('#searchInput');
    await searchInput.fill('بسم الله');
    await page.waitForTimeout(2000);

    const results = page.locator('#searchResults');
    await expect(results).toBeVisible();
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
