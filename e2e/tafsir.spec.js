import { test, expect } from './fixtures/mock-network';

test.describe('التفسير', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.surah-content', { timeout: 15000 });
    await page.evaluate(() => {
      const ws = document.getElementById('welcomeScreen');
      if (ws) ws.remove();
    });
    await page.selectOption('#surahSelect', '1');
    await page.waitForTimeout(3000);
  });

  test('ستارة التفسير موجودة', async ({ page }) => {
    await expect(page.locator('#tafsirCurtain')).toBeVisible();
  });

  test('فتح التفسير يعرض المحتوى', async ({ page }) => {
    await page.evaluate(() => {
      const handle = document.getElementById('tafsirCurtainHandle');
      if (handle) handle.click();
    });
    await page.waitForTimeout(3000);
    await expect(page.locator('#tafsirCurtain')).toHaveClass(/open/);
    const header = page.locator('#tafsirCurtainHeader');
    await expect(header).toBeVisible();
    await expect(header).not.toBeEmpty();
  });

  test('إغلاق التفسير يخفي المحتوى', async ({ page }) => {
    await page.evaluate(() => {
      const handle = document.getElementById('tafsirCurtainHandle');
      if (handle) handle.click();
    });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const handle = document.getElementById('tafsirCurtainHandle');
      if (handle) handle.click();
    });
    await page.waitForTimeout(1000);
    await expect(page.locator('#tafsirCurtain')).not.toHaveClass(/open/);
  });

  test('قائمة اختيار المفسر موجودة', async ({ page }) => {
    await expect(page.locator('#tafsirSelect')).toBeVisible();
  });
});
