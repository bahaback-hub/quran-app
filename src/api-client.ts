/**
 * Unified API Client for Quran App.
 *
 * Provides a single, consistent entry point for all network requests:
 *   - Automatic error handling (toast + console log)
 *   - Timeout support (default 15s)
 *   - Response validation
 *   - Offline detection with user-friendly messages
 *   - AbortController support for cancellation
 *
 * Usage:
 *   import { apiFetch, prayerFetch, tafsirFetch } from './api-client.js';
 *   const data = await apiFetch('/surah/1');
 *   const times = await prayerFetch('?city=Makkah&country=SA&method=4');
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
}

interface TimeoutController {
  controller: AbortController;
  timerId: ReturnType<typeof setTimeout>;
}

/* ===================== CONSTANTS ===================== */

const DEFAULT_TIMEOUT = 15000;

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
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('net::err')) return ERROR_MESSAGES.network;
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
      externalSignal.addEventListener('abort', () => {
        clearTimeout(timerId);
        controller.abort();
      }, { once: true });
    }
  }

  return { controller, timerId };
}

/* ===================== CORE FETCH ===================== */

/**
 * Unified fetch wrapper with timeout, error handling, and toast notifications.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function safeFetch(url: string, options: FetchOptions = {}): Promise<any> {
  const {
    timeout = DEFAULT_TIMEOUT,
    signal: externalSignal,
    silent = false,
    errorMsg,
    expectJSON = true,
  } = options;

  const { controller, timerId } = createTimeoutController(timeout, externalSignal);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    clearTimeout(timerId);

    // Handle HTTP errors
    if (!response.ok) {
      const httpError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      httpError.name = 'HTTPError';
      (httpError as unknown as Record<string, unknown>).status = response.status;

      if (!silent) {
        const msg = response.status >= 500
          ? ERROR_MESSAGES.server
          : (errorMsg || ERROR_MESSAGES.default);
        showToastMsg(msg);
      }

      console.warn(`[API] ${response.status} ${response.statusText} ← ${url}`);
      throw httpError;
    }

    if (expectJSON) {
      try {
        return await response.json();
      } catch (parseError) {
        if (!silent) showToastMsg(errorMsg || ERROR_MESSAGES.parse);
        console.warn(`[API] JSON parse error ← ${url}`, parseError);
        throw parseError;
      }
    }

    return response;

  } catch (error: unknown) {
    clearTimeout(timerId);

    // Don't double-handle HTTP errors (already handled above)
    if (error instanceof Error && error.name === 'HTTPError') throw error;

    const classified = classifyError(error as Error);

    // Aborted requests are silent
    if (!classified) throw error;

    if (!silent) {
      showToastMsg(errorMsg || classified);
    }

    console.warn(`[API] Request failed ← ${url}`, (error as Error).message || error);
    throw error;
  }
}

/* ===================== CONVENIENCE METHODS ===================== */

/**
 * Fetch from the Quran API (api.alquran.cloud).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function apiFetch(path: string, options?: FetchOptions): Promise<any> {
  const url = `${CONFIG.API_BASE}${path}`;
  return safeFetch(url, options);
}

/**
 * Fetch from the Prayer API (api.aladhan.com).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function prayerFetch(query: string, options?: FetchOptions): Promise<any> {
  const url = `${CONFIG.PRAYER_API}${query}`;
  return safeFetch(url, { timeout: 20000, ...options });
}

/**
 * Fetch from the Tafsir API.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function tafsirFetch(path: string, options?: FetchOptions): Promise<any> {
  const url = `${CONFIG.TAFSIR_API}${path}`;
  return safeFetch(url, { timeout: 10000, ...options });
}

/**
 * Generic JSON fetch for any URL (e.g. local files, CDN).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonFetch(url: string, options?: FetchOptions): Promise<any> {
  return safeFetch(url, { expectJSON: true, ...options });
}
