/**
 * Prayer provider — the Aladhan `timingsByCity` endpoint.
 *
 * Query strings (city, country, method) are appended to the base URL by the
 * caller. The provider uses a roomier 20s budget because prayer responses can
 * be slow and are refreshed only a few times a day.
 */

import { CONFIG } from '../config.js';
import type { JsonFetch, JsonProvider } from './types.js';

export const PRAYER_PROVIDER_ID = 'prayer-aladhan' as const;

/** Prayer times are fetched rarely but can be slow; allow a 20s budget. */
export const PRAYER_DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Create the prayer provider. The network function is injected by the
 * composition root so this module stays free of fetch/pipeline concerns.
 */
export function createPrayerProvider(fetchJson: JsonFetch): JsonProvider {
  return {
    id: PRAYER_PROVIDER_ID,
    displayName: 'Aladhan Prayer API',
    baseUrl: CONFIG.PRAYER_API,
    fetch: <T = unknown>(path: string, options?: Parameters<JsonFetch>[1]) =>
      fetchJson<T>(`${CONFIG.PRAYER_API}${path}`, { timeout: PRAYER_DEFAULT_TIMEOUT_MS, ...options }),
    isAvailable: () => typeof navigator === 'undefined' || navigator.onLine !== false,
  };
}
