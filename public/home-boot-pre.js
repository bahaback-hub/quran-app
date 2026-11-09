/* Pre-paint language/direction guard (parser-blocking, classic script).
 *
 * The app's static shell ships right-to-left (Arabic-first). Browsers whose
 * language is not Arabic must start left-to-right, but the only other place
 * that decides the direction (src/home-boot.ts, initI18n) runs after the
 * first paint — the browser paints the static RTL shell first, then the
 * deferred module flips dir and mirrors the whole page (measured CLS 0.13
 * in Lighthouse CI, where the runner boots English).
 *
 * This tiny classic script (no imports, no exports) runs during parsing —
 * before any body paint — so the first frame already uses the right
 * direction. The full pre-paint guard in src/home-boot.ts re-applies the
 * same values after paint (harmless duplicate) and owns the theme/launcher
 * work. Keep SUPPORTED/RTL lists in sync with src/home-boot.ts.
 */
(function () {
  var SUPPORTED = ['ar', 'en', 'tr', 'ms', 'id', 'fr', 'de', 'ru', 'ur'];
  var RTL = ['ar', 'ur'];
  try {
    var saved = null;
    try {
      saved = JSON.parse(localStorage.getItem('quran_app_lang') || 'null');
    } catch (e) {
      saved = null;
    }
    var browser = (navigator.language || '').slice(0, 2);
    var lang = saved !== null && SUPPORTED.indexOf(saved) !== -1 ? saved : SUPPORTED.indexOf(browser) !== -1 ? browser : 'ar';
    var dir = RTL.indexOf(lang) !== -1 ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  } catch (e) {
    // Storage blocked: keep the static shell's defaults (Arabic RTL).
  }
})();
