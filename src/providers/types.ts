/**
 * Provider contracts for the app's external data endpoints.
 *
 * A provider encapsulates ONE third-party source (base URL, per-domain
 * defaults, availability) behind a common interface so the rest of the app
 * talks to a stable contract instead of hard-coded endpoints. The actual
 * network pipeline (timeout, retry, deduplication, offline fallback) is
 * injected by the composition root (`api-client.ts`), which keeps providers
 * pure metadata + URL building and avoids any import cycle.
 */

import type { FetchOptions } from '../types/api-options.js';

/**
 * The network call used to materialize a provider. It resolves a fully
 * qualified URL (provider base URL + path) using the app's fetch pipeline.
 */
export type JsonFetch = <T = unknown>(url: string, options?: FetchOptions) => Promise<T>;

/** Static metadata every provider exposes for diagnostics and tooling. */
export interface ProviderInfo {
  /** Unique registry id, e.g. `tafsir-jsdelivr` or `prayer-aladhan`. */
  readonly id: string;
  /** Human-readable label for logs and diagnostics. */
  readonly displayName: string;
  /** Base URL of the endpoint. Paths are appended to it at fetch time. */
  readonly baseUrl: string;
}

/** A JSON endpoint provider: builds URLs from its base and fetches them. */
export interface JsonProvider extends ProviderInfo {
  /**
   * Fetch a JSON payload for `path`, which is appended to `baseUrl`.
   * Caller options override the provider's per-domain defaults.
   */
  fetch<T = unknown>(path: string, options?: FetchOptions): Promise<T>;
  /** Whether the provider is reachable in the current environment. */
  isAvailable(): boolean;
}

/** Convenience guard for consumers that want to type a bound provider. */
export function isJsonProvider(value: unknown): value is JsonProvider {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as JsonProvider).id === 'string' &&
    typeof (value as JsonProvider).fetch === 'function'
  );
}
