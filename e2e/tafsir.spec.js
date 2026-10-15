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
    await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });
  });

  test('ستارة التفسير موجودة', async ({ page }) => {
    await expect(page.locator('#tafsirCurtain')).toBeVisible();
  });

  test('فتح التفسير يعرض المحتوى', async ({ page }) => {
    await page.evaluate(() => {
      const handle = document.getElementById('tafsirCurtainHandle');
      if (handle) handle.click();
    });
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
    await expect(page.locator('#tafsirCurtain')).toHaveClass(/open/);
    await page.evaluate(() => {
      const handle = document.getElementById('tafsirCurtainHandle');
      if (handle) handle.click();
    });
    await expect(page.locator('#tafsirCurtain')).not.toHaveClass(/open/);
  });

  test('قائمة اختيار المفسر موجودة', async ({ page }) => {
    await expect(page.locator('#tafsirSelect')).toBeVisible();
  });
});
