import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state } from '../state.js';
import { dom } from '../dom.js';
import type { SurahData } from '../types.js';

// Mock config
vi.mock('../config.js', () => ({
  CONFIG: {
    API_BASE: 'https://api.alquran.cloud/v1',
    TAFSIR_API: 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir',
    PRAYER_API: 'https://api.aladhan.com/v1/timingsByCity',
    AZAN_FILE: 'azan.mp3',
    SURAH_COUNT: 114,
    STORAGE_PREFIX: 'quran_app_',
    DEFAULT_RECITER: 'ar.alafasy',
    DEFAULT_TAFSIR: 'ar-tafsir-muyassar',
    DEFAULT_METHOD: '4',
    DEFAULT_CITY: 'مكة المكرمة',
    DEFAULT_COUNTRY: 'SA',
    CACHE_LIMIT: 20,
  },
}));

// Mock i18n
vi.mock('../i18n.js', () => ({
  __: vi.fn((key: string) => key),
}));

// Mock storage
vi.mock('../storage.js', () => ({
  storage: {
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

// Mock templates
vi.mock('../templates.js', () => ({
  tafsirLoading: vi.fn(() => '<div class="tafsir-loading">loading</div>'),
  tafsirContent: vi.fn((text: string) => `<div class="tafsir-text">${text}</div>`),
  tafsirErrorMessage: vi.fn((msg: string) => `<div class="tafsir-error">${msg}</div>`),
  escapeHtml: vi.fn((s: string) => s),
}));

// Mock api-client
vi.mock('../api-client.js', () => ({
  apiFetch: vi.fn(),
  tafsirFetch: vi.fn(),
}));

// Mock localStorage
const store: Record<string, string> = {};
beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  globalThis.localStorage = {
    getItem: (key: string) => (store[key] === undefined ? null : store[key]),
    setItem: (key: string, val: string) => {
      store[key] = String(val);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
  } as Storage;
});

// In-memory store for tafsir cache entries
const mockIDBData: Record<string, { key: string; val: string }> = {};

// Create a fully functional mock IDBDatabase
function createMockIDBDatabase() {
  const storeNames = new Set<string>();
  return {
    objectStoreNames: {
      contains: (name: string) => storeNames.has(name),
    },
    createObjectStore: vi.fn((name: string, _opts?: unknown) => {
      storeNames.add(name);
      return {};
    }),
    transaction: vi.fn((_storeName: string, _mode?: string) => {
      const data = mockIDBData;
      return {
        objectStore: vi.fn(() => ({
          get: vi.fn((key: string) => {
            const req: { result: unknown; onsuccess?: ((ev: { target: { result: unknown } }) => void) | null } = {
              result: null,
              onsuccess: null,
            };
            queueMicrotask(() => {
              req.result = data[key] || null;
              if (req.onsuccess) req.onsuccess({ target: { result: req.result } });
            });
            return req;
          }),
          put: vi.fn((val: { key: string; val: string }) => {
            data[val.key] = val;
          }),
        })),
      };
    }),
  };
}

let mockDB: ReturnType<typeof createMockIDBDatabase> | null = null;

beforeEach(() => {
  mockDB = createMockIDBDatabase();
  Object.keys(mockIDBData).forEach((k) => delete mockIDBData[k]);

  globalThis.indexedDB = {
    open: vi.fn(() => {
      const request: {
        onupgradeneeded?: ((ev: { target: { result: unknown } }) => void) | null;
        onsuccess?: ((ev: { target: { result: unknown } }) => void) | null;
      } = {
        onupgradeneeded: null,
        onsuccess: null,
      };
      queueMicrotask(() => {
        if (request.onupgradeneeded) {
          request.onupgradeneeded({ target: { result: mockDB } });
        }
        if (request.onsuccess) {
          request.onsuccess({ target: { result: mockDB } });
        }
      });
      return request as unknown as IDBOpenDBRequest;
    }),
  } as unknown as IDBFactory;
});

import {
  closeTafsir,
  toggleTafsir,
  openTafsir,
  fetchTafsirText,
  loadTafsirForCurrentAyah,
  loadTafsirForSurahAyah,
} from '../tafsir.js';

beforeEach(() => {
  // Set up DOM elements
  dom.tafsirCurtain = document.createElement('div');
  dom.tafsirCurtain.className = 'tafsir-curtain';
  dom.tafsirCurtainHandle = document.createElement('div');
  dom.tafsirCurtainHeader = document.createElement('div');
  dom.tafsirCurtainBody = document.createElement('div');
  dom.tafsirSelect = document.createElement('select') as HTMLSelectElement;

  // Reset state
  state.surahData = null;
  state.currentAyahIndex = 0;
  state.currentSurah = 1;
  state.currentTafsirEdition = 'ar-tafsir-muyassar';
  state.surahList = [
    { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', numberOfAyahs: 7 },
    { number: 2, name: 'البقرة', englishName: 'Al-Baqara', numberOfAyahs: 286 },
  ];
});

describe('openTafsir', () => {
  it('should add open class to tafsir curtain', () => {
    openTafsir();
    expect(dom.tafsirCurtain!.classList.contains('open')).toBe(true);
  });

  it('should add open class to tafsir curtain handle', () => {
    openTafsir();
    expect(dom.tafsirCurtainHandle!.classList.contains('open')).toBe(true);
  });

  it('should not throw when tafsirCurtain is null', () => {
    dom.tafsirCurtain = null;
    expect(() => openTafsir()).not.toThrow();
  });
});

describe('closeTafsir', () => {
  it('should remove open class from tafsir curtain', () => {
    dom.tafsirCurtain!.classList.add('open');
    closeTafsir();
    expect(dom.tafsirCurtain!.classList.contains('open')).toBe(false);
  });

  it('should remove open class from tafsir curtain handle', () => {
    dom.tafsirCurtainHandle!.classList.add('open');
    closeTafsir();
    expect(dom.tafsirCurtainHandle!.classList.contains('open')).toBe(false);
  });

  it('should not throw when tafsirCurtain is null', () => {
    dom.tafsirCurtain = null;
    expect(() => closeTafsir()).not.toThrow();
  });
});

describe('toggleTafsir', () => {
  it('should open tafsir when closed', () => {
    expect(dom.tafsirCurtain!.classList.contains('open')).toBe(false);
    toggleTafsir();
    expect(dom.tafsirCurtain!.classList.contains('open')).toBe(true);
  });

  it('should close tafsir when open', () => {
    dom.tafsirCurtain!.classList.add('open');
    toggleTafsir();
    expect(dom.tafsirCurtain!.classList.contains('open')).toBe(false);
  });
});

describe('fetchTafsirText', () => {
  it('should return null when edition is missing', async () => {
    const result = await fetchTafsirText('', 1, 1);
    expect(result).toBeNull();
  });

  it('should return null when surahNum is 0', async () => {
    const result = await fetchTafsirText('ar-tafsir-muyassar', 0, 1);
    expect(result).toBeNull();
  });

  it('should return null when ayahNum is 0', async () => {
    const result = await fetchTafsirText('ar-tafsir-muyassar', 1, 0);
    expect(result).toBeNull();
  });

  it('should return translated fallback key when API returns no tafsir text', async () => {
    // Mock tafsirFetch to return empty object
    const { tafsirFetch } = await import('../api-client.js');
    vi.mocked(tafsirFetch).mockResolvedValue({});

    const result = await fetchTafsirText('ar-tafsir-muyassar', 1, 1);
    // Mock __() returns key 'no_tafsir_available'
    expect(result).toBe('no_tafsir_available');
  });

  it('should return null when API fetch fails', async () => {
    const { tafsirFetch } = await import('../api-client.js');
    vi.mocked(tafsirFetch).mockRejectedValue(new Error('Network error'));
    const result = await fetchTafsirText('ar-tafsir-muyassar', 1, 1);
    expect(result).toBeNull();
  });
});

describe('loadTafsirForCurrentAyah', () => {
  it('should return early when surahData is null', async () => {
    state.surahData = null;
    await loadTafsirForCurrentAyah();
    expect(dom.tafsirCurtainHeader!.textContent).toBe('');
  });

  it('should set tafsir header with surah name and ayah number', async () => {
    state.surahData = {
      number: 1,
      name: 'الفاتحة',
      englishName: 'Al-Fatiha',
      ayahs: [{ numberInSurah: 1, text: 'بِسْمِ اللَّهِ' }],
    } as SurahData;
    state.currentAyahIndex = 0;

    const { tafsirFetch } = await import('../api-client.js');
    vi.mocked(tafsirFetch).mockResolvedValue({ tafsir: { text: 'تفسير الفاتحة' } });

    await loadTafsirForCurrentAyah();

    expect(dom.tafsirCurtainHeader!.textContent).toContain('الفاتحة');
  });

  it('should return early when currentAyahIndex is out of range', async () => {
    state.surahData = {
      number: 1,
      name: 'الفاتحة',
      englishName: 'Al-Fatiha',
      ayahs: [],
    } as SurahData;
    state.currentAyahIndex = 0;

    await loadTafsirForCurrentAyah();
    expect(dom.tafsirCurtainHeader!.textContent).toBe('');
  });
});

describe('loadTafsirForSurahAyah', () => {
  it('should return early when dom elements are null', async () => {
    dom.tafsirCurtainBody = null;
    await loadTafsirForSurahAyah(1, 1);
    // Should not throw
  });

  it('should use surah name from surahList', async () => {
    const { tafsirFetch } = await import('../api-client.js');
    vi.mocked(tafsirFetch).mockResolvedValue({ tafsir: { text: 'تفسير' } });

    await loadTafsirForSurahAyah(1, 1);

    expect(dom.tafsirCurtainHeader!.textContent).toContain('الفاتحة');
  });

  it('should use fallback surah name when surah not in list', async () => {
    const { tafsirFetch } = await import('../api-client.js');
    vi.mocked(tafsirFetch).mockResolvedValue({ tafsir: { text: 'تفسير' } });

    await loadTafsirForSurahAyah(999, 1);

    // Mock __() returns key 'surah', so header contains 'surah 999'
    expect(dom.tafsirCurtainHeader!.textContent).toContain('999');
  });

  it('should open tafsir curtain', async () => {
    const { tafsirFetch } = await import('../api-client.js');
    vi.mocked(tafsirFetch).mockResolvedValue({ tafsir: { text: 'تفسير' } });

    await loadTafsirForSurahAyah(1, 1);

    expect(dom.tafsirCurtain!.classList.contains('open')).toBe(true);
  });

  it('should show error when API fails', async () => {
    const { tafsirFetch } = await import('../api-client.js');
    vi.mocked(tafsirFetch).mockRejectedValue(new Error('Network error'));

    await loadTafsirForSurahAyah(1, 1);

    expect(dom.tafsirCurtainBody!.innerHTML).toContain('tafsir-error');
  });
});
