/**
 * Pre-paint guard for the static launcher hero and the saved theme.
 *
 * The home launcher's bismillah is the first-visit Largest Contentful Paint, so
 * its markup now lives in index.html and paints with the first frame instead of
 * waiting for i18n and the module graph (that wait was most of the measured LCP).
 * Returning readers must never see it flash while their surah is fetched, so
 * this tiny module runs before first paint and marks the document; home.css
 * hides the hero while the class is present and src/home.ts removes it as soon
 * as the launcher is really shown.
 *
 * Startup DOM work (panel injection, launcher hydration) is deferred to after
 * that first frame — see `afterFirstPaint()` in src/main.ts — which means the
 * saved night/sepia palette has to be applied here too. Without this the first
 * frame would paint the default light palette and switch one frame later.
 * src/settings.ts still restores everything else once the app starts; this only
 * sets the body classes the theme stylesheets key off.
 */

import { storage } from './storage.js';

interface LastPosition {
  surah?: number;
}

/** Languages shipped by src/i18n.ts and the two that are right-to-left. */
const SUPPORTED_LANGUAGES = ['ar', 'en', 'tr', 'ms', 'id', 'fr', 'de', 'ru', 'ur'];
const RTL_LANGUAGES = ['ar', 'ur'];

/**
 * Apply the saved (or browser) language direction before the first frame.
 *
 * i18n now starts after the first paint, so without this an English reader
 * would see the Arabic right-to-left shell for one frame and then a mirrored
 * page. index.html ships `lang="ar" dir="rtl"`, so only non-Arabic readers need
 * the correction; the saved choice always wins over the browser language, which
 * mirrors initI18n().
 */
function applyStoredLanguage(): void {
  const saved = storage.get<string>('lang');
  const browser = (navigator.language || '').slice(0, 2);
  const lang =
    saved !== null && SUPPORTED_LANGUAGES.includes(saved)
      ? saved
      : SUPPORTED_LANGUAGES.includes(browser)
        ? browser
        : 'ar';
  const direction = RTL_LANGUAGES.includes(lang) ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
  document.documentElement.dir = direction;
  if (document.body) {
    document.body.style.direction = direction;
  }
}

/** Apply the stored palette (or the OS dark preference) before the first frame. */
function applyStoredTheme(): void {
  const body = document.body;
  if (!body) {
    return;
  }

  const deepNight = storage.get<boolean>('deep_night_mode');
  const night = storage.get<boolean>('night_mode');
  const sepia = storage.get<boolean>('sepia_mode');

  if (deepNight === true) {
    body.classList.add('night-mode', 'deep-night-mode');
    return;
  }
  if (night === true) {
    body.classList.add('night-mode');
    return;
  }
  if (sepia === true) {
    body.classList.add('sepia-mode');
    return;
  }
  // No explicit choice stored: mirror initSystemThemeDetection() so a reader on
  // a dark system does not get a light flash either.
  const hasExplicitPreference = night !== undefined && night !== null;
  if (
    !hasExplicitPreference &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    body.classList.add('night-mode');
  }
}

try {
  const saved = storage.get<LastPosition>('last_position');
  const hash = (window.location.hash || '').replace(/^#\/?/, '');
  if (saved?.surah || hash) {
    document.documentElement.classList.add('home-preload-hide');
  }
  applyStoredTheme();
  applyStoredLanguage();
} catch {
  // Storage blocked or malformed: keep the launcher visible and the default theme.
}
