/**
 * IndexedDB-backed audio-cache tests (ARC-05).
 *
 * The other audio-cache suites run WITHOUT IndexedDB (openDB rejects, every
 * path degrades to false) — this file uses fake-indexeddb to prove the
 * metadata fast path: isAudioCached answers from the tiny meta row and never
 * reads audio Blobs just to test existence.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { isAudioCached } from '../features/audio/audio-cache.js';

const URL = 'https://example.com/audio/1.mp3';

async function putMeta(url: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('QuranAudioCacheDB', 1);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('cacheMeta')) {
        db.createObjectStore('cacheMeta', { keyPath: 'url' });
      }
    };
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('cacheMeta', 'readwrite');
      tx.objectStore('cacheMeta').put({
        url,
        lastAccessed: Date.now(),
        size: 1234,
        surah: 1,
        reciter: 'test',
      });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    open.onerror = () => reject(open.error);
  });
}

describe('audio-cache metadata fast path (ARC-05)', () => {
  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('QuranAudioCacheDB');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });

  it('reports a cached URL from its metadata row without any Blob', async () => {
    await putMeta(URL);
    // No audioFiles row exists — a Blob-reading implementation would say false.
    await expect(isAudioCached(URL)).resolves.toBe(true);
  });

  it('reports false for an unknown URL', async () => {
    await expect(isAudioCached('https://example.com/audio/missing.mp3')).resolves.toBe(false);
  });
});
