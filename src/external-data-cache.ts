/**
 * External JSON resilience cache.
 * Keeps a bounded local copy of successful public API responses so readers can
 * continue using their most recent reliable data during an outage. The cache is
 * refreshed quietly after connectivity returns and never stores binary media.
 */

interface ExternalCacheEntry {
  key: string;
  url: string;
  payload: unknown;
  updatedAt: number;
}

const DB_NAME = 'QuranExternalDataDB';
const DB_VERSION = 1;
const STORE_NAME = 'responses';
const MAX_ENTRIES = 40;
const REFRESH_LIMIT = 12;
const REFRESH_TIMEOUT_MS = 12_000;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function supportsIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  return signal?.aborted === true || (error as Error)?.name === 'AbortError';
}

function openCacheDB(): Promise<IDBDatabase | null> {
  if (!supportsIndexedDB()) {
    return Promise.resolve(null);
  }
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error: unknown): null => {
    dbPromise = null;
    console.warn('[ExternalCache] IndexedDB unavailable:', error);
    return null;
  });

  return dbPromise;
}

async function getAllEntries(): Promise<ExternalCacheEntry[]> {
  const db = await openCacheDB();
  if (!db) {
    return [];
  }
  return new Promise((resolve) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as ExternalCacheEntry[]) || []);
    request.onerror = () => resolve([]);
  });
}

export async function getCachedExternalData<T>(url: string): Promise<T | null> {
  if (!isExternalUrl(url)) {
    return null;
  }
  const db = await openCacheDB();
  if (!db) {
    return null;
  }
  return new Promise((resolve) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(url);
    request.onsuccess = () => resolve((request.result as ExternalCacheEntry | undefined)?.payload as T ?? null);
    request.onerror = () => resolve(null);
  });
}

/**
 * Persist a reliable public JSON response and report whether it was written.
 * Background cache refreshes may ignore the boolean, while an explicit offline
 * download must fail honestly if persistent storage is unavailable.
 */
export async function cacheExternalData(url: string, payload: unknown): Promise<boolean> {
  if (!isExternalUrl(url)) {
    return false;
  }
  const db = await openCacheDB();
  if (!db) {
    return false;
  }
  const entry: ExternalCacheEntry = { key: url, url, payload, updatedAt: Date.now() };
  const stored = await new Promise<boolean>((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(entry);
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => resolve(false);
    transaction.onabort = () => resolve(false);
  });
  if (!stored) {
    return false;
  }
  await pruneCache();
  return true;
}

async function pruneCache(): Promise<void> {
  const entries = await getAllEntries();
  const expired = entries
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(MAX_ENTRIES);
  if (!expired.length) {
    return;
  }
  const db = await openCacheDB();
  if (!db) {
    return;
  }
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    expired.forEach((entry) => store.delete(entry.key));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}

/**
 * Request fresh JSON when possible; if the request fails, return the last
 * locally verified response for that exact URL. Aborted navigation requests
 * always remain aborted and are never replaced with stale data.
 */
export async function fetchJsonWithOfflineFallback<T>(
  url: string,
  request: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!isExternalUrl(url)) {
    return request();
  }

  const cachedPromise = getCachedExternalData<T>(url);
  if (!isOnline()) {
    const cached = await cachedPromise;
    if (cached !== null) {
      return cached;
    }
    return request();
  }

  try {
    const fresh = await request();
    if (!signal?.aborted) {
      await cacheExternalData(url, fresh);
    }
    return fresh;
  } catch (error) {
    if (isAbortError(error, signal)) {
      throw error;
    }
    const cached = await cachedPromise;
    if (cached !== null) {
      console.info('[ExternalCache] Serving last reliable response:', url);
      return cached;
    }
    throw error;
  }
}

/** Refresh recently used public JSON endpoints after the browser reconnects. */
export async function refreshRecentExternalData(): Promise<void> {
  if (!isOnline()) {
    return;
  }
  const entries = (await getAllEntries())
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, REFRESH_LIMIT);

  await Promise.all(
    entries.map(async (entry) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);
      try {
        const response = await fetch(entry.url, { signal: controller.signal });
        if (response.ok) {
          await cacheExternalData(entry.url, await response.json());
        }
      } catch {
        // Keep the previously reliable response. A later connection can retry.
      } finally {
        clearTimeout(timer);
      }
    }),
  );
}

/** Exposed for settings/reset flows and deterministic tests. */
export async function clearExternalDataCache(): Promise<void> {
  const db = await openCacheDB();
  if (!db) {
    return;
  }
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}
