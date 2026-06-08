import { test, expect } from '@playwright/test';

test.describe('الترجمة', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      const ws = document.getElementById('welcomeScreen');
      if (ws) ws.remove();
    });
    await page.selectOption('#surahSelect', '1');
    await page.waitForTimeout(3000);
  });

  test('زر تفعيل الترجمة موجود', async ({ page }) => {
    await expect(page.locator('#translationToggle')).toBeVisible();
  });

  test('تفعيل الترجمة يظهر النص المترجم', async ({ page }) => {
    await page.evaluate(() => {
      const toggle = document.getElementById('translationToggle');
      if (toggle) toggle.click();
    });
    await page.waitForTimeout(3000);
    const translationTexts = page.locator('.translation-text');
    const count = await translationTexts.count();
    expect(count).toBeGreaterThan(0);
  });

  test('إيقاف الترجمة يخفي النص المترجم', async ({ page }) => {
    await page.evaluate(() => {
      const toggle = document.getElementById('translationToggle');
      if (toggle) toggle.click();
    });
    await page.waitForTimeout(3000);
    await page.evaluate(() => {
      const toggle = document.getElementById('translationToggle');
      if (toggle) toggle.click();
    });
    await page.waitForTimeout(3000);
    const translationTexts = page.locator('.translation-text');
    const count = await translationTexts.count();
    expect(count).toBe(0);
  });

  test('قائمة اختيار الترجمة موجودة بعد التفعيل', async ({ page }) => {
    await page.evaluate(() => {
      const toggle = document.getElementById('translationToggle');
      if (toggle) toggle.click();
    });
    await page.waitForTimeout(2000);
    await expect(page.locator('#translationSelect')).toBeVisible();
  });

  test('تغيير الترجمة يعيد تحميل المحتوى', async ({ page }) => {
    await page.evaluate(() => {
      const toggle = document.getElementById('translationToggle');
      if (toggle) toggle.click();
    });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const sel = document.getElementById('translationSelect');
      if (sel) sel.value = 'en.pickthall';
      const evt = new Event('change', { bubbles: true });
      if (sel) sel.dispatchEvent(evt);
    });
    await page.waitForSelector('.translation-text', { timeout: 15000 });
    const translationTexts = page.locator('.translation-text');
    const count = await translationTexts.count();
    expect(count).toBeGreaterThan(0);
  });
});
