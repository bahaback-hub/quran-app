import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface QuranAyah {
  number: number;
  text: string;
  numberInSurah: number;
  juz: number;
  page: number;
}

interface QuranSurah {
  number: number;
  name: string;
  englishName: string;
  ayahs: QuranAyah[];
}

interface QuranSource {
  data: { surahs: QuranSurah[] };
}

interface SurahListItem {
  number: number;
  name: string;
  englishName: string;
  numberOfAyahs: number;
}

interface MuyassarEntry {
  ayah: number;
  surah: number;
  text: string;
}

const projectRoot = resolve(import.meta.dirname, '../..');
const dataDir = resolve(projectRoot, 'public/data');

const SURAH_COUNT = 114;
const TOTAL_AYAHS = 6236;
const PAGE_COUNT = 604;
const JUZ_COUNT = 30;

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(resolve(dataDir, relativePath), 'utf8')) as T;
}

describe('quran data integrity', () => {
  it('quran-uthmani.json exposes the canonical 114 surahs with 6236 fully numbered ayahs', async () => {
    const quran = await readJson<QuranSource>('quran-uthmani.json');

    expect(quran.data.surahs).toHaveLength(SURAH_COUNT);
    expect(quran.data.surahs.map((s) => s.number)).toEqual(Array.from({ length: SURAH_COUNT }, (_, i) => i + 1));

    const totalAyahs = quran.data.surahs.reduce((sum, surah) => sum + surah.ayahs.length, 0);
    expect(totalAyahs).toBe(TOTAL_AYAHS);

    const pages = new Set<number>();
    const juzs = new Set<number>();
    const seenNumbers = new Set<number>();
    const seenKeys = new Set<string>();
    let expectedGlobal = 1;

    for (const surah of quran.data.surahs) {
      for (const ayah of surah.ayahs) {
        expect(ayah.number).toBe(expectedGlobal);
        expect(seenNumbers.has(ayah.number)).toBe(false);
        seenNumbers.add(ayah.number);

        const key = `${surah.number}:${ayah.numberInSurah}`;
        expect(seenKeys.has(key)).toBe(false);
        seenKeys.add(key);

        expect(ayah.numberInSurah).toBeGreaterThan(0);
        expect(ayah.numberInSurah).toBeLessThanOrEqual(surah.ayahs.length);
        expect(ayah.juz).toBeGreaterThanOrEqual(1);
        expect(ayah.juz).toBeLessThanOrEqual(JUZ_COUNT);
        expect(ayah.page).toBeGreaterThanOrEqual(1);
        expect(ayah.page).toBeLessThanOrEqual(PAGE_COUNT);
        expect(ayah.text.trim().length).toBeGreaterThan(0);

        pages.add(ayah.page);
        juzs.add(ayah.juz);
        expectedGlobal++;
      }
    }

    expect(pages.size).toBe(PAGE_COUNT);
    expect(juzs.size).toBe(JUZ_COUNT);
    expect(expectedGlobal - 1).toBe(TOTAL_AYAHS);
  });

  it('surah-list.json matches the canonical counts and the actual ayah arrays', async () => {
    const quran = await readJson<QuranSource>('quran-uthmani.json');
    const surahList = await readJson<SurahListItem[]>('surah-list.json');

    expect(surahList).toHaveLength(SURAH_COUNT);
    expect(surahList.map((s) => s.number)).toEqual(quran.data.surahs.map((s) => s.number));

    const listedTotal = surahList.reduce((sum, s) => sum + s.numberOfAyahs, 0);
    expect(listedTotal).toBe(TOTAL_AYAHS);

    for (const item of surahList) {
      const surah = quran.data.surahs.find((s) => s.number === item.number);
      expect(surah).toBeDefined();
      expect(surah!.ayahs.length).toBe(item.numberOfAyahs);
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.englishName.length).toBeGreaterThan(0);
    }
  });

  it('muyassar-tafsir.json covers every ayah exactly once', async () => {
    const quran = await readJson<QuranSource>('quran-uthmani.json');
    const tafsir = await readJson<Record<string, { ayahs: MuyassarEntry[] }>>('muyassar-tafsir.json');

    expect(Object.keys(tafsir)).toHaveLength(SURAH_COUNT);

    const quranKeys = new Set(quran.data.surahs.flatMap((s) => s.ayahs.map((a) => `${s.number}:${a.numberInSurah}`)));

    const tafsirKeys = new Set<string>();
    let total = 0;
    for (const [surahNum, entry] of Object.entries(tafsir)) {
      const expectedAyahs = quran.data.surahs.find((s) => s.number === Number(surahNum))?.ayahs.length;
      expect(entry.ayahs).toHaveLength(expectedAyahs ?? -1);
      for (const row of entry.ayahs) {
        const key = `${row.surah}:${row.ayah}`;
        expect(quranKeys.has(key)).toBe(true);
        expect(tafsirKeys.has(key)).toBe(false);
        tafsirKeys.add(key);
        expect(row.text.trim().length).toBeGreaterThan(0);
        total++;
      }
    }

    expect(total).toBe(TOTAL_AYAHS);
    expect(tafsirKeys.size).toBe(TOTAL_AYAHS);
  });

  it('surah-1.json payload matches the reference surah 1 exactly', async () => {
    const quran = await readJson<QuranSource>('quran-uthmani.json');
    const payload = await readJson<{ data: { number: number; ayahs: QuranAyah[] } }>('surah-1.json');

    const reference = quran.data.surahs[0];
    expect(reference).toBeDefined();
    expect(payload.data.number).toBe(reference.number);
    expect(payload.data.ayahs).toHaveLength(reference.ayahs.length);

    for (let i = 0; i < reference.ayahs.length; i++) {
      const p = payload.data.ayahs[i];
      const r = reference.ayahs[i];
      expect(p.number).toBe(r.number);
      expect(p.numberInSurah).toBe(r.numberInSurah);
      expect(p.juz).toBe(r.juz);
      expect(p.page).toBe(r.page);
      expect(p.text.replace(/^\uFEFF/, '')).toBe(r.text.replace(/^\uFEFF/, ''));
    }
  });
});
