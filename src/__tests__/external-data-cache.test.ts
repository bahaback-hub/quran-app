/**
 * Behavioral coverage for resilient public API data.
 * Exercises real IndexedDB through fake-indexeddb rather than mocking cache
 * implementation details, including offline, outage, refresh, and abort paths.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

function setOnline(value: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value });
}

describe('external data resilience cache', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.restoreAllMocks();
    setOnline(true);
    const { clearExternalDataCache } = await import('../external-data-cache.js');
    await clearExternalDataCache();
  });

  it('serves the last reliable API response while offline without another network request', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ data: { name: 'الفاتحة' } }), { status: 200 }));
    const { apiFetch } = await import('../api-client.js');

    const fresh = await apiFetch<{ data: { name: string } }>('/surah/1', { silent: true, retries: 0 });
    setOnline(false);
    fetchSpy.mockClear();
    const cached = await apiFetch<{ data: { name: string } }>('/surah/1', { silent: true, retries: 0 });

    expect(fresh).toEqual(cached);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('uses the last reliable response when an online request fails', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { edition: 'موثوق' } }), { status: 200 }));
    const { tafsirFetch } = await import('../api-client.js');
    await tafsirFetch<{ data: { edition: string } }>('/edition/1/1.json', { silent: true, retries: 0 });

    fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const cached = await tafsirFetch<{ data: { edition: string } }>('/edition/1/1.json', {
      silent: true,
      retries: 0,
    });

    expect(cached).toEqual({ data: { edition: 'موثوق' } });
  });

  it('refreshes recently used data when connectivity returns', async () => {
    const url = 'https://example.org/public-data.json';
    const { cacheExternalData, getCachedExternalData, refreshRecentExternalData } =
      await import('../external-data-cache.js');
    await cacheExternalData(url, { revision: 'old' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ revision: 'new' }), { status: 200 }));

    await refreshRecentExternalData();

    await expect(getCachedExternalData(url)).resolves.toEqual({ revision: 'new' });
  });

  it('preserves an aborted navigation request instead of substituting cached data', async () => {
    const { cacheExternalData } = await import('../external-data-cache.js');
    const { apiFetch } = await import('../api-client.js');
    await cacheExternalData('https://api.alquran.cloud/v1/surah/2', { data: { name: 'البقرة' } });

    const controller = new AbortController();
    controller.abort();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    await expect(apiFetch('/surah/2', { signal: controller.signal, silent: true, retries: 0 })).rejects.toThrow();
  });

  it('drops a tampered entry instead of serving it (SEC-01)', async () => {
    const url = 'https://example.org/tampered.json';
    const { cacheExternalData, getCachedExternalData } = await import('../external-data-cache.js');
    await cacheExternalData(url, { data: 'genuine' });
    await expect(getCachedExternalData(url)).resolves.toEqual({ data: 'genuine' });

    // Rewrite the stored payload in place, keeping the write-time digest:
    // this is exactly what a corrupted/backdoored record looks like.
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('QuranExternalDataDB', 1);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('responses', 'readwrite');
        const get = tx.objectStore('responses').get(url);
        get.onsuccess = () => {
          tx.objectStore('responses').put({ ...get.result, payload: { data: 'forged' } });
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });

    await expect(getCachedExternalData(url)).resolves.toBeNull();
    // The suspect entry is gone, so a second read cannot resurrect it either.
    await expect(getCachedExternalData(url)).resolves.toBeNull();
  });

  it('keeps serving pre-digest entries written before verification existed', async () => {
    const url = 'https://example.org/legacy.json';
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('QuranExternalDataDB', 1);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('responses', 'readwrite');
        tx.objectStore('responses').put({ key: url, url, payload: { data: 'old' }, updatedAt: 1 });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });

    const { getCachedExternalData } = await import('../external-data-cache.js');
    await expect(getCachedExternalData(url)).resolves.toEqual({ data: 'old' });
  });
});
