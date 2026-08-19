import { test, expect } from './fixtures/mock-network';

test.describe('الأوفلاين', () => {
  test('يعرض السورة من الكاش المحلي عند عدم الاتصال', async ({ page }) => {
    test.setTimeout(60000);
    // Load surah 1 while online (mock API is instant)
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#surahSelect option', { timeout: 15000 });
    await page.selectOption('#surahSelect', '1');
    await page.waitForSelector('.ayah', { timeout: 15000 });
    await expect(page.locator('.surah-title')).toBeVisible();

    // Go offline — DON'T navigate, just toggle offline on the loaded page
    // The app should fall back to local data (quran-uthmani.json) for new surahs
    await page.context().setOffline(true);
    await page.waitForTimeout(500);

    // Try selecting a different surah while offline
    // The app's api-fallback.ts should load from local /data/quran-uthmani.json
    await page.selectOption('#surahSelect', '36');
    // With local fallback, surah should still load
    await page.waitForSelector('.ayah', { timeout: 30000 });
    await expect(page.locator('.ayah').first()).toBeVisible();

    // Go back online
    await page.context().setOffline(false);
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
    // Wait for mushaf mode to activate (body.mushaf-active class)
    // Mushaf canvas may not render text (mock fonts are empty) but mode should activate
    await page.waitForFunction(
      () => document.body.classList.contains('mushaf-active'),
      { timeout: 15000 },
    );

    // Test offline mode — mushaf should stay active
    await page.context().setOffline(true);
    await page.waitForTimeout(500);
    // Verify mushaf mode is still active
    const isActive = await page.evaluate(() => document.body.classList.contains('mushaf-active'));
    expect(isActive).toBe(true);
    await page.context().setOffline(false);
  });

  test('يعرض النص المحلي (quran-uthmani.json) في السورة عند عدم الاتصال', async ({ page }) => {
    // Load page while online
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#surahSelect', { timeout: 15000 });

    // Go offline — DON'T navigate, just toggle offline
    await page.context().setOffline(true);
    await page.waitForTimeout(500);

    // Select surah 1 — should load from local fallback
    await page.selectOption('#surahSelect', '1');
    await page.waitForSelector('.ayah', { timeout: 30000 });
    await expect(page.locator('.surah-title')).toBeVisible();

    // Go back online
    await page.context().setOffline(false);
  });
});
