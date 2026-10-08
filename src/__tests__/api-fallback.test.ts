/**
 * Tests for api-fallback.ts — local JSON caching for offline operation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

vi.unmock('../api-fallback.js');

// Mock api-client's jsonFetch — api-fallback uses it internally
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

const SURAH_LIST_FIXTURE_3 = [
  { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', numberOfAyahs: 7 },
  { number: 2, name: 'البقرة', englishName: 'Al-Baqara', numberOfAyahs: 286 },
  { number: 114, name: 'الناس', englishName: 'An-Nas', numberOfAyahs: 6 },
];

// Generate a 114-entry surah list fixture
const SURAH_LIST_FIXTURE_114 = Array.from({ length: 114 }, (_, i) => ({
  number: i + 1,
  name: `سورة ${i + 1}`,
  englishName: `Surah ${i + 1}`,
  numberOfAyahs: 7,
}));

const QURAN_FIXTURE = {
  data: {
    surahs: [
      {
        number: 1,
        name: 'الفاتحة',
        englishName: 'Al-Fatiha',
        englishNameTranslation: 'The Opening',
        revelationType: 'Meccan',
        numberOfAyahs: 7,
        ayahs: [
          { number: 1, text: 'بسم الله الرحمن الرحيم', numberInSurah: 1, juz: 1, page: 1, sajda: false },
          { number: 2, text: 'الحمد لله رب العالمين', numberInSurah: 2, juz: 1, page: 1, sajda: false },
        ],
      },
      {
        number: 114,
        name: 'الناس',
        englishName: 'An-Nas',
        englishNameTranslation: 'Mankind',
        revelationType: 'Meccan',
        numberOfAyahs: 6,
        ayahs: [{ number: 6231, text: 'قل أعوذ برب الناس', numberInSurah: 1, juz: 30, page: 604, sajda: false }],
      },
    ],
  },
};

const TAFSIR_FIXTURE: Record<string, string> = {
  '1:1': 'تفسير الآية الأولى من الفاتحة',
  '1:2': 'تفسير الآية الثانية من الفاتحة',
  '2:1': 'تفسير الآية الأولى من البقرة',
};

async function getModule() {
  const mod = await import('../api-fallback.js');
  const apiClient = await import('../api-client.js');
  return { mod, jsonFetchMock: apiClient.jsonFetch as ReturnType<typeof vi.fn> };
}

describe('api-fallback — loadLocalSurahList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns 114 entries when local file has 114 surahs', async () => {
    const { mod, jsonFetchMock } = await getModule();
    jsonFetchMock.mockResolvedValue(SURAH_LIST_FIXTURE_114);
    const result = await mod.loadLocalSurahList();
    expect(result).not.toBeNull();
    expect(result!.length).toBe(114);
  });

  it('returns null when local file has fewer than 114 entries', async () => {
    const { mod, jsonFetchMock } = await getModule();
    jsonFetchMock.mockResolvedValue(SURAH_LIST_FIXTURE_3);
    const result = await mod.loadLocalSurahList();
    expect(result).toBeNull();
  });

  it('returns null when jsonFetch throws', async () => {
    const { mod, jsonFetchMock } = await getModule();
    jsonFetchMock.mockRejectedValue(new Error('network error'));
    const result = await mod.loadLocalSurahList();
    expect(result).toBeNull();
  });
});

describe('api-fallback — loadLocalSurahText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns surah data when the surah exists locally', async () => {
    const { mod, jsonFetchMock } = await getModule();
    jsonFetchMock.mockResolvedValue(QURAN_FIXTURE);
    const result = await mod.loadLocalSurahText(1);
    expect(result).not.toBeNull();
    expect(result!.number).toBe(1);
    expect(result!.name).toBe('الفاتحة');
    expect(result!.englishName).toBe('Al-Fatiha');
    expect(result!.numberOfAyahs).toBe(7);
    expect(result!.ayahs.length).toBe(2);
    expect(result!.ayahs[0].text).toContain('بسم');
  });

  it('returns the last surah (An-Nas) correctly', async () => {
    const { mod, jsonFetchMock } = await getModule();
    jsonFetchMock.mockResolvedValue(QURAN_FIXTURE);
    const result = await mod.loadLocalSurahText(114);
    expect(result).not.toBeNull();
    expect(result!.number).toBe(114);
    expect(result!.name).toBe('الناس');
  });

  it('returns null when surahNum is not found', async () => {
    const { mod, jsonFetchMock } = await getModule();
    jsonFetchMock.mockResolvedValue(QURAN_FIXTURE);
    const result = await mod.loadLocalSurahText(999);
    expect(result).toBeNull();
  });

  it('returns null when jsonFetch throws', async () => {
    const { mod, jsonFetchMock } = await getModule();
    jsonFetchMock.mockRejectedValue(new Error('network error'));
    const result = await mod.loadLocalSurahText(1);
    expect(result).toBeNull();
  });

  it('caches the Quran data — second call does not re-fetch', async () => {
    const { mod, jsonFetchMock } = await getModule();
    jsonFetchMock.mockResolvedValue(QURAN_FIXTURE);
    await mod.loadLocalSurahText(1);
    await mod.loadLocalSurahText(114);
    // jsonFetch should only be called once for quran-uthmani.json
    expect(jsonFetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('api-fallback — loadLocalTafsirMuyassar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns tafsir entries for surah 1', async () => {
    const { mod, jsonFetchMock } = await getModule();
    jsonFetchMock.mockResolvedValue(TAFSIR_FIXTURE);
    const result = await mod.loadLocalTafsirMuyassar(1);
    expect(result).not.toBeNull();
    expect(Object.keys(result!).length).toBe(2);
    expect(result![1]).toContain('الفاتحة');
    expect(result![2]).toContain('الفاتحة');
  });

  it('returns entries for surah 2 only (not surah 1)', async () => {
    const { mod, jsonFetchMock } = await getModule();
    jsonFetchMock.mockResolvedValue(TAFSIR_FIXTURE);
    const result = await mod.loadLocalTafsirMuyassar(2);
    expect(result).not.toBeNull();
    expect(Object.keys(result!).length).toBe(1);
    expect(result![1]).toContain('البقرة');
  });

  it('returns null when no entries match the surah', async () => {
    const { mod, jsonFetchMock } = await getModule();
    jsonFetchMock.mockResolvedValue(TAFSIR_FIXTURE);
    const result = await mod.loadLocalTafsirMuyassar(999);
    expect(result).toBeNull();
  });

  it('returns null when jsonFetch throws', async () => {
    const { mod, jsonFetchMock } = await getModule();
    jsonFetchMock.mockRejectedValue(new Error('network error'));
    const result = await mod.loadLocalTafsirMuyassar(1);
    expect(result).toBeNull();
  });
});

const TRANSLATION_FIXTURE = {
  data: {
    surahs: [
      {
        number: 1,
        name: 'الفاتحة',
        englishName: 'Al-Fatiha',
        ayahs: [
          {
            number: 1,
            text: 'In the name of Allah, the Entirely Merciful, the Especially Merciful.',
            numberInSurah: 1,
          },
          { number: 2, text: 'All praise is due to Allah, Lord of the worlds.', numberInSurah: 2 },
        ],
      },
      {
        number: 114,
        name: 'الناس',
        englishName: 'An-Nas',
        ayahs: [{ number: 6231, text: 'Say, "I seek refuge in the Lord of mankind."', numberInSurah: 1 }],
      },
    ],
  },
};

describe('api-fallback — loadLocalTranslation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns the surah translation for a bundled edition', async () => {
    const { mod, jsonFetchMock } = await getModule();
    jsonFetchMock.mockResolvedValue(TRANSLATION_FIXTURE);
    const result = await mod.loadLocalTranslation(1, 'en.sahih');
    expect(result).not.toBeNull();
    expect(result!.number).toBe(1);
    expect(result!.ayahs.length).toBe(2);
    expect(result!.ayahs[0].text).toContain('Entirely Merciful');
    // The shape matches an AlQuran.cloud /surah/{n}/{edition} `.data` payload,
    // so the caller uses it with no special-casing.
    expect(result!.ayahs[0].numberInSurah).toBe(1);
  });

  it('returns null for an edition with no bundled file — never another edition', async () => {
    const { mod, jsonFetchMock } = await getModule();
    jsonFetchMock.mockResolvedValue(TRANSLATION_FIXTURE);
    const result = await mod.loadLocalTranslation(1, 'en.pickthall');
    expect(result).toBeNull();
    // The map is checked before any fetch: an unbundled edition must not even
    // attempt a download, let alone serve the wrong translation under its name.
    expect(jsonFetchMock).not.toHaveBeenCalled();
  });

  it('returns null when the surah is missing from the file', async () => {
    const { mod, jsonFetchMock } = await getModule();
    jsonFetchMock.mockResolvedValue(TRANSLATION_FIXTURE);
    const result = await mod.loadLocalTranslation(999, 'en.sahih');
    expect(result).toBeNull();
  });

  it('returns null when any ayah text is empty — no half-translated surah', async () => {
    const { mod, jsonFetchMock } = await getModule();
    jsonFetchMock.mockResolvedValue({
      data: {
        surahs: [
          {
            number: 1,
            name: 'الفاتحة',
            englishName: 'Al-Fatiha',
            ayahs: [
              { number: 1, text: 'In the name of Allah.', numberInSurah: 1 },
              { number: 2, text: '   ', numberInSurah: 2 },
            ],
          },
        ],
      },
    });
    const result = await mod.loadLocalTranslation(1, 'en.sahih');
    expect(result).toBeNull();
  });

  it('returns null when jsonFetch throws', async () => {
    const { mod, jsonFetchMock } = await getModule();
    jsonFetchMock.mockRejectedValue(new Error('network error'));
    const result = await mod.loadLocalTranslation(1, 'en.sahih');
    expect(result).toBeNull();
  });

  it('caches per edition and clears with the rest of the fallback cache', async () => {
    const { mod, jsonFetchMock } = await getModule();
    jsonFetchMock.mockResolvedValue(TRANSLATION_FIXTURE);
    await mod.loadLocalTranslation(1, 'en.sahih');
    await mod.loadLocalTranslation(114, 'en.sahih');
    expect(jsonFetchMock).toHaveBeenCalledTimes(1);
    mod.clearLocalFallbackCache();
    await mod.loadLocalTranslation(1, 'en.sahih');
    expect(jsonFetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('api-fallback — isLocalFallbackAvailable & cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns true when local Quran file is accessible', async () => {
    const { mod, jsonFetchMock } = await getModule();
    jsonFetchMock.mockResolvedValue(QURAN_FIXTURE);
    const result = await mod.isLocalFallbackAvailable();
    expect(result).toBe(true);
  });

  it('returns false when jsonFetch throws', async () => {
    const { mod, jsonFetchMock } = await getModule();
    jsonFetchMock.mockRejectedValue(new Error('network error'));
    const result = await mod.isLocalFallbackAvailable();
    expect(result).toBe(false);
  });

  it('clearLocalFallbackCache resets the internal cache', async () => {
    const { mod, jsonFetchMock } = await getModule();
    jsonFetchMock.mockResolvedValue(QURAN_FIXTURE);
    await mod.loadLocalSurahText(1); // first call — loads and caches
    expect(jsonFetchMock).toHaveBeenCalledTimes(1);
    mod.clearLocalFallbackCache();
    await mod.loadLocalSurahText(1); // second call — should reload
    expect(jsonFetchMock).toHaveBeenCalledTimes(2);
  });
});
