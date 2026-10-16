import { test, expect } from './fixtures/mock-network';

/**
 * Real-playback verification: every other audio test serves empty bodies
 * (the media element never actually plays) or mocks the element in jsdom.
 * These tests serve a valid silent WAV so Chromium/Firefox/WebKit genuinely
 * decode and play it — asserting the states users see: pause label, the
 * `audio-playing` body class, a moving currentTime, and that the watchdog
 * busy state clears once playback starts.
 */

/** Build a tiny valid 8 kHz mono 16-bit PCM WAV (silence). */
function silentWav(seconds = 8) {
  const sampleRate = 8000;
  const samples = sampleRate * seconds;
  const dataSize = samples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}

test.describe('audio real playback', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://cdn.islamic.network/**', (route) =>
      route.fulfill({ status: 200, contentType: 'audio/wav', body: silentWav() }),
    );

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.surah-content', { timeout: 15000 });
    await page.evaluate(() => {
      const ws = document.getElementById('welcomeScreen');
      if (ws) ws.remove();
    });
    await page.selectOption('#surahSelect', '1');
    await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });
    await page.evaluate(() => document.getElementById('player')?.classList.remove('collapsed'));
  });

  test('plays decoded audio, pauses, and resumes with correct UI states', async ({ page, browserName }) => {
    const playBtn = page.locator('#playPauseBtn');
    const audio = page.locator('#audioPlayer');

    // ── Play: real decoding starts, UI flips to pause.
    await playBtn.click();
    await expect(page.locator('body')).toHaveClass(/audio-playing/, { timeout: 15000 });
    await expect(playBtn).toHaveText('إيقاف مؤقت');

    if (browserName === 'webkit') {
      // Headless WebKit has no audio renderer: the media element errors out
      // and the app's retry path resets the button, so the stable pause/resume
      // flow can only be exercised on engines that really decode (Chromium,
      // Firefox). The click → playing UI contract is still covered above.
      return;
    }

    // The clock actually advances — the file is really playing.
    await expect.poll(() => audio.evaluate((el) => el.currentTime), { timeout: 15000 }).toBeGreaterThan(0);

    // The watchdog busy state cleared once the playing event fired.
    await expect.poll(() => playBtn.getAttribute('aria-busy'), { timeout: 5000 }).not.toBe('true');

    // ── Pause: playback stops, UI flips back.
    const before = await audio.evaluate((el) => el.currentTime);
    await playBtn.click();
    await expect(playBtn).toHaveText('تشغيل');
    await expect(page.locator('body')).not.toHaveClass(/audio-playing/);
    expect(await audio.evaluate((el) => el.paused)).toBe(true);

    // ── Resume: continues from roughly where it paused.
    await playBtn.click();
    await expect(page.locator('body')).toHaveClass(/audio-playing/, { timeout: 15000 });
    await expect.poll(() => audio.evaluate((el) => el.currentTime), { timeout: 15000 }).toBeGreaterThanOrEqual(before);
  });
});
