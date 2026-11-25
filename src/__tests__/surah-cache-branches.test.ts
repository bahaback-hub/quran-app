import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './mocks/mock-indexeddb.js';
import {
  cacheSurahToIDB,
  getCachedSurahFromIDB,
  saveOfflineAudioUrls,
  getOfflineAudioUrls,
  MAX_SURAH_CACHE_ENTRIES,
  type CachedSurahEntry,
} from '../surah-cache.js';

function deleteDatabase(): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase('QuranSurahDB');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

function makeEntry(n: number): CachedSurahEntry {
  return {
    text: { number: n, name: `s${n}`, englishName: `S${n}`, ayahs: [{ numberInSurah: 1, text: 't', number: 1 }] },
    translation: null,
  };
}

describe('surah-cache branches', () => {
  beforeEach(async () => {
    await deleteDatabase();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await deleteDatabase();
  });

  it('saves and reads offline audio URLs, filters invalid values', async () => {
    await saveOfflineAudioUrls('ar.alafasy', 1, ['u1', '', 'u2']);
    expect(await getOfflineAudioUrls('ar.alafasy', 1)).toEqual(['u1', 'u2']);
    expect(await getOfflineAudioUrls('ar.alafasy', 999)).toEqual([]);
  });

  it('getOfflineAudioUrls returns [] for malformed records', async () => {
    await saveOfflineAudioUrls('r', 2, ['u1']);
    // overwrite with malformed shape directly
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('QuranSurahDB', 2);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('surahs', 'readwrite');
      tx.objectStore('surahs').put({ key: 'offline-urls:r:2', urls: 'bad' });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    expect(await getOfflineAudioUrls('r', 2)).toEqual([]);
  });

  it('returns null on integrity hash mismatch (SEC-01)', async () => {
    await cacheSurahToIDB('1_test', makeEntry(1));
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('QuranSurahDB', 2);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const record = await new Promise<any>((resolve) => {
      const tx = db.transaction('surahs', 'readonly');
      const req = tx.objectStore('surahs').get('1_test');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    record.text.ayahs[0].text = 'tampered';
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('surahs', 'readwrite');
      tx.objectStore('surahs').put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    expect(await getCachedSurahFromIDB('1_test')).toBeNull();
  });

  it('skips integrity check when crypto.subtle is unavailable', async () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
    await cacheSurahToIDB('2_test', makeEntry(2));
    const cached = await getCachedSurahFromIDB('2_test');
    expect(cached?.text.number).toBe(2);
    Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true });
  });

  it('enforces LRU cap by evicting oldest entries', async () => {
    const total = MAX_SURAH_CACHE_ENTRIES + 5;
    for (let i = 1; i <= total; i++) {
      await cacheSurahToIDB(`k${i}`, makeEntry(i));
    }
    // oldest keys should be evicted; newest should remain
    expect(await getCachedSurahFromIDB(`k${total}`)).not.toBeNull();
    expect(await getCachedSurahFromIDB(`k1`)).toBeNull();
  }, 20000);
});
