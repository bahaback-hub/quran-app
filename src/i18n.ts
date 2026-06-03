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

const STORAGE_KEY = 'lang';

/** Lazy-loaded translation cache — only the active language is loaded. */
const translations: Partial<Record<LangCode, TranslationBundle>> = {};

/** Always keep Arabic loaded as the fallback language. */
let _arFallback: TranslationBundle | null = null;

/** Get the Arabic fallback bundle, loading it lazily on first access. */
async function getArFallback(): Promise<TranslationBundle> {
  if (_arFallback) return _arFallback;
  const mod = await import('./translations/ar.js');
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
 */
async function loadTranslation(lang: LangCode): Promise<TranslationBundle> {
  if (translations[lang]) return translations[lang]!;

  const moduleMap: Record<LangCode, () => Promise<any>> = {
    ar: () => import('./translations/ar.js'),
    en: () => import('./translations/en.js'),
    tr: () => import('./translations/tr.js'),
    ms: () => import('./translations/ms.js'),
    id: () => import('./translations/id.js'),
  };

  const loader = moduleMap[lang];
  if (!loader) throw new Error(`Unknown language: ${lang}`);

  const mod = await loader();
  translations[lang] = mod.default;

  // Cache Arabic fallback when it loads
  if (lang === 'ar') _arFallback = mod.default;

  return mod.default;
}

/** Initialize i18n system from saved language or browser preference. */
export async function initI18n(): Promise<void> {
  const saved = storage.get<string>(STORAGE_KEY) as LangCode | null;
  const targetLang: LangCode = saved || (
    (navigator.language || '').startsWith('en') ? 'en' : 'ar'
  );

  // Always load Arabic as fallback first
  await loadTranslation('ar');

  // Then load the target language (may be Arabic, which is already cached)
  await setLang(targetLang);
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
