import { test, expect } from './fixtures/mock-network';

// Audio↔ayah continuity: the reader must preserve the exact ayah binding
// across end-of-surah transitions, player close/reopen, position persistence,
// and offline timing fetches (character-count fallback). These are the flows
// the ChatGPT audit flagged: last ayah → next surah, pause→resume, offline.
// Playback media is mocked (empty buffers), so transitions are driven through
// the real 'ended' listener like audio.test.ts does at unit level.
// Ayah positions are asserted via the player's "آية <numberInSurah>" suffix,
// which is stable across Uthmani text variants.

async function openReader(page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('.surah-content', { timeout: 15000 });
  await page.evaluate(() => {
    const ws = document.getElementById('welcomeScreen');
    if (ws) ws.remove();
  });
  await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });
  await page.evaluate(() => document.getElementById('player')?.classList.remove('collapsed'));
}

async function advanceAyahs(page, times) {
  for (let i = 0; i < times; i++) {
    await page.locator('#nextAyahBtn').click();
    await page.waitForTimeout(100);
  }
}

test.describe('استمرارية الصوت', () => {
  test('آخر آية في السورة → السورة التالية تلقائياً عند انتهاء التشغيل', async ({ page }) => {
    await openReader(page);

    // Enable auto-play-next (off by default) through the real toggle.
    await page.locator('#autoPlayNextBtn').click();
    await expect(page.locator('#autoPlayNextBtn')).toHaveClass(/active/);

    // Reach the last ayah of Al-Fatiha (7 ayahs, index 0 → 6).
    await advanceAyahs(page, 6);
    await expect(page.locator('#playerCurrentAyah')).toContainText('آية 7', { timeout: 10000 });

    // Audio ends naturally on the last ayah → onAudioEnded → nextSurah().
    await page.evaluate(() => document.getElementById('audioPlayer')?.dispatchEvent(new Event('ended')));

    await expect(page.locator('.ayah[data-surah="2"]').first()).toBeVisible({ timeout: 25000 });
    await expect(page.locator('#playerSurahName')).toContainText('البقرة', { timeout: 10000 });
    await expect(page.locator('#playerCurrentAyah')).toContainText('آية 1', { timeout: 10000 });
  });

  test('آخر آية + تشغيل متصل مفعّل → يبدأ السورة التالية من أول آية', async ({ page }) => {
    await openReader(page);
    await page.locator('#autoPlayNextBtn').click();
    await expect(page.locator('#autoPlayNextBtn')).toHaveClass(/active/);

    await advanceAyahs(page, 6);
    await expect(page.locator('#playerCurrentAyah')).toContainText('آية 7', { timeout: 10000 });
    await page.evaluate(() => document.getElementById('audioPlayer')?.dispatchEvent(new Event('ended')));

    await expect(page.locator('#playerSurahName')).toContainText('البقرة', { timeout: 25000 });
    await expect(page.locator('#playerCurrentAyah')).toContainText('آية 1', { timeout: 10000 });
  });

  test('إغلاق المشغل وإعادة فتحه يستأنف من نفس الآية، وعند حدود السورة يُحفظ موضع الاستئناف', async ({ page }) => {
    await openReader(page);

    // Position at ayah 5 (index 4).
    await advanceAyahs(page, 4);
    await expect(page.locator('#playerCurrentAyah')).toContainText('آية 5', { timeout: 10000 });

    // Close the player…
    await page.evaluate(() => document.getElementById('player')?.classList.add('collapsed'));
    await page.waitForTimeout(300);
    // …and reopen it: position must be retained, not reset to ayah 1.
    await page.evaluate(() => document.getElementById('player')?.classList.remove('collapsed'));
    await expect(page.locator('#playerCurrentAyah')).toContainText('آية 5', { timeout: 10000 });

    // The app persists the resume position on surah loads (autoSave). Walking
    // off the last ayah into surah 2 must re-anchor the saved position there.
    await advanceAyahs(page, 2);
    await expect(page.locator('#playerCurrentAyah')).toContainText('آية 7', { timeout: 10000 });
    await page.locator('#nextAyahBtn').click();
    await expect(page.locator('.ayah[data-surah="2"]').first()).toBeVisible({ timeout: 25000 });

    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem('quran_app_last_position');
      return raw ? JSON.parse(raw) : null;
    });
    expect(saved).not.toBeNull();
    expect(saved.surah).toBe(2);
    expect(saved.ayahNumberInSurah).toBe(1);
  });

  test('بانقطاع توقيتات الواجهة (أوفلاين) يبقى الربط تلو الآية سليماً', async ({ page }) => {
    await openReader(page);

    // quran.com timings are unreachable — the character-count fallback must
    // still produce an exact one-timing-per-ayah binding.
    await page.route('https://api.quran.com/api/v4/chapter_recitations/**', (route) => route.abort('failed'));

    // Advance offline to ayah 3 (index 2), then let the audio 'end' naturally.
    await advanceAyahs(page, 2);
    await expect(page.locator('#playerCurrentAyah')).toContainText('آية 3', { timeout: 10000 });
    await page.evaluate(() => document.getElementById('audioPlayer')?.dispatchEvent(new Event('ended')));

    // Continuation lands exactly on ayah 4, then 5 — the binding survives with
    // no timing API available.
    await expect(page.locator('#playerCurrentAyah')).toContainText('آية 4', { timeout: 10000 });
    await page.evaluate(() => document.getElementById('audioPlayer')?.dispatchEvent(new Event('ended')));
    await expect(page.locator('#playerCurrentAyah')).toContainText('آية 5', { timeout: 10000 });
  });
});