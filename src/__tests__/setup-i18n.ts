/**
 * Test setup for Vitest — mock i18n before any module loads it.
 */

// Mock the i18n __() function to return the key itself
vi.mock('../i18n.js', () => ({
  __: (key: string, ..._args: string[]) => key,
  __n: (key: string, count: number) => `${key}:${count}`,
  toArabicDigits: (v: string | number) => String(v),
  toLatinDigits: (v: string | number) => String(v),
  setLocale: vi.fn(),
  getCurrentLocale: vi.fn(() => 'ar'),
  loadLocale: vi.fn(() => Promise.resolve()),
}));

// Mock the config module
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

// Mock the internal-state module
vi.mock('../internal-state.js', () => ({
  resetInternalState: vi.fn(),
}));

// Mock the mushaf-renderer module
vi.mock('../mushaf-renderer.js', () => ({}));

// Mock the storage module
vi.mock('../storage.js', () => ({
  storage: {
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

// Mock the ui module — must export ALL public functions to avoid
// "No export defined" errors in tests that import ui directly.
vi.mock('../ui.js', () => ({
  showToast: vi.fn(),
  loadingBar: {
    show: vi.fn(),
    hide: vi.fn(),
  },
}));

// Mock the utils module — must export ALL public functions to avoid
// "No export defined" errors in tests that import utils directly.
vi.mock('../utils.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    hapticFeedback: vi.fn(),
  };
});

// Mock the dom module
vi.mock('../dom.js', () => ({
  dom: {},
}));
