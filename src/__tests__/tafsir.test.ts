import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state } from '../state.js';
import { dom } from '../dom.js';
import { CONFIG } from '../config.js';
import type { SurahData } from '../types.js';

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
            const req: { result: unknown; onsuccess?: ((ev: { target: { result: unknown } }) => void) | null } = { result: null, onsuccess: null };
            // Use queueMicrotask to simulate async IDB behavior
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
      const request: { onupgradeneeded?: ((ev: { target: { result: unknown } }) => void) | null; onsuccess?: ((ev: { target: { result: unknown } }) => void) | null } = {
        onupgradeneeded: null,
        onsuccess: null,
      };
      // Synchronously fire callbacks so they complete before the test
      // IDB first fires onupgradeneeded, then onsuccess
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

  it('should fetch tafsir from API when not in cache', async () => {
    const tafsirText = 'هذا تفسير تجريبي';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tafsir: { text: tafsirText } }),
    });

    const result = await fetchTafsirText('ar-tafsir-muyassar', 1, 1);

    expect(fetch).toHaveBeenCalled();
    expect(result).toBe(tafsirText);
  });

  it('should return fallback text when API returns no tafsir text', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const result = await fetchTafsirText('ar-tafsir-muyassar', 1, 1);
    expect(result).toBe('⚠️ لا يوجد تفسير متاح');
  });

  it('should return null when API fetch fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const result = await fetchTafsirText('ar-tafsir-muyassar', 1, 1);
    expect(result).toBeNull();
  });

  it('should use text field directly when tafsir wrapper is missing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: 'direct text field' }),
    });

    const result = await fetchTafsirText('ar-tafsir-muyassar', 1, 1);
    expect(result).toBe('direct text field');
  });
});

describe('loadTafsirForCurrentAyah', () => {
  it('should return early when surahData is null', async () => {
    state.surahData = null;
    await loadTafsirForCurrentAyah();
    // No error thrown, no side effects
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

    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ tafsir: { text: 'تفسير الفاتحة' } }),
    });

    await loadTafsirForCurrentAyah();

    expect(dom.tafsirCurtainHeader!.textContent).toContain('الفاتحة');
    expect(dom.tafsirCurtainHeader!.textContent).toContain('1');
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
    // Should not throw
    expect(dom.tafsirCurtainHeader!.textContent).toBe('');
  });

  it('should show error when fetch fails and no cache', async () => {
    state.surahData = {
      number: 1,
      name: 'الفاتحة',
      englishName: 'Al-Fatiha',
      ayahs: [{ numberInSurah: 1, text: 'بِسْمِ اللَّهِ' }],
    } as SurahData;
    state.currentAyahIndex = 0;

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await loadTafsirForCurrentAyah();

    expect(dom.tafsirCurtainBody!.innerHTML).toContain('tafsir-error');
  });
});

describe('loadTafsirForSurahAyah', () => {
  it('should return early when dom elements are null', async () => {
    dom.tafsirCurtainBody = null;
    await loadTafsirForSurahAyah(1, 1);
    // Should not throw
  });

  it('should use surah name from surahList', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ tafsir: { text: 'تفسير' } }),
    });

    await loadTafsirForSurahAyah(1, 1);

    expect(dom.tafsirCurtainHeader!.textContent).toContain('الفاتحة');
  });

  it('should use fallback surah name when surah not in list', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ tafsir: { text: 'تفسير' } }),
    });

    await loadTafsirForSurahAyah(999, 1);

    expect(dom.tafsirCurtainHeader!.textContent).toContain('سورة 999');
  });

  it('should open tafsir curtain', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ tafsir: { text: 'تفسير' } }),
    });

    await loadTafsirForSurahAyah(1, 1);

    expect(dom.tafsirCurtain!.classList.contains('open')).toBe(true);
  });

  it('should show error when API fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await loadTafsirForSurahAyah(1, 1);

    expect(dom.tafsirCurtainBody!.innerHTML).toContain('tafsir-error');
  });

  it('should use CONFIG.DEFAULT_TAFSIR when no edition set', async () => {
    state.currentTafsirEdition = '';

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tafsir: { text: 'تفسير' } }),
    });

    await loadTafsirForSurahAyah(1, 1);

    // api-client constructs full URL from CONFIG.TAFSIR_API + edition path
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(CONFIG.DEFAULT_TAFSIR), expect.any(Object));
  });

  it('should render tafsir text in curtain body on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tafsir: { text: 'تفسير الاخلاص' } }),
    });

    await loadTafsirForSurahAyah(1, 1);

    expect(dom.tafsirCurtainBody!.innerHTML).toContain('تفسير الاخلاص');
  });
});
