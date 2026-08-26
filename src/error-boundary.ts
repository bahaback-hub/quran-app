/**
 * Global Error Boundary for Quran App.
 *
 * Catches three categories of runtime errors:
 *   1. Synchronous JS errors        → window.onerror
 *   2. Unhandled Promise rejections → window.onunhandledrejection
 *   3. Resource load failures        → window.addEventListener('error', capture)
 *
 * For each error the boundary:
 *   - Logs a structured entry to the console for debugging
 *   - Shows a user-friendly toast (non-intrusive)
 *   - Shows a recovery overlay if the error is critical
 *   - Keeps an in-memory error log (capped at 50 entries) for diagnostics
 */

import { __ } from './i18n.js';
import { errorRecoveryOverlay } from './templates.js';
// Use namespace import for ui so mocks can swap implementations per-test
import * as ui from './ui.js';

/** Local alias that resolves at call time (allows mocks to work).
 *  Named differently from the showToast OPTION to avoid shadowing. */
function displayToast(msg: string, type: string = ''): void {
  if (typeof ui.showToast === 'function') {
    ui.showToast(msg, type);
  }
}

/* ===================== CONFIG ===================== */

const MAX_LOG_ENTRIES = 50;
const TOAST_DEBOUNCE_MS = 3000;
const STORAGE_KEY = 'error_log';
const STORAGE_MAX_ENTRIES = 100;
const REPORT_THRESHOLD = 3; // Same error occurring 3+ times = pattern

/* ===================== TYPES ===================== */

interface ErrorLogEntry {
  timestamp: number;
  type: string;
  message: string;
  source?: string;
  line?: number;
  col?: number;
  stack?: string;
}

/* ===================== STATE ===================== */

const errorLog: ErrorLogEntry[] = [];

let _lastToastTime: number | null = null;

/** Is the recovery overlay currently visible? */
let _recoveryVisible = false;

/* ===================== LOGGING ===================== */

/**
 * Push a structured error entry and trim old entries.
 */
function logError(entry: Omit<ErrorLogEntry, 'timestamp'>): void {
  errorLog.push({ timestamp: Date.now(), ...entry });
  if (errorLog.length > MAX_LOG_ENTRIES) {
    errorLog.splice(0, errorLog.length - MAX_LOG_ENTRIES);
  }
  // Structured console output
  console.error(`[ErrorBoundary][${entry.type}]`, entry.message, entry.stack || '');
  // Persist to localStorage for cross-session diagnostics
  persistErrorLog();
}

/**
 * Return a copy of the current error log.
 */
export function getErrorLog(): ErrorLogEntry[] {
  return [...errorLog];
}

/**
 * Clear the in-memory error log.
 */
export function clearErrorLog(): void {
  errorLog.length = 0;
}

/**
 * Persist the error log to localStorage for cross-session diagnostics.
 * Capped at STORAGE_MAX_ENTRIES to avoid unbounded growth.
 */
function persistErrorLog(): void {
  try {
    const stored: ErrorLogEntry[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    // Only push the latest entry (the one just added by logError),
    // not the entire in-memory array, to avoid duplicating previously persisted errors.
    if (errorLog.length > 0) {
      stored.push(errorLog[errorLog.length - 1]!);
    }
    const trimmed = stored.slice(-STORAGE_MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage full or unavailable — non-critical
  }
}

/**
 * Get the persisted error log from localStorage.
 */
export function getPersistedErrorLog(): ErrorLogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Clear the persisted error log from localStorage.
 */
export function clearPersistedErrorLog(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
}

/**
 * Detect error patterns — errors that occur REPORT_THRESHOLD+ times.
 * Returns a map of error message → count for recurring errors.
 */
export function detectErrorPatterns(): Map<string, number> {
  const allErrors = [...getPersistedErrorLog(), ...errorLog];
  const counts = new Map<string, number>();
  for (const entry of allErrors) {
    const key = entry.message.substring(0, 100); // Normalize by first 100 chars
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  // Only return patterns above threshold
  for (const [key, count] of counts) {
    if (count < REPORT_THRESHOLD) {
      counts.delete(key);
    }
  }
  return counts;
}

/**
 * Export the full error log as a JSON string for bug reports.
 * Includes both in-memory and persisted errors.
 */
export function exportErrorLog(): string {
  const allErrors = [...getPersistedErrorLog(), ...errorLog];
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: location.href,
      online: navigator.onLine,
      errorCount: allErrors.length,
      patterns: Object.fromEntries(detectErrorPatterns()),
      errors: allErrors,
    },
    null,
    2,
  );
}

/* ===================== USER NOTIFICATIONS ===================== */

/**
 * Show a debounced toast so rapid errors don't flood the UI.
 */
async function showDebouncedToast(msg: string): Promise<void> {
  const now = Date.now();
  if (_lastToastTime && now - _lastToastTime < TOAST_DEBOUNCE_MS) {
    return;
  }
  _lastToastTime = now;
  try {
    // displayToast is the local alias for ui.showToast
    displayToast(msg, 'error');
  } catch {
    // Fallback: use DOM directly if showToast throws
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = msg;
      toast.className = 'toast show error';
      setTimeout(() => toast.classList.remove('show'), 2500);
    }
  }
}

/* ===================== RECOVERY OVERLAY ===================== */

/**
 * Show a full-screen recovery overlay for critical errors.
 * Uses dedicated CSS classes in components.css for styling,
 * ensuring theme consistency and maintainability.
 */
function showRecoveryOverlay(errorMsg: string): void {
  if (_recoveryVisible) {
    return;
  }
  _recoveryVisible = true;

  // Don't create duplicate overlays
  if (document.getElementById('errorRecoveryOverlay')) {
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'errorRecoveryOverlay';
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-label', __('error_title'));
  overlay.innerHTML = errorRecoveryOverlay(errorMsg, errorMsg);

  document.body.appendChild(overlay);

  // Bind copy button
  const copyBtn = overlay.querySelector('#errorCopyBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const details = overlay.querySelector('pre')?.textContent || '';
      navigator.clipboard
        ?.writeText(details)
        .then(() => {
          copyBtn.textContent = __('error_copied');
        })
        .catch(() => {
          /* noop */
        });
    });
  }
}

/* ===================== ERROR CLASSIFICATION ===================== */

/**
 * Determine if an error is "critical" (should show recovery overlay)
 * vs "non-critical" (toast only).
 *
 * Critical = likely broke the entire app shell or rendering.
 * Non-critical = a feature failed but the app is still usable.
 */
function isCriticalError(message: string, source?: string): boolean {
  if (!message) {
    return false;
  }
  const msg = message.toLowerCase();
  // Rendering / DOM errors that break the UI
  if (msg.includes('cannot read properties of null') && (msg.includes('dom') || msg.includes('element'))) {
    return true;
  }
  if (msg.includes('cannot read properties of undefined') && (msg.includes('dom') || msg.includes('element'))) {
    return true;
  }
  // Bootstrap / init errors
  if (source && source.includes('app.js')) {
    return true;
  }
  if (source && source.includes('main.js')) {
    return true;
  }
  // Stack overflow
  if (msg.includes('maximum call stack')) {
    return true;
  }
  // Out of memory
  if (msg.includes('out of memory')) {
    return true;
  }
  return false;
}

/* ===================== HANDLERS ===================== */

/**
 * Handler for synchronous JS errors.
 */
function handleOnError(
  message: string | Event,
  source?: string,
  lineno?: number,
  colno?: number,
  error?: Error,
): boolean {
  logError({
    type: 'sync',
    message: String(message),
    source: source || undefined,
    line: lineno || undefined,
    col: colno || undefined,
    stack: error?.stack || undefined,
  });

  if (isCriticalError(String(message), source)) {
    showRecoveryOverlay(error?.stack || String(message));
  } else {
    showDebouncedToast(__('error_title'));
  }

  return true; // Prevent default browser error handling
}

/**
 * Handler for unhandled Promise rejections.
 */
function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  const reason = event.reason;
  const message = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : undefined;

  logError({
    type: 'promise',
    message,
    stack,
  });

  // Network / API errors → toast only, never critical overlay
  const msgLower = message.toLowerCase();
  if (
    msgLower.includes('fetch') ||
    msgLower.includes('network') ||
    msgLower.includes('failed to fetch') ||
    msgLower.includes('networkerror') ||
    msgLower.includes('load failed') ||
    msgLower.includes('err_internet_disconnected') ||
    msgLower.includes('net::err')
  ) {
    showDebouncedToast(__('error_server_unreachable'));
  } else if (isCriticalError(message)) {
    showRecoveryOverlay(stack || message);
  } else {
    showDebouncedToast(__('error_unexpected'));
  }

  event.preventDefault(); // Silence console warning
}

/**
 * Handler for resource load errors (images, scripts, stylesheets).
 */
function handleResourceError(event: Event): void {
  const target = event.target as HTMLElement | null;
  if (!target || (event.target as unknown) === window || (event.target as unknown) === document) {
    return;
  } // Not a resource error

  const tagName = target.tagName?.toLowerCase();
  const src = target.getAttribute('src') || target.getAttribute('href') || '';
  if (!src) {
    return;
  }

  logError({
    type: 'resource',
    message: `Failed to load ${tagName}: ${src}`,
    source: src,
  });

  // Resource errors are non-critical — just log them
  // (CSS/images failing shouldn't break the app experience)
}

/* ===================== INITIALIZATION ===================== */

/**
 * Install the global error boundary handlers.
 * Call this as early as possible in the app lifecycle (before other modules).
 */
export function initErrorBoundary(): void {
  // 1. Synchronous errors
  window.onerror = handleOnError;

  // 2. Unhandled Promise rejections
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  // 3. Resource load failures (capturing phase to catch before bubble)
  window.addEventListener('error', handleResourceError, true);

  // Log initialization
  console.warn('[ErrorBoundary] Global error handlers installed.');
}

/**
 * Remove all error boundary handlers (useful for testing / cleanup).
 */
export function destroyErrorBoundary(): void {
  window.onerror = null;
  window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  window.removeEventListener('error', handleResourceError, true);
  _recoveryVisible = false;
  console.warn('[ErrorBoundary] Global error handlers removed.');
}

/* ===================== SAFE DYNAMIC IMPORT ===================== */

interface SafeLoadOptions {
  /** Max retry attempts (default: 2). */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (default: 1000). */
  baseDelay?: number;
  /** Whether to show a toast on failure (default: true). */
  showToast?: boolean;
  /** Human-readable label for error messages (default: module name). */
  label?: string;
}

interface SafeLoadResult<T> {
  success: boolean;
  module?: T;
  error?: Error;
  attempts: number;
}

/** Cache of modules that exhausted all retries — they should not be retried in this session. */
const failedModules = new Set<string>();

/**
 * Dynamically import a module with retry + exponential backoff.
 *
 * Replaces the unsafe pattern:
 *   import('./feature.js')
 *     .then((m) => m.init())
 *     .catch((e) => console.error(e));  // ← user never knows!
 *
 * With:
 *   const mod = await safeLoad(() => import('./feature.js'), {
 *     label: 'وضع المصحف',
 *     maxRetries: 3,
 *   });
 *   if (mod.success) { mod.module.init(); }
 *
 * Features:
 *   - Exponential backoff: 1s, 2s, 4s
 *   - User-visible toast on each retry
 *   - Final error toast when all retries exhausted
 *   - Cache failures to avoid infinite retries in same session
 *   - Returns structured result (no throw)
 */
export async function safeLoad<T>(loader: () => Promise<T>, options: SafeLoadOptions = {}): Promise<SafeLoadResult<T>> {
  const { maxRetries = 2, baseDelay = 1000, showToast = true, label = 'module' } = options;

  // Check if this module already exhausted all retries in this session
  if (failedModules.has(label)) {
    console.warn(`[ErrorBoundary] "${label}" already exhausted retries this session — skipping.`);
    return { success: false, attempts: 0, error: new Error('Skipped due to prior failures') };
  }

  let lastError: Error | undefined;
  let attempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts++;
    try {
      const module = await loader();
      // Success — module is NOT in failedModules (or we wouldn't be here)
      if (attempt > 0 && showToast) {
        displayToast(__('success') || 'تم', 'success');
      }
      return { success: true, module, attempts };
    } catch (err) {
      lastError = err as Error;
      console.error(`[ErrorBoundary] safeLoad "${label}" failed (attempt ${attempt + 1}/${maxRetries + 1}):`, err);

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s, ...
        const delay = baseDelay * Math.pow(2, attempt);
        if (showToast) {
          displayToast(`فشل تحميل ${label}. إعادة المحاولة خلال ${Math.round(delay / 1000)} ثانية...`, 'warning');
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted — add to failedModules set so we don't retry this session
  failedModules.add(label);
  console.error(`[ErrorBoundary] safeLoad "${label}" exhausted ${attempts} attempts.`, lastError);

  if (showToast) {
    displayToast(`تعذّر تحميل ${label}. يرجى تحديث الصفحة أو التحقق من اتصالك بالإنترنت.`, 'error');
  }

  return { success: false, attempts, error: lastError };
}

/**
 * Wrap an async function with retry logic (similar to safeLoad but for any async op).
 *
 * @example
 *   const data = await safeAsync(
 *     () => fetch('/api/data').then(r => r.json()),
 *     { label: 'بيانات السورة', fallback: null }
 *   );
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  options: SafeLoadOptions & { fallback: T } = { fallback: null as T },
): Promise<T> {
  const { fallback, maxRetries = 2, baseDelay = 1000, showToast = true, label = 'operation' } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        if (showToast) {
          displayToast(`فشلت عملية "${label}". إعادة المحاولة...`, 'warning');
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`[ErrorBoundary] safeAsync "${label}" failed:`, lastError);
  return fallback;
}

/** Reset the failed-modules cache (e.g., when connectivity is restored). */
export function resetFailedModulesCache(): void {
  failedModules.clear();
}
