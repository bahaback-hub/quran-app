import { test, expect } from './fixtures/mock-network';

// Item 6: reference-frequency (pitch) tuning. The mock audio files are empty
// buffers, so playback itself errors — but the rate/preservesPitch state and
// persistence must still apply exactly (528/440 = 1.2x at 1x speed).
test('pitch select and slider change the effective playback rate', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });
  await page.evaluate(() => {
    document.getElementById('welcomeScreen')?.remove();
    document.getElementById('player')?.classList.remove('collapsed');
  });
  await expect(page.locator('#pitchSelect')).toBeVisible();

  // Preset 528Hz at default 1x speed -> effective rate 1.2.
  await page.locator('#pitchSelect').selectOption('528');
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const a = document.getElementById('audioPlayer');
          return a ? { rate: a.playbackRate, preserves: a.preservesPitch } : null;
        }),
      { timeout: 5000 },
    )
    .toEqual({ rate: 1.2, preserves: false });

  // Slider to a custom frequency (e.g. 550) -> 1.25.
  await page.locator('#pitchRange').fill('550');
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const a = document.getElementById('audioPlayer');
          return a ? a.playbackRate : null;
        }),
      { timeout: 5000 },
    )
    .toBe(1.25);

  // Persisted across reloads.
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });
  await page.evaluate(() => {
    document.getElementById('player')?.classList.remove('collapsed');
  });
  await expect(page.locator('#pitchSelect')).toHaveValue('550');
});
