import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state } from '../state.js';

// Mock i18n — __() returns key with interpolation
vi.mock('../i18n.js', () => ({
  __: (key: string, ...args: string[]) => {
    let val = key;
    args.forEach((arg, i) => {
      val = val.replace(`{${i}}`, arg);
    });
    return val;
  },
  setLocale: vi.fn(),
  getCurrentLocale: vi.fn(() => 'ar'),
  loadLocale: vi.fn(() => Promise.resolve()),
}));

// Mock storage with a working in-memory store
const store: Record<string, string> = {};
vi.mock('../storage.js', () => ({
  storage: {
    get: vi.fn(<T>(_key: string, _default?: T): T | null => {
      const fullKey = 'quran_app_' + _key;
      const raw = store[fullKey];
      if (raw === undefined) {
        return _default ?? null;
      }
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    }),
    set: vi.fn((_key: string, val: unknown): boolean => {
      const fullKey = 'quran_app_' + _key;
      try {
        store[fullKey] = JSON.stringify(val);
        return true;
      } catch {
        return false;
      }
    }),
    remove: vi.fn((_key: string): void => {
      const fullKey = 'quran_app_' + _key;
      delete store[fullKey];
    }),
  },
}));

vi.mock('../templates.js', () => ({
  readingStatsGrid: vi.fn(() => '<div>stats</div>'),
  escapeHtml: vi.fn((s: string) => s),
}));

import {
  getReadingStats,
  recordReadingSession,
  addReadingTime,
  getFormattedStats,
  resetReadingStats,
} from '../reading-stats.js';

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
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
    // Mock __() returns key with args: 'stats_hours_mins' → 'stats_hours_mins'
    // With interpolation: 'stats_hours_mins1 30' (key + args)
    expect(stats.formattedTime).toContain('stats_hours_mins');
  });

  it('should format minutes only', () => {
    addReadingTime(30);
    const stats = getFormattedStats();
    // Mock __() returns key: 'stats_mins' with args
    expect(stats.formattedTime).toContain('stats_mins');
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
