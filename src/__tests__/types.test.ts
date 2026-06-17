/**
 * Tests for types.ts — shared TypeScript types, type guards, and utilities.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  isSurahData,
  isPrayerTimes,
  hasKeys,
  getCapacitor,
  isCapacitorNative,
  getFullscreenElement,
  isFullscreen,
} from '../types.js';

describe('isSurahData', () => {
  it('should return true for valid SurahData', () => {
    const data = { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', ayahs: [] };
    expect(isSurahData(data)).toBe(true);
  });

  it('should return true for SurahData with optional fields', () => {
    const data = { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', ayahs: [], numberOfAyahs: 7 };
    expect(isSurahData(data)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isSurahData(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isSurahData(undefined)).toBe(false);
  });

  it('should return false for primitive', () => {
    expect(isSurahData(42)).toBe(false);
  });

  it('should return false for missing ayahs', () => {
    expect(isSurahData({ number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha' })).toBe(false);
  });

  it('should return false for non-array ayahs', () => {
    expect(isSurahData({ number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', ayahs: {} })).toBe(false);
  });
});

describe('isPrayerTimes', () => {
  it('should return true for valid PrayerTimes', () => {
    const times = { Fajr: '04:30', Sunrise: '06:00', Dhuhr: '12:00', Asr: '15:30', Maghrib: '18:30', Isha: '20:00' };
    expect(isPrayerTimes(times)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isPrayerTimes(null)).toBe(false);
  });

  it('should return false for missing Fajr', () => {
    expect(isPrayerTimes({ Maghrib: '18:30' })).toBe(false);
  });

  it('should return false for missing Maghrib', () => {
    expect(isPrayerTimes({ Fajr: '04:30' })).toBe(false);
  });

  it('should return false for non-string values', () => {
    expect(isPrayerTimes({ Fajr: 430, Maghrib: 1830 })).toBe(false);
  });
});

describe('hasKeys', () => {
  it('should return true when all keys exist', () => {
    expect(hasKeys({ a: 1, b: 2 }, 'a', 'b')).toBe(true);
  });

  it('should return false when a key is missing', () => {
    expect(hasKeys({ a: 1 }, 'a', 'b')).toBe(false);
  });

  it('should return true for empty key list', () => {
    expect(hasKeys({ a: 1 })).toBe(true);
  });

  it('should return false for null', () => {
    expect(hasKeys(null, 'a')).toBe(false);
  });

  it('should return false for primitive', () => {
    expect(hasKeys(42, 'a')).toBe(false);
  });

  it('should work with arrays (objects with numeric keys)', () => {
    expect(hasKeys([1, 2, 3], '0', 'length')).toBe(true);
  });
});

describe('getCapacitor', () => {
  it('should return undefined when Capacitor is not available', () => {
    expect(getCapacitor()).toBeUndefined();
  });
});

describe('isCapacitorNative', () => {
  it('should return false when Capacitor is not available', () => {
    expect(isCapacitorNative()).toBe(false);
  });
});

describe('getFullscreenElement', () => {
  it('should return null when no element is fullscreen', () => {
    expect(getFullscreenElement()).toBeNull();
  });
});

describe('isFullscreen', () => {
  it('should return false when not in fullscreen', () => {
    expect(isFullscreen()).toBe(false);
  });
});
