import { describe, it, expect, beforeEach } from 'vitest';
import {
  getReadingStats,
  recordReadingSession,
  addReadingTime,
  getFormattedStats,
  resetReadingStats,
} from '../reading-stats.js';

beforeEach(() => {
  const store = {};
  globalThis.localStorage = {
    getItem: (key) => (store[key] === undefined ? null : store[key]),
    setItem: (key, val) => {
      store[key] = String(val);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
  };
  resetReadingStats();
});

describe('getReadingStats', () => {
  it('should return default stats', () => {
    const stats = getReadingStats();
    expect(stats.totalAyahs).toBe(0);
    expect(stats.totalMinutes).toBe(0);
    expect(stats.sessionsCount).toBe(0);
    expect(stats.streakDays).toBe(0);
  });
});

describe('recordReadingSession', () => {
  it('should increment totalAyahs', () => {
    recordReadingSession(1, 7);
    const stats = getReadingStats();
    expect(stats.totalAyahs).toBe(7);
  });

  it('should increment sessionsCount', () => {
    recordReadingSession(1, 7);
    recordReadingSession(2, 286);
    const stats = getReadingStats();
    expect(stats.sessionsCount).toBe(2);
  });

  it('should track surahs read', () => {
    recordReadingSession(1, 7);
    recordReadingSession(2, 10);
    const stats = getReadingStats();
    expect(stats.surahsRead[1]).toBe(7);
    expect(stats.surahsRead[2]).toBe(10);
  });
});

describe('addReadingTime', () => {
  it('should add minutes', () => {
    addReadingTime(5);
    addReadingTime(10);
    const stats = getReadingStats();
    expect(stats.totalMinutes).toBe(15);
  });
});

describe('getFormattedStats', () => {
  it('should format time correctly', () => {
    addReadingTime(90);
    const stats = getFormattedStats();
    expect(stats.formattedTime).toContain('ساعة');
  });

  it('should format minutes only', () => {
    addReadingTime(30);
    const stats = getFormattedStats();
    expect(stats.formattedTime).toContain('دقيقة');
  });

  it('should count unique surahs', () => {
    recordReadingSession(1, 7);
    recordReadingSession(2, 10);
    recordReadingSession(1, 7);
    const stats = getFormattedStats();
    expect(stats.uniqueSurahs).toBe(2);
  });
});

describe('resetReadingStats', () => {
  it('should reset all stats to zero', () => {
    recordReadingSession(1, 7);
    addReadingTime(5);
    resetReadingStats();
    const stats = getReadingStats();
    expect(stats.totalAyahs).toBe(0);
    expect(stats.totalMinutes).toBe(0);
    expect(stats.sessionsCount).toBe(0);
  });
});
