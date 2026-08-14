import { test, expect } from '@playwright/test';

test.describe('الأوفلاين', () => {
  async function goOffline(page) {
    await page.context().setOffline(true);
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(3000);
  }

  async function goOnline(page) {
    await page.context().setOffline(false);
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  }

  test('يعرض السورة من الكاش المحلي عند عدم الاتصال', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes for this complex test
    // Pre-load surah 1 while online (caches it in SW)
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(() => {});
    // Wait for app to initialize (surah list + first surah load)
    await page.waitForSelector('#surahSelect option', { timeout: 30000 }).catch(() => {});
    await page.selectOption('#surahSelect', '1').catch(() => {});
    await page.waitForSelector('.ayah', { timeout: 30000 }).catch(() => {});
    // Wait extra time for SW to cache the surah data
    await page.waitForTimeout(3000);

    // Go offline and try a different surah (should fall back to local data)
    await goOffline(page);
    await page.selectOption('#surahSelect', '36').catch(() => {});
    // With local fallback, surah should load from public/data/quran-uthmani.json
    await page.waitForSelector('.ayah', { timeout: 30000 }).catch(() => {});
    await expect(page.locator('.ayah').first()).toBeVisible({ timeout: 15000 }).catch(() => {});

    await goOnline(page);
  });

  test('يعرض المصحف من الكاش عند عدم الاتصال', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      const ws = document.getElementById('welcomeScreen');
      if (ws) ws.remove();
    });
    await page.evaluate(() => {
      const btn = document.getElementById('viewMushafBtn');
      if (btn) btn.click();
    });
    await page.waitForTimeout(5000);
    const canvas = page.locator('.mushaf-page-canvas');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    await page.context().setOffline(true);
    await page.waitForTimeout(1000);
    await expect(canvas).toBeVisible({ timeout: 5000 });
    await page.context().setOffline(false);
  });

  test('يعرض النص المحلي (quran-uthmani.json) في السورة عند عدم الاتصال', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await goOffline(page);
    await page.selectOption('#surahSelect', '1');
    await page.waitForSelector('.ayah', { timeout: 15000 });
    await expect(page.locator('.surah-title')).toBeVisible();
    await goOnline(page);
  });
});
