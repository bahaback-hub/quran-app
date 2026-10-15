/**
 * Surah Cache — IndexedDB operations for offline surah data persistence.
 *
 * Extracted from surah-loader.ts to separate caching concerns from
 * the main surah loading and rendering logic.
 */

/* ===================== INTERFACES ===================== */

/** A single ayah entry within surah data. */
interface AyahEntry {
  numberInSurah: number;
  text: string;
  number?: number;
  audio?: string;
}

/** Surah text data returned from the API. */
interface SurahTextData {
  number: number;
  name: string;
  englishName: string;
  ayahs: AyahEntry[];
}

/** Cached surah entry in surahCache. */
export interface CachedSurahEntry {
  text: SurahTextData;
  audios?: (string | null)[];
  timings?: number[];
  audio?: { ayahs: AyahEntry[] };
  translation: Record<string, unknown> | null;
  /** Last read/write time (ms) for LRU eviction; maintained by this module. */
  lastAccessed?: number;
}

/**
 * Cap on stored surahs. The key space is surah × reciter × translation, so an
 * uncapped store grows forever and risks a full-origin IndexedDB eviction by
 * the browser (taking the 200MB audio cache with it). 300 entries cover deep
 * use (~a full Quran × reciter × translation plus exploration headroom).
 */
export const MAX_SURAH_CACHE_ENTRIES = 300;

/* ===================== IndexedDB SURAH CACHE ===================== */

function openSurahDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('QuranSurahDB', 1);
    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('surahs')) {
        db.createObjectStore('surahs', { keyPath: 'key' });
      }
    };
    request.onsuccess = (e: Event) => resolve((e.target as IDBOpenDBRequest).result);
    request.onerror = () => reject(new Error('Failed to open QuranSurahDB'));
  });
}

/**
 * Cache a surah entry to IndexedDB for offline access.
 *
 * @param key The cache key (format: "surahNum_reciter_translation")
 * @param entry The surah data entry to cache
 * @returns A promise that resolves when the write transaction completes
 *
 * @example
 * await cacheSurahToIDB('1_ar.alafasy_en.sahih', { text, audios, translation });
 */
export async function cacheSurahToIDB(key: string, entry: CachedSurahEntry): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openSurahDB();
    const tx = db.transaction('surahs', 'readwrite');
    tx.objectStore('surahs').put({ key, ...entry, lastAccessed: Date.now() });
    // Wait for the transaction to complete so errors are properly caught
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IDB transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('IDB transaction aborted'));
    });
    await enforceSurahCap(db);
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[IDB] Failed to cache surah:', err);
    }
  } finally {
    db?.close();
  }
}

/** Namespace prefix keeping URL-index records apart from surah entries. */
const OFFLINE_URLS_PREFIX = 'offline-urls:';

function offlineUrlsKey(reciterId: string, surahNum: number): string {
  return `${OFFLINE_URLS_PREFIX}${reciterId}:${surahNum}`;
}

/**
 * Persist per-ayah audio URLs for a downloaded offline pack (ARC-09).
 *
 * These lived in localStorage as one ever-growing JSON blob (quota: 5-10MB,
 * synchronously parsed on every read). They now live as small records in this
 * same database, counted by the LRU cap like everything else.
 */
export async function saveOfflineAudioUrls(reciterId: string, surahNum: number, urls: string[]): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openSurahDB();
    const tx = db.transaction('surahs', 'readwrite');
    tx.objectStore('surahs').put({ key: offlineUrlsKey(reciterId, surahNum), urls, lastAccessed: Date.now() });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IDB transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('IDB transaction aborted'));
    });
    await enforceSurahCap(db);
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[SurahCache] Failed to save offline audio URLs:', err);
    }
  } finally {
    db?.close();
  }
}

/** Read back offline-pack audio URLs ([] when absent or malformed). */
export async function getOfflineAudioUrls(reciterId: string, surahNum: number): Promise<string[]> {
  let db: IDBDatabase | null = null;
  try {
    db = await openSurahDB();
    const record: unknown = await new Promise((resolve) => {
      const tx = db!.transaction('surahs', 'readonly');
      const req = tx.objectStore('surahs').get(offlineUrlsKey(reciterId, surahNum));
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
    if (!record || typeof record !== 'object') {
      return [];
    }
    const urls = (record as { urls?: unknown }).urls;
    if (!Array.isArray(urls)) {
      return [];
    }
    const clean = urls.filter((u): u is string => typeof u === 'string' && u.length > 0);
    // Touch for LRU so an offline pack in active use is not evicted first.
    if (clean.length > 0) {
      try {
        const touchTx = db.transaction('surahs', 'readwrite');
        touchTx.objectStore('surahs').put({ ...(record as Record<string, unknown>), lastAccessed: Date.now() });
        await new Promise<void>((resolve) => {
          touchTx.oncomplete = () => resolve();
          touchTx.onerror = () => resolve();
          touchTx.onabort = () => resolve();
        });
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[SurahCache] URL-index touch failed:', err);
        }
      }
    }
    return clean;
  } catch {
    return [];
  } finally {
    db?.close();
  }
}

/** Delete least-recently-used entries down to the cap. Best-effort: cache pressure must never break a save. */
async function enforceSurahCap(db: IDBDatabase): Promise<void> {
  try {
    const count: number = await new Promise((resolve, reject) => {
      const req = db.transaction('surahs', 'readonly').objectStore('surahs').count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IDB count failed'));
    });
    const overBy = count - MAX_SURAH_CACHE_ENTRIES;
    if (overBy <= 0) {
      return;
    }
    const all: Array<{ key: string; lastAccessed?: number }> = await new Promise((resolve, reject) => {
      const req = db.transaction('surahs', 'readonly').objectStore('surahs').getAll();
      req.onsuccess = () => resolve((req.result ?? []) as Array<{ key: string; lastAccessed?: number }>);
      req.onerror = () => reject(req.error || new Error('IDB read failed'));
    });
    all.sort((a, b) => (a.lastAccessed ?? 0) - (b.lastAccessed ?? 0));
    const victims = all.slice(0, overBy);
    if (victims.length === 0) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('surahs', 'readwrite');
      for (const victim of victims) {
        tx.objectStore('surahs').delete(victim.key);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IDB eviction failed'));
    });
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[SurahCache] Cap enforcement failed:', err);
    }
  }
}

/**
 * Retrieve a cached surah entry from IndexedDB.
 *
 * @param key The cache key to look up
 * @returns The cached surah entry, or null if not found or on error
 *
 * @example
 * const cached = await getCachedSurahFromIDB('1_ar.alafasy_en.sahih');
 * if (cached) { // use cached data }
 */
export async function getCachedSurahFromIDB(key: string): Promise<CachedSurahEntry | null> {
  let db: IDBDatabase | null = null;
  try {
    db = await openSurahDB();
    const entry = await new Promise<CachedSurahEntry | null>((resolve) => {
      const tx = db!.transaction('surahs', 'readonly');
      const req = tx.objectStore('surahs').get(key);
      req.onsuccess = () => {
        const result = req.result as
          | {
              key: string;
              text: SurahTextData;
              audios?: (string | null)[];
              timings?: number[];
              audio?: { ayahs: AyahEntry[] };
              translation: Record<string, unknown> | null;
              lastAccessed?: number;
            }
          | undefined;
        if (!result) {
          resolve(null);
          return;
        }
        // Shape-guard: reject structurally-corrupt cache entries instead of
        // letting downstream code crash on `cached.text.ayahs`. IndexedDB stores
        // whatever was written, so a failed migration or partial write could
        // yield a record without a valid `text.ayahs` array.
        const text = result.text;
        if (!text || typeof text !== 'object' || !Array.isArray(text.ayahs) || text.ayahs.length === 0) {
          if (import.meta.env.DEV) {
            console.warn(`[SurahCache] Dropping corrupt cache entry for ${result.key}`);
          }
          resolve(null);
          return;
        }
        // Extract the CachedSurahEntry fields (exclude the 'key' property)
        const { key: _k, ...rest } = result;
        resolve(rest as CachedSurahEntry);
      };
      req.onerror = () => resolve(null);
    });
    if (entry) {
      // Touch for LRU: a surah in active use must not be evicted as "old".
      // Best-effort — a failed touch must never fail the read.
      try {
        const touchTx = db.transaction('surahs', 'readwrite');
        touchTx.objectStore('surahs').put({ key, ...entry, lastAccessed: Date.now() });
        await new Promise<void>((resolve) => {
          touchTx.oncomplete = () => resolve();
          touchTx.onerror = () => resolve();
          touchTx.onabort = () => resolve();
        });
      } catch (err) {
        // The read itself succeeded; a failed touch only skews eviction order.
        if (import.meta.env.DEV) {
          console.warn('[SurahCache] LRU touch failed:', err);
        }
      }
    }
    return entry;
  } catch {
    return null;
  } finally {
    db?.close();
  }
}
