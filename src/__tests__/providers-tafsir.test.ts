/**
 * Unit tests for the tafsir provider: metadata, URL building, timeout default
 * merging, and delegation to the injected network function.
 */

import { describe, it, expect, vi } from 'vitest';
import { CONFIG } from '../config.js';
import type { JsonFetch } from '../providers/types.js';
import { createTafsirProvider, TAFSIR_PROVIDER_ID, TAFSIR_DEFAULT_TIMEOUT_MS } from '../providers/tafsir.js';

function makeFetch(): JsonFetch {
  return vi.fn<JsonFetch>((_url: unknown) => Promise.resolve({ ok: true } as never)) as unknown as JsonFetch;
}

describe('TafsirProvider', () => {
  it('should expose stable metadata', () => {
    const fetchJson = makeFetch();
    const provider = createTafsirProvider(fetchJson);
    expect(provider.id).toBe(TAFSIR_PROVIDER_ID);
    expect(provider.displayName).toContain('Tafsir');
    expect(provider.baseUrl).toBe(CONFIG.TAFSIR_API);
  });

  it('should build the full URL from baseUrl + path', async () => {
    const fetchJson = makeFetch();
    const provider = createTafsirProvider(fetchJson);
    await provider.fetch('/ar-tafsir-muyassar/1/1.json', { silent: true });
    expect(fetchJson).toHaveBeenCalledWith(`${CONFIG.TAFSIR_API}/ar-tafsir-muyassar/1/1.json`, {
      timeout: TAFSIR_DEFAULT_TIMEOUT_MS,
      silent: true,
    });
  });

  it('should default a 10s timeout when the caller passes no options', async () => {
    const fetchJson = makeFetch();
    const provider = createTafsirProvider(fetchJson);
    await provider.fetch('/x/1/1.json');
    expect(fetchJson).toHaveBeenCalledWith(`${CONFIG.TAFSIR_API}/x/1/1.json`, {
      timeout: TAFSIR_DEFAULT_TIMEOUT_MS,
    });
  });

  it('should let caller options override the default timeout', async () => {
    const fetchJson = makeFetch();
    const provider = createTafsirProvider(fetchJson);
    await provider.fetch('/x/1/1.json', { timeout: 4000, silent: true });
    expect(fetchJson).toHaveBeenCalledWith(`${CONFIG.TAFSIR_API}/x/1/1.json`, {
      timeout: 4000,
      silent: true,
    });
  });

  it('should pass through extra fetch options', async () => {
    const fetchJson = makeFetch();
    const provider = createTafsirProvider(fetchJson);
    await provider.fetch('/x/1/1.json', { retries: 0, noDedup: true });
    expect(fetchJson).toHaveBeenCalledWith(`${CONFIG.TAFSIR_API}/x/1/1.json`, {
      timeout: TAFSIR_DEFAULT_TIMEOUT_MS,
      retries: 0,
      noDedup: true,
    });
  });

  it('should resolve the fetched payload', async () => {
    const payload = { text: 'تفسير' };
    const fetchJson: JsonFetch = vi.fn<JsonFetch>(() => Promise.resolve(payload) as never) as unknown as JsonFetch;
    const provider = createTafsirProvider(fetchJson);
    await expect(provider.fetch('/x/1/1.json')).resolves.toBe(payload);
  });

  it('should report availability', () => {
    const provider = createTafsirProvider(makeFetch());
    expect(provider.isAvailable()).toBe(true);
  });
});
