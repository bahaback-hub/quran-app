/**
 * Tafsir provider — the jsDelivr-hosted tafsir API (spa5k/tafsir_api).
 *
 * Each ayah is one small JSON document at `/<edition>/<surah>/<ayah>.json`,
 * so the provider shortens the default fetch timeout to 10s. The endpoint is
 * intentionally built from CONFIG so a build-time `VITE_TAFSIR_API` override
 * keeps working through the provider.
 */

import { CONFIG } from '../config.js';
import type { FetchOptions } from '../types/api-options.js';
import type { JsonFetch, JsonProvider } from './types.js';

export const TAFSIR_PROVIDER_ID = 'tafsir-jsdelivr' as const;

/** A single ayah is a tiny document; no need for the generic 15s budget. */
export const TAFSIR_DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Create the tafsir provider. The network function is injected by the
 * composition root so this module stays free of fetch/pipeline concerns.
 */
export function createTafsirProvider(fetchJson: JsonFetch): JsonProvider {
  return {
    id: TAFSIR_PROVIDER_ID,
    displayName: 'Tafsir API (jsDelivr)',
    baseUrl: CONFIG.TAFSIR_API,
    fetch: <T = unknown>(path: string, options?: FetchOptions) =>
      fetchJson<T>(`${CONFIG.TAFSIR_API}${path}`, { timeout: TAFSIR_DEFAULT_TIMEOUT_MS, ...options }),
    isAvailable: () => typeof navigator === 'undefined' || navigator.onLine !== false,
  };
}
