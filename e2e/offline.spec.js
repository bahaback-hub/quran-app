import { test, expect } from './fixtures/mock-network';

test.describe('الأوفلاين', () => {
  test('يعرض السورة من الكاش المحلي عند عدم الاتصال', async ({ page }) => {
    test.setTimeout(60000);
    // Load page while the API mock is available, then wait for real ayahs
    // rather than the loading container that is rendered before data arrives.
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });

    // Simulate an unreachable external API while preserving the bundled local
    // fallback route. This is deterministic across browser engines and tests
    // the same fallback branch as an offline request.
    await page.route('https://api.alquran.cloud/v1/surah/**', (route) => route.abort('failed'));
    await page.selectOption('#surahSelect', '36');
    await expect(page.locator('.ayah[data-surah="36"]').first()).toBeVisible({ timeout: 30000 });
  });

  test('يعرض المصحف من الكاش عند عدم الاتصال', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });
    await page.locator('#viewMushafBtn').click();
    // Wait for mushaf mode to activate (body.mushaf-active class)
    await page.waitForFunction(
      () => document.body.classList.contains('mushaf-active'),
      { timeout: 15000 },
    );

    // Test offline mode — mushaf should stay active
    await page.context().setOffline(true);
    await page.waitForTimeout(500);
    const isActive = await page.evaluate(() => document.body.classList.contains('mushaf-active'));
    expect(isActive).toBe(true);
    await page.context().setOffline(false);
  });

  test('يعرض النص المحلي (quran-uthmani.json) في السورة عند عدم الاتصال', async ({ page }) => {
    test.setTimeout(60000);
    // Load the reader before simulating a remote API failure.
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });
    await page.route('https://api.alquran.cloud/v1/surah/**', (route) => route.abort('failed'));

    // Select a different surah so the reader must use quran-uthmani.json.
    await page.selectOption('#surahSelect', '2');
    await expect(page.locator('.ayah[data-surah="2"]').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.surah-title')).toBeVisible();
  });
});
