/**
 * Unit tests for the prayer provider: metadata, query forwarding, and the
 * 20s timeout default.
 */

import { describe, it, expect, vi } from 'vitest';
import { CONFIG } from '../config.js';
import type { JsonFetch } from '../providers/types.js';
import { createPrayerProvider, PRAYER_PROVIDER_ID, PRAYER_DEFAULT_TIMEOUT_MS } from '../providers/prayer.js';

function makeFetch(): JsonFetch {
  return vi.fn<JsonFetch>((_url: unknown) => Promise.resolve({ data: {} } as never)) as unknown as JsonFetch;
}

describe('PrayerProvider', () => {
  it('should expose stable metadata', () => {
    const fetchJson = makeFetch();
    const provider = createPrayerProvider(fetchJson);
    expect(provider.id).toBe(PRAYER_PROVIDER_ID);
    expect(provider.displayName).toContain('Aladhan');
    expect(provider.baseUrl).toBe(CONFIG.PRAYER_API);
  });

  it('should forward the query string appended to the base URL', async () => {
    const fetchJson = makeFetch();
    const provider = createPrayerProvider(fetchJson);
    const query = '?city=Makkah&country=SA&method=4';
    await provider.fetch(query, { silent: true });
    expect(fetchJson).toHaveBeenCalledWith(`${CONFIG.PRAYER_API}${query}`, {
      timeout: PRAYER_DEFAULT_TIMEOUT_MS,
      silent: true,
    });
  });

  it('should default a 20s timeout when no options are passed', async () => {
    const fetchJson = makeFetch();
    const provider = createPrayerProvider(fetchJson);
    await provider.fetch('?city=Madinah&country=SA&method=4');
    expect(fetchJson).toHaveBeenCalledWith(`${CONFIG.PRAYER_API}?city=Madinah&country=SA&method=4`, {
      timeout: PRAYER_DEFAULT_TIMEOUT_MS,
    });
  });

  it('should let caller options override the default timeout', async () => {
    const fetchJson = makeFetch();
    const provider = createPrayerProvider(fetchJson);
    await provider.fetch('?city=Makkah', { timeout: 5000 });
    expect(fetchJson).toHaveBeenCalledWith(`${CONFIG.PRAYER_API}?city=Makkah`, { timeout: 5000 });
  });

  it('should resolve the fetched payload', async () => {
    const payload = { data: { timings: { Fajr: '05:12' } } };
    const fetchJson: JsonFetch = vi.fn<JsonFetch>(() => Promise.resolve(payload) as never) as unknown as JsonFetch;
    const provider = createPrayerProvider(fetchJson);
    await expect(provider.fetch('?city=Makkah')).resolves.toBe(payload);
  });

  it('should report availability', () => {
    const provider = createPrayerProvider(makeFetch());
    expect(provider.isAvailable()).toBe(true);
  });
});
