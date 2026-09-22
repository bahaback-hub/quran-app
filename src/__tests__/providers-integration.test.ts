/**
 * Integration tests for the facade seam: importing `api-client` registers the
 * built-in tafsir/prayer providers, and overriding a provider redirects the
 * public facade functions (`prayerFetch`, `tafsirFetch`) — the "single
 * override" contract Stream 3 promises.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { prayerFetch, tafsirFetch } from '../api-client.js';
import { overrideProvider, clearOverrides, getProvider, hasOverride, listProviderIds } from '../providers/registry.js';
import { TAFSIR_PROVIDER_ID } from '../providers/tafsir.js';
import { PRAYER_PROVIDER_ID } from '../providers/prayer.js';
import type { JsonProvider } from '../providers/types.js';

function stubProvider(id: string, payload: unknown): JsonProvider {
  return {
    id,
    displayName: `stub-${id}`,
    baseUrl: 'https://stub.example',
    fetch: vi.fn<JsonProvider['fetch']>(() => Promise.resolve(payload) as never) as unknown as JsonProvider['fetch'],
    isAvailable: () => true,
  };
}

describe('api-client facade + provider overrides', () => {
  afterEach(() => {
    clearOverrides();
  });

  it('should register the built-in tafsir and prayer providers on import', () => {
    const ids = listProviderIds();
    expect(ids).toEqual(expect.arrayContaining([TAFSIR_PROVIDER_ID, PRAYER_PROVIDER_ID]));
  });

  it('should route prayerFetch through an overridden provider', async () => {
    const payload = { data: { status: 200, timings: { Fajr: '05:12' } } };
    const stub = stubProvider(PRAYER_PROVIDER_ID, payload);
    overrideProvider(PRAYER_PROVIDER_ID, stub);

    await expect(prayerFetch('?city=Makkah&country=SA&method=4')).resolves.toBe(payload);
    expect(stub.fetch).toHaveBeenCalledWith('?city=Makkah&country=SA&method=4', undefined);
  });

  it('should route tafsirFetch through an overridden provider', async () => {
    const payload = { text: 'تفسير ميسر' };
    const stub = stubProvider(TAFSIR_PROVIDER_ID, payload);
    overrideProvider(TAFSIR_PROVIDER_ID, stub);

    await expect(tafsirFetch('/ar-tafsir-muyassar/1/1.json')).resolves.toBe(payload);
    expect(stub.fetch).toHaveBeenCalledWith('/ar-tafsir-muyassar/1/1.json', undefined);
  });

  it('should restore the built-in provider after clearOverrides', () => {
    const stub = stubProvider(PRAYER_PROVIDER_ID, {});
    overrideProvider(PRAYER_PROVIDER_ID, stub);
    expect(hasOverride(PRAYER_PROVIDER_ID)).toBe(true);
    clearOverrides();
    expect(hasOverride(PRAYER_PROVIDER_ID)).toBe(false);
    // The effective provider is the built-in again (metadata proves it, no network).
    expect(getProvider(PRAYER_PROVIDER_ID).id).toBe(PRAYER_PROVIDER_ID);
    expect(getProvider(PRAYER_PROVIDER_ID).displayName).toContain('Aladhan');
    expect(getProvider(TAFSIR_PROVIDER_ID).displayName).toContain('Tafsir');
  });
});
