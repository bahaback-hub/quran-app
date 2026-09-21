/**
 * API Request & Fetch Configuration Options.
 * Extracted to avoid circular dependencies between api-client and provider implementations.
 */

export interface FetchOptions {
  timeout?: number;
  signal?: AbortSignal;
  silent?: boolean;
  errorMsg?: string;
  expectJSON?: boolean;
  /** Number of retry attempts for transient failures (5xx, 429 rate-limit, network errors). Default: 1. Set to 0 to disable. */
  retries?: number;
  /** Delay in ms between retries. Default: 1000. */
  retryDelay?: number;
  /** Skip request deduplication for this call. Default: false. */
  noDedup?: boolean;
  /** Use the bounded IndexedDB fallback for public JSON endpoints. Default: true. */
  offlineCache?: boolean;
}
