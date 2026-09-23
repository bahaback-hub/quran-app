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
  let lastSelect = 0;
  await expect
    .poll(
      async () => {
        const target = page.locator(`.ayah[data-surah="${n}"]`).first();
        if (await target.isVisible().catch(() => false)) {
          return true;
        }

        // A rendered load error means the previous attempt settled without data —
        // retry immediately. Otherwise, re-driving every poll tick (selectOption
        // re-fires `change` even for the SAME value) aborts each in-flight load
        // before its ~1s retry + fallback can finish — an endless restart storm
        // on slower engines. Give a settled attempt room to render.
        const loadFailed = await page
          .locator('#surahContent .error-msg')
          .first()
          .isVisible()
          .catch(() => false);
        if (!loadFailed && Date.now() - lastSelect < 3500) {
          await page.waitForTimeout(200);
          return target.isVisible().catch(() => false);
        }

        // Bounce through surah 1 (bundled local file, instant, no API) to force a
        // REAL value change: it fires a fresh `change` event even when the current
        // selection already equals n (e.g. a select that landed before the app
        // bound its change listeners in phase 2 was silently dropped).
        const current = await page
          .locator('#surahSelect')
          .inputValue()
          .catch(() => '');
        if (current !== '1') {
          await page.selectOption('#surahSelect', '1');
          await page.waitForTimeout(150);
        }
        await page.selectOption('#surahSelect', String(n));
        lastSelect = Date.now();
        await page.waitForTimeout(150);
        return target.isVisible().catch(() => false);
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
    test.setTimeout(120000);
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
    await expect
      .poll(async () => (await next.count()) > 0 && (await prev.count()) > 0, {
        timeout: 30000,
      })
      .toBe(true);

    const pageNum = () =>
      page
        .locator('.mushaf-container .mushaf-footer')
        .textContent()
        .catch(() => '');
    const before = await pageNum();

    // Drive the buttons with the browser's own DOM click. On WebKit, the
    // prev/next buttons overhang the overflow-clipped mushaf container so
    // Playwright's pixel hit-testing reports the container as the pointer
    // interceptor even though the button is visible and its handler is wired.
    // el.click() fires the real click listener — which flips the page through
    // loadPage offline — so we assert the navigation behavior itself.
    await next.evaluate((el) => el.click());
    await expect.poll(async () => (await pageNum()) !== before, { timeout: 20000 }).toBe(true);
    await expect(page.locator('body')).toHaveClass(/mushaf-active/);

    const afterNext = await pageNum();
    await prev.evaluate((el) => el.click());
    await expect.poll(async () => (await pageNum()) !== afterNext, { timeout: 20000 }).toBe(true);
    await expect(page.locator('body')).toHaveClass(/mushaf-active/);
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
