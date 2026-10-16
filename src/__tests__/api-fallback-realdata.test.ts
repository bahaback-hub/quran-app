/**
 * Real-data regression tests for api-fallback.ts.
 *
 * Unlike api-fallback.test.ts (which uses hand-made fixtures), these tests
 * feed the fallback functions the files that actually ship in public/data/.
 * A parser that drifts from the shipped shape then fails here instead of
 * only in production.
 *
 * This file exists because loadLocalTafsirMuyassar once parsed a
 * `surah:ayah`-keyed map that the bundle never contained — while its
 * fixture-based tests happily passed against the imaginary shape.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api-client.js', () => ({
  jsonFetch: vi.fn(),
  safeFetch: vi.fn(),
  apiFetch: vi.fn(),
  HTTPError: class HTTPError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

const projectRoot = resolve(import.meta.dirname, '../..');

async function getModule() {
  const mod = await import('../api-fallback.js');
  const apiClient = await import('../api-client.js');
  const jsonFetchMock = apiClient.jsonFetch as ReturnType<typeof vi.fn>;
  // Serve every `data/...` path straight from the shipped public/data files.
  jsonFetchMock.mockImplementation(async (path: string) =>
    JSON.parse(await readFile(resolve(projectRoot, 'public', path), 'utf8')),
  );
  return { mod, jsonFetchMock };
}

describe('api-fallback — real bundled data files', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('loadLocalSurahList reads all 114 surahs from the shipped file', async () => {
    const { mod } = await getModule();
    const list = await mod.loadLocalSurahList();
    expect(list).not.toBeNull();
    expect(list!.length).toBe(114);
    expect(list![0]!.number).toBe(1);
    expect(list![113]!.number).toBe(114);
    expect(list![1]!.numberOfAyahs).toBe(286);
  });

  it('loadLocalSurahText adapts the shipped full-Quran file', async () => {
    const { mod } = await getModule();
    const fatiha = await mod.loadLocalSurahText(1);
    expect(fatiha).not.toBeNull();
    expect(fatiha!.number).toBe(1);
    expect(fatiha!.ayahs.length).toBe(7);
    expect(fatiha!.ayahs[0]!.text.trim().length).toBeGreaterThan(0);
    const nas = await mod.loadLocalSurahText(114);
    expect(nas).not.toBeNull();
    expect(nas!.ayahs.length).toBe(6);
  });

  it('loadLocalTafsirMuyassar parses the shipped nested file', async () => {
    const { mod } = await getModule();
    const fatiha = await mod.loadLocalTafsirMuyassar(1);
    expect(fatiha).not.toBeNull();
    expect(Object.keys(fatiha!).length).toBe(7);
    expect(fatiha![1]!.trim().length).toBeGreaterThan(0);
    const nas = await mod.loadLocalTafsirMuyassar(114);
    expect(nas).not.toBeNull();
    expect(Object.keys(nas!).length).toBe(6);
  });

  it('loadLocalTranslation reads every bundled edition from the shipped files', async () => {
    const { mod } = await getModule();
    for (const edition of ['en.sahih', 'en.pickthall', 'en.yusufali', 'fr.hamidullah', 'ur.jalandhry']) {
      const surah = await mod.loadLocalTranslation(1, edition);
      expect(surah, edition).not.toBeNull();
      expect(surah!.ayahs.length, edition).toBe(7);
      expect(surah!.ayahs[0]!.text.trim().length, edition).toBeGreaterThan(0);
    }
  });
});
