import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculateAyahTimings } from '../surah-loader.js';
import { RECITERS, TIMING_API_IDS } from '../reciters.js';

interface QuranAyah {
  number: number;
  text: string;
  numberInSurah: number;
}

interface QuranSource {
  data: { surahs: { number: number; ayahs: QuranAyah[] }[] };
}

const projectRoot = resolve(import.meta.dirname, '../..');
const dataDir = resolve(projectRoot, 'public/data');

async function readQuran(): Promise<QuranSource> {
  return JSON.parse(await readFile(resolve(dataDir, 'quran-uthmani.json'), 'utf8')) as QuranSource;
}

describe('audio↔ayah binding — character-count fallback timings', () => {
  it('produces exactly one timing per ayah for all 114 surahs', async () => {
    const quran = await readQuran();
    for (const surah of quran.data.surahs) {
      const timings = calculateAyahTimings(surah.ayahs, surah.number);
      expect(timings, `surah ${surah.number} — timing count != ayah count`).toHaveLength(surah.ayahs.length);
      expect(surah.ayahs.length, `surah ${surah.number} — no ayahs`).toBeGreaterThan(0);
    }
  });

  it('timings form a valid, non-decreasing cumulative distribution for every surah', async () => {
    const quran = await readQuran();
    for (const surah of quran.data.surahs) {
      const timings = calculateAyahTimings(surah.ayahs, surah.number);
      let prev = 0;
      for (let i = 0; i < timings.length; i++) {
        const t = timings[i]!;
        expect(t, `surah ${surah.number} ayah ${i + 1} — negative width`).toBeGreaterThanOrEqual(0);
        expect(t, `surah ${surah.number} ayah ${i + 1} — backsliding`).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = t;
      }
      expect(prev, `surah ${surah.number} — last split should stay < 1`).toBeLessThan(1);
      expect(
        timings.reduce((sum, t) => sum + t, 0),
        `surah ${surah.number} — degenerate all-zero`,
      ).toBeGreaterThan(0);
    }
  });

  it('keeps the count exact on the basmalah edge cases (surah 1 basmalah-as-ayah, surah 9 none)', async () => {
    const quran = await readQuran();
    const s1 = quran.data.surahs[0]!;
    const s9 = quran.data.surahs[8]!;
    expect(calculateAyahTimings(s1.ayahs, 1)).toHaveLength(s1.ayahs.length);
    expect(calculateAyahTimings(s9.ayahs, 9)).toHaveLength(s9.ayahs.length);
  });
});

describe('timing API map integrity (quran.com ↔ mp3quran)', () => {
  const timed = Object.keys(TIMING_API_IDS);
  const mp3quran = RECITERS.filter((r) => r.source === 'mp3quran');

  it('every timing id maps to a real mp3quran reciter with a server', () => {
    expect(timed.length).toBeGreaterThanOrEqual(14);
    expect(new Set(timed).size).toBe(timed.length);
    for (const id of timed) {
      const reciter = RECITERS.find((r) => r.id === id);
      expect(reciter, `timing id ${id} has no reciter`).toBeDefined();
      expect(reciter!.source).toBe('mp3quran');
      expect(reciter!.server, `timing id ${id} has no server`).toMatch(/^https:\/\/server\d+\.mp3quran\.net\//);
    }
  });

  it('every mp3quran reciter is timed or explicitly fallback-only', () => {
    const ids = mp3quran.map((r) => r.id);
    const fallbackOnly = ids.filter((id) => !timed.includes(id)).sort();
    expect(fallbackOnly).toEqual(['hthfi', 'mtrod', 'qtm', 'salamah']);
  });
});
