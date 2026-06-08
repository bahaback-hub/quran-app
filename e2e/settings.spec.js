import { test, expect } from '@playwright/test';

test.describe('الإعدادات', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const panel = document.getElementById('settingsPanel');
      if (panel) panel.classList.add('open');
    });
  });

  test('لوحة الإعدادات تفتح', async ({ page }) => {
    await expect(page.locator('#settingsPanel')).toHaveClass(/open/);
    await expect(page.locator('#settingsPanel h2')).toBeVisible();
  });

  test('يوجد حقل المدينة والدولة', async ({ page }) => {
    await expect(page.locator('#cityInput')).toBeVisible();
    await expect(page.locator('#countryInput')).toBeVisible();
  });

  test('طريقة الحساب قابلة للتغيير', async ({ page }) => {
    await page.selectOption('#methodSelect', '5');
    await expect(page.locator('#methodSelect')).toHaveValue('5');
  });

  test('مفتاح الأذان موجود', async ({ page }) => {
    await expect(page.locator('#azanToggle')).toBeVisible();
  });

  test('اختيار حجم الخط', async ({ page }) => {
    await page.selectOption('#fontSizeSelect', '36');
    await expect(page.locator('#fontSizeSelect')).toHaveValue('36');
  });

  test('اختيار الخلفية', async ({ page }) => {
    await page.selectOption('#bgSelect', 'emerald-green');
    await expect(page.locator('#bgSelect')).toHaveValue('emerald-green');
  });

  test('زر إعادة ضبط الإعدادات موجود', async ({ page }) => {
    await expect(page.locator('#resetSettingsBtn')).toBeVisible();
  });
});
