/**
 * Additional tests for types.ts — covering low-coverage functions.
 * Targets: requestFullscreen, exitFullscreen, getCapacitor (with Capacitor global),
 * isCapacitorNative (with Capacitor available), and additional branch coverage.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isSurahData,
  isPrayerTimes,
  hasKeys,
  getCapacitor,
  isCapacitorNative,
  getFullscreenElement,
  requestFullscreen,
  exitFullscreen,
  isFullscreen,
} from '../types.js';

describe('requestFullscreen', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call element.requestFullscreen when available', async () => {
    const el = document.createElement('div');
    const requestFsSpy = vi.fn().mockResolvedValue(undefined);
    el.requestFullscreen = requestFsSpy;

    await requestFullscreen(el);
    expect(requestFsSpy).toHaveBeenCalled();
  });

  it('should call webkitRequestFullscreen when requestFullscreen not available', async () => {
    const el = document.createElement('div');
    // Remove requestFullscreen to simulate Safari
    delete (el as unknown as Record<string, unknown>).requestFullscreen;
    const webkitSpy = vi.fn().mockResolvedValue(undefined);
    (el as unknown as Record<string, unknown>).webkitRequestFullscreen = webkitSpy;

    await requestFullscreen(el);
    expect(webkitSpy).toHaveBeenCalled();
  });

  it('should throw when neither fullscreen API is available', async () => {
    const el = document.createElement('div');
    delete (el as unknown as Record<string, unknown>).requestFullscreen;

    await expect(requestFullscreen(el)).rejects.toThrow('Fullscreen API not supported');
  });
});

describe('exitFullscreen', () => {
  afterEach(() => {
    // Clean up any modifications to document
    delete (document as unknown as Record<string, unknown>).webkitExitFullscreen;
    vi.restoreAllMocks();
  });

  it('should call document.exitFullscreen when available', async () => {
    const exitFsSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, 'exitFullscreen', {
      value: exitFsSpy,
      configurable: true,
      writable: true,
    });

    await exitFullscreen();
    expect(exitFsSpy).toHaveBeenCalled();
  });

  it('should call webkitExitFullscreen when exitFullscreen not available', async () => {
    // Set exitFullscreen to undefined to simulate Safari
    Object.defineProperty(document, 'exitFullscreen', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    const webkitExitSpy = vi.fn().mockResolvedValue(undefined);
    (document as unknown as Record<string, unknown>).webkitExitFullscreen = webkitExitSpy;

    await exitFullscreen();
    expect(webkitExitSpy).toHaveBeenCalled();
  });

  it('should throw when neither exitFullscreen API is available', async () => {
    Object.defineProperty(document, 'exitFullscreen', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    delete (document as unknown as Record<string, unknown>).webkitExitFullscreen;

    await expect(exitFullscreen()).rejects.toThrow('Fullscreen API not supported');
  });
});

describe('getFullscreenElement — with webkit', () => {
  afterEach(() => {
    delete (document as unknown as Record<string, unknown>).webkitFullscreenElement;
    vi.restoreAllMocks();
  });

  it('should return webkitFullscreenElement when fullscreenElement is null', () => {
    const fakeElement = document.createElement('div');
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      configurable: true,
    });
    (document as unknown as Record<string, unknown>).webkitFullscreenElement = fakeElement;

    expect(getFullscreenElement()).toBe(fakeElement);
  });

  it('should return null when neither fullscreen element is set', () => {
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      configurable: true,
    });
    expect(getFullscreenElement()).toBeNull();
  });

  it('should return the standard fullscreenElement when set', () => {
    const fakeElement = document.createElement('div');
    Object.defineProperty(document, 'fullscreenElement', {
      value: fakeElement,
      configurable: true,
    });

    expect(getFullscreenElement()).toBe(fakeElement);
  });
});

describe('isFullscreen — with element', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return true when an element is fullscreen', () => {
    const fakeElement = document.createElement('div');
    Object.defineProperty(document, 'fullscreenElement', {
      value: fakeElement,
      configurable: true,
    });

    expect(isFullscreen()).toBe(true);
  });
});

describe('getCapacitor — with Capacitor global', () => {
  afterEach(() => {
    // Clean up Capacitor globals
    delete (globalThis as unknown as Record<string, unknown>).Capacitor;
  });

  it('should return Capacitor from globalThis when available', () => {
    const mockCapacitor = { isNative: true };
    (globalThis as unknown as Record<string, unknown>).Capacitor = mockCapacitor;

    expect(getCapacitor()).toBe(mockCapacitor);
  });

  it('should return undefined when Capacitor is not available anywhere', () => {
    delete (globalThis as unknown as Record<string, unknown>).Capacitor;
    expect(getCapacitor()).toBeUndefined();
  });

  it('should find Capacitor on globalThis (which includes window in jsdom)', () => {
    const mockCapacitor = { isNative: true, isNativePlatform: vi.fn().mockReturnValue(true) };
    (globalThis as unknown as Record<string, unknown>).Capacitor = mockCapacitor;

    const result = getCapacitor();
    expect(result).toBeDefined();
    expect(result).toBe(mockCapacitor);
  });
});

describe('isCapacitorNative — with Capacitor', () => {
  afterEach(() => {
    delete (globalThis as unknown as Record<string, unknown>).Capacitor;
  });

  it('should return true when isNativePlatform returns true', () => {
    const mockCapacitor = { isNativePlatform: vi.fn().mockReturnValue(true) };
    (globalThis as unknown as Record<string, unknown>).Capacitor = mockCapacitor;

    expect(isCapacitorNative()).toBe(true);
    expect(mockCapacitor.isNativePlatform).toHaveBeenCalled();
  });

  it('should return false when isNativePlatform returns false', () => {
    const mockCapacitor = { isNativePlatform: vi.fn().mockReturnValue(false) };
    (globalThis as unknown as Record<string, unknown>).Capacitor = mockCapacitor;

    expect(isCapacitorNative()).toBe(false);
  });

  it('should fall back to isNative flag when isNativePlatform is not a function', () => {
    const mockCapacitor = { isNative: true, isNativePlatform: undefined };
    (globalThis as unknown as Record<string, unknown>).Capacitor = mockCapacitor;

    expect(isCapacitorNative()).toBe(true);
  });

  it('should return false when isNative is false', () => {
    const mockCapacitor = { isNative: false };
    (globalThis as unknown as Record<string, unknown>).Capacitor = mockCapacitor;

    expect(isCapacitorNative()).toBe(false);
  });

  it('should return false when Capacitor is not available', () => {
    delete (globalThis as unknown as Record<string, unknown>).Capacitor;
    expect(isCapacitorNative()).toBe(false);
  });
});

describe('hasKeys — additional branches', () => {
  it('should return false for undefined', () => {
    expect(hasKeys(undefined, 'a')).toBe(false);
  });

  it('should handle objects with inherited properties', () => {
    const parent = { inherited: true };
    const child = Object.create(parent);
    child.own = true;

    expect(hasKeys(child, 'own')).toBe(true);
    expect(hasKeys(child, 'inherited')).toBe(true); // 'in' checks prototype chain
  });

  it('should work with a single key', () => {
    expect(hasKeys({ x: 1 }, 'x')).toBe(true);
    expect(hasKeys({ x: 1 }, 'y')).toBe(false);
  });
});

describe('isSurahData — additional branches', () => {
  it('should return false when number is not a number', () => {
    expect(isSurahData({ number: '1', name: 'test', englishName: 'Test', ayahs: [] })).toBe(false);
  });

  it('should return false when name is not a string', () => {
    expect(isSurahData({ number: 1, name: 123, englishName: 'Test', ayahs: [] })).toBe(false);
  });

  it('should return false when englishName is not a string', () => {
    expect(isSurahData({ number: 1, name: 'test', englishName: 123, ayahs: [] })).toBe(false);
  });

  it('should return false for empty object', () => {
    expect(isSurahData({})).toBe(false);
  });

  it('should return false for string', () => {
    expect(isSurahData('not an object')).toBe(false);
  });
});

describe('isPrayerTimes — additional branches', () => {
  it('should return false for undefined', () => {
    expect(isPrayerTimes(undefined)).toBe(false);
  });

  it('should return false for string', () => {
    expect(isPrayerTimes('not an object')).toBe(false);
  });

  it('should return false for number', () => {
    expect(isPrayerTimes(42)).toBe(false);
  });

  it('should return true with only Fajr and Maghrib', () => {
    expect(isPrayerTimes({ Fajr: '04:30', Maghrib: '18:30' })).toBe(true);
  });
});
