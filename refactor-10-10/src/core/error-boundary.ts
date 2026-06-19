/**
 * ================================================================
 * Error Boundary — Solves Problem #6
 * ----------------------------------------------------------------
 * Replaces silent `console.error` in dynamic imports with a real
 * error boundary that:
 *   1. Shows user-friendly error UI
 *   2. Provides retry button
 *   3. Exponential backoff retry mechanism
 *   4. Fallback UI for critical vs non-critical failures
 *   5. Global error handlers (uncaught errors, unhandled rejections)
 *
 * Usage:
 *   const audio = await ErrorBoundary.load('Audio Module', () => import('./audio.js'));
 *   if (audio) audio.play();
 * ================================================================
 */

import { toast } from './toast.js';
import { escapeHtml } from './template-registry.js';

interface ErrorBoundaryOptions {
  /** Max retry attempts (default: 3). */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (default: 1000). */
  baseDelay?: number;
  /** Whether to show toast on error (default: true). */
  showToast?: boolean;
  /** Whether to show full UI error (default: false, only for critical). */
  showUI?: boolean;
  /** Container to inject error UI into (default: document.body). */
  container?: HTMLElement;
}

interface LoadResult<T> {
  success: boolean;
  module?: T;
  error?: Error;
  attempts: number;
}

class ErrorBoundaryManager {
  private readonly failureCounts = new Map<string, number>();
  private readonly globalHandlersInstalled = false;

  constructor() {
    this.installGlobalHandlers();
  }

  /**
   * Load a module with retry + error UI support.
   * Returns null if all retries fail.
   *
   * @example
   *   const audio = await ErrorBoundary.load(
   *     'Audio Module',
   *     () => import('./audio.js').then(m => m.default),
   *     { maxRetries: 3 }
   *   );
   */
  async load<T>(
    label: string,
    loader: () => Promise<T>,
    options: ErrorBoundaryOptions = {},
  ): Promise<T | null> {
    const { maxRetries = 3, baseDelay = 1000, showToast = true, showUI = false } = options;

    let lastError: Error | undefined;
    let attempts = 0;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      attempts++;
      try {
        const module = await loader();
        this.failureCounts.delete(label);
        if (attempt > 0 && showToast) {
          toast.success(`تم تحميل ${label} بنجاح بعد ${attempt} محاولة.`);
        }
        return module;
      } catch (err) {
        lastError = err as Error;
        console.error(`[ErrorBoundary] "${label}" failed (attempt ${attempt + 1}/${maxRetries}):`, err);

        if (attempt < maxRetries - 1) {
          // Exponential backoff: 1s, 2s, 4s, 8s...
          const delay = baseDelay * Math.pow(2, attempt);
          if (showToast) {
            toast.warning(`فشل تحميل ${label}. إعادة المحاولة خلال ${delay / 1000} ثانية...`);
          }
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    this.failureCounts.set(label, (this.failureCounts.get(label) ?? 0) + 1);
    console.error(`[ErrorBoundary] "${label}" failed after ${attempts} attempts.`, lastError);

    if (showToast) {
      toast.error(`تعذّر تحميل ${label}. يرجى التحقق من اتصالك بالإنترنت ثم إعادة المحاولة.`, 8000);
    }

    if (showUI) {
      this.showErrorUI(label, lastError, options.container);
    }

    return null;
  }

  /**
   * Wrap an async function with error handling.
   * Catches errors, shows toast, returns fallback value.
   *
   * @example
   *   const result = await ErrorBoundary.wrap(
   *     'fetch ayahs',
   *     () => api.fetchAyahs(surah),
   *     { fallback: [] }
   *   );
   */
  async wrap<T>(label: string, fn: () => Promise<T>, options: { fallback: T; showToast?: boolean } = { fallback: null as T }): Promise<T> {
    const { fallback, showToast = true } = options;
    try {
      return await fn();
    } catch (err) {
      console.error(`[ErrorBoundary] "${label}" threw:`, err);
      if (showToast) {
        toast.error(`حدث خطأ في ${label}.`, 5000);
      }
      return fallback;
    }
  }

  /**
   * Show a critical error UI with retry button.
   */
  showErrorUI(label: string, error: Error | undefined, container?: HTMLElement): void {
    const target = container ?? document.body;
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-boundary';
    errorDiv.innerHTML = `
      <h3>⚠️ تعذّر تحميل ${escapeHtml(label)}</h3>
      <p>حدث خطأ أثناء تحميل هذه الميزة. قد يكون السبب:
        ضعف الاتصال بالإنترنت، أو مشكلة في الخادم.
      </p>
      <p style="font-size: 12px; color: var(--color-text-muted);">
        ${error ? escapeHtml(error.message) : 'لا توجد تفاصيل إضافية.'}
      </p>
      <button class="error-boundary-retry-btn" type="button">
        🔄 إعادة المحاولة
      </button>
    `;

    const retryBtn = errorDiv.querySelector<HTMLButtonElement>('.error-boundary-retry-btn');
    retryBtn?.addEventListener('click', () => {
      errorDiv.remove();
      // Reload the page as a simple retry mechanism
      window.location.reload();
    });

    target.prepend(errorDiv);
  }

  /**
   * Install global handlers for uncaught errors and unhandled rejections.
   * Prevents silent failures in production.
   */
  private installGlobalHandlers(): void {
    window.addEventListener('error', (event) => {
      console.error('[ErrorBoundary] Uncaught error:', event.error);
      toast.error('حدث خطأ غير متوقع. يرجى تحديث الصفحة.', 8000);
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('[ErrorBoundary] Unhandled promise rejection:', event.reason);
      toast.error('فشلت عملية في الخلفية. يرجى إعادة المحاولة.', 5000);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Get failure count for a label (for diagnostics). */
  getFailureCount(label: string): number {
    return this.failureCounts.get(label) ?? 0;
  }

  /** Reset failure counts (e.g., when connectivity is restored). */
  resetFailures(): void {
    this.failureCounts.clear();
  }
}

/** Singleton instance. */
export const errorBoundary = new ErrorBoundaryManager();

/** Convenience function: load with retry. */
export async function loadWithErrorBoundary<T>(
  label: string,
  loader: () => Promise<T>,
  options?: ErrorBoundaryOptions,
): Promise<T | null> {
  return errorBoundary.load(label, loader, options);
}

/** Convenience function: wrap async with fallback. */
export async function safeAsync<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  return errorBoundary.wrap(label, fn, { fallback });
}
