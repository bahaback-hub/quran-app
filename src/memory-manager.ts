/**
 * Memory Manager — Proactive memory leak prevention and monitoring.
 *
 * Features:
 *   1. Periodic cleanup of stale caches (IndexedDB, Map, Set)
 *   2. Object URL revocation tracking
 *   3. Event listener leak detection (dev mode)
 *   4. Memory usage reporting (when performance.memory is available)
 *   5. AbortController registry for bulk cancellation
 *
 * Usage:
 *   import { initMemoryManager, getMemoryStats } from './memory-manager.js';
 *   initMemoryManager();
 *   const stats = getMemoryStats();
 */

/* ===================== TYPES ===================== */

export interface MemoryStats {
  /** Tracked object URLs (revoke calls pending). */
  objectUrls: number;
  /** Tracked AbortControllers. */
  abortControllers: number;
  /** Tracked event listeners (dev mode only). */
  eventListeners: number;
  /** JS heap size in MB (Chrome only — performance.memory). */
  jsHeapSizeMB: number | null;
  /** JS heap limit in MB (Chrome only). */
  jsHeapLimitMB: number | null;
  /** Timestamp of last cleanup. */
  lastCleanup: string | null;
}

export interface CleanupResult {
  /** Number of object URLs revoked. */
  objectUrlsRevoked: number;
  /** Number of stale entries removed. */
  staleEntriesRemoved: number;
  /** Number of orphaned listeners removed (dev mode). */
  listenersRemoved: number;
  /** Time elapsed in milliseconds. */
  elapsedMs: number;
}

/* ===================== STATE ===================== */

/** Map of object URL → original URL for tracking. */
const _objectUrls = new Map<string, string>();

/** Set of active AbortControllers. */
const _abortControllers = new Set<AbortController>();

/** Tracked event listeners (dev mode only). */
const _eventListeners = new Map<string, { target: EventTarget; type: string; listener: EventListenerOrEventListenerObject }>();

/** Timestamp of last cleanup. */
let _lastCleanup: string | null = null;

/** Cleanup interval handle. */
let _cleanupInterval: ReturnType<typeof setInterval> | null = null;

/** Cleanup interval (5 minutes). */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/* ===================== OBJECT URL MANAGEMENT ===================== */

/**
 * Create a tracked object URL that will be automatically revoked during cleanup.
 * @param blob The blob to create a URL for
 * @param originalUrl The original URL (for debugging)
 * @returns The object URL
 */
export function createTrackedObjectUrl(blob: Blob, originalUrl?: string): string {
  const url = URL.createObjectURL(blob);
  _objectUrls.set(url, originalUrl || url);
  return url;
}

/**
 * Revoke a tracked object URL immediately.
 * @param url The object URL to revoke
 */
export function revokeTrackedObjectUrl(url: string): void {
  if (_objectUrls.has(url)) {
    URL.revokeObjectURL(url);
    _objectUrls.delete(url);
  } else {
    // Not tracked, but revoke anyway
    URL.revokeObjectURL(url);
  }
}

/* ===================== ABORT CONTROLLER MANAGEMENT ===================== */

/**
 * Register an AbortController for bulk cancellation.
 * @param controller The AbortController to track
 */
export function registerAbortController(controller: AbortController): AbortController {
  _abortControllers.add(controller);
  // Auto-remove when aborted
  controller.signal.addEventListener('abort', () => {
    _abortControllers.delete(controller);
  });
  return controller;
}

/**
 * Abort all registered AbortControllers.
 * Useful for cleanup on page unload or route change.
 */
export function abortAll(): void {
  for (const controller of _abortControllers) {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  }
  _abortControllers.clear();
}

/* ===================== EVENT LISTENER TRACKING (DEV MODE) ===================== */

/**
 * Add a tracked event listener (dev mode only).
 * In production, this falls back to the native addEventListener.
 */
export function addTrackedEventListener(
  target: EventTarget,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: AddEventListenerOptions,
): void {
  target.addEventListener(type, listener, options);
  if (import.meta.env?.DEV) {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    _eventListeners.set(id, { target, type, listener });
  }
}

/**
 * Remove a tracked event listener.
 */
export function removeTrackedEventListener(
  target: EventTarget,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: EventListenerOptions,
): void {
  target.removeEventListener(type, listener, options);
  if (import.meta.env?.DEV) {
    for (const [id, entry] of _eventListeners) {
      if (entry.target === target && entry.type === type && entry.listener === listener) {
        _eventListeners.delete(id);
        break;
      }
    }
  }
}

/* ===================== CLEANUP ===================== */

/**
 * Run a cleanup pass to free memory.
 * - Revokes old object URLs
 * - Removes stale event listeners (dev mode)
 * - Reports memory usage
 */
export function cleanup(): CleanupResult {
  const startTime = Date.now();
  let objectUrlsRevoked = 0;
  const staleEntriesRemoved = 0;
  let listenersRemoved = 0;

  // Revoke all tracked object URLs
  for (const [url] of _objectUrls) {
    URL.revokeObjectURL(url);
    objectUrlsRevoked++;
  }
  _objectUrls.clear();

  // Remove stale event listeners (dev mode)
  if (import.meta.env?.DEV) {
    for (const [id, entry] of _eventListeners) {
      try {
        entry.target.removeEventListener(entry.type, entry.listener);
        listenersRemoved++;
      } catch {
        // Already removed
      }
      _eventListeners.delete(id);
    }
  }

  _lastCleanup = new Date().toISOString();

  return {
    objectUrlsRevoked,
    staleEntriesRemoved,
    listenersRemoved,
    elapsedMs: Date.now() - startTime,
  };
}

/* ===================== MONITORING ===================== */

/**
 * Get current memory usage statistics.
 * Note: performance.memory is Chrome-only and may not be available.
 */
export function getMemoryStats(): MemoryStats {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;

  return {
    objectUrls: _objectUrls.size,
    abortControllers: _abortControllers.size,
    eventListeners: _eventListeners.size,
    jsHeapSizeMB: memory ? Math.round(memory.usedJSHeapSize / (1024 * 1024)) : null,
    jsHeapLimitMB: memory ? Math.round(memory.jsHeapSizeLimit / (1024 * 1024)) : null,
    lastCleanup: _lastCleanup,
  };
}

/* ===================== INITIALIZATION ===================== */

/**
 * Initialize the memory manager.
 * Sets up periodic cleanup and page unload handler.
 *
 * Call once during app startup.
 */
export function initMemoryManager(): void {
  if (_cleanupInterval !== null) {
    return; // Already initialized
  }

  // Periodic cleanup
  _cleanupInterval = setInterval(() => {
    const result = cleanup();
    if (import.meta.env?.DEV && (result.objectUrlsRevoked > 0 || result.listenersRemoved > 0)) {
      console.warn(`[Memory] Cleanup: ${result.objectUrlsRevoked} URLs revoked, ${result.listenersRemoved} listeners removed in ${result.elapsedMs}ms`);
    }
  }, CLEANUP_INTERVAL_MS);

  // Cleanup on page unload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      abortAll();
      cleanup();
    });
  }

  // Cleanup on visibility change (tab hidden)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // Light cleanup when tab is hidden
        for (const [url] of _objectUrls) {
          URL.revokeObjectURL(url);
        }
        _objectUrls.clear();
      }
    });
  }
}

/**
 * Stop the memory manager and clean up.
 * Useful for test cleanup.
 */
export function _stopMemoryManagerForTests(): void {
  if (_cleanupInterval !== null) {
    clearInterval(_cleanupInterval);
    _cleanupInterval = null;
  }
  _objectUrls.clear();
  _abortControllers.clear();
  _eventListeners.clear();
  _lastCleanup = null;
}
