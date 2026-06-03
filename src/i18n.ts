import ar from './translations/ar.js';
import en from './translations/en.js';
import tr from './translations/tr.js';
import ms from './translations/ms.js';
import id from './translations/id.js';
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

const translations: Record<string, TranslationBundle> = { ar, en, tr, ms, id };

let currentLang: LangCode = 'ar';
let currentBundle: TranslationBundle = translations.ar;

/** Initialize i18n system from saved language or browser preference. */
export function initI18n(): void {
  const saved = storage.get<string>(STORAGE_KEY);
  if (saved && translations[saved]) {
    setLang(saved as LangCode);
  } else {
    const browserLang = navigator.language || (navigator as Navigator & { userLanguage?: string }).userLanguage || '';
    if (browserLang.startsWith('en')) {
      setLang('en');
    } else {
      setLang('ar');
    }
  }
}

/** Set the active language and update document direction. */
export function setLang(lang: LangCode): void {
  if (!translations[lang]) return;
  currentLang = lang;
  currentBundle = translations[lang];
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
  let val: string | string[] | Record<string, string> | undefined = currentBundle[key];
  if (val === undefined) {
    val = translations.ar[key];
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
  return currentBundle.reciters?.[key] || translations.ar.reciters?.[key] || key;
}

/** Get the localized name for a tafsir edition. */
export function getTafsirName(key: string): string {
  return currentBundle.tafsir_names?.[key] || translations.ar.tafsir_names?.[key] || key;
}

/** Get the localized name for a city. */
export function getCityName(key: string): string {
  return currentBundle.cities?.[key] || translations.ar.cities?.[key] || key;
}

/** Get the localized name for a calculation method. */
export function getCalcMethodName(key: string): string {
  return currentBundle.calc_methods?.[key] || translations.ar.calc_methods?.[key] || key;
}

/** Get the localized weekday name by index (0=Sunday). */
export function getWeekday(index: number): string {
  return currentBundle.weekdays?.[index] || translations.ar.weekdays?.[index] || '';
}
