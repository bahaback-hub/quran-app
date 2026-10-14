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
} as const;

/** Buckets written by older releases; safe to delete (content re-caches on demand). */
export const LEGACY_CACHE_NAMES = ['islamic-cdn', 'quran-audio', 'app-data-v2'] as const;

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
