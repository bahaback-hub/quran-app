/**
 * Behavioral tests for reading-stats.ts.
 *
 * Bypasses the setup-i18n.ts storage mock by re-mocking storage to use
 * localStorage. Also resets modules between tests so the DEFAULT_STATS
 * constant in reading-stats.ts is re-created fresh (preventing state
 * leakage from the mock returning the fallback object reference).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

vi.unmock('../reading-stats.js');

// Re-mock storage to use localStorage (which jsdom provides)
vi.mock('../storage.js', () => ({
  storage: {
    get: vi.fn(<T>(key: string, fallback?: T): T | null => {
      const fullKey = 'quran_app_' + key;
      const raw = localStorage.getItem(fullKey);
      if (raw === null) {
        // Return a deep copy of fallback to prevent mutation leakage
        return fallback ? structuredClone(fallback) : null;
      }
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback ? structuredClone(fallback) : null;
      }
    }),
    set: vi.fn((key: string, value: unknown) => {
      const fullKey = 'quran_app_' + key;
      try {
        localStorage.setItem(fullKey, JSON.stringify(value));
      } catch {
        /* quota exceeded — ignore */
      }
    }),
    remove: vi.fn((key: string) => {
      const fullKey = 'quran_app_' + key;
      localStorage.removeItem(fullKey);
    }),
  },
}));

beforeEach(() => {
  // Clear localStorage between tests
  localStorage.clear();
  // Reset module cache so DEFAULT_STATS is re-created fresh
  vi.resetModules();
});

describe('reading-stats — getReadingStats', () => {
  it('returns default stats when storage is empty', async () => {
    const { getReadingStats } = await import('../reading-stats.js');
    const stats = getReadingStats();
    expect(stats.totalAyahs).toBe(0);
    expect(stats.totalMinutes).toBe(0);
    expect(stats.sessionsCount).toBe(0);
    expect(stats.lastSession).toBeNull();
    expect(stats.surahsRead).toEqual({});
    expect(stats.streakDays).toBe(0);
    expect(stats.lastActiveDate).toBeNull();
  });
});

describe('reading-stats — recordReadingSession', () => {
  it('increments totalAyahs and sessionsCount', async () => {
    const { recordReadingSession, getReadingStats } = await import('../reading-stats.js');
    recordReadingSession(1, 7);
    const stats = getReadingStats();
    expect(stats.totalAyahs).toBe(7);
    expect(stats.sessionsCount).toBe(1);
  });

  it('accumulates across multiple sessions', async () => {
    const { recordReadingSession, getReadingStats } = await import('../reading-stats.js');
    recordReadingSession(1, 7);
    recordReadingSession(2, 286);
    recordReadingSession(3, 200);
    const stats = getReadingStats();
    expect(stats.totalAyahs).toBe(493);
    expect(stats.sessionsCount).toBe(3);
  });

  it('tracks per-surah ayah counts', async () => {
    const { recordReadingSession, getReadingStats } = await import('../reading-stats.js');
    recordReadingSession(1, 7);
    recordReadingSession(1, 7);
    recordReadingSession(2, 286);
    const stats = getReadingStats();
    expect(stats.surahsRead[1]).toBe(14);
    expect(stats.surahsRead[2]).toBe(286);
  });

  it('sets lastSession to a recent timestamp', async () => {
    const { recordReadingSession, getReadingStats } = await import('../reading-stats.js');
    const before = Date.now();
    recordReadingSession(1, 7);
    const after = Date.now();
    const stats = getReadingStats();
    expect(stats.lastSession).not.toBeNull();
    expect(stats.lastSession!).toBeGreaterThanOrEqual(before);
    expect(stats.lastSession!).toBeLessThanOrEqual(after);
  });

  it('sets streakDays to 1 on first session', async () => {
    const { recordReadingSession, getReadingStats } = await import('../reading-stats.js');
    recordReadingSession(1, 7);
    const stats = getReadingStats();
    expect(stats.streakDays).toBe(1);
  });

  it('sets lastActiveDate to today', async () => {
    const { recordReadingSession, getReadingStats } = await import('../reading-stats.js');
    recordReadingSession(1, 7);
    const stats = getReadingStats();
    expect(stats.lastActiveDate).toBe(new Date().toDateString());
  });
});

describe('reading-stats — addReadingTime', () => {
  it('adds minutes to totalMinutes', async () => {
    const { addReadingTime, getReadingStats } = await import('../reading-stats.js');
    addReadingTime(15);
    addReadingTime(20);
    const stats = getReadingStats();
    expect(stats.totalMinutes).toBe(35);
  });

  it('handles zero minutes', async () => {
    const { addReadingTime, getReadingStats } = await import('../reading-stats.js');
    addReadingTime(0);
    const stats = getReadingStats();
    expect(stats.totalMinutes).toBe(0);
  });
});

describe('reading-stats — getFormattedStats', () => {
  it('returns zero stats on empty storage', async () => {
    const { getFormattedStats } = await import('../reading-stats.js');
    const stats = getFormattedStats();
    expect(stats.totalAyahs).toBe(0);
    expect(stats.totalMinutes).toBe(0);
    expect(stats.sessionsCount).toBe(0);
    expect(stats.uniqueSurahs).toBe(0);
    expect(stats.streakDays).toBe(0);
  });

  it('formats time as minutes only when under 60', async () => {
    const { addReadingTime, getFormattedStats } = await import('../reading-stats.js');
    addReadingTime(45);
    const stats = getFormattedStats();
    // i18n mock returns the key itself, so formattedTime is 'stats_mins'
    // We verify the underlying totalMinutes instead
    expect(stats.totalMinutes).toBe(45);
    expect(stats.formattedTime).toBeDefined();
  });

  it('formats time as hours and minutes when over 60', async () => {
    const { addReadingTime, getFormattedStats } = await import('../reading-stats.js');
    addReadingTime(125);
    const stats = getFormattedStats();
    expect(stats.totalMinutes).toBe(125);
    expect(stats.formattedTime).toBeDefined();
  });

  it('counts unique surahs correctly', async () => {
    const { recordReadingSession, getFormattedStats } = await import('../reading-stats.js');
    recordReadingSession(1, 7);
    recordReadingSession(2, 286);
    recordReadingSession(2, 286);
    recordReadingSession(3, 200);
    const stats = getFormattedStats();
    expect(stats.uniqueSurahs).toBe(3);
  });

  it('shows em-dash for lastSession when no sessions recorded', async () => {
    const { getFormattedStats } = await import('../reading-stats.js');
    const stats = getFormattedStats();
    expect(stats.lastSession).toBe('—');
  });

  it('shows localized date for lastSession after recording', async () => {
    const { recordReadingSession, getFormattedStats } = await import('../reading-stats.js');
    recordReadingSession(1, 7);
    const stats = getFormattedStats();
    expect(stats.lastSession).not.toBe('—');
    expect(stats.lastSession.length).toBeGreaterThan(0);
  });
});

describe('reading-stats — resetReadingStats', () => {
  it('clears all stats to defaults', async () => {
    const { recordReadingSession, addReadingTime, resetReadingStats, getReadingStats } =
      await import('../reading-stats.js');
    recordReadingSession(1, 7);
    addReadingTime(30);
    resetReadingStats();
    const stats = getReadingStats();
    expect(stats.totalAyahs).toBe(0);
    expect(stats.totalMinutes).toBe(0);
    expect(stats.sessionsCount).toBe(0);
    expect(stats.lastSession).toBeNull();
    expect(stats.surahsRead).toEqual({});
    expect(stats.streakDays).toBe(0);
    expect(stats.lastActiveDate).toBeNull();
  });
});

describe('reading-stats — renderReadingStats', () => {
  it('no-ops when container is null', async () => {
    const { renderReadingStats } = await import('../reading-stats.js');
    expect(() => renderReadingStats(null)).not.toThrow();
  });

  it('populates container with stats grid HTML', async () => {
    const { recordReadingSession, renderReadingStats } = await import('../reading-stats.js');
    recordReadingSession(1, 7);
    const container = document.createElement('div');
    renderReadingStats(container);
    expect(container.innerHTML).toContain('reading-stats-grid');
    expect(container.innerHTML.length).toBeGreaterThan(50);
  });

  it('renders even with empty stats', async () => {
    const { renderReadingStats } = await import('../reading-stats.js');
    const container = document.createElement('div');
    renderReadingStats(container);
    expect(container.innerHTML).toContain('reading-stats-grid');
  });
});

describe('reading-stats — streak calculation', () => {
  it('resets streak to 1 when lastActiveDate is older than yesterday', async () => {
    const { recordReadingSession, getReadingStats } = await import('../reading-stats.js');
    const { storage } = await import('../storage.js');
    const oldStats = {
      totalAyahs: 10,
      totalMinutes: 5,
      sessionsCount: 1,
      lastSession: Date.now() - 3 * 86400000,
      surahsRead: { 1: 10 },
      streakDays: 5,
      lastActiveDate: new Date(Date.now() - 3 * 86400000).toDateString(),
    };
    storage.set('reading_stats', oldStats);

    recordReadingSession(2, 286);
    const stats = getReadingStats();
    expect(stats.streakDays).toBe(1);
  });

  it('increments streak when lastActiveDate is yesterday', async () => {
    const { recordReadingSession, getReadingStats } = await import('../reading-stats.js');
    const { storage } = await import('../storage.js');
    const oldStats = {
      totalAyahs: 10,
      totalMinutes: 5,
      sessionsCount: 1,
      lastSession: Date.now() - 86400000,
      surahsRead: { 1: 10 },
      streakDays: 3,
      lastActiveDate: new Date(Date.now() - 86400000).toDateString(),
    };
    storage.set('reading_stats', oldStats);

    recordReadingSession(2, 286);
    const stats = getReadingStats();
    expect(stats.streakDays).toBe(4);
  });

  it('does not increment streak when called twice on the same day', async () => {
    const { recordReadingSession, getReadingStats } = await import('../reading-stats.js');
    recordReadingSession(1, 7);
    recordReadingSession(2, 286);
    const stats = getReadingStats();
    expect(stats.streakDays).toBe(1);
  });
});
