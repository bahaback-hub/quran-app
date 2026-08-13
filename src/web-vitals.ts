/**
 * Web Vitals Monitoring — Real User Monitoring (RUM) for Core Web Vitals.
 *
 * Collects LCP, FID/INP, CLS, FCP, TTFB from real user sessions and
 * makes them available via `getWebVitals()` for debugging or for
 * sending to an analytics endpoint.
 *
 * Uses the native PerformanceObserver API — no external dependencies.
 *
 * Usage:
 *   import { initWebVitalsMonitoring } from './web-vitals.js';
 *   initWebVitalsMonitoring();
 *   // Later:
 *   import { getWebVitals } from './web-vitals.js';
 *   console.log(getWebVitals());
 */

/* ===================== TYPES ===================== */

export interface WebVitalMetric {
  /** Metric name (LCP, FID, CLS, FCP, TTFB, INP). */
  name: string;
  /** Metric value (units vary by metric — see web.dev). */
  value: number;
  /** Metric rating: 'good' | 'needs-improvement' | 'poor'. */
  rating: 'good' | 'needs-improvement' | 'poor';
  /** Delta from previous report (for CLS which accumulates). */
  delta: number;
  /** Unique ID for the metric instance. */
  id: string;
  /** Timestamp when the metric was recorded. */
  timestamp: number;
  /** Navigation type ('navigate' | 'reload' | 'back-forward' | 'prerender'). */
  navigationType: string;
}

/* ===================== THRESHOLDS ===================== */

/** Thresholds from web.dev/vitals. */
const THRESHOLDS: Record<string, { good: number; poor: number }> = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
};

/* ===================== STATE ===================== */

const _metrics = new Map<string, WebVitalMetric>();
const _observers: PerformanceObserver[] = [];
let _initialized = false;

/* ===================== HELPERS ===================== */

/** Compute rating based on thresholds. */
function computeRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name];
  if (!threshold) {
    return 'good';
  }
  if (value <= threshold.good) {
    return 'good';
  }
  if (value <= threshold.poor) {
    return 'needs-improvement';
  }
  return 'poor';
}

/** Get navigation type from PerformanceNavigationTiming. */
function getNavigationType(): string {
  try {
    const entries = performance.getEntriesByType('navigation');
    if (entries.length > 0) {
      const navEntry = entries[0] as PerformanceNavigationTiming;
      return navEntry.type || 'navigate';
    }
  } catch {
    // PerformanceNavigationTiming may not be available
  }
  return 'navigate';
}

/* ===================== METRIC COLLECTION ===================== */

/** Record a metric. */
function recordMetric(name: string, value: number, id: string, delta: number = 0): void {
  const metric: WebVitalMetric = {
    name,
    value,
    rating: computeRating(name, value),
    delta,
    id,
    timestamp: Date.now(),
    navigationType: getNavigationType(),
  };
  _metrics.set(name, metric);

  // Log poor metrics in development
  if (metric.rating === 'poor' && import.meta.env?.DEV) {
    console.warn(`[WebVitals] Poor ${name}: ${value} (threshold: ${THRESHOLDS[name]?.poor})`);
  }
}

/** Initialize LCP observation. */
function observeLCP(): void {
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (entries.length > 0) {
        const lastEntry = entries[entries.length - 1] as PerformanceEventTiming;
        recordMetric('LCP', lastEntry.startTime, 'lcp-' + Date.now());
      }
    });
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
    _observers.push(observer);
  } catch {
    // LCP not supported
  }
}

/** Initialize CLS observation. */
function observeCLS(): void {
  try {
    let clsValue = 0;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const layoutShift = entry as PerformanceEventTiming & { hadRecentInput?: boolean; value?: number };
        if (!layoutShift.hadRecentInput) {
          clsValue += layoutShift.value || 0;
        }
      }
      recordMetric('CLS', clsValue, 'cls-' + Date.now());
    });
    observer.observe({ type: 'layout-shift', buffered: true });
    _observers.push(observer);
  } catch {
    // CLS not supported
  }
}

/** Initialize FID/INP observation. */
function observeFIDandINP(): void {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const eventTiming = entry as PerformanceEventTiming;
        const duration = eventTiming.processingStart - eventTiming.startTime;
        if (entry.entryType === 'first-input') {
          recordMetric('FID', duration, 'fid-' + Date.now());
        }
        // INP: track the longest interaction duration
        if (entry.entryType === 'event' && duration > 0) {
          const currentINP = _metrics.get('INP');
          if (!currentINP || duration > currentINP.value) {
            recordMetric('INP', duration, 'inp-' + Date.now());
          }
        }
      }
    });
    observer.observe({ type: 'first-input', buffered: true });
    try {
      observer.observe({ type: 'event', buffered: true });
    } catch {
      // Event timing not supported (older browsers)
    }
    _observers.push(observer);
  } catch {
    // FID not supported
  }
}

/** Initialize FCP and TTFB from navigation entries. */
function observeFCPandTTFB(): void {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          recordMetric('FCP', entry.startTime, 'fcp-' + Date.now());
        }
      }
    });
    observer.observe({ type: 'paint', buffered: true });
    _observers.push(observer);
  } catch {
    // Paint timing not supported
  }

  // TTFB from navigation timing
  try {
    const entries = performance.getEntriesByType('navigation');
    if (entries.length > 0) {
      const navEntry = entries[0] as PerformanceNavigationTiming;
      const ttfb = navEntry.responseStart - navEntry.requestStart;
      if (ttfb > 0) {
        recordMetric('TTFB', ttfb, 'ttfb-' + Date.now());
      }
    }
  } catch {
    // Navigation timing not supported
  }
}

/* ===================== PUBLIC API ===================== */

/**
 * Initialize Web Vitals monitoring.
 * Call once during app startup (after DOM is ready).
 *
 * In production, metrics are collected silently.
 * In development, poor metrics are logged to console.
 */
export function initWebVitalsMonitoring(): void {
  if (_initialized) {
    return;
  }
  _initialized = true;

  // Only run in browser environment
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return;
  }

  observeLCP();
  observeCLS();
  observeFIDandINP();
  observeFCPandTTFB();
}

/**
 * Get all collected Web Vitals metrics.
 * Returns a snapshot of current values.
 */
export function getWebVitals(): WebVitalMetric[] {
  return Array.from(_metrics.values());
}

/**
 * Get a specific metric by name.
 * @example
 *   const lcp = getWebVital('LCP');
 *   if (lcp) console.log(`LCP: ${lcp.value}ms (${lcp.rating})`);
 */
export function getWebVital(name: string): WebVitalMetric | undefined {
  return _metrics.get(name);
}

/**
 * Get a summary of all metrics with pass/fail status.
 * Useful for CI assertions or health checks.
 */
export function getWebVitalsSummary(): {
  total: number;
  good: number;
  needsImprovement: number;
  poor: number;
  metrics: WebVitalMetric[];
} {
  const metrics = getWebVitals();
  return {
    total: metrics.length,
    good: metrics.filter((m) => m.rating === 'good').length,
    needsImprovement: metrics.filter((m) => m.rating === 'needs-improvement').length,
    poor: metrics.filter((m) => m.rating === 'poor').length,
    metrics,
  };
}

/**
 * Disconnect all observers and reset state.
 * Useful for test cleanup.
 */
export function _resetWebVitalsForTests(): void {
  for (const observer of _observers) {
    try {
      observer.disconnect();
    } catch {
      // Already disconnected
    }
  }
  _observers.length = 0;
  _metrics.clear();
  _initialized = false;
}
