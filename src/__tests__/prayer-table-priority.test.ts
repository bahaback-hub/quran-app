/**
 * Regression tests for prayer-source priority.
 *
 * Guards the Dammam 2026-11-27 defect where the date-less "underwritten" snapshot
 * (a single fixed set of times reused all year) used to be the FIRST source and
 * overrode the per-date prayer-times-1448.json table, skewing Maghrib/Isha by
 * exactly 104 minutes. The date-aware table must now win; the static table is a
 * last-resort fallback only.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { state } from '../state.js';

const {
  mockGetPrayerName,
  mockStorageGet,
  mockStorageSet,
  mockPrayerFetch,
  mockCalculatePrayerTimesLocally,
  mockShowToast,
  mockPrayerTimesRows,
  mockUpdatePlayPauseBtn,
  mockSetStoppedState,
  mockLocalJSONFails,
  mockDom,
} = vi.hoisted(() => {
  function createMockElement(): HTMLElement {
    return document.createElement('div');
  }

  function createMockAudioElement(): HTMLAudioElement {
    const el = document.createElement('audio') as HTMLAudioElement;
    el.pause = vi.fn();
    el.load = vi.fn();
    el.play = vi.fn(() => Promise.resolve());
    el.removeAttribute = vi.fn();
    return el;
  }

  const dom: Record<string, HTMLElement | HTMLAudioElement | HTMLInputElement | HTMLSelectElement | null> = {
    bigClockHijri: createMockElement(),
    bigClockDate: createMockElement(),
    bigClockTime: createMockElement(),
    bigClockTime2: createMockElement(),
    cityInput: Object.assign(createMockElement(), { value: 'الدمام' }) as unknown as HTMLInputElement,
    countryInput: Object.assign(createMockElement(), { value: 'SA' }) as unknown as HTMLInputElement,
    methodSelect: Object.assign(createMockElement(), { value: '4' }) as unknown as HTMLSelectElement,
    prayerTimesRows: createMockElement(),
    prayerNextCountdown: Object.assign(createMockElement(), { id: 'prayerNextCountdown' }),
    nextPrayerName: createMockElement(),
    nextPrayerTime: createMockElement(),
    azanNotification: createMockElement(),
    azanNotifPrayer: createMockElement(),
    azanPlayer: createMockAudioElement(),
    audioPlayer: createMockAudioElement(),
    testAzanBtn: createMockElement(),
    prayerBar: createMockElement(),
    expandBarBtn: document.createElement('button'),
  };

  return {
    mockGetPrayerName: vi.fn((key: string) => key),
    mockStorageGet: vi.fn(() => null),
    mockStorageSet: vi.fn(),
    mockPrayerFetch: vi.fn(),
    mockCalculatePrayerTimesLocally: vi.fn(() => Promise.resolve(null)),
    mockShowToast: vi.fn(),
    mockPrayerTimesRows: vi.fn((times: unknown[]) => JSON.stringify(times)),
    mockUpdatePlayPauseBtn: vi.fn(),
    mockSetStoppedState: vi.fn(),
    mockLocalJSONFails: vi.fn(() => false),
    mockDom: dom,
  };
});

vi.mock('../config.js', () => ({
  CONFIG: {
    API_BASE: 'https://api.alquran.cloud/v1',
    TAFSIR_API: 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir',
    PRAYER_API: 'https://api.aladhan.com/v1/timingsByCity',
    AZAN_FILE: '/azan.mp3',
    SURAH_COUNT: 114,
    STORAGE_PREFIX: 'quran_app_',
    DEFAULT_RECITER: 'ar.alafasy',
    DEFAULT_TAFSIR: 'ar-tafsir-muyassar',
    DEFAULT_METHOD: '4',
    DEFAULT_CITY: 'الدمام',
    DEFAULT_COUNTRY: 'SA',
    CACHE_LIMIT: 20,
  },
  PRAYER_ORDER: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'],
  PRAYER_DISPLAY_ORDER: ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'],
  PRAYER_NAMES_AR: {},
}));

vi.mock('../i18n.js', () => ({
  __: vi.fn((key: string) => key),
  getCityName: (key: string) => key,
  getPrayerName: mockGetPrayerName,
  getWeekday: vi.fn((day: number) => `day-${day}`),
  setLocale: vi.fn(),
  getCurrentLocale: vi.fn(() => 'ar'),
  loadLocale: vi.fn(() => Promise.resolve()),
}));

vi.mock('../storage.js', () => ({
  storage: {
    get: (...args: unknown[]) => (mockStorageGet as (...a: unknown[]) => unknown)(...args),
    set: (...args: unknown[]) => (mockStorageSet as (...a: unknown[]) => unknown)(...args),
    remove: vi.fn(),
  },
}));

vi.mock('../ui.js', () => ({
  showToast: mockShowToast,
}));

vi.mock('../templates.js', async () => {
  const real = await vi.importActual<typeof import('../templates-prayer.js')>('../templates-prayer.js');
  return {
    prayerTimesRows: mockPrayerTimesRows,
    PRAYER_BAR_LOCATIONS: real.PRAYER_BAR_LOCATIONS,
    barCountryOptions: real.barCountryOptions,
    barCityOptions: real.barCityOptions,
  };
});

vi.mock('../features/audio/audio.js', () => ({
  updatePlayPauseBtn: mockUpdatePlayPauseBtn,
  setStoppedState: mockSetStoppedState,
}));

vi.mock('../api-client.js', () => ({
  prayerFetch: (...args: unknown[]) => mockPrayerFetch(...args),
}));

vi.mock('../features/prayer/prayer-local.js', () => ({
  calculatePrayerTimesLocally: (...args: unknown[]) =>
    (mockCalculatePrayerTimesLocally as (...a: unknown[]) => unknown)(...args),
}));

vi.mock('../dom.js', () => ({
  dom: mockDom,
}));

import { loadPrayerTimes, loadUnderwrittenPrayerTable, stopClock } from '../features/prayer/prayer.js';

const UNDERWRITTEN_DAMMAM = {
  _comment: 'static snapshot (date-less)',
  dammam: {
    label: 'الدمام',
    Fajr: '04:30',
    Sunrise: '05:49',
    Dhuhr: '12:13',
    Asr: '15:40',
    Maghrib: '18:31',
    Isha: '20:01',
  },
};

const DATE_AWARE_DAMMAM = {
  cities: {
    الدمام: {
      days: [
        {
          date: '2026-11-27',
          hijri: '1448-06-18',
          Fajr: '04:45',
          Sunrise: '06:07',
          Dhuhr: '11:28',
          Asr: '14:27',
          Maghrib: '16:47',
          Isha: '18:17',
        },
      ],
    },
  },
};

function mockFetchForTables(): void {
  globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('prayer-times-1448.json')) {
      if (mockLocalJSONFails()) {
        return Promise.resolve({ ok: false, status: 404 } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(DATE_AWARE_DAMMAM),
      } as Response);
    }
    if (url.includes('prayer-times-underwritten.json')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(UNDERWRITTEN_DAMMAM),
      } as Response);
    }
    return Promise.resolve({ ok: false, status: 404 } as Response);
  }) as unknown as typeof fetch;
}

describe('prayer source priority (date-aware 1448 table vs static underwritten)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 27, 10, 0, 0));

    state.prayerTimes = null;
    state.azanEnabled = false;
    state.azanFajrEnabled = false;
    state.azanPlaying = false;
    state.isPlaying = false;
    state.lastAzanFired = null;
    state.barCollapsed = true;
    state.city = 'الدمام';
    state.country = 'SA';
    state.method = '4';

    mockStorageGet.mockReturnValue(null);
    mockCalculatePrayerTimesLocally.mockResolvedValue(null);
    mockPrayerFetch.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    stopClock();
    vi.restoreAllMocks();
  });

  it('uses the static underwritten snapshot ONLY when the date-aware table is unavailable', async () => {
    mockLocalJSONFails.mockReturnValue(true);
    mockFetchForTables();
    await loadUnderwrittenPrayerTable();
    await loadPrayerTimes();

    expect(state.prayerTimes).not.toBeNull();
    expect(state.prayerTimes!.Maghrib).toBe('18:31');
  });

  it('never lets the static snapshot override the date-aware 1448 table (Dammam 2026-11-27: 18:31 vs 16:47)', async () => {
    mockLocalJSONFails.mockReturnValue(false);
    mockFetchForTables();
    await loadUnderwrittenPrayerTable();
    await loadPrayerTimes();

    expect(state.prayerTimes).not.toBeNull();
    expect(state.prayerTimes!.Maghrib).toBe('16:47');
    expect(state.prayerTimes!.Isha).toBe('18:17');
  });
});
