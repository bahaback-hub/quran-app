import { test, expect } from './fixtures/mock-network';

test.describe('الأوفلاين', () => {
  async function goOffline(page) {
    await page.context().setOffline(true);
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
  }

  async function goOnline(page) {
    await page.context().setOffline(false);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.surah-content', { timeout: 15000 });
  }

  test('يعرض السورة من الكاش المحلي عند عدم الاتصال', async ({ page }) => {
    test.setTimeout(120000);
    // Load surah 1 while online (mock API is instant)
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#surahSelect option', { timeout: 15000 });
    await page.selectOption('#surahSelect', '1');
    await page.waitForSelector('.ayah', { timeout: 15000 });
    await expect(page.locator('.surah-title')).toBeVisible();

    // Go offline — app should still work from cache/local data
    await goOffline(page);
    await page.selectOption('#surahSelect', '36');
    // With local fallback (quran-uthmani.json), surah should still load
    await page.waitForSelector('.ayah', { timeout: 30000 });
    await expect(page.locator('.ayah').first()).toBeVisible();

    await goOnline(page);
  });

  test('يعرض المصحف من الكاش عند عدم الاتصال', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#viewMushafBtn', { timeout: 15000 });
    await page.evaluate(() => {
      const ws = document.getElementById('welcomeScreen');
      if (ws) ws.remove();
      const btn = document.getElementById('viewMushafBtn');
      if (btn) btn.click();
    });
    // Wait for mushaf canvas (mock fonts return empty but canvas should still render)
    const canvas = page.locator('.mushaf-page-canvas');
    await expect(canvas).toBeVisible({ timeout: 20000 });

    // Test offline mode
    await page.context().setOffline(true);
    await page.waitForTimeout(1000);
    await expect(canvas).toBeVisible({ timeout: 5000 });
    await page.context().setOffline(false);
  });

  test('يعرض النص المحلي (quran-uthmani.json) في السورة عند عدم الاتصال', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await goOffline(page);
    await page.selectOption('#surahSelect', '1');
    await page.waitForSelector('.ayah', { timeout: 15000 });
    await expect(page.locator('.surah-title')).toBeVisible();
    await goOnline(page);
  });
});
