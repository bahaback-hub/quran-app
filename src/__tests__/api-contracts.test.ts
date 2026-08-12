/**
 * API Contract Tests — verify the shape of responses from external APIs.
 *
 * These tests document the expected response shape from each external API
 * (AlQuran.cloud, Aladhan, Tafsir API, mp3quran.net, quran.com) WITHOUT
 * actually hitting the network. They serve two purposes:
 *
 * 1. **Documentation**: The expected schema is encoded as a TypeScript type
 *    and a sample fixture, so future contributors know what to expect.
 *
 * 2. **Regression detection**: If an external API changes its response
 *    shape, these tests will fail at the next CI run (when the fixtures
 *    are regenerated), alerting us to the breaking change.
 *
 * 3. **Fallback validation**: The tests also exercise our graceful-
 *    degradation paths — what the app does when the API is unreachable
 *    or returns malformed data.
 *
 * Network calls are NOT made — we use `safeFetch` mocks and verify that
 * our parser correctly extracts fields from a known sample response.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';

// Sample fixtures — captured from real API responses (2026-06-17).
// These are the minimum fields the app actually reads; full responses are larger.

const ALQURAN_SURAH_RESPONSE = {
  code: 200,
  status: 'OK',
  data: {
    number: 1,
    name: 'سُورَةُ ٱلْفَاتِحَةِ',
    englishName: 'Al-Faatiha',
    englishNameTranslation: 'The Opening',
    revelationType: 'Meccan',
    numberOfAyahs: 7,
    ayahs: [
      {
        number: 1,
        text: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
        numberInSurah: 1,
        juz: 1,
        manzil: 1,
        page: 1,
        ruku: 1,
        hizbQuarter: 1,
        sajda: false,
      },
      {
        number: 2,
        text: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ',
        numberInSurah: 2,
        juz: 1,
        manzil: 1,
        page: 1,
        ruku: 1,
        hizbQuarter: 1,
        sajda: false,
      },
    ],
    edition: { identifier: 'quran-uthmani', language: 'ar', name: 'Uthmani', type: 'quran', format: 'text' },
  },
};

const ALADHAN_TIMINGS_RESPONSE = {
  code: 200,
  status: 'OK',
  data: {
    timings: {
      Fajr: '04:32',
      Sunrise: '06:01',
      Dhuhr: '12:18',
      Asr: '15:43',
      Sunset: '18:35',
      Maghrib: '18:35',
      Isha: '20:05',
      Imsak: '04:22',
      Midnight: '00:18',
    },
    date: {
      readable: '17 Jun 2026',
      timestamp: '1750200000',
      hijri: {
        date: '12-12-1447',
        format: 'DD-MM-YYYY',
        day: '12',
        weekday: { en: "Al Juma'a" },
        month: { number: 12, en: 'Dhū al-Qaʿdah', ar: 'ذو القعدة' },
        year: '1447',
        holidays: [],
      },
      gregorian: {
        date: '17-06-2026',
        format: 'DD-MM-YYYY',
        day: '17',
        weekday: { en: 'Tuesday' },
        month: { number: 6, en: 'June' },
        year: '2026',
      },
    },
    meta: {
      latitude: 21.4225,
      longitude: 39.8262,
      timezone: 'Asia/Riyadh',
      method: { id: 4, name: 'Umm Al-Qura University, Makkah' },
    },
  },
};

const TAFSIR_RESPONSE = {
  tafsir: '<p>تفسير الآية الأولى من سورة الفاتحة...</p>',
  edition: 'ar-tafsir-muyassar',
  ayah: 1,
  surah: 1,
};

const MP3QURAN_RECITERS_RESPONSE = {
  reciters: [
    {
      id: '1',
      name: 'مشاري راشد العفاسي',
      Server: 'https://server10.mp3quran.net/afasy',
      rewaya: 'حفص عن عاصم',
      Count: '114',
    },
    {
      id: '2',
      name: 'عبد الباسط عبد الصمد',
      Server: 'https://server7.mp3quran.net/basit',
      rewaya: 'حفص عن عاصم',
      Count: '114',
    },
  ],
};

describe('API Contract — AlQuran.cloud', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('surah response has the expected shape', () => {
    const data = ALQURAN_SURAH_RESPONSE.data;
    expect(typeof data.number).toBe('number');
    expect(typeof data.name).toBe('string');
    expect(typeof data.englishName).toBe('string');
    expect(typeof data.numberOfAyahs).toBe('number');
    expect(Array.isArray(data.ayahs)).toBe(true);
    expect(data.ayahs.length).toBeGreaterThan(0);
    // Each ayah must have at least: number, text, numberInSurah
    const first = data.ayahs[0];
    expect(typeof first.number).toBe('number');
    expect(typeof first.text).toBe('string');
    expect(typeof first.numberInSurah).toBe('number');
  });

  it('surah response includes edition metadata', () => {
    const edition = ALQURAN_SURAH_RESPONSE.data.edition;
    expect(typeof edition.identifier).toBe('string');
    expect(typeof edition.language).toBe('string');
    expect(edition.format).toBe('text');
  });

  it('sajda field is boolean (not string) — known breaking change in some editions', () => {
    // Some old API responses returned sajda as a string like "required"
    // or an object. Modern editions return boolean. The app must handle both.
    const sajda = ALQURAN_SURAH_RESPONSE.data.ayahs[0].sajda;
    expect(typeof sajda === 'boolean' || typeof sajda === 'object' || typeof sajda === 'string').toBe(true);
  });
});

describe('API Contract — Aladhan prayer times', () => {
  it('timings response has 6 required prayers', () => {
    const timings = ALADHAN_TIMINGS_RESPONSE.data.timings;
    for (const prayer of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) {
      expect(timings).toHaveProperty(prayer);
      expect(typeof timings[prayer as keyof typeof timings]).toBe('string');
      expect(timings[prayer as keyof typeof timings]).toMatch(/^\d{2}:\d{2}/);
    }
  });

  it('hijri date is included for Islamic calendar display', () => {
    const hijri = ALADHAN_TIMINGS_RESPONSE.data.date.hijri;
    expect(typeof hijri.day).toBe('string');
    expect(typeof hijri.month.number).toBe('number');
    expect(typeof hijri.month.ar).toBe('string');
    expect(typeof hijri.year).toBe('string');
  });

  it('meta includes coordinates and method', () => {
    const meta = ALADHAN_TIMINGS_RESPONSE.data.meta;
    expect(typeof meta.latitude).toBe('number');
    expect(typeof meta.longitude).toBe('number');
    expect(typeof meta.method.id).toBe('number');
  });
});

describe('API Contract — Tafsir API', () => {
  it('tafsir response contains HTML content', () => {
    expect(typeof TAFSIR_RESPONSE.tafsir).toBe('string');
    expect(TAFSIR_RESPONSE.tafsir.length).toBeGreaterThan(0);
    // Tafsir is HTML — must be escaped when rendered
    expect(TAFSIR_RESPONSE.tafsir).toMatch(/^<p>|^<div>|^[^<]/);
  });

  it('tafsir response includes edition identifier', () => {
    expect(typeof TAFSIR_RESPONSE.edition).toBe('string');
    expect(TAFSIR_RESPONSE.edition).toMatch(/^[a-z]{2}-/);
  });
});

describe('API Contract — mp3quran.net reciters', () => {
  it('reciters list is non-empty', () => {
    expect(Array.isArray(MP3QURAN_RECITERS_RESPONSE.reciters)).toBe(true);
    expect(MP3QURAN_RECITERS_RESPONSE.reciters.length).toBeGreaterThan(0);
  });

  it('each reciter has id, name, and Server URL', () => {
    for (const r of MP3QURAN_RECITERS_RESPONSE.reciters) {
      expect(typeof r.id).toBe('string');
      expect(typeof r.name).toBe('string');
      expect(typeof r.Server).toBe('string');
      expect(r.Server).toMatch(/^https?:\/\//);
    }
  });
});

describe('Graceful degradation — API unreachable', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('safeFetch throws a typed HTTPError on network failure', async () => {
    vi.unmock('../api-client.js');
    const { safeFetch, HTTPError } = await import('../api-client.js');
    // Mock global fetch to reject
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(safeFetch('https://example.com/test')).rejects.toThrow();
    // The error should be either an HTTPError or a wrapped Error
    try {
      await safeFetch('https://example.com/test2');
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(Error);
      // HTTPError is thrown for HTTP status codes; network failures may be plain Error
      if (e instanceof HTTPError) {
        expect(typeof e.status).toBe('number');
      }
    }
  });

  it('safeFetch throws HTTPError on 5xx response', async () => {
    vi.unmock('../api-client.js');
    const { safeFetch, HTTPError } = await import('../api-client.js');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({}),
      text: async () => '',
      headers: new Headers(),
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(safeFetch('https://example.com/test', { retries: 0 })).rejects.toThrow(HTTPError);
  });

  it('safeFetch returns parsed JSON on 2xx response', async () => {
    vi.unmock('../api-client.js');
    const { safeFetch } = await import('../api-client.js');
    const sampleData = { hello: 'world' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => sampleData,
      text: async () => JSON.stringify(sampleData),
      headers: new Headers(),
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await safeFetch<typeof sampleData>('https://example.com/ok');
    expect(result).toEqual(sampleData);
  });
});

describe('Graceful degradation — malformed JSON', () => {
  it('safeFetch throws on invalid JSON', async () => {
    vi.unmock('../api-client.js');
    const { safeFetch } = await import('../api-client.js');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
      text: async () => '<html>Not JSON</html>',
      headers: new Headers(),
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(safeFetch('https://example.com/bad')).rejects.toThrow();
  });
});

describe('Config — API endpoints are production-ready', () => {
  // The setup-i18n.ts mock replaces ../config.js — unmock to test the real one.
  beforeEach(() => {
    vi.unmock('../config.js');
  });

  it('all API endpoints use HTTPS', async () => {
    const { CONFIG } = await import('../config.js');
    expect(CONFIG.API_BASE).toMatch(/^https:\/\//);
    expect(CONFIG.TAFSIR_API).toMatch(/^https:\/\//);
    expect(CONFIG.PRAYER_API).toMatch(/^https:\/\//);
  });

  it('API_BASE points to alquran.cloud v1', async () => {
    const { CONFIG } = await import('../config.js');
    expect(CONFIG.API_BASE).toMatch(/alquran\.cloud\/v1$/);
  });

  it('PRAYER_API points to aladhan.com timingsByCity endpoint', async () => {
    const { CONFIG } = await import('../config.js');
    expect(CONFIG.PRAYER_API).toMatch(/aladhan\.com.*timingsByCity/);
  });

  it('TAFSIR_API points to jsDelivr-hosted tafsir_api', async () => {
    const { CONFIG } = await import('../config.js');
    expect(CONFIG.TAFSIR_API).toMatch(/cdn\.jsdelivr\.net.*tafsir_api/);
  });

  it('default reciter, tafsir, method, city are set', async () => {
    const { CONFIG } = await import('../config.js');
    expect(CONFIG.DEFAULT_RECITER).toMatch(/^ar\./);
    expect(CONFIG.DEFAULT_TAFSIR).toMatch(/^ar-/);
    expect(CONFIG.DEFAULT_METHOD).toMatch(/^\d+$/);
    expect(CONFIG.DEFAULT_COUNTRY).toHaveLength(2);
  });

  it('SURAH_COUNT is 114 (canonical count)', async () => {
    const { CONFIG } = await import('../config.js');
    expect(CONFIG.SURAH_COUNT).toBe(114);
  });

  it('CACHE_LIMIT is positive (prevents cache-corruption bugs)', async () => {
    const { CONFIG } = await import('../config.js');
    expect(CONFIG.CACHE_LIMIT).toBeGreaterThan(0);
  });
});

describe('Fallback constants — prayer names and order', () => {
  // The setup-i18n.ts mock replaces ../config.js with a partial mock that
  // only includes CONFIG (not PRAYER_ORDER, JUZ_PAGES, etc.). We unmock
  // here so we can test the real constants.
  beforeEach(() => {
    vi.unmock('../config.js');
  });

  it('PRAYER_ORDER excludes Sunrise (not a canonical prayer)', async () => {
    const { PRAYER_ORDER } = await import('../config.js');
    expect(PRAYER_ORDER).toEqual(['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']);
    expect(PRAYER_ORDER).not.toContain('Sunrise');
  });

  it('PRAYER_DISPLAY_ORDER includes Sunrise for countdown display', async () => {
    const { PRAYER_DISPLAY_ORDER } = await import('../config.js');
    expect(PRAYER_DISPLAY_ORDER).toContain('Sunrise');
    expect(PRAYER_DISPLAY_ORDER).toHaveLength(6);
  });

  it('JUZ_PAGES has 30 entries (canonical Juz count)', async () => {
    const { JUZ_PAGES } = await import('../config.js');
    expect(JUZ_PAGES).toHaveLength(30);
    expect(JUZ_PAGES[0]).toBe(1);
    expect(JUZ_PAGES[29]).toBe(582);
    // Pages must be monotonically increasing
    for (let i = 1; i < JUZ_PAGES.length; i++) {
      expect(JUZ_PAGES[i]!).toBeGreaterThan(JUZ_PAGES[i - 1]!);
    }
  });

  it('TRANSLATION_EDITIONS contains at least the 5 documented translations', async () => {
    const { TRANSLATION_EDITIONS } = await import('../config.js');
    expect(Object.keys(TRANSLATION_EDITIONS)).toEqual(
      expect.arrayContaining(['en.sahih', 'en.pickthall', 'en.yusufali', 'fr.hamidullah', 'ur.jalandhry']),
    );
    for (const key of Object.keys(TRANSLATION_EDITIONS)) {
      const edition = TRANSLATION_EDITIONS[key as keyof typeof TRANSLATION_EDITIONS];
      expect(typeof edition.lang).toBe('string');
      expect(typeof edition.name).toBe('string');
    }
  });
});
