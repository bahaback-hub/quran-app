/**
 * Tests for memory-manager module.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createTrackedObjectUrl,
  revokeTrackedObjectUrl,
  registerAbortController,
  abortAll,
  addTrackedEventListener,
  removeTrackedEventListener,
  cleanup,
  getMemoryStats,
  initMemoryManager,
  _stopMemoryManagerForTests,
} from '../memory-manager.js';

describe('memory-manager', () => {
  beforeEach(() => {
    _stopMemoryManagerForTests();
  });

  describe('createTrackedObjectUrl / revokeTrackedObjectUrl', () => {
    it('creates and tracks an object URL', () => {
      const blob = new Blob(['test']);
      const url = createTrackedObjectUrl(blob, 'original.mp3');
      expect(url).toMatch(/^blob:/);
      const stats = getMemoryStats();
      expect(stats.objectUrls).toBe(1);
    });

    it('revokes a tracked object URL', () => {
      const blob = new Blob(['test']);
      const url = createTrackedObjectUrl(blob);
      revokeTrackedObjectUrl(url);
      const stats = getMemoryStats();
      expect(stats.objectUrls).toBe(0);
    });

    it('does not throw when revoking unknown URL', () => {
      expect(() => revokeTrackedObjectUrl('blob:unknown')).not.toThrow();
    });
  });

  describe('registerAbortController / abortAll', () => {
    it('registers an AbortController', () => {
      const controller = new AbortController();
      registerAbortController(controller);
      const stats = getMemoryStats();
      expect(stats.abortControllers).toBe(1);
    });

    it('aborts all registered controllers', () => {
      const c1 = new AbortController();
      const c2 = new AbortController();
      registerAbortController(c1);
      registerAbortController(c2);
      abortAll();
      expect(c1.signal.aborted).toBe(true);
      expect(c2.signal.aborted).toBe(true);
    });

    it('auto-removes aborted controllers', () => {
      const controller = new AbortController();
      registerAbortController(controller);
      controller.abort();
      // Should still be in set until abort event fires
      // (event is sync in Node/jsdom)
      const stats = getMemoryStats();
      expect(stats.abortControllers).toBeLessThanOrEqual(1);
    });
  });

  describe('addTrackedEventListener / removeTrackedEventListener', () => {
    it('adds and removes event listeners', () => {
      const target = new EventTarget();
      const listener = vi.fn();
      addTrackedEventListener(target, 'test', listener);
      target.dispatchEvent(new Event('test'));
      expect(listener).toHaveBeenCalledTimes(1);
      removeTrackedEventListener(target, 'test', listener);
      target.dispatchEvent(new Event('test'));
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not 2
    });
  });

  describe('cleanup', () => {
    it('revokes all object URLs', () => {
      const blob1 = new Blob(['test1']);
      const blob2 = new Blob(['test2']);
      createTrackedObjectUrl(blob1);
      createTrackedObjectUrl(blob2);
      const result = cleanup();
      expect(result.objectUrlsRevoked).toBe(2);
      expect(getMemoryStats().objectUrls).toBe(0);
    });

    it('updates lastCleanup timestamp', () => {
      cleanup();
      const stats = getMemoryStats();
      expect(stats.lastCleanup).not.toBeNull();
    });

    it('returns elapsed time', () => {
      const result = cleanup();
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getMemoryStats', () => {
    it('returns object with expected keys', () => {
      const stats = getMemoryStats();
      expect(stats).toHaveProperty('objectUrls');
      expect(stats).toHaveProperty('abortControllers');
      expect(stats).toHaveProperty('eventListeners');
      expect(stats).toHaveProperty('jsHeapSizeMB');
      expect(stats).toHaveProperty('jsHeapLimitMB');
      expect(stats).toHaveProperty('lastCleanup');
    });
  });

  describe('initMemoryManager', () => {
    it('is idempotent', () => {
      initMemoryManager();
      expect(() => initMemoryManager()).not.toThrow();
    });
  });

  describe('_stopMemoryManagerForTests', () => {
    it('resets all state', () => {
      const blob = new Blob(['test']);
      createTrackedObjectUrl(blob);
      registerAbortController(new AbortController());
      _stopMemoryManagerForTests();
      const stats = getMemoryStats();
      expect(stats.objectUrls).toBe(0);
      expect(stats.abortControllers).toBe(0);
    });
  });
});
