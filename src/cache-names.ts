/**
 * Cache Storage bucket names — single source of truth.
 *
 * The PWA service worker (vite.config.js runtimeCaching) and the runtime code
 * (audio-cache.ts, offline-pack.ts) must use the SAME buckets, or audio/JSON
 * gets stored twice in parallel buckets while orphaned ones survive cleanup
 * forever. This module is imported by both sides; vite.config.js reads the
 * same constants so the names cannot drift again.
 *
 * NOTE for vite.config.js: keep this module free of non-erasable TypeScript
 * (no enums/namespaces) so the Vite config can import it directly.
 */

export const CACHE_NAMES = {
  /** Cross-origin recitation audio (mp3quran servers). */
  quranAudio: 'quran-audio-v3',
  /** Cross-origin recitation audio (islamic.network CDN). */
  islamicCdn: 'islamic-cdn-v3',
  /** Same-origin bundled JSON (Quran text, tajweed, contemplation, prayer). */
  appData: 'app-data-v3',
  /**
   * QCF4 Mushaf font binaries (same-origin /fonts/qcf4/*.woff2).
   * Shared by the SW CacheFirst route and the runtime pack manager
   * (qcf4-font-pack.ts / mushaf-data-pack.ts) so each ~800 KB font is
   * stored exactly once (NEW-03).
   */
  mushafFonts: 'mushaf-fonts',
  /**
   * Mushaf page-layout JSONs (quran-qcf4 mirrors). Shared by the SW
   * mirror routes and the runtime pipeline (mushaf-page-data.ts) so a
   * page never lands in three parallel buckets (NEW-03).
   */
  mushafLayouts: 'qcf4-page-layouts',
} as const;

/**
 * Buckets written by older releases; safe to delete (content re-caches on demand).
 * `mushaf-layout-v3` and `mushaf-fonts-v3` were the pre-consolidation SW
 * mirror buckets that duplicated `qcf4-page-layouts` (NEW-03).
 */
export const LEGACY_CACHE_NAMES = [
  'islamic-cdn',
  'quran-audio',
  'app-data-v2',
  'mushaf-layout-v3',
  'mushaf-fonts-v3',
] as const;

/** Generic SW font bucket that, before consolidation, also swallowed the QCF4 binaries. */
const APP_FONTS_BUCKET = 'app-fonts-v3';

/** Matches only the QCF4 font URLs inside the generic app-fonts bucket. */
const LEGACY_QCF4_FONT_PATTERN = /\/fonts\/qcf4\//i;

/**
 * One-time cleanup of pre-v3 buckets. Fire-and-forget from app boot: every
 * reader uses caches.match (which searches ALL buckets), so dropping orphans
 * in the background cannot break reads; misses simply re-fetch.
 */
export function deleteLegacyCaches(): void {
  if (!('caches' in globalThis)) {
    return;
  }
  void (async () => {
    try {
      const names = await caches.keys();
      const legacy = (LEGACY_CACHE_NAMES as readonly string[]).slice();
      await Promise.all(names.filter((n) => legacy.includes(n)).map((n) => caches.delete(n)));
    } catch (err) {
      console.warn('[Cache] Legacy bucket cleanup failed:', err);
    }
  })();
}

/**
 * One-time sweep of the ~37 MB of QCF4 font binaries older releases left inside
 * the generic app-fonts SW bucket (NEW-03). The bucket itself stays — it still
 * caches the UI fonts — only the /fonts/qcf4/ entries are removed. The runtime
 * pack bucket (CACHE_NAMES.mushafFonts) is untouched, so installed packs keep
 * working; deleted entries simply re-fetch from the pack bucket on demand.
 */
export function deleteLegacyQcf4FontEntries(): void {
  if (!('caches' in globalThis)) {
    return;
  }
  void (async () => {
    try {
      const cache = await caches.open(APP_FONTS_BUCKET);
      const stale = (await cache.keys()).filter((req) => LEGACY_QCF4_FONT_PATTERN.test(req.url));
      await Promise.all(stale.map((req) => cache.delete(req)));
    } catch (err) {
      console.warn('[Cache] Legacy QCF4 font-entry cleanup failed:', err);
    }
  })();
}
