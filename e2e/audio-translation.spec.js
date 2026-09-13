import { test, expect } from './fixtures/mock-network';

// Regression (real user report): after enabling translation the surah
// reloads and — when the audio request is rate-limited at that moment —
// the reader used to stay permanently silent. The reader must keep a
// playable audio list across the reload instead of showing "no audio".
//
// The forced-failure case is fully covered by unit tests
// (api-client-deep: 429 retry; surah-loader-deep: cached fallback;
// audio-deep: loading toast). This E2E covers the end-to-end happy path:
// toggle translation → reload → playback still works, no error toast.
test('translation toggle keeps audio playable', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });
  await page.evaluate(() => {
    const ws = document.getElementById('welcomeScreen');
    if (ws) ws.remove();
  });

  // The translation toggle starts hidden — same pattern as translation.spec.js.
  await page.evaluate(() => {
    const t = document.getElementById('translationToggle');
    if (t) t.classList.remove('hidden');
  });

  // Expand the player (starts collapsed in the default CI viewport).
  await page.evaluate(() => {
    const player = document.getElementById('player');
    if (player) player.classList.remove('collapsed');
  });
  await expect(page.locator('#playPauseBtn')).toBeVisible();

  // Play once so the player attaches to the loaded audio list.
  await page.locator('#playPauseBtn').click();
  await page.waitForTimeout(500);

  // Enable translation — this reloads surah 1 in the background.
  await page.locator('#translationToggle').click();
  // The reload must actually render translation text — proves toggle worked.
  await expect(page.locator('.translation-text').first()).toBeVisible({ timeout: 30000 });
  // Wait for the reload to settle (loading spinner fully cleared).
  await page.waitForFunction(() => {
    const el = document.querySelector('#surahContent');
    return el !== null && !el.classList.contains('is-loading') && el.querySelectorAll('.ayah').length > 0;
  }, undefined, { timeout: 30000 });
  await page.waitForTimeout(1500);

  // Playback must NOT raise the "no audio" error toast.
  await page.locator('#playPauseBtn').click();
  await page.waitForTimeout(1200);
  const errToast = page.locator('#toast.show.error');
  if ((await errToast.count()) > 0) {
    const text = ((await errToast.textContent()) ?? '').trim();
    expect(text).not.toMatch(/لا يوجد صوت|no[ _]?audio/i);
  }
});