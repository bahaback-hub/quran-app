import ar from './translations/ar.js';
import en from './translations/en.js';
import tr from './translations/tr.js';
import ms from './translations/ms.js';
import id from './translations/id.js';
import { storage } from './storage.js';

const STORAGE_KEY = 'lang';

const translations = { ar, en, tr, ms, id };

let currentLang = 'ar';
let currentBundle = translations.ar;

/** Initialize i18n system from saved language or browser preference. */
export function initI18n() {
  const saved = storage.get(STORAGE_KEY);
  if (saved && translations[saved]) {
    setLang(saved);
  } else {
    const browserLang = navigator.language || navigator.userLanguage || '';
    if (browserLang.startsWith('en')) {
      setLang('en');
    } else {
      setLang('ar');
    }
  }
}

/** Set the active language and update document direction. */
export function setLang(lang) {
  if (!translations[lang]) return;
  currentLang = lang;
  currentBundle = translations[lang];
  storage.set(STORAGE_KEY, lang);

  document.documentElement.lang = lang === 'ar' ? 'ar' : 'en';
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.body.style.direction = lang === 'ar' ? 'rtl' : 'ltr';

  applyTranslations();
  window.dispatchEvent(new CustomEvent('languagechange', { detail: { lang } }));
}

/** Translate all elements with data-i18n attribute. */
export function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = __(key);
  });
}

/** Get the current active language code. */
export function getLang() {
  return currentLang;
}

/** Get a translated string by key with optional argument interpolation. */
export function __(key, ...args) {
  let val = currentBundle[key];
  if (val === undefined) {
    val = translations.ar[key];
  }
  if (val === undefined) return key;

  if (args.length > 0) {
    val = String(val).replace(/\{(\d+)\}/g, (match, index) => {
      return args[parseInt(index)] !== undefined ? args[parseInt(index)] : match;
    });
  }
  return val;
}

/** Get the localized name for a reciter by ID. */
export function getReciterName(key) {
  return currentBundle.reciters?.[key] || translations.ar.reciters?.[key] || key;
}

/** Get the localized name for a tafsir edition. */
export function getTafsirName(key) {
  return currentBundle.tafsir_names?.[key] || translations.ar.tafsir_names?.[key] || key;
}

/** Get the localized name for a city. */
export function getCityName(key) {
  return currentBundle.cities?.[key] || translations.ar.cities?.[key] || key;
}

/** Get the localized name for a calculation method. */
export function getCalcMethodName(key) {
  return currentBundle.calc_methods?.[key] || translations.ar.calc_methods?.[key] || key;
}

/** Get the localized weekday name by index (0=Sunday). */
export function getWeekday(index) {
  return currentBundle.weekdays?.[index] || translations.ar.weekdays?.[index] || '';
}
