import { __ } from './i18n.js';
import { state } from './state.js';
import { storage } from './storage.js';

const STATS_KEY = 'reading_stats';

/** Shape of reading statistics stored in localStorage. */
interface ReadingStats {
  totalAyahs: number;
  totalMinutes: number;
  sessionsCount: number;
  lastSession: number | null;
  surahsRead: Record<number, number>;
  streakDays: number;
  lastActiveDate: string | null;
}

/** Shape of formatted reading statistics for display. */
interface FormattedStats {
  totalAyahs: number;
  totalMinutes: number;
  formattedTime: string;
  sessionsCount: number;
  uniqueSurahs: number;
  streakDays: number;
  lastSession: string;
}

const DEFAULT_STATS: ReadingStats = {
  totalAyahs: 0,
  totalMinutes: 0,
  sessionsCount: 0,
  lastSession: null,
  surahsRead: {},
  streakDays: 0,
  lastActiveDate: null,
};

/** Get reading statistics from localStorage. */
export function getReadingStats(): ReadingStats {
  return storage.get<ReadingStats>(STATS_KEY, DEFAULT_STATS) ?? DEFAULT_STATS;
}

/** Save reading statistics to localStorage. */
function saveReadingStats(stats: ReadingStats): void {
  storage.set(STATS_KEY, stats);
}

/** Record a reading session. */
export function recordReadingSession(surahNum: number, ayahCount: number): void {
  const stats = getReadingStats();
  stats.totalAyahs += ayahCount;
  stats.sessionsCount += 1;
  stats.lastSession = Date.now();

  if (!stats.surahsRead[surahNum]) {
    stats.surahsRead[surahNum] = 0;
  }
  stats.surahsRead[surahNum] += ayahCount;

  const today = new Date().toDateString();
  if (stats.lastActiveDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (stats.lastActiveDate === yesterday) {
      stats.streakDays += 1;
    } else if (stats.lastActiveDate !== today) {
      stats.streakDays = 1;
    }
    stats.lastActiveDate = today;
  }

  saveReadingStats(stats);
}

/** Add reading time in minutes. */
export function addReadingTime(minutes: number): void {
  const stats = getReadingStats();
  stats.totalMinutes += minutes;
  saveReadingStats(stats);
}

/** Get formatted reading statistics. */
export function getFormattedStats(): FormattedStats {
  const stats = getReadingStats();
  const uniqueSurahs = Object.keys(stats.surahsRead).length;
  const hours = Math.floor(stats.totalMinutes / 60);
  const mins = stats.totalMinutes % 60;

  return {
    totalAyahs: stats.totalAyahs,
    totalMinutes: stats.totalMinutes,
    formattedTime:
      hours > 0 ? `${__('stats_hours_mins', String(hours), String(mins))}` : `${__('stats_mins', String(mins))}`,
    sessionsCount: stats.sessionsCount,
    uniqueSurahs,
    streakDays: stats.streakDays,
    lastSession: stats.lastSession ? new Date(stats.lastSession).toLocaleDateString('ar-SA') : '—',
  };
}

/** Reset reading statistics. */
export function resetReadingStats(): void {
  saveReadingStats({
    totalAyahs: 0,
    totalMinutes: 0,
    sessionsCount: 0,
    lastSession: null,
    surahsRead: {},
    streakDays: 0,
    lastActiveDate: null,
  });
}

/** Render reading statistics in a container. */
export function renderReadingStats(container: HTMLElement | null): void {
  if (!container) return;
  const stats = getFormattedStats();
  container.innerHTML = `
    <div class="reading-stats-grid">
      <div class="stat-card">
        <div class="stat-number">${stats.totalAyahs}</div>
        <div class="stat-label">${__('stats_ayahs_read')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${stats.formattedTime}</div>
        <div class="stat-label">${__('stats_reading_time')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${stats.uniqueSurahs}</div>
        <div class="stat-label">${__('stats_surahs_read')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${stats.streakDays}</div>
        <div class="stat-label">${__('stats_streak_days')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${stats.sessionsCount}</div>
        <div class="stat-label">${__('stats_sessions')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${stats.lastSession}</div>
        <div class="stat-label">${__('stats_last_read')}</div>
      </div>
    </div>
  `;
}
