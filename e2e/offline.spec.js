import { test, expect } from '@playwright/test';

test.describe('الأوفلاين', () => {
  async function goOffline(page) {
    await page.context().setOffline(true);
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  async function goOnline(page) {
    await page.context().setOffline(false);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  }

  test('يعرض السورة من الكاش المحلي عند عدم الاتصال', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.selectOption('#surahSelect', '1');
    await page.waitForSelector('.ayah', { timeout: 15000 });
    await expect(page.locator('.surah-title')).toBeVisible();

    await goOffline(page);
    await page.selectOption('#surahSelect', '36');
    await page.waitForSelector('.ayah', { timeout: 15000 });
    await expect(page.locator('.ayah').first()).toBeVisible();

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
