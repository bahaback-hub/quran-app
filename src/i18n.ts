import { storage } from './storage.js';

/** Translation bundle — string keys plus structured sub-objects. */
export interface TranslationBundle {
  [key: string]: string | string[] | Record<string, string>;
  weekdays: string[];
  reciters: Record<string, string>;
  tafsir_names: Record<string, string>;
  cities: Record<string, string>;
  calc_methods: Record<string, string>;
}

/** Supported language codes. */
export type LangCode = 'ar' | 'en' | 'tr' | 'ms' | 'id';

/** Language metadata for the language selector UI. */
export interface LanguageInfo {
  code: LangCode;
  nativeName: string;
  englishName: string;
  dir: 'rtl' | 'ltr';
}

/** Available languages with metadata. */
export const AVAILABLE_LANGUAGES: LanguageInfo[] = [
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl' },
  { code: 'en', nativeName: 'English', englishName: 'English', dir: 'ltr' },
  { code: 'tr', nativeName: 'Türkçe', englishName: 'Turkish', dir: 'ltr' },
  { code: 'ms', nativeName: 'Bahasa Melayu', englishName: 'Malay', dir: 'ltr' },
  { code: 'id', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian', dir: 'ltr' },
];

const STORAGE_KEY = 'lang';

/** Lazy-loaded translation cache — only the active language is loaded. */
const translations: Partial<Record<LangCode, TranslationBundle>> = {};

/** Loading promises — prevents duplicate loads for the same language. */
const loadingPromises: Partial<Record<LangCode, Promise<TranslationBundle>>> = {};

/** Always keep Arabic loaded as the fallback language. */
let _arFallback: TranslationBundle | null = null;

/** Get the Arabic fallback bundle, loading it lazily on first access. */
async function getArFallback(): Promise<TranslationBundle> {
  if (_arFallback) return _arFallback;
  const mod = await import('./translations/ar');
  _arFallback = mod.default;
  translations.ar = _arFallback;
  return _arFallback;
}

/** Get the Arabic fallback synchronously (returns null if not yet loaded). */
function getArFallbackSync(): TranslationBundle | null {
  return _arFallback;
}

let currentLang: LangCode = 'ar';
let currentBundle: TranslationBundle | null = null;

/**
 * Load a translation bundle by language code.
 * Uses dynamic import so only the needed language is fetched.
 * Deduplicates concurrent loads for the same language.
 */
async function loadTranslation(lang: LangCode): Promise<TranslationBundle> {
  // Return cached translation if already loaded
  if (translations[lang]) return translations[lang]!;

  // Return existing loading promise if one is in progress
  if (loadingPromises[lang]) return loadingPromises[lang]!;

  const moduleMap: Record<LangCode, () => Promise<{ default: TranslationBundle }>> = {
    ar: () => import('./translations/ar'),
    en: () => import('./translations/en'),
    tr: () => import('./translations/tr'),
    ms: () => import('./translations/ms'),
    id: () => import('./translations/id'),
  };

  const loader = moduleMap[lang];
  if (!loader) throw new Error(`Unknown language: ${lang}`);

  // Create and cache the loading promise to prevent duplicate loads
  const promise = loader().then(mod => {
    translations[lang] = mod.default;
    delete loadingPromises[lang]; // Clean up promise after load

    // Cache Arabic fallback when it loads
    if (lang === 'ar') _arFallback = mod.default;

    if (import.meta.env.DEV) {
      console.info(`[i18n] Loaded "${lang}" bundle (${Object.keys(mod.default).length} keys)`);
    }

    return mod.default;
  }).catch(err => {
    delete loadingPromises[lang]; // Clean up on error too
    console.error(`[i18n] Failed to load language "${lang}":`, err);
    throw err;
  });

  loadingPromises[lang] = promise;
  return promise;
}

/**
 * Preload a translation bundle without switching to it.
 * Useful for warming the cache so language switches feel instant.
 * Returns immediately if already loaded or loading.
 */
export function preloadLang(lang: LangCode): void {
  loadTranslation(lang).catch(() => {
    // Silently ignore preload failures — user didn't request this language
  });
}

/**
 * Unload a translation bundle from memory to free RAM.
 * Never unloads Arabic (fallback) or the current language.
 * @returns true if the bundle was unloaded, false if it's protected
 */
export function unloadLang(lang: LangCode): boolean {
  // Never unload Arabic (fallback) or the current language
  if (lang === 'ar' || lang === currentLang) return false;
  if (!translations[lang]) return false;

  delete translations[lang];
  if (import.meta.env.DEV) {
    console.info(`[i18n] Unloaded "${lang}" bundle to free memory`);
  }
  return true;
}

/**
 * Get list of currently loaded languages.
 */
export function getLoadedLangs(): LangCode[] {
  return Object.keys(translations) as LangCode[];
}

/** Initialize i18n system from saved language or browser preference. */
export async function initI18n(): Promise<void> {
  const saved = storage.get<string>(STORAGE_KEY) as LangCode | null;
  const targetLang: LangCode = saved || (
    (navigator.language || '').startsWith('en') ? 'en' : 'ar'
  );

  // Load Arabic and target language in parallel if they're different
  // This cuts init time in half for non-Arabic users
  if (targetLang === 'ar') {
    await loadTranslation('ar');
  } else {
    await Promise.all([
      loadTranslation('ar'),
      loadTranslation(targetLang),
    ]);
  }

  await setLang(targetLang);

  // After init, preload likely-needed languages in the background
  // Strategy: preload the 2 most likely alternate languages
  setTimeout(() => {
    const toPreload = getPreloadCandidates(targetLang);
    for (const lang of toPreload) {
      preloadLang(lang);
    }
  }, 3000);
}

/**
 * Get language codes to preload based on the current language.
 * Preloads languages that users are most likely to switch to.
 */
function getPreloadCandidates(current: LangCode): LangCode[] {
  // Always suggest English as the most common alternate
  const candidates: LangCode[] = [];
  if (current !== 'en') candidates.push('en');
  // Add the user's browser language if different and supported
  const browserLang = (navigator.language || '').slice(0, 2);
  if (browserLang !== current && browserLang !== 'en') {
    const supported = AVAILABLE_LANGUAGES.find(l => l.code === browserLang);
    if (supported) candidates.push(supported.code);
  }
  return candidates.slice(0, 2); // Max 2 preloads to save bandwidth
}

/** Set the active language and update document direction. */
export async function setLang(lang: LangCode): Promise<void> {
  const bundle = await loadTranslation(lang);
  currentLang = lang;
  currentBundle = bundle;
  storage.set(STORAGE_KEY, lang);

  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.body.style.direction = lang === 'ar' ? 'rtl' : 'ltr';

  applyTranslations();
  window.dispatchEvent(new CustomEvent('languagechange', { detail: { lang } }));
}

/** Translate all elements with data-i18n, data-i18n-placeholder, data-i18n-title, data-i18n-aria-label attributes. */
export function applyTranslations(): void {
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = __(key);
  }
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) (el as HTMLInputElement).placeholder = __(key);
  }
  for (const el of document.querySelectorAll('[data-i18n-title]')) {
    const key = el.getAttribute('data-i18n-title');
    if (key) (el as HTMLElement).title = __(key);
  }
  for (const el of document.querySelectorAll('[data-i18n-aria-label]')) {
    const key = el.getAttribute('data-i18n-aria-label');
    if (key) el.setAttribute('aria-label', __(key));
  }
}

/** Get the current active language code. */
export function getLang(): LangCode {
  return currentLang;
}

/** Get a translated string by key with optional argument interpolation. */
export function __(key: string, ...args: string[]): string {
  let val: string | string[] | Record<string, string> | undefined = currentBundle?.[key];
  if (val === undefined) {
    const arFallback = getArFallbackSync();
    val = arFallback?.[key];
  }
  if (val === undefined) return key;

  if (args.length > 0) {
    val = String(val).replace(/\{(\d+)\}/g, (match, index: string) => {
      return args[parseInt(index, 10)] !== undefined ? args[parseInt(index, 10)] : match;
    });
  }
  return String(val);
}

/** Get the localized name for a reciter by ID. */
export function getReciterName(key: string): string {
  return currentBundle?.reciters?.[key] || getArFallbackSync()?.reciters?.[key] || key;
}

/** Get the localized name for a tafsir edition. */
export function getTafsirName(key: string): string {
  return currentBundle?.tafsir_names?.[key] || getArFallbackSync()?.tafsir_names?.[key] || key;
}

/** Get the localized name for a city. */
export function getCityName(key: string): string {
  return currentBundle?.cities?.[key] || getArFallbackSync()?.cities?.[key] || key;
}

/** Get the localized name for a calculation method. */
export function getCalcMethodName(key: string): string {
  return currentBundle?.calc_methods?.[key] || getArFallbackSync()?.calc_methods?.[key] || key;
}

/** Get the localized weekday name by index (0=Sunday). */
export function getWeekday(index: number): string {
  return currentBundle?.weekdays?.[index] || getArFallbackSync()?.weekdays?.[index] || '';
}
