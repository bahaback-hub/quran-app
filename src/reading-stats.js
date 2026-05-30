import { state } from './state.js';
import { storage } from './storage.js';

const STATS_KEY = 'reading_stats';

/** Get reading statistics from localStorage. */
export function getReadingStats() {
  return storage.get(STATS_KEY, {
    totalAyahs: 0,
    totalMinutes: 0,
    sessionsCount: 0,
    lastSession: null,
    surahsRead: {},
    streakDays: 0,
    lastActiveDate: null
  });
}

/** Save reading statistics to localStorage. */
function saveReadingStats(stats) {
  storage.set(STATS_KEY, stats);
}

/** Record a reading session. */
export function recordReadingSession(surahNum, ayahCount) {
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
export function addReadingTime(minutes) {
  const stats = getReadingStats();
  stats.totalMinutes += minutes;
  saveReadingStats(stats);
}

/** Get formatted reading statistics. */
export function getFormattedStats() {
  const stats = getReadingStats();
  const uniqueSurahs = Object.keys(stats.surahsRead).length;
  const hours = Math.floor(stats.totalMinutes / 60);
  const mins = stats.totalMinutes % 60;

  return {
    totalAyahs: stats.totalAyahs,
    totalMinutes: stats.totalMinutes,
    formattedTime: hours > 0 ? `${hours} ساعة ${mins} دقيقة` : `${mins} دقيقة`,
    sessionsCount: stats.sessionsCount,
    uniqueSurahs,
    streakDays: stats.streakDays,
    lastSession: stats.lastSession ? new Date(stats.lastSession).toLocaleDateString('ar-SA') : '—'
  };
}

/** Reset reading statistics. */
export function resetReadingStats() {
  saveReadingStats({
    totalAyahs: 0,
    totalMinutes: 0,
    sessionsCount: 0,
    lastSession: null,
    surahsRead: {},
    streakDays: 0,
    lastActiveDate: null
  });
}

/** Render reading statistics in a container. */
export function renderReadingStats(container) {
  if (!container) return;
  const stats = getFormattedStats();
  container.innerHTML = `
    <div class="reading-stats-grid">
      <div class="stat-card">
        <div class="stat-number">${stats.totalAyahs}</div>
        <div class="stat-label">آية مقروءة</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${stats.formattedTime}</div>
        <div class="stat-label">وقت القراءة</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${stats.uniqueSurahs}</div>
        <div class="stat-label">سورة مقروءة</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${stats.streakDays}</div>
        <div class="stat-label">أيام متتالية</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${stats.sessionsCount}</div>
        <div class="stat-label">جلسة قراءة</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${stats.lastSession}</div>
        <div class="stat-label">آخر قراءة</div>
      </div>
    </div>
  `;
}
