/**
 * Splash dismissal guard.
 *
 * The Android splash used to stay up for 500ms after DOMContentLoaded plus a
 * 300ms fade, which the user felt as dead time on every cold start. These tests
 * pin the fast path: hide at DOM-ready, and never longer than the fallback.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const hide = vi.fn();

vi.mock('../types.js', () => ({
  getCapacitor: vi.fn(() => ({ Plugins: { SplashScreen: { hide } } })),
}));

import { getCapacitor } from '../types.js';
import { dismissSplashOnReady, hideNativeSplash, SPLASH_FALLBACK_MS } from '../splash.js';

describe('splash dismissal', () => {
  beforeEach(() => {
    hide.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hides the splash with a short fade when the plugin is present', () => {
    hideNativeSplash();
    expect(hide).toHaveBeenCalledTimes(1);
    // A long fade would itself be felt as launch latency.
    expect(hide.mock.calls[0][0].fadeOutDuration).toBeLessThanOrEqual(150);
  });

  it('never throws when Capacitor is unavailable', () => {
    vi.mocked(getCapacitor).mockReturnValueOnce(undefined);
    expect(() => hideNativeSplash()).not.toThrow();
  });

  it('hides immediately when the document is already parsed', () => {
    const original = Object.getOwnPropertyDescriptor(document, 'readyState');
    Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });
    try {
      dismissSplashOnReady();
      expect(hide).toHaveBeenCalledTimes(1);
    } finally {
      if (original) Object.defineProperty(document, 'readyState', original);
    }
  });

  it('waits for DOMContentLoaded instead of a fixed delay while loading', () => {
    const original = Object.getOwnPropertyDescriptor(document, 'readyState');
    Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });
    try {
      dismissSplashOnReady();
      // Nothing yet: no artificial timeout has fired.
      expect(hide).not.toHaveBeenCalled();
      document.dispatchEvent(new Event('DOMContentLoaded'));
      expect(hide).toHaveBeenCalledTimes(1);
    } finally {
      if (original) Object.defineProperty(document, 'readyState', original);
    }
  });

  it('always registers a bounded fallback so the splash cannot stick', () => {
    const original = Object.getOwnPropertyDescriptor(document, 'readyState');
    Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });
    try {
      dismissSplashOnReady();
      expect(hide).not.toHaveBeenCalled();
      vi.advanceTimersByTime(SPLASH_FALLBACK_MS);
      expect(hide).toHaveBeenCalledTimes(1);
      expect(SPLASH_FALLBACK_MS).toBeLessThanOrEqual(3000);
    } finally {
      if (original) Object.defineProperty(document, 'readyState', original);
    }
  });
});
