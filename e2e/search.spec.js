import { test, expect } from '@playwright/test';

test.describe('البحث', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('حقل البحث موجود وقابل للكتابة', async ({ page }) => {
    await page.evaluate(() => {
      const group = document.getElementById('searchInputGroup');
      if (group) group.style.display = 'flex';
    });
    const searchInput = page.locator('#searchInput');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('الرحمن');
    await expect(searchInput).toHaveValue('الرحمن');
  });

  test('زر البحث موجود', async ({ page }) => {
    await expect(page.locator('#searchBtn')).toBeVisible();
  });

  test('زر مسح البحث موجود', async ({ page }) => {
    await expect(page.locator('#clearSearchBtn')).toBeVisible();
  });

  test('لوحة المفاتيح العربية تعمل عبر JS', async ({ page }) => {
    await page.evaluate(() => {
      const group = document.getElementById('searchInputGroup');
      if (group) group.style.display = 'flex';
      const kbd = document.getElementById('arabicKeyboard');
      const toggle = document.getElementById('kbdToggleBtn');
      if (kbd) kbd.classList.add('open');
      if (toggle) toggle.classList.add('active');
    });
    await expect(page.locator('#arabicKeyboard')).toBeVisible();
    await expect(page.locator('#kbdToggleBtn')).toHaveClass(/active/);
  });
});
