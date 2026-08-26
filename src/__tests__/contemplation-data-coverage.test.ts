import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface QuranAyah {
  numberInSurah: number;
}

interface QuranSurah {
  number: number;
  ayahs: QuranAyah[];
}

interface QuranSource {
  data: { surahs: QuranSurah[] };
}

interface ContemplationEntry {
  surah: number;
  ayah: number;
  questions: unknown;
}

interface ContemplationManifest {
  totalEntries: number;
  surahs: Array<{ surah: number; file: string }>;
}

const projectRoot = resolve(import.meta.dirname, '../..');
const contemplationDirectory = resolve(projectRoot, 'public/data/contemplation');

function hasThreeQuestions(value: unknown): value is [string, string, string] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((question) => typeof question === 'string' && question.trim().length > 0)
  );
}

describe('contemplation data coverage', () => {
  it('provides three local contemplation questions for every Quran ayah', async () => {
    const quran = JSON.parse(
      await readFile(resolve(projectRoot, 'public/data/quran-uthmani.json'), 'utf8'),
    ) as QuranSource;
    const manifest = JSON.parse(
      await readFile(resolve(contemplationDirectory, 'manifest.json'), 'utf8'),
    ) as ContemplationManifest;

    const expectedIds = new Set(
      quran.data.surahs.flatMap((surah) => surah.ayahs.map((ayah) => `${surah.number}:${ayah.numberInSurah}`)),
    );
    const entries = (
      await Promise.all(
        manifest.surahs.map(
          async ({ file }) =>
            JSON.parse(await readFile(resolve(contemplationDirectory, file), 'utf8')) as ContemplationEntry[],
        ),
      )
    ).flat();
    const validIds = entries
      .filter((entry) => hasThreeQuestions(entry.questions))
      .map((entry) => `${entry.surah}:${entry.ayah}`);

    expect(manifest.surahs).toHaveLength(114);
    expect(manifest.totalEntries).toBe(expectedIds.size);
    expect(validIds).toHaveLength(expectedIds.size);
    expect(new Set(validIds).size).toBe(expectedIds.size);
    expect(new Set(validIds)).toEqual(expectedIds);
  });
});
