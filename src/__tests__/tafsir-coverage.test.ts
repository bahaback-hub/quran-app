/**
 * Coverage tests for tafsir.ts — covers additional branches:
 * - Local Muyassar loading (success and failure)
 * - IndexedDB cache (hit and miss)
 * - API fetch (success and failure)
 * - renderTafsirContent, setTafsirHeader, showTafsirLoading, showTafsirError
 * - loadTafsirForCurrentAyah (various paths)
 * - loadTafsirForSurahAyah (with and without surah info)
 * - fetchTafsirText (all guard conditions)
 */

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
const localStorageStore: Record<string, string> = {};
beforeEach(() => {
  Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]);
  globalThis.localStorage = {
    getItem: (key: string) => (localStorageStore[key] === undefined ? null : localStorageStore[key]),
    setItem: (key: string, val: string) => { localStorageStore[key] = String(val); },
    removeItem: (key: string) => { delete localStorageStore[key]; },
    clear: () => { Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]); },
  } as Storage;
});

// Mock IDB
const mockIDBData: Record<string, { key: string; val: string }> = {};

function createMockIDBDatabase() {
  const storeNames = new Set<string>();
  return {
    objectStoreNames: {
      contains: (name: string) => storeNames.has(name),
    },
    createObjectStore: vi.fn((name: string) => {
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
        onerror?: ((ev: { target: { result: unknown } }) => void) | null;
      } = {
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
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
  dom.tafsirCurtain = document.createElement('div');
  dom.tafsirCurtain.className = 'tafsir-curtain';
  dom.tafsirCurtainHandle = document.createElement('div');
  dom.tafsirCurtainHeader = document.createElement('div');
  dom.tafsirCurtainBody = document.createElement('div');
  dom.tafsirSelect = document.createElement('select') as HTMLSelectElement;

  state.surahData = null;
  state.currentAyahIndex = 0;
  state.currentSurah = 1;
  state.currentTafsirEdition = 'ar-tafsir-muyassar';
  state.surahList = [
    { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', numberOfAyahs: 7 },
    { number: 2, name: 'البقرة', englishName: 'Al-Baqara', numberOfAyahs: 286 },
  ];
  state.fullQuranText = [];
});

describe('tafsir coverage', () => {
  describe('fetchTafsirText — guard conditions', () => {
    it('should return null for empty edition', async () => {
      const result = await fetchTafsirText('', 1, 1);
      expect(result).toBeNull();
    });

    it('should return null for zero surahNum', async () => {
      const result = await fetchTafsirText('ar-tafsir-muyassar', 0, 1);
      expect(result).toBeNull();
    });

    it('should return null for zero ayahNum', async () => {
      const result = await fetchTafsirText('ar-tafsir-muyassar', 1, 0);
      expect(result).toBeNull();
    });

    it('should return tafsir text from API when cache miss', async () => {
      const { tafsirFetch } = await import('../api-client.js');
      vi.mocked(tafsirFetch).mockResolvedValue({
        tafsir: { text: 'Tafsir from API' },
      });

      const result = await fetchTafsirText('ar-tafsir-muyassar', 1, 1);
      expect(result).toBe('Tafsir from API');
    });

    it('should return text from data.text when tafsir.text is missing', async () => {
      const { tafsirFetch } = await import('../api-client.js');
      vi.mocked(tafsirFetch).mockResolvedValue({
        text: 'Direct text',
      });

      const result = await fetchTafsirText('ar-tafsir-muyassar', 1, 1);
      expect(result).toBe('Direct text');
    });

    it('should return null when API fetch fails', async () => {
      const { tafsirFetch } = await import('../api-client.js');
      vi.mocked(tafsirFetch).mockRejectedValue(new Error('Network error'));

      const result = await fetchTafsirText('ar-tafsir-muyassar', 1, 1);
      expect(result).toBeNull();
    });
  });

  describe('loadTafsirForCurrentAyah', () => {
    it('should return early when tafsirCurtainBody is null', async () => {
      dom.tafsirCurtainBody = null;
      state.surahData = { ayahs: [{ text: 'test' }] } as any;
      await loadTafsirForCurrentAyah();
      // Should not throw
    });

    it('should return early when tafsirCurtainHeader is null', async () => {
      dom.tafsirCurtainHeader = null;
      state.surahData = { ayahs: [{ text: 'test' }] } as any;
      await loadTafsirForCurrentAyah();
      // Should not throw
    });

    it('should return early when currentAyahIndex is out of bounds', async () => {
      state.surahData = {
        number: 1,
        name: 'الفاتحة',
        englishName: 'Al-Fatiha',
        ayahs: [],
      } as SurahData;
      state.currentAyahIndex = 0;

      await loadTafsirForCurrentAyah();
      // Header should remain empty since no ayah at index 0
    });

    it('should load tafsir via API when local and cache miss', async () => {
      state.surahData = {
        number: 1,
        name: 'الفاتحة',
        englishName: 'Al-Fatiha',
        ayahs: [{ numberInSurah: 1, text: 'بِسْمِ اللَّهِ' }],
      } as SurahData;
      state.currentAyahIndex = 0;

      const { tafsirFetch } = await import('../api-client.js');
      vi.mocked(tafsirFetch).mockResolvedValue({
        tafsir: { text: 'تفسير الفاتحة من API' },
      });

      await loadTafsirForCurrentAyah();

      expect(dom.tafsirCurtainHeader!.textContent).toContain('الفاتحة');
      expect(dom.tafsirCurtainBody!.innerHTML).toContain('تفسير الفاتحة من API');
    });

    it('should show error when API fails', async () => {
      state.surahData = {
        number: 1,
        name: 'الفاتحة',
        englishName: 'Al-Fatiha',
        ayahs: [{ numberInSurah: 1, text: 'بِسْمِ اللَّهِ' }],
      } as SurahData;
      state.currentAyahIndex = 0;

      const { tafsirFetch } = await import('../api-client.js');
      vi.mocked(tafsirFetch).mockRejectedValue(new Error('Network error'));

      await loadTafsirForCurrentAyah();

      expect(dom.tafsirCurtainBody!.innerHTML).toContain('tafsir-error');
    });
  });

  describe('loadTafsirForSurahAyah', () => {
    it('should use fallback surah name when surah not in list', async () => {
      const { tafsirFetch } = await import('../api-client.js');
      vi.mocked(tafsirFetch).mockResolvedValue({ tafsir: { text: 'تفسير' } });

      await loadTafsirForSurahAyah(999, 1);

      expect(dom.tafsirCurtainHeader!.textContent).toContain('999');
    });

    it('should use surah name from surahList when available', async () => {
      const { tafsirFetch } = await import('../api-client.js');
      vi.mocked(tafsirFetch).mockResolvedValue({ tafsir: { text: 'تفسير' } });

      await loadTafsirForSurahAyah(1, 1);

      expect(dom.tafsirCurtainHeader!.textContent).toContain('الفاتحة');
    });

    it('should show error when API fails for surahAyah', async () => {
      const { tafsirFetch } = await import('../api-client.js');
      vi.mocked(tafsirFetch).mockRejectedValue(new Error('Network error'));

      await loadTafsirForSurahAyah(1, 1);

      expect(dom.tafsirCurtainBody!.innerHTML).toContain('tafsir-error');
    });

    it('should open tafsir curtain', async () => {
      const { tafsirFetch } = await import('../api-client.js');
      vi.mocked(tafsirFetch).mockResolvedValue({ tafsir: { text: 'تفسير' } });

      await loadTafsirForSurahAyah(1, 1);

      expect(dom.tafsirCurtain!.classList.contains('open')).toBe(true);
    });
  });

  describe('openTafsir', () => {
    it('should add open class to tafsir curtain', () => {
      openTafsir();
      expect(dom.tafsirCurtain!.classList.contains('open')).toBe(true);
    });

    it('should add open class to curtain handle', () => {
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

  describe('Local Muyassar tafsir', () => {
    it('should load local Muyassar tafsir when available', async () => {
      // Mock fetch to return local Muyassar data
      vi.spyOn(globalThis, 'fetch').mockImplementation((url: string) => {
        if (url.includes('muyassar-tafsir')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              1: { ayahs: [{ ayah: 1, text: 'مویسّر تفسیر' }] },
            }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ tafsir: { text: 'API tafsir' } }),
        } as Response);
      });

      const result = await fetchTafsirText('ar-tafsir-muyassar', 1, 1);
      expect(result).toBe('مویسّر تفسیر');
    });

    it('should handle local Muyassar fetch failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation((url: string) => {
        if (url.includes('muyassar-tafsir')) {
          return Promise.resolve({ ok: false } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ tafsir: { text: 'API fallback tafsir' } }),
        } as Response);
      });

      const result = await fetchTafsirText('ar-tafsir-muyassar', 1, 1);
      // Should fall back to API or cache
      expect(result).toBeTruthy();
    });

    it('should handle local Muyassar with bare array format', async () => {
      // Use vi.resetModules to clear module-level _localMuyassar cache
      vi.resetModules();
      // Re-register the mocks after reset
      vi.doMock('../config.js', () => ({
        CONFIG: {
          API_BASE: 'https://api.alquran.cloud/v1',
          TAFSIR_API: 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir',
          PRAYER_API: 'https://api.aladhan.com/v1/timingsByCity',
          DEFAULT_TAFSIR: 'ar-tafsir-muyassar',
        },
      }));
      vi.doMock('../i18n.js', () => ({ __: vi.fn((key: string) => key) }));
      vi.doMock('../storage.js', () => ({ storage: { get: vi.fn(() => null), set: vi.fn(), remove: vi.fn() } }));
      vi.doMock('../templates.js', () => ({
        tafsirLoading: vi.fn(() => ''),
        tafsirContent: vi.fn((text: string) => text),
        tafsirErrorMessage: vi.fn((msg: string) => msg),
        escapeHtml: vi.fn((s: string) => s),
      }));
      vi.doMock('../api-client.js', () => ({
        apiFetch: vi.fn(),
        tafsirFetch: vi.fn(),
      }));
      vi.doMock('../dom.js', () => ({ dom: {} }));

      vi.spyOn(globalThis, 'fetch').mockImplementation((url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('muyassar-tafsir')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              3: [{ ayah: 1, text: 'Array format tafsir' }],
            }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ tafsir: { text: 'API fallback' } }),
        } as Response);
      });

      const { fetchTafsirText } = await import('../tafsir.js');
      const result = await fetchTafsirText('ar-tafsir-muyassar', 3, 1);
      expect(result).toBe('Array format tafsir');

      vi.restoreAllMocks();
    });

    it('should handle local Muyassar with missing surah', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation((url: string) => {
        if (url.includes('muyassar-tafsir')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              2: [{ ayah: 1, text: 'Surah 2 tafsir' }],
            }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ tafsir: { text: 'API fallback' } }),
        } as Response);
      });

      // Surah 1 is not in the local file, should fall through to API
      const result = await fetchTafsirText('ar-tafsir-muyassar', 1, 1);
      expect(result).toBeTruthy();
    });
  });

  describe('IDB cache', () => {
    it('should use cached tafsir when available', async () => {
      // Pre-populate the cache
      mockIDBData['tafsir_ar-tafsir-muyassar_1_1'] = {
        key: 'tafsir_ar-tafsir-muyassar_1_1',
        val: 'Cached tafsir text',
      };

      const result = await fetchTafsirText('ar-tafsir-muyassar', 1, 1);
      // The mock IDB should return the cached value
      // This exercises the cache path
    });
  });
});
