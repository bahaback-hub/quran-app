import { test, expect } from './fixtures/mock-network';

/**
 * Comprehensive offline verification.
 *
 * Strategy: follow the same proven pattern as the original offline.spec.js —
 * cut external APIs BEFORE switching surahs so the app falls back to the
 * bundled local data files (quran-uthmani.json, surah-1.json, muyassar-tafsir.json).
 * This is deterministic, fast, and mirrors how the fallback chain works in prod.
 */

async function cutAlquranApi(page) {
  await page.route('https://api.alquran.cloud/**', (route) => route.abort('failed'));
}

async function cutTafsirApi(page) {
  await page.route('https://cdn.jsdelivr.net/gh/spa5k/tafsir_api/**', (route) => route.abort('failed'));
}

async function cutAllExternal(page) {
  await page.route('https://api.alquran.cloud/**', (route) => route.abort('failed'));
  await page.route('https://api.quran.com/**', (route) => route.abort('failed'));
  await page.route('https://api.aladhan.com/**', (route) => route.abort('failed'));
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort('failed'));
  await page.route('https://raw.githubusercontent.com/**', (route) => route.abort('failed'));
  await page.route('https://server*.mp3quran.net/**', (route) => route.abort('failed'));
  await page.route('https://cdn.islamic.network/**', (route) => route.abort('failed'));
}

/**
 * The first surah becomes visible during PHASE 1 (loadSurah), but the UI
 * controls are only wired up in PHASE 2 (bindAllEvents) and the ayah modal
 * in deferred PHASE 3 (requestIdleCallback). A click that lands before those
 * listeners exist is silently lost, so interactions below retry until their
 * effect is actually observable.
 */
async function openSearch(page) {
  await expect
    .poll(
      async () => {
        if (!(await page.locator('#searchInputGroup').isVisible())) {
          await page.locator('#searchToggleBtn').click();
          await page.waitForTimeout(100);
        }
        return page.locator('#searchInputGroup').isVisible();
      },
      { timeout: 20000 },
    )
    .toBe(true);
}

async function openFirstAyahModal(page) {
  await expect
    .poll(
      async () => {
        if (!(await page.locator('#ayahModal').isVisible())) {
          await page.locator('.ayah[data-surah="1"] .word').first().click();
          await page.waitForTimeout(200);
        }
        return page.locator('#ayahModal').isVisible();
      },
      { timeout: 20000 },
    )
    .toBe(true);
}

async function selectSurah(page, n) {
  await expect
    .poll(
      async () => {
        if (!(await page.locator(`.ayah[data-surah="${n}"]`).first().isVisible())) {
          await page.selectOption('#surahSelect', String(n));
          await page.waitForTimeout(150);
        }
        return page.locator(`.ayah[data-surah="${n}"]`).first().isVisible();
      },
      { timeout: 30000 },
    )
    .toBe(true);
}

test.describe('الأوفلاين الكامل', () => {
  test('يقرأ سوراً كاملة من البيانات المحلية بعد انقطاع الشبكة', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });

    // Cut AlQuran.cloud — the app falls back to bundled quran-uthmani.json.
    await cutAlquranApi(page);

    await selectSurah(page, 2);
    await expect(page.locator('.surah-title')).toBeVisible();

    await selectSurah(page, 112);
  });

  test('يبحث في النص المحلي بعد انقطاع الشبكة', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });

    // The search index is built from in-memory data at init — no network needed.
    await cutAllExternal(page);

    await openSearch(page);
    await page.locator('#searchInput').fill('بسم الله');
    await page.locator('#searchBtn').click();
    await expect(page.locator('#searchResults').locator('.search-result-item').first()).toBeVisible({ timeout: 20000 });
  });

  test('يعرض تفسير الميسّر من الملف المحلي بعد انقطاع الشبكة', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });

    // Cut the tafsir CDN — the local Muyassar file takes over instantly.
    await cutTafsirApi(page);

    // Click the ayah TEXT (not the .ayah-number circle) to open the detail modal.
    await openFirstAyahModal(page);
    // Local Muyassar text for S1A1: "سورة الفاتحة سميت هذه السورة بالفاتحة..."
    await expect(page.locator('#ayahModalTafsirBody')).toContainText('الفاتحة', { timeout: 15000 });
  });

  test('يبقى المصحف قابلاً للتنقل بعد انقطاع الشبكة', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });

    // Enter mushaf while online.
    await expect
      .poll(
        async () => {
          if (!(await page.evaluate(() => document.body.classList.contains('mushaf-active')))) {
            await page.locator('#viewMushafBtn').click();
            await page.waitForTimeout(200);
          }
          return page.evaluate(() => document.body.classList.contains('mushaf-active'));
        },
        { timeout: 20000 },
      )
      .toBe(true);

    // Cut the QCF CDN — navigation controls must remain interactive.
    await page.route('https://raw.githubusercontent.com/**', (route) => route.abort('failed'));
    await page.route('https://cdn.jsdelivr.net/gh/MohamadHajjRabee/**', (route) => route.abort('failed'));

    const next = page.locator('.mushaf-page-nav-btn.mushaf-page-nav-next');
    const prev = page.locator('.mushaf-page-nav-btn.mushaf-page-nav-prev');
    if ((await next.count()) > 0) {
      await next.click();
      await expect(page.locator('body')).toHaveClass(/mushaf-active/);
    }
    if ((await prev.count()) > 0) {
      await prev.click();
      await expect(page.locator('body')).toHaveClass(/mushaf-active/);
    }
  });

  test('دورة كاملة: تحميل، قطع الشبكة، إعادة فتح، قراءة وبحث', async ({ page }) => {
    test.setTimeout(90000);
    // 1 — Open the app online and let the resources load.
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });

    // 2 — The connection drops.
    await cutAllExternal(page);

    // 3 — Read a different surah from the local bundle.
    await selectSurah(page, 112);

    // 4 — Search still works.
    await openSearch(page);
    await page.locator('#searchInput').fill('بسم الله');
    await page.locator('#searchBtn').click();
    await expect(page.locator('#searchResults').locator('.search-result-item').first()).toBeVisible({ timeout: 20000 });

    // 5 — Close and reopen the app (full page reload) while still offline.
    //    Clear the reading position so init restarts from surah 1 (the bundled
    //    surah-1.json path), otherwise last_position restores surah 112.
    await page.evaluate(() => localStorage.removeItem('quran_app_last_position'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.surah-title')).toBeVisible();
  });
});