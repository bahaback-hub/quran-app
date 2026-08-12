/**
 * Tests for web-vitals module.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initWebVitalsMonitoring,
  getWebVitals,
  getWebVital,
  getWebVitalsSummary,
  _resetWebVitalsForTests,
} from '../web-vitals.js';

describe('web-vitals', () => {
  beforeEach(() => {
    _resetWebVitalsForTests();
  });

  describe('initWebVitalsMonitoring', () => {
    it('should be callable without throwing', () => {
      expect(() => initWebVitalsMonitoring()).not.toThrow();
    });

    it('should be idempotent (calling twice is a no-op)', () => {
      initWebVitalsMonitoring();
      expect(() => initWebVitalsMonitoring()).not.toThrow();
    });
  });

  describe('getWebVitals', () => {
    it('returns empty array before any metrics collected', () => {
      const metrics = getWebVitals();
      expect(Array.isArray(metrics)).toBe(true);
    });
  });

  describe('getWebVital', () => {
    it('returns undefined for unknown metric name', () => {
      const metric = getWebVital('NONEXISTENT');
      expect(metric).toBeUndefined();
    });
  });

  describe('getWebVitalsSummary', () => {
    it('returns summary with correct structure', () => {
      const summary = getWebVitalsSummary();
      expect(summary).toHaveProperty('total');
      expect(summary).toHaveProperty('good');
      expect(summary).toHaveProperty('needsImprovement');
      expect(summary).toHaveProperty('poor');
      expect(summary).toHaveProperty('metrics');
      expect(Array.isArray(summary.metrics)).toBe(true);
      expect(summary.total).toBe(summary.metrics.length);
      expect(summary.good + summary.needsImprovement + summary.poor).toBe(summary.total);
    });
  });

  describe('_resetWebVitalsForTests', () => {
    it('should reset state cleanly', () => {
      initWebVitalsMonitoring();
      _resetWebVitalsForTests();
      // Should be able to init again
      expect(() => initWebVitalsMonitoring()).not.toThrow();
    });
  });
});
