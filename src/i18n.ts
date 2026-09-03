/**
 * Internationalization (i18n) Module for Quran App.
 *
 * Provides a lightweight, lazy-loading translation system supporting 5 languages
 * (Arabic, English, Turkish, Malay, Indonesian, French, German, Russian). Key design decisions:
 *
 *   - Arabic is always loaded as the fallback language
 *   - Only the active language bundle is kept in memory
 *   - Dynamic imports ensure users only download the language they need
 *   - Concurrent load requests for the same language are deduplicated
 *   - Background preloading warms likely-needed languages after init
 *   - DOM updates via data-i18n attributes allow declarative translation
 *
 * Usage:
 *   import { __, initI18n, setLang } from './i18n.js';
 *   await initI18n();  // Load saved/browser language
 *   const text = __('pray_fajr');  // 'الفجر' or 'Fajr'
 */

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
export type LangCode = 'ar' | 'en' | 'tr' | 'ms' | 'id' | 'fr' | 'de' | 'ru';

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
  { code: 'fr', nativeName: 'Français', englishName: 'French', dir: 'ltr' },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German', dir: 'ltr' },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian', dir: 'ltr' },
];

const STORAGE_KEY = 'lang';

/** Lazy-loaded translation cache — only the active language is loaded. */
const translations: Partial<Record<LangCode, TranslationBundle>> = {};

/** Loading promises — prevents duplicate loads for the same language. */
const loadingPromises: Partial<Record<LangCode, Promise<TranslationBundle>>> = {};

/** Always keep Arabic loaded as the fallback language. */
let _arFallback: TranslationBundle | null = null;

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
  if (translations[lang]) {
    return translations[lang]!;
  }

  // Return existing loading promise if one is in progress
  if (loadingPromises[lang]) {
    return loadingPromises[lang]!;
  }

  const moduleMap: Record<LangCode, () => Promise<{ default: TranslationBundle }>> = {
    ar: () => import('./translations/ar'),
    en: () => import('./translations/en'),
    tr: () => import('./translations/tr'),
    ms: () => import('./translations/ms'),
    id: () => import('./translations/id'),
    fr: () => import('./translations/fr'),
    de: () => import('./translations/de'),
    ru: () => import('./translations/ru'),
  };

  const loader = moduleMap[lang];
  if (!loader) {
    throw new Error(`Unknown language: ${lang}`);
  }

  // Create and cache the loading promise to prevent duplicate loads
  const promise = loader()
    .then((mod) => {
      translations[lang] = mod.default;
      delete loadingPromises[lang]; // Clean up promise after load

      // Cache Arabic fallback when it loads
      if (lang === 'ar') {
        _arFallback = mod.default;
      }

      if (import.meta.env.DEV) {
        console.warn(`[i18n] Loaded "${lang}" bundle (${Object.keys(mod.default).length} keys)`);
      }

      return mod.default;
    })
    .catch((err) => {
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
  if (lang === 'ar' || lang === currentLang) {
    return false;
  }
  if (!translations[lang]) {
    return false;
  }

  delete translations[lang];
  if (import.meta.env.DEV) {
    console.warn(`[i18n] Unloaded "${lang}" bundle to free memory`);
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
  const browserLang = (navigator.language || '').slice(0, 2) as LangCode;
  const detectedLang = AVAILABLE_LANGUAGES.find((language) => language.code === browserLang)?.code;
  const targetLang: LangCode = saved || detectedLang || 'ar';

  // Load Arabic and target language in parallel if they're different
  // This cuts init time in half for non-Arabic users
  if (targetLang === 'ar') {
    await loadTranslation('ar');
  } else {
    await Promise.all([loadTranslation('ar'), loadTranslation(targetLang)]);
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
  if (current !== 'en') {
    candidates.push('en');
  }
  // Add the user's browser language if different and supported
  const browserLang = (navigator.language || '').slice(0, 2);
  if (browserLang !== current && browserLang !== 'en') {
    const supported = AVAILABLE_LANGUAGES.find((l) => l.code === browserLang);
    if (supported) {
      candidates.push(supported.code);
    }
  }
  return candidates.slice(0, 2); // Max 2 preloads to save bandwidth
}

/** Set the active language. The layout direction stays RTL regardless of the
 * language: the whole UI is designed around Arabic layout and must not flip
 * (logo, menus, buttons keep their positions); only translated text changes. */
export async function setLang(lang: LangCode): Promise<void> {
  const bundle = await loadTranslation(lang);
  currentLang = lang;
  currentBundle = bundle;
  storage.set(STORAGE_KEY, lang);

  document.documentElement.lang = lang;
  document.documentElement.dir = 'rtl';
  document.body.style.direction = 'rtl';

  applyTranslations();
  window.dispatchEvent(new CustomEvent('app:langchange', { detail: { lang } }));
}

/** Translate all elements with data-i18n, data-i18n-placeholder, data-i18n-title, data-i18n-aria-label attributes. */
export function applyTranslations(): void {
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = __(key);
    }
  }
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      (el as HTMLInputElement).placeholder = __(key);
    }
  }
  for (const el of document.querySelectorAll('[data-i18n-title]')) {
    const key = el.getAttribute('data-i18n-title');
    if (key) {
      (el as HTMLElement).title = __(key);
    }
  }
  for (const el of document.querySelectorAll('[data-i18n-aria-label]')) {
    const key = el.getAttribute('data-i18n-aria-label');
    if (key) {
      el.setAttribute('aria-label', __(key));
    }
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
  if (val === undefined) {
    return key;
  }

  if (args.length > 0) {
    val = String(val).replace(/\{(\d+)\}/g, (match, index: string) => {
      return args[parseInt(index, 10)] !== undefined ? args[parseInt(index, 10)]! : match;
    });
  }
  return String(val);
}

/* ===================== PLURALIZATION ===================== */

/**
 * Plural form keys per Intl.PluralRules.
 * Arabic has 6 forms: zero, one, two, few, many, other.
 */
type PluralForm = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

/** Cache of PluralRules instances per language (perf optimization). */
const pluralRulesCache = new Map<LangCode, Intl.PluralRules>();

/** Arabic-Indic digit mapping for displaying numbers in Arabic. */
const ARABIC_DIGITS: Record<string, string> = {
  '0': '٠',
  '1': '١',
  '2': '٢',
  '3': '٣',
  '4': '٤',
  '5': '٥',
  '6': '٦',
  '7': '٧',
  '8': '٨',
  '9': '٩',
};

/** Convert Latin digits to Arabic-Indic digits (٠-٩). */
export function toArabicDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_DIGITS[d] ?? d);
}

/** Convert Arabic-Indic digits back to Latin. */
export function toLatinDigits(value: string): string {
  const reverse: Record<string, string> = {};
  for (const [k, v] of Object.entries(ARABIC_DIGITS)) {
    reverse[v] = k;
  }
  return value.replace(/[٠-٩]/g, (d) => reverse[d] ?? d);
}

/** Get (or create) cached Intl.PluralRules for the current language. */
function getPluralRules(lang: LangCode): Intl.PluralRules {
  if (!pluralRulesCache.has(lang)) {
    pluralRulesCache.set(lang, new Intl.PluralRules(lang, { type: 'cardinal' }));
  }
  return pluralRulesCache.get(lang)!;
}

/**
 * Translate a key with pluralization support.
 *
 * The translation value should be an object with plural form keys:
 *   {
 *     zero: 'لا توجد آيات',
 *     one:  'آية واحدة',
 *     two:  'آيتان',
 *     few:  '{count} آيات',     // 3-10
 *     many: '{count} آية',      // 11-99
 *     other:'{count} آية'       // 100+
 *   }
 *
 * @example
 *   __n('ayah_count', 5);   // → "٥ آيات"
 *   __n('ayah_count', 1);   // → "آية واحدة"
 *   __n('ayah_count', 100); // → "١٠٠ آية"
 */
export function __n(key: string, count: number, params?: Record<string, string | number>): string {
  let val: string | string[] | Record<string, string> | undefined = currentBundle?.[key];
  if (val === undefined) {
    const arFallback = getArFallbackSync();
    val = arFallback?.[key];
  }

  // If value is a string, just substitute {count}
  if (typeof val === 'string') {
    return substitutePluralPlaceholders(val, count, params);
  }

  // If value is an object with plural forms, select the right one
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const pluralObj = val as Record<PluralForm, string>;
    const rule = getPluralRules(currentLang).select(count) as PluralForm;
    const selectedForm = pluralObj[rule] ?? pluralObj.other ?? '';
    return substitutePluralPlaceholders(selectedForm, count, params);
  }

  // Fallback: key not found
  return key;
}

/** Substitute {count} and other placeholders, with Arabic digit conversion. */
function substitutePluralPlaceholders(
  template: string,
  count: number,
  params?: Record<string, string | number>,
): string {
  const allParams: Record<string, string | number> = { count, ...(params ?? {}) };
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = allParams[key];
    if (value === undefined) {
      return match;
    }
    // Convert numbers to Arabic digits for Arabic language
    if (typeof value === 'number' && currentLang === 'ar') {
      return toArabicDigits(value);
    }
    return String(value);
  });
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

/** Mapping of English prayer keys to i18n translation keys. */
const PRAYER_I18N_KEYS: Record<string, string> = {
  Fajr: 'prayer_fajr',
  Sunrise: 'prayer_sunrise',
  Dhuhr: 'prayer_dhuhr',
  Asr: 'prayer_asr',
  Maghrib: 'prayer_maghrib',
  Isha: 'prayer_isha',
};

/** Get the localized prayer name by its English key (e.g. 'Fajr' → 'الفجر'). */
export function getPrayerName(key: string): string {
  const i18nKey = PRAYER_I18N_KEYS[key];
  return i18nKey ? __(i18nKey) : key;
}
