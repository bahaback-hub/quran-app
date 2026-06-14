/**
 * Unified API Client for Quran App.
 *
 * Provides a single, consistent entry point for all network requests:
 *   - Automatic error handling (toast + console log)
 *   - Timeout support (default 15s)
 *   - Response validation
 *   - Offline detection with user-friendly messages
 *   - AbortController support for cancellation
 *   - Full generic type safety — no `any` types
 *   - Request deduplication — concurrent identical requests share one flight
 *   - Automatic retry — transient failures (5xx, network) retried up to 2 times
 *
 * Usage:
 *   import { apiFetch, prayerFetch, tafsirFetch } from './api-client.js';
 *   const data = await apiFetch<SurahResponse>('/surah/1');
 *   const times = await prayerFetch<PrayerResponse>('?city=Makkah&country=SA&method=4');
 */

import { CONFIG } from './config.js';
import { __ } from './i18n.js';

/* ===================== TYPES ===================== */

export interface FetchOptions {
  timeout?: number;
  signal?: AbortSignal;
  silent?: boolean;
  errorMsg?: string;
  expectJSON?: boolean;
  /** Number of retry attempts for transient failures (5xx, network errors). Default: 1. Set to 0 to disable. */
  retries?: number;
  /** Delay in ms between retries. Default: 1000. */
  retryDelay?: number;
  /** Skip request deduplication for this call. Default: false. */
  noDedup?: boolean;
}

interface TimeoutController {
  controller: AbortController;
  timerId: ReturnType<typeof setTimeout>;
}

/** HTTP error with status code — thrown for non-2xx responses. */
export class HTTPError extends Error {
  readonly status: number;

  constructor(status: number, statusText: string) {
    super(`HTTP ${status}: ${statusText}`);
    this.name = 'HTTPError';
    this.status = status;
  }
}

/* ===================== CONSTANTS ===================== */

const DEFAULT_TIMEOUT = 15000;
const DEFAULT_RETRIES = 1;
const DEFAULT_RETRY_DELAY = 1000;

/** Arabic error messages by category */
const ERROR_MESSAGES: Record<string, string> = {
  offline: __('error_no_connection'),
  timeout: __('error_timeout'),
  network: __('error_server_unreachable'),
  server: __('error_server_error'),
  parse: __('error_invalid_data'),
  default: __('error_unexpected'),
};

/* ===================== HELPERS ===================== */

/**
 * Show a toast notification. Lazy-imports ui.js to avoid circular deps.
 */
async function showToastMsg(msg: string, type: string = 'error'): Promise<void> {
  try {
    const { showToast } = await import('./ui.js');
    showToast(msg, type);
  } catch {
    // Absolute fallback: use DOM directly
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = msg;
      toast.className = `toast show ${type}`;
      setTimeout(() => toast.classList.remove('show'), 2500);
    }
  }
}

/**
 * Classify an error and return the appropriate Arabic message.
 */
function classifyError(error: Error): string {
  const name = error.name || '';
  const msg = (error.message || '').toLowerCase();

  if (!navigator.onLine) return ERROR_MESSAGES.offline;
  if (name === 'AbortError') return ''; // Silently ignore aborted requests
  if (name === 'TimeoutError' || msg.includes('timeout') || msg.includes('aborted')) return ERROR_MESSAGES.timeout;
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('net::err'))
    return ERROR_MESSAGES.network;
  if (msg.includes('json') || msg.includes('parse') || msg.includes('unexpected token')) return ERROR_MESSAGES.parse;

  return ERROR_MESSAGES.default;
}

/**
 * Create an AbortController that auto-aborts after `ms` milliseconds.
 * Composes with an external signal if provided.
 */
function createTimeoutController(ms: number, externalSignal?: AbortSignal): TimeoutController {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), ms);

  // If external signal aborts, abort our controller too
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timerId);
      controller.abort();
    } else {
      externalSignal.addEventListener(
        'abort',
        () => {
          clearTimeout(timerId);
          controller.abort();
        },
        { once: true }
      );
    }
  }

  return { controller, timerId };
}

/* ===================== REQUEST DEDUPLICATION ===================== */

/**
 * In-flight request deduplication map.
 * Key: request URL, Value: shared Promise.
 *
 * When multiple callers request the same URL concurrently,
 * they share a single network request instead of firing duplicates.
 */
const _inflightRequests = new Map<string, Promise<unknown>>();

/**
 * Deduplicate a request — if an identical URL is already in-flight, return its Promise.
 * Otherwise, execute the request and cache the Promise until it settles.
 */
function deduplicateRequest<T>(url: string, exec: () => Promise<T>, noDedup: boolean): Promise<T> {
  if (noDedup) return exec();

  const existing = _inflightRequests.get(url) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = exec().finally(() => {
    _inflightRequests.delete(url);
  });

  _inflightRequests.set(url, promise);
  return promise;
}

/* ===================== CORE FETCH ===================== */

/**
 * Unified fetch wrapper with timeout, error handling, toast notifications,
 * request deduplication, and automatic retry.
 *
 * @typeParam T - The expected response type (defaults to unknown).
 *   When `expectJSON` is true (default), the response is parsed as JSON and typed as T.
 *   When `expectJSON` is false, the raw Response object is returned.
 *
 * @example
 *   // Type-safe JSON response
 *   const surah = await safeFetch<SurahData>(url);
 *   // Raw response (non-JSON)
 *   const response = await safeFetch(url, { expectJSON: false });
 *   // With retry for transient failures
 *   const data = await safeFetch<SurahData>(url, { retries: 2 });
 */
export async function safeFetch<T = unknown>(url: string, options: FetchOptions = {}): Promise<T> {
  const {
    timeout = DEFAULT_TIMEOUT,
    signal: externalSignal,
    silent = false,
    errorMsg,
    expectJSON = true,
    retries = DEFAULT_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    noDedup = false,
  } = options;

  return deduplicateRequest(url, () => _fetchWithRetry<T>(url, {
    timeout, externalSignal, silent, errorMsg, expectJSON, retries, retryDelay,
  }), noDedup);
}

/**
 * Internal: execute fetch with automatic retry for transient failures.
 * Retries on 5xx errors and network errors (not on 4xx, abort, or parse errors).
 */
async function _fetchWithRetry<T>(
  url: string,
  opts: {
    timeout: number;
    externalSignal?: AbortSignal;
    silent: boolean;
    errorMsg?: string;
    expectJSON: boolean;
    retries: number;
    retryDelay: number;
  }
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await _singleFetch<T>(url, opts, attempt > 0);
    } catch (error: unknown) {
      lastError = error;

      // Don't retry on: aborts, 4xx client errors, or parse errors
      if (error instanceof HTTPError && error.status < 500) break;
      if (error instanceof DOMException && error.name === 'AbortError') break;

      // Don't retry parse errors
      const msg = (error as Error).message?.toLowerCase() ?? '';
      if (msg.includes('json') || msg.includes('parse') || msg.includes('unexpected token')) break;

      // Retry if we have attempts left
      if (attempt < opts.retries) {
        if (!opts.silent) {
          console.info(`[API] Retrying (${attempt + 1}/${opts.retries}) ← ${url}`);
        }
        await new Promise(resolve => setTimeout(resolve, opts.retryDelay));
        continue;
      }
    }
  }

  throw lastError;
}

/**
 * Internal: execute a single fetch attempt with timeout and error handling.
 */
async function _singleFetch<T>(
  url: string,
  opts: {
    timeout: number;
    externalSignal?: AbortSignal;
    silent: boolean;
    errorMsg?: string;
    expectJSON: boolean;
  },
  isRetry: boolean = false
): Promise<T> {
  const { controller, timerId } = createTimeoutController(opts.timeout, opts.externalSignal);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    clearTimeout(timerId);

    // Handle HTTP errors
    if (!response.ok) {
      const httpError = new HTTPError(response.status, response.statusText);

      // Only show toast on final attempt (not during retries)
      if (!opts.silent && !isRetry) {
        const msg = response.status >= 500 ? ERROR_MESSAGES.server : opts.errorMsg || ERROR_MESSAGES.default;
        showToastMsg(msg);
      }

      console.warn(`[API] ${response.status} ${response.statusText} ← ${url}`);
      throw httpError;
    }

    if (opts.expectJSON) {
      try {
        return (await response.json()) as T;
      } catch (parseError) {
        if (!opts.silent) showToastMsg(opts.errorMsg || ERROR_MESSAGES.parse);
        console.warn(`[API] JSON parse error ← ${url}`, parseError);
        throw parseError;
      }
    }

    return response as unknown as T;
  } catch (error: unknown) {
    clearTimeout(timerId);

    // Don't double-handle HTTP errors (already handled above)
    if (error instanceof HTTPError) throw error;

    const classified = classifyError(error as Error);

    // Aborted requests are silent
    if (!classified) throw error;

    if (!opts.silent && !isRetry) {
      showToastMsg(opts.errorMsg || classified);
    }

    console.warn(`[API] Request failed ← ${url}`, (error as Error).message || error);
    throw error;
  }
}

/* ===================== CONVENIENCE METHODS ===================== */

/**
 * Fetch from the Quran API (api.alquran.cloud).
 *
 * @typeParam T - The expected response shape from the Quran API.
 *
 * @example
 *   const data = await apiFetch<SurahResponse>('/surah/1');
 */
export function apiFetch<T = unknown>(path: string, options?: FetchOptions): Promise<T> {
  const url = `${CONFIG.API_BASE}${path}`;
  return safeFetch<T>(url, options);
}

/**
 * Fetch from the Prayer API (api.aladhan.com).
 *
 * @typeParam T - The expected response shape from the Prayer API.
 *
 * @example
 *   const times = await prayerFetch<PrayerTimesResponse>('?city=Makkah&country=SA&method=4');
 */
export function prayerFetch<T = unknown>(query: string, options?: FetchOptions): Promise<T> {
  const url = `${CONFIG.PRAYER_API}${query}`;
  return safeFetch<T>(url, { timeout: 20000, ...options });
}

/**
 * Fetch from the Tafsir API.
 *
 * @typeParam T - The expected response shape from the Tafsir API.
 *
 * @example
 *   const tafsir = await tafsirFetch<TafsirResponse>('/ar-tafsir-muyassar/1/1.json');
 */
export function tafsirFetch<T = unknown>(path: string, options?: FetchOptions): Promise<T> {
  const url = `${CONFIG.TAFSIR_API}${path}`;
  return safeFetch<T>(url, { timeout: 10000, ...options });
}

/**
 * Generic JSON fetch for any URL (e.g. local files, CDN).
 *
 * @typeParam T - The expected JSON response shape.
 *
 * @example
 *   const data = await jsonFetch<SurahList>('data/surah-list.json');
 */
export function jsonFetch<T = unknown>(url: string, options?: FetchOptions): Promise<T> {
  return safeFetch<T>(url, { expectJSON: true, ...options });
}
