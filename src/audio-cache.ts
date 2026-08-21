/**
 * Audio Cache Module — IndexedDB-based offline audio storage with LRU eviction.
 *
 * Provides intelligent audio file caching for offline Quran playback:
 *   - Stores audio files (Blob) in IndexedDB, not in RAM
 *   - LRU (Least Recently Used) eviction when cache exceeds size limit
 *   - Per-surah/per-reciter caching with automatic metadata tracking
 *   - Download progress tracking for UI feedback
 *   - Cache size estimation and management
 *
 * Architecture:
 *   - AudioCacheDB (IndexedDB) with two object stores:
 *     1. 'audioFiles' — stores audio Blobs keyed by URL
 *     2. 'cacheMeta'  — stores LRU metadata (access time, size) per URL
 *   - Maximum cache size defaults to 200 MB (configurable)
 *   - When limit is exceeded, oldest entries are evicted first
 *
 * Usage:
 *   import { cacheSurahAudio, getCachedAudioUrl, getCacheStats } from './audio-cache.js';
 *   await cacheSurahAudio(audioUrls);
 *   const url = await getCachedAudioUrl('https://...mp3');
 */

/* ===================== CONSTANTS ===================== */

/** Maximum cache size in bytes (200 MB). */
const MAX_CACHE_BYTES = 200 * 1024 * 1024;

/** IndexedDB database name. */
const DB_NAME = 'QuranAudioCacheDB';

/** IndexedDB database version. */
const DB_VERSION = 1;

/** Object store name for audio Blobs. */
const AUDIO_STORE = 'audioFiles';

/** Object store name for cache metadata. */
const META_STORE = 'cacheMeta';

/** Runtime cache names shared with the PWA's Workbox audio routes. */
const RUNTIME_AUDIO_CACHE_NAMES = ['islamic-cdn', 'quran-audio'];

/* ===================== INTERFACES ===================== */

/** Metadata entry for a cached audio file. */
interface CacheMetaEntry {
  /** The audio URL (primary key). */
  url: string;
  /** Timestamp of last access (for LRU eviction). */
  lastAccessed: number;
  /** Size of the cached Blob in bytes. */
  size: number;
  /** Surah number this audio belongs to (for grouped operations). */
  surah: number;
  /** Reciter ID this audio belongs to. */
  reciter: string;
}

/** Cache statistics returned by getCacheStats(). */
export interface CacheStats {
  /** Total number of cached audio files. */
  fileCount: number;
  /** Total size of cached data in bytes. */
  totalSize: number;
  /** Maximum allowed cache size in bytes. */
  maxSize: number;
  /** Usage percentage (0–100). */
  usagePercent: number;
  /** List of cached surah numbers. */
  cachedSurahs: number[];
}

/** Download progress callback type. */
export type ProgressCallback = (
  surah: number,
  reciter: string,
  current: number,
  total: number,
) => void;

/* ===================== IndexedDB HELPERS ===================== */

/** Track ongoing downloads to prevent duplicates. */
const _activeDownloads = new Map<string, Promise<void>>();

/**
 * Open the AudioCacheDB database.
 * Creates object stores on first run (version upgrade).
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE, { keyPath: 'url' });
      }

      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'url' });
      }
    };

    request.onsuccess = (e: Event) => resolve((e.target as IDBOpenDBRequest).result);
    request.onerror = () => reject(new Error('Failed to open AudioCacheDB'));
  });
}

/* ===================== CORE CACHE OPERATIONS ===================== */

/**
 * Store a single audio file in the cache.
 * Fetches the audio from the network, stores the Blob in IndexedDB,
 * and records metadata for LRU tracking.
 *
 * @param url The audio URL to cache
 * @param surah The surah number this audio belongs to
 * @param reciter The reciter ID
 * @returns true if cached successfully, false on error
 */
async function storeAudioFile(url: string, surah: number, reciter: string): Promise<boolean> {
  try {
    // Fetch the audio file
    const response = await fetch(url);
    if (!response.ok) {
      if (import.meta.env.DEV) {
        console.warn(`[AudioCache] Failed to fetch ${url}: ${response.status}`);
      }
      return false;
    }

    const blob = await response.blob();
    const size = blob.size;

    // Store Blob in IndexedDB
    const db = await openDB();
    const tx = db.transaction([AUDIO_STORE, META_STORE], 'readwrite');

    tx.objectStore(AUDIO_STORE).put({ url, blob });
    tx.objectStore(META_STORE).put({
      url,
      lastAccessed: Date.now(),
      size,
      surah,
      reciter,
    });

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IDB transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('IDB transaction aborted'));
    });

    return true;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[AudioCache] Error storing audio file:', err);
    }
    return false;
  }
}

/**
 * Store a cross-origin audio response for service-worker playback when the CDN
 * permits normal media playback but does not expose bytes to fetch() via CORS.
 */
async function storeOpaqueAudioFile(url: string): Promise<boolean> {
  if (!('caches' in globalThis)) {
    return false;
  }
  try {
    const cacheName = url.includes('mp3quran.net') ? RUNTIME_AUDIO_CACHE_NAMES[1]! : RUNTIME_AUDIO_CACHE_NAMES[0]!;
    const response = await fetch(url, { mode: 'no-cors' });
    const cache = await caches.open(cacheName);
    await cache.put(url, response.clone());
    return true;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[AudioCache] Error storing opaque audio response:', err);
    }
    return false;
  }
}

/** Check browser Cache Storage as a fallback for CORS-restricted audio CDNs. */
async function isRuntimeAudioCached(url: string): Promise<boolean> {
  if (!('caches' in globalThis)) {
    return false;
  }
  try {
    return Boolean(await caches.match(url));
  } catch {
    return false;
  }
}

/**
 * Evict oldest entries until the total cache size is within the limit.
 * Uses LRU (Least Recently Used) strategy — removes entries with the oldest lastAccessed time.
 *
 * @param db Open IDBDatabase connection (optional, opens new one if not provided)
 */
async function evictIfNeeded(db?: IDBDatabase): Promise<void> {
  const database = db || (await openDB());

  try {
    // Get total size and all entries sorted by lastAccessed (oldest first)
    const tx = database.transaction(META_STORE, 'readonly');
    const store = tx.objectStore(META_STORE);
    const allReq = store.getAll();

    const entries: CacheMetaEntry[] = await new Promise((resolve) => {
      allReq.onsuccess = () => resolve(allReq.result as CacheMetaEntry[]);
      allReq.onerror = () => resolve([]);
    });

    const totalSize = entries.reduce((sum: number, e: CacheMetaEntry) => sum + e.size, 0);

    if (totalSize <= MAX_CACHE_BYTES) {
      return; // No eviction needed
    }

    // Sort by lastAccessed ascending (oldest first)
    entries.sort((a: CacheMetaEntry, b: CacheMetaEntry) => a.lastAccessed - b.lastAccessed);

    // Delete oldest entries until under limit
    let freedSize = 0;
    const targetFree = totalSize - MAX_CACHE_BYTES;
    const toDelete: string[] = [];

    for (const entry of entries) {
      if (freedSize >= targetFree) {
        break;
      }
      toDelete.push(entry.url);
      freedSize += entry.size;
    }

    if (toDelete.length > 0) {
      const deleteTx = database.transaction([AUDIO_STORE, META_STORE], 'readwrite');
      for (const url of toDelete) {
        deleteTx.objectStore(AUDIO_STORE).delete(url);
        deleteTx.objectStore(META_STORE).delete(url);
      }
      await new Promise<void>((resolve, reject) => {
        deleteTx.oncomplete = () => resolve();
        deleteTx.onerror = () => reject(deleteTx.error);
        deleteTx.onabort = () => reject(deleteTx.error);
      });

      if (import.meta.env.DEV) {
        console.warn(
          `[AudioCache] Evicted ${toDelete.length} files, freed ${(freedSize / 1024 / 1024).toFixed(1)} MB`,
        );
      }
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[AudioCache] Error during eviction:', err);
    }
  }
}

/* ===================== PUBLIC API ===================== */

/**
 * Cache all audio files for a surah+reciter combination.
 * Fetches each audio URL and stores it in IndexedDB for offline access.
 * Deduplicates concurrent cache requests for the same surah+reciter.
 * Runs eviction after caching to maintain size limits.
 *
 * @param audioUrls Array of audio URLs for each ayah
 * @param surah Surah number
 * @param reciter Reciter ID
 * @param onProgress Optional callback for download progress updates
 *
 * @example
 * await cacheSurahAudio(
 *   ['https://cdn.islamic.network/quran/1/1.mp3', ...],
 *   1,
 *   'ar.alafasy',
 *   (s, r, current, total) => updateProgress(current, total)
 * );
 */
export async function cacheSurahAudio(
  audioUrls: (string | null)[],
  surah: number,
  reciter: string,
  onProgress?: ProgressCallback,
): Promise<void> {
  const cacheKey = `${surah}_${reciter}`;

  // Deduplicate concurrent downloads for the same surah+reciter
  if (_activeDownloads.has(cacheKey)) {
    return _activeDownloads.get(cacheKey)!;
  }

  const promise = (async () => {
    const validUrls = audioUrls.filter((u): u is string => u !== null);
    const total = validUrls.length;
    let cached = 0;

    for (let i = 0; i < validUrls.length; i++) {
      const url = validUrls[i]!;

      // Skip if already cached
      if (await isAudioCached(url)) {
        // Update access time
        await updateAccessTime(url);
        cached++;
        onProgress?.(surah, reciter, i + 1, total);
        continue;
      }

      const storedInIndexedDB = await storeAudioFile(url, surah, reciter);
      const success = storedInIndexedDB || await storeOpaqueAudioFile(url);
      if (success) {
        cached++;
      }

      onProgress?.(surah, reciter, i + 1, total);
    }

    // Run eviction after caching new files
    await evictIfNeeded();

    if (import.meta.env.DEV) {
      console.warn(
        `[AudioCache] Cached ${cached}/${total} audio files for surah ${surah}, reciter ${reciter}`,
      );
    }
  })();

  // Always clean up the dedup entry, even on error, so future calls can retry
  promise.finally(() => {
    _activeDownloads.delete(cacheKey);
  });

  _activeDownloads.set(cacheKey, promise);
  return promise;
}

/**
 * Get a cached audio URL (Object URL) for immediate playback.
 * Returns null if the audio is not cached.
 *
 * IMPORTANT: The caller must call URL.revokeObjectURL() when done
 * to free memory, or use getCachedAudioBlob() for long-lived references.
 *
 * @param url The original audio URL to look up
 * @returns An Object URL pointing to the cached Blob, or null if not cached
 */
export async function getCachedAudioUrl(url: string): Promise<string | null> {
  const blob = await getCachedAudioBlob(url);
  if (!blob) {
    return null;
  }

  // Update access time for LRU tracking
  await updateAccessTime(url);

  return URL.createObjectURL(blob);
}

/**
 * Get a cached audio Blob directly.
 * Useful for creating Object URLs or other Blob operations.
 *
 * @param url The original audio URL to look up
 * @returns The cached Blob, or null if not found
 */
export async function getCachedAudioBlob(url: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(AUDIO_STORE, 'readonly');
    const req = tx.objectStore(AUDIO_STORE).get(url);

    return new Promise((resolve) => {
      req.onsuccess = () => {
        const result = req.result as { url: string; blob: Blob } | undefined;
        resolve(result?.blob || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Update the lastAccessed timestamp for a cached URL.
 * Called automatically when audio is retrieved from cache.
 *
 * @param url The audio URL to update
 */
async function updateAccessTime(url: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(META_STORE, 'readwrite');
    const store = tx.objectStore(META_STORE);
    const req = store.get(url);

    await new Promise<void>((resolve) => {
      req.onsuccess = () => {
        const entry = req.result as CacheMetaEntry | undefined;
        if (entry) {
          entry.lastAccessed = Date.now();
          store.put(entry);
        }
        resolve();
      };
      req.onerror = () => resolve();
    });

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Silently ignore — access time update is non-critical
  }
}

/**
 * Check if a specific audio URL is cached.
 *
 * @param url The audio URL to check
 * @returns true if the URL is cached, false otherwise
 */
export async function isAudioCached(url: string): Promise<boolean> {
  const blob = await getCachedAudioBlob(url);
  return blob !== null || isRuntimeAudioCached(url);
}

/**
 * Check if all audio files for a surah+reciter are cached.
 *
 * @param audioUrls Array of audio URLs to check
 * @returns true if ALL URLs are cached, false otherwise
 */
export async function isSurahCached(audioUrls: (string | null)[]): Promise<boolean> {
  const validUrls = audioUrls.filter((u): u is string => u !== null);
  if (validUrls.length === 0) {
    return false;
  }

  const results = await Promise.all(validUrls.map(isAudioCached));
  return results.every(Boolean);
}

/**
 * Get cache statistics including total size, file count, and cached surahs.
 *
 * @returns Cache statistics object
 */
export async function getCacheStats(): Promise<CacheStats> {
  try {
    const db = await openDB();
    const tx = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).getAll();

    return new Promise((resolve) => {
      req.onsuccess = () => {
        const entries = (req.result as CacheMetaEntry[]) || [];
        const totalSize = entries.reduce((sum: number, e: CacheMetaEntry) => sum + e.size, 0);
        const cachedSurahs = [...new Set(entries.map((e: CacheMetaEntry) => e.surah))].sort(
          (a: number, b: number) => a - b,
        );

        resolve({
          fileCount: entries.length,
          totalSize,
          maxSize: MAX_CACHE_BYTES,
          usagePercent: Math.round((totalSize / MAX_CACHE_BYTES) * 100),
          cachedSurahs,
        });
      };
      req.onerror = () =>
        resolve({
          fileCount: 0,
          totalSize: 0,
          maxSize: MAX_CACHE_BYTES,
          usagePercent: 0,
          cachedSurahs: [],
        });
    });
  } catch {
    return {
      fileCount: 0,
      totalSize: 0,
      maxSize: MAX_CACHE_BYTES,
      usagePercent: 0,
      cachedSurahs: [],
    };
  }
}

/**
 * Delete all cached audio files for a specific surah+reciter.
 *
 * @param surah Surah number to remove
 * @param reciter Reciter ID to remove
 * @returns Number of files deleted
 */
export async function deleteSurahCache(surah: number, reciter: string): Promise<number> {
  try {
    const db = await openDB();
    const tx = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).getAll();

    const entries: CacheMetaEntry[] = await new Promise((resolve) => {
      req.onsuccess = () => resolve((req.result as CacheMetaEntry[]) || []);
      req.onerror = () => resolve([]);
    });

    const toDelete = entries.filter(
      (e: CacheMetaEntry) => e.surah === surah && e.reciter === reciter,
    );

    if (toDelete.length === 0) {
      return 0;
    }

    const deleteTx = db.transaction([AUDIO_STORE, META_STORE], 'readwrite');
    for (const entry of toDelete) {
      deleteTx.objectStore(AUDIO_STORE).delete(entry.url);
      deleteTx.objectStore(META_STORE).delete(entry.url);
    }

    await new Promise<void>((resolve, reject) => {
      deleteTx.oncomplete = () => resolve();
      deleteTx.onerror = () => reject(deleteTx.error);
      deleteTx.onabort = () => reject(deleteTx.error);
    });

    if (import.meta.env.DEV) {
      console.warn(
        `[AudioCache] Deleted ${toDelete.length} cached files for surah ${surah}, reciter ${reciter}`,
      );
    }

    return toDelete.length;
  } catch {
    return 0;
  }
}

/**
 * Clear the entire audio cache.
 * Removes all audio files and metadata from IndexedDB.
 *
 * @returns true if cleared successfully, false on error
 */
export async function clearAudioCache(): Promise<boolean> {
  try {
    const db = await openDB();
    const tx = db.transaction([AUDIO_STORE, META_STORE], 'readwrite');
    tx.objectStore(AUDIO_STORE).clear();
    tx.objectStore(META_STORE).clear();

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });

    if (import.meta.env.DEV) {
      console.warn('[AudioCache] Cache cleared');
    }

    return true;
  } catch {
    return false;
  }
}
