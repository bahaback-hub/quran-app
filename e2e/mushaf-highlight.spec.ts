/**
 * Mushaf highlight E2E test.
 *
 * Verifies that clicking a word in mushaf mode paints highlight bars that
 * follow the ayah's MEASURED line bounds (text-based geometry), not the
 * whole page width. Uses real QCF4 layout JSON (fixtures/qcf-pages) and the
 * locally served QCF4 fonts so canvas text measurement matches production.
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const mockSurah1 = {
  code: 200,
  status: 'OK',
  data: {
    number: 1,
    name: 'الفاتحة',
    englishName: 'Al-Fatiha',
    englishNameTranslation: 'The Opening',
    revelationType: 'Meccan',
    numberOfAyahs: 7,
    ayahs: [
      { number: 1, text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', numberInSurah: 1, audio: 'https://cdn.islamic.network/quran/1/1.mp3' },
      { number: 2, text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', numberInSurah: 2, audio: 'https://cdn.islamic.network/quran/1/2.mp3' },
      { number: 3, text: 'الرَّحْمَٰنِ الرَّحِيمِ', numberInSurah: 3, audio: 'https://cdn.islamic.network/quran/1/3.mp3' },
      { number: 4, text: 'مَالِكِ يَوْمِ الدِّينِ', numberInSurah: 4, audio: 'https://cdn.islamic.network/quran/1/4.mp3' },
      { number: 5, text: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ', numberInSurah: 5, audio: 'https://cdn.islamic.network/quran/1/5.mp3' },
      { number: 6, text: 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ', numberInSurah: 6, audio: 'https://cdn.islamic.network/quran/1/6.mp3' },
      { number: 7, text: 'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ', numberInSurah: 7, audio: 'https://cdn.islamic.network/quran/1/7.mp3' },
    ],
  },
};

async function registerMushafNetworkMocks(page: import('@playwright/test').Page): Promise<void> {
  const fixtureDir = path.resolve(process.cwd(), 'e2e/fixtures/qcf-pages');

  await page.route('https://api.alquran.cloud/v1/surah/**', (route) => {
    const url = route.request().url();
    if (url.includes('/editions/') || url.includes('en.sahih')) {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, status: 'OK', data: { ayahs: [] } }) });
      return;
    }
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSurah1) });
  });
  await page.route('https://api.alquran.cloud/v1/quran/*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, status: 'OK', data: { surahs: [mockSurah1.data] } }) }),
  );
  await page.route('https://api.alquran.cloud/v1/ayah/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, status: 'OK', data: { page: 1 } }) }),
  );
  await page.route('https://api.aladhan.com/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { timings: {}, meta: {} } }) }),
  );
  await page.route('https://api.quran.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ audio_file: { timestamps: [] } }) }),
  );

  // Serve real QCF4 layout JSON from local fixtures (avoids 503s from
  // raw.githubusercontent.com in CI/sandboxed networks).
  await page.route('**/raw.githubusercontent.com/MohamadHajjRabee/quran-qcf4/main/pages/*.json', (route) => {
    const match = /pages\/(\d+)\.json$/.exec(route.request().url());
    const file = path.join(fixtureDir, `${match ? match[1] : '001'}.json`);
    if (fs.existsSync(file)) {
      route.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(file) });
    } else {
      route.fulfill({ status: 404, contentType: 'text/plain', body: 'missing' });
    }
  });

  await page.route('**/*.mp3', (route) => route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.alloc(0) }));
  await page.route('https://cdn.jsdelivr.net/gh/spa5k/tafsir_api/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, data: { text: 't' } }) }),
  );
}

test('mushaf highlight bars follow measured ayah bounds (desktop)', async ({ page }) => {
  test.setTimeout(240_000);

  await page.addInitScript(() => {
    localStorage.setItem('quran_app_help_seen', JSON.stringify(true));
  });
  await registerMushafNetworkMocks(page);

  await page.goto('/');
  await page.waitForSelector('#surahContent .ayah', { timeout: 45_000 });
  await page.waitForTimeout(800);

  await page.locator('#viewMushafBtn').click();

  const canvasReady = await page
    .waitForFunction(
      () => {
        const c = document.querySelector('.mushaf-page-canvas') as HTMLCanvasElement | null;
        return !!c && c.width > 0;
      },
      undefined,
      { timeout: 60_000 },
    )
    .then(() => true)
    .catch(() => false);
  expect(canvasReady).toBe(true);

  const canvas = page.locator('.mushaf-page-canvas');
  const box = (await canvas.boundingBox())!;

  // Click word positions across the page; the first hit paints the ayah bars.
  const xs = [0.86, 0.72, 0.55, 0.62, 0.4];
  const ys = [0.06, 0.14, 0.22, 0.3, 0.38];
  let bars = 0;
  for (let round = 0; round < 2 && bars === 0; round++) {
    for (let i = 0; i < xs.length; i++) {
      await page.mouse.click(box.x + box.width * xs[i]!, box.y + box.height * ys[i]!);
      try {
        await page.waitForSelector('.mushaf-highlight-overlay .mushaf-ayah-highlight', { timeout: 3000 });
        bars = await page.locator('.mushaf-highlight-overlay .mushaf-ayah-highlight').count();
        if (bars > 0) {
          break;
        }
      } catch {
        /* keep probing */
      }
      if (round === 0) {
        await page.waitForTimeout(900);
      }
    }
  }
  expect(bars).toBeGreaterThan(0);

  // Each bar must stay inside the overlay that owns it and span a single
  // measured line range, not the whole page width.
  const rects = await page.$$eval('.mushaf-highlight-overlay', (overlays) =>
    overlays.flatMap((ov) =>
      Array.from(ov.querySelectorAll('.mushaf-ayah-highlight')).map((bar) => {
        const b = bar.getBoundingClientRect();
        const o = ov.getBoundingClientRect();
        return {
          leftGap: b.left - o.left,
          rightGap: o.left + o.width - (b.left + b.width),
          width: b.width,
          height: b.height,
          ovW: o.width,
          ovH: o.height,
        };
      }),
    ),
  );
  expect(rects.length).toBeGreaterThan(0);
  for (const r of rects) {
    expect(r.leftGap).toBeGreaterThanOrEqual(-2);
    expect(r.rightGap).toBeGreaterThanOrEqual(-2);
    expect(r.width).toBeLessThan(r.ovW * 0.6);
    expect(r.height).toBeGreaterThan(0);
    expect(r.height).toBeLessThan(r.ovH * 0.2);
  }
});