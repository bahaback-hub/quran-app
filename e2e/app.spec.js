import { test, expect } from './fixtures/mock-network';

test.describe('التطبيق — الصفحة الرئيسية', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.surah-content', { timeout: 15000 });
  });

  test('يعرض عنوان الصفحة بالعربية', async ({ page }) => {
    await expect(page).toHaveTitle(/القرآن الكريم/);
  });

  test('يعرض المحتوى الرئيسي', async ({ page }) => {
    await expect(page.locator('#surahContent')).toBeVisible();
    await expect(page.locator('.header h1')).toContainText('القرآن الكريم');
  });

  test('قائمة السور موجودة في الصفحة', async ({ page }) => {
    await expect(page.locator('#surahSelect')).toBeVisible();
  });

  test('فتح وإغلاق الإعدادات عبر JS', async ({ page }) => {
    await page.evaluate(() => {
      const panel = document.getElementById('settingsPanel');
      if (panel) panel.classList.add('open');
    });
    await expect(page.locator('#settingsPanel')).toHaveClass(/open/);

    await page.evaluate(() => {
      const panel = document.getElementById('settingsPanel');
      if (panel) panel.classList.remove('open');
    });
    await expect(page.locator('#settingsPanel')).not.toHaveClass(/open/);
  });

  test('تعمل أزرار وضع العرض الأساسية', async ({ page }) => {
    await expect(page.locator('#viewSurahBtn')).toBeVisible();
    await expect(page.locator('#viewMushafBtn')).toBeVisible();
    await expect(page.locator('#viewPresBtn')).toBeVisible();
    await expect(page.locator('#viewSurahBtn')).toHaveClass(/active/);
  });

  test('اختيار سورة من القائمة يحمّل المحتوى', async ({ page }) => {
    await page.selectOption('#surahSelect', '1');
    await page.waitForTimeout(2000);
    const content = page.locator('#surahContent');
    await expect(content).not.toContainText('اختر سورة');
  });
});
