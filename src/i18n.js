import ar from './translations/ar.js';
import en from './translations/en.js';
import { storage } from './storage.js';

const STORAGE_KEY = 'lang';

const translations = { ar, en };

let currentLang = 'ar';
let currentBundle = translations.ar;

export function initI18n() {
  const saved = storage.get(STORAGE_KEY);
  if (saved && translations[saved]) {
    setLang(saved);
  } else {
    // Auto-detect: prefer English if browser language starts with 'en'
    const browserLang = navigator.language || navigator.userLanguage || '';
    if (browserLang.startsWith('en')) {
      setLang('en');
    } else {
      setLang('ar');
    }
  }
}

export function setLang(lang) {
  if (!translations[lang]) return;
  currentLang = lang;
  currentBundle = translations[lang];
  storage.set(STORAGE_KEY, lang);

  // Set HTML dir and lang
  document.documentElement.lang = lang === 'ar' ? 'ar' : 'en';
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.body.style.direction = lang === 'ar' ? 'rtl' : 'ltr';

  // Dispatch event for app to re-render dynamic text
  window.dispatchEvent(new CustomEvent('languagechange', { detail: { lang } }));
}

export function getLang() {
  return currentLang;
}

export function __(key, ...args) {
  let val = currentBundle[key];
  if (val === undefined) {
    // Fallback to Arabic
    val = translations.ar[key];
  }
  if (val === undefined) return key;

  // Simple argument interpolation: {0}, {1}, etc.
  if (args.length > 0) {
    val = String(val).replace(/\{(\d+)\}/g, (match, index) => {
      return args[parseInt(index)] !== undefined ? args[parseInt(index)] : match;
    });
  }
  return val;
}

export function getReciterName(key) {
  return currentBundle.reciters?.[key] || translations.ar.reciters?.[key] || key;
}

export function getTafsirName(key) {
  return currentBundle.tafsir_names?.[key] || translations.ar.tafsir_names?.[key] || key;
}

export function getCityName(key) {
  return currentBundle.cities?.[key] || translations.ar.cities?.[key] || key;
}

export function getCalcMethodName(key) {
  return currentBundle.calc_methods?.[key] || translations.ar.calc_methods?.[key] || key;
}

export function getWeekday(index) {
  return currentBundle.weekdays?.[index] || translations.ar.weekdays?.[index] || '';
}
