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
}

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
    tx.objectStore('surahs').put({ key, ...entry });
    // Wait for the transaction to complete so errors are properly caught
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IDB transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('IDB transaction aborted'));
    });
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[IDB] Failed to cache surah:', err);
    }
  } finally {
    db?.close();
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
    return await new Promise((resolve) => {
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
        const { key: _k, ...entry } = result;
        resolve(entry as CachedSurahEntry);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  } finally {
    db?.close();
  }
}
