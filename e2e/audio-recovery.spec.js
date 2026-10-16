import { test, expect } from './fixtures/mock-network';

// The boot-time audio fetch can fail (API rate-limit burst on page load).
// Pressing play must refetch on demand; once the list is back, playback
// proceeds instead of staying silent.
test.describe('audio recovery', () => {
  test('stalled audio load shows a busy indicator and an error toast', async ({ page }) => {
    // Stall the audio CDN: the request never completes, mirroring a dead
    // connection where no 'error' event fires. Without feedback the play
    // button appeared dead (TestSprite report). The watchdog must surface it.
    await page.route('https://cdn.islamic.network/**', () => new Promise(() => {}));

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.surah-content', { timeout: 15000 });
    await page.evaluate(() => {
      const ws = document.getElementById('welcomeScreen');
      if (ws) ws.remove();
    });
    await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });
    await page.evaluate(() => document.getElementById('player')?.classList.remove('collapsed'));

    const playBtn = page.locator('#playPauseBtn');
    await playBtn.click();

    // Loading indicator: the button turns busy while the request is in flight.
    await expect(playBtn).toHaveAttribute('aria-busy', 'true', { timeout: 12000 });

    // Watchdog fires after ~10s: the attempt stops with a visible error toast.
    await expect(page.locator('#toast.show')).toBeVisible({ timeout: 25000 });
  });

  test('refetches audio on play after a failed boot fetch, then plays', async ({ page }) => {
    let allowFetch = false;
    const postClickReqs = [];
    await page.route('**/surah/1/ar.alafasy', async (route) => {
      if (!allowFetch) {
        await route.abort('failed');
      } else {
        postClickReqs.push(1);
        await route.fallback();
      }
    });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.surah-content', { timeout: 15000 });
    await page.evaluate(() => {
      const ws = document.getElementById('welcomeScreen');
      if (ws) ws.remove();
    });
    await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });
    // Boot audio list is empty (fetch aborted) — play must refetch.
    allowFetch = true;
    await page.locator('#collapsedPlayBtn').click({ timeout: 15000 });
    await expect.poll(() => postClickReqs.length, { timeout: 20000 }).toBeGreaterThan(0);
    // With the list restored, the main play button starts playback.
    await page.evaluate(() => document.getElementById('player')?.classList.remove('collapsed'));
    await page.locator('#playPauseBtn').click({ timeout: 15000 });
    await expect
      .poll(async () => page.evaluate(() => document.getElementById('audioPlayer')?.currentSrc || ''), {
        timeout: 25000,
      })
      .not.toBe('');
  });
});
