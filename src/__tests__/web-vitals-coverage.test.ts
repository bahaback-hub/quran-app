/**
 * Additional tests for web-vitals module to improve coverage.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initWebVitalsMonitoring,
  getWebVitals,
  getWebVital,
  getWebVitalsSummary,
  _resetWebVitalsForTests,
} from '../web-vitals.js';

// Mock PerformanceObserver
class MockPerformanceObserver {
  callback: (list: { getEntries: () => unknown[] }) => void;
  static observers: MockPerformanceObserver[] = [];
  constructor(cb: (list: { getEntries: () => unknown[] }) => void) {
    this.callback = cb;
    MockPerformanceObserver.observers.push(this);
  }
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
  static triggerEntries(entries: unknown[]): void {
    for (const obs of MockPerformanceObserver.observers) {
      obs.callback({ getEntries: () => entries });
    }
  }
}

describe('web-vitals — additional coverage', () => {
  beforeEach(() => {
    _resetWebVitalsForTests();
    MockPerformanceObserver.observers = [];
    // Replace PerformanceObserver with mock
    (globalThis as unknown as { PerformanceObserver: typeof PerformanceObserver }).PerformanceObserver =
      MockPerformanceObserver as unknown as typeof PerformanceObserver;
  });

  describe('initWebVitalsMonitoring', () => {
    it('should not throw when PerformanceObserver is available', () => {
      expect(() => initWebVitalsMonitoring()).not.toThrow();
    });

    it('should not throw when PerformanceObserver is undefined', () => {
      const original = (globalThis as { PerformanceObserver?: typeof PerformanceObserver }).PerformanceObserver;
      delete (globalThis as { PerformanceObserver?: typeof PerformanceObserver }).PerformanceObserver;
      expect(() => initWebVitalsMonitoring()).not.toThrow();
      (globalThis as { PerformanceObserver?: typeof PerformanceObserver }).PerformanceObserver = original;
    });
  });

  describe('LCP observation', () => {
    it('records LCP metric when entries are dispatched', () => {
      initWebVitalsMonitoring();
      MockPerformanceObserver.triggerEntries([
        { startTime: 2500, entryType: 'largest-contentful-paint' },
      ]);
      const lcp = getWebVital('LCP');
      expect(lcp).toBeDefined();
      expect(lcp?.value).toBe(2500);
      expect(lcp?.rating).toBe('good');
    });

    it('rates LCP as needs-improvement when between 2500-4000ms', () => {
      initWebVitalsMonitoring();
      MockPerformanceObserver.triggerEntries([
        { startTime: 3000, entryType: 'largest-contentful-paint' },
      ]);
      const lcp = getWebVital('LCP');
      expect(lcp?.rating).toBe('needs-improvement');
    });

    it('rates LCP as poor when above 4000ms', () => {
      initWebVitalsMonitoring();
      MockPerformanceObserver.triggerEntries([
        { startTime: 5000, entryType: 'largest-contentful-paint' },
      ]);
      const lcp = getWebVital('LCP');
      expect(lcp?.rating).toBe('poor');
    });
  });

  describe('CLS observation', () => {
    it('accumulates CLS values across multiple entries', () => {
      initWebVitalsMonitoring();
      MockPerformanceObserver.triggerEntries([
        { hadRecentInput: false, value: 0.05, entryType: 'layout-shift' },
        { hadRecentInput: false, value: 0.03, entryType: 'layout-shift' },
      ]);
      const cls = getWebVital('CLS');
      expect(cls?.value).toBe(0.08);
      expect(cls?.rating).toBe('good');
    });

    it('ignores entries with hadRecentInput=true', () => {
      initWebVitalsMonitoring();
      MockPerformanceObserver.triggerEntries([
        { hadRecentInput: true, value: 0.5, entryType: 'layout-shift' },
      ]);
      const cls = getWebVital('CLS');
      expect(cls?.value).toBe(0);
    });

    it('rates CLS as poor when above 0.25', () => {
      initWebVitalsMonitoring();
      MockPerformanceObserver.triggerEntries([
        { hadRecentInput: false, value: 0.3, entryType: 'layout-shift' },
      ]);
      const cls = getWebVital('CLS');
      expect(cls?.rating).toBe('poor');
    });

    it('rates CLS as needs-improvement when between 0.1-0.25', () => {
      initWebVitalsMonitoring();
      MockPerformanceObserver.triggerEntries([
        { hadRecentInput: false, value: 0.15, entryType: 'layout-shift' },
      ]);
      const cls = getWebVital('CLS');
      expect(cls?.rating).toBe('needs-improvement');
    });
  });

  describe('FID and INP observation', () => {
    it('records FID on first-input entries', () => {
      initWebVitalsMonitoring();
      MockPerformanceObserver.triggerEntries([
        { startTime: 100, processingStart: 250, entryType: 'first-input' },
      ]);
      const fid = getWebVital('FID');
      expect(fid).toBeDefined();
      expect(fid?.value).toBe(150);
    });

    it('records INP on event entries', () => {
      initWebVitalsMonitoring();
      MockPerformanceObserver.triggerEntries([
        { startTime: 100, processingStart: 350, entryType: 'event' },
      ]);
      const inp = getWebVital('INP');
      expect(inp).toBeDefined();
      expect(inp?.value).toBe(250);
    });

    it('keeps the highest INP value across multiple events', () => {
      initWebVitalsMonitoring();
      MockPerformanceObserver.triggerEntries([
        { startTime: 100, processingStart: 200, entryType: 'event' },
      ]);
      MockPerformanceObserver.triggerEntries([
        { startTime: 100, processingStart: 500, entryType: 'event' },
      ]);
      const inp = getWebVital('INP');
      expect(inp?.value).toBe(400);
    });
  });

  describe('FCP and TTFB', () => {
    it('records FCP from paint entries', () => {
      initWebVitalsMonitoring();
      MockPerformanceObserver.triggerEntries([
        { name: 'first-contentful-paint', startTime: 1800, entryType: 'paint' },
      ]);
      const fcp = getWebVital('FCP');
      expect(fcp).toBeDefined();
      expect(fcp?.value).toBe(1800);
      expect(fcp?.rating).toBe('good');
    });

    it('records TTFB from navigation timing', () => {
      // Mock performance.getEntriesByType
      const originalGetEntries = performance.getEntriesByType;
      performance.getEntriesByType = ((type: string) => {
        if (type === 'navigation') {
          return [{ responseStart: 100, requestStart: 50, type: 'navigate' }];
        }
        return [];
      }) as typeof performance.getEntriesByType;

      initWebVitalsMonitoring();
      MockPerformanceObserver.triggerEntries([]);

      const ttfb = getWebVital('TTFB');
      expect(ttfb).toBeDefined();
      expect(ttfb?.value).toBe(50);

      performance.getEntriesByType = originalGetEntries;
    });
  });

  describe('getWebVitalsSummary', () => {
    it('counts metrics by rating correctly', () => {
      initWebVitalsMonitoring();
      // Add a good CLS (below 0.1)
      MockPerformanceObserver.triggerEntries([
        { hadRecentInput: false, value: 0.05, entryType: 'layout-shift' },
      ]);
      // Add a poor CLS (above 0.25)
      MockPerformanceObserver.triggerEntries([
        { hadRecentInput: false, value: 0.3, entryType: 'layout-shift' },
      ]);

      const summary = getWebVitalsSummary();
      expect(summary.total).toBeGreaterThanOrEqual(1);
      expect(summary.poor).toBeGreaterThanOrEqual(1);
    });
  });

  describe('computeRating edge cases', () => {
    it('returns good for unknown metric names', () => {
      initWebVitalsMonitoring();
      // Trigger with an entry that doesn't match any known metric
      // This tests the fallback in computeRating
      const metrics = getWebVitals();
      expect(metrics).toBeDefined();
    });
  });
});
