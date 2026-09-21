import { __ } from './i18n.js';
import { getAbsNumber } from './surah-list.js';
import { storage } from './storage.js';
import { dom } from './dom.js';
import { toArabicNumeral, escapeHtml } from './utils.js';

/**
 * Reading plans (khatma schedules): pick a completion target (7/30/60/90/180
 * or 365 days) and the app tracks your progress toward finishing the whole
 * Quran (6236 ayahs), synced automatically from the reader position.
 *
 * State persists in localStorage under `reading_plan` (prefixed by storage.ts)
 * and is intentionally a plain serializable object — no reactive proxy needed.
 */

/** Built-in plan durations. */
export interface ReadingPlanDef {
  id: string;
  days: number;
}

export const READING_PLANS: ReadingPlanDef[] = [
  { id: 'week', days: 7 },
  { id: 'month', days: 30 },
  { id: 'two_months', days: 60 },
  { id: 'three_months', days: 90 },
  { id: 'six_months', days: 180 },
  { id: 'year', days: 365 },
];

/** Total ayahs in the whole mushaf (1..6236). */
export const TOTAL_AYAHS = 6236;

/** Persisted reading plan record. */
export interface ReadingPlanRecord {
  planId: string;
  days: number;
  /** ISO date (YYYY-MM-DD) of the day the plan started. */
  startDate: string;
  /** Highest absolute ayah index (1..6236) reached so far. */
  completedAyahs: number;
}

const PLAN_KEY = 'reading_plan';
const DAY_MS = 86_400_000;

function todayISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parsePlan(raw: unknown): ReadingPlanRecord | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Partial<ReadingPlanRecord>;
  if (
    typeof r.planId !== 'string' ||
    typeof r.days !== 'number' ||
    typeof r.startDate !== 'string' ||
    typeof r.completedAyahs !== 'number'
  ) {
    return null;
  }
  return r as ReadingPlanRecord;
}

/** Current plan, or null if none is active. */
export function getPlan(): ReadingPlanRecord | null {
  return parsePlan(storage.get(PLAN_KEY));
}

/** Start (or restart) a plan identified by its id in READING_PLANS. */
export function startPlan(planId: string, today: Date = new Date()): ReadingPlanRecord {
  const def = READING_PLANS.find((p) => p.id === planId) ?? READING_PLANS[0]!;
  const plan: ReadingPlanRecord = {
    planId: def.id,
    days: def.days,
    startDate: todayISO(today),
    completedAyahs: 0,
  };
  storage.set(PLAN_KEY, plan);
  return plan;
}

/** Cancel the active plan. */
export function resetPlan(): void {
  storage.remove(PLAN_KEY);
}

/** Ayahs to read per day for a plan (always rounds up, capped at the total). */
export function ayahsPerDay(plan: Pick<ReadingPlanRecord, 'days'>): number {
  return Math.ceil(TOTAL_AYAHS / plan.days);
}

/** 1-based day of the plan we are on (clamped to [1, days]). */
export function elapsedDay(plan: ReadingPlanRecord, today: Date = new Date()): number {
  const start = Date.parse(`${plan.startDate}T00:00:00`);
  const now = today;
  now.setHours(0, 0, 0, 0);
  const elapsed = Math.floor((now.getTime() - start) / DAY_MS) + 1;
  return Math.min(Math.max(elapsed, 1), plan.days);
}

/** Everything the panel needs to render, computed purely from the record. */
export interface PlanSummary {
  days: number;
  ayahsPerDay: number;
  elapsedDay: number;
  /** Inclusive ayah range due today, e.g. 91..120. */
  dueFrom: number;
  dueTo: number;
  dailyTarget: number;
  completedAyahs: number;
  progressPercent: number;
  onTrack: boolean;
  finishedToday: boolean;
  completed: boolean;
  remaining: number;
}

/** Compute the progress summary for a plan. */
export function getPlanSummary(plan: ReadingPlanRecord, today: Date = new Date()): PlanSummary {
  const perDay = ayahsPerDay(plan);
  const elapsed = elapsedDay(plan, today);
  const dueFrom = (elapsed - 1) * perDay + 1;
  const dueTo = Math.min(elapsed * perDay, TOTAL_AYAHS);
  const completed = plan.completedAyahs >= TOTAL_AYAHS;
  const targetByToday = Math.min(elapsed * perDay, TOTAL_AYAHS);
  return {
    days: plan.days,
    ayahsPerDay: perDay,
    elapsedDay: elapsed,
    dueFrom,
    dueTo,
    dailyTarget: Math.max(0, dueTo - dueFrom + 1),
    completedAyahs: plan.completedAyahs,
    progressPercent: Math.min(100, Math.round((plan.completedAyahs / TOTAL_AYAHS) * 100)),
    onTrack: plan.completedAyahs >= targetByToday,
    finishedToday: !completed && plan.completedAyahs >= dueTo,
    completed,
    remaining: Math.max(0, TOTAL_AYAHS - plan.completedAyahs),
  };
}

/**
 * Record that the reader reached absolute ayah `ayahNumberInSurah` of `surah`.
 * Progress only ever moves forward. No-op without an active plan. Returns the
 * updated completedAyahs.
 */
export function recordReading(surah: number, ayahNumberInSurah: number): number {
  const plan = getPlan();
  if (!plan) {
    return 0;
  }
  const abs = getAbsNumber(surah, ayahNumberInSurah);
  if (abs === null) {
    return plan.completedAyahs;
  }
  if (abs > plan.completedAyahs) {
    plan.completedAyahs = abs;
    storage.set(PLAN_KEY, plan);
  }
  return plan.completedAyahs;
}

/* ===================== PANEL ===================== */

/**
 * Render the plan picker (when no plan is active) or the live progress (when
 * one is). `today` is injectable for tests.
 */
export function renderReadingPlans(today: Date = new Date()): void {
  const container = dom.readingPlanContent;
  if (!container) {
    return;
  }
  const plan = getPlan();
  if (!plan) {
    container.innerHTML =
      `<p class="reading-plan-intro">${escapeHtml(__('reading_plan_intro'))}</p>` +
      `<p class="reading-plan-label">${escapeHtml(__('reading_plan_pick'))}</p>` +
      `<div class="reading-plan-grid" id="readingPlanPicker">` +
      READING_PLANS.map((p) => {
        const label = __('reading_plan_days', toArabicNumeral(String(p.days)));
        return (
          `<button type="button" class="reading-plan-option" data-plan-id="${escapeHtml(p.id)}">` +
          `<span class="reading-plan-option-days">${escapeHtml(label)}</span>` +
          `<span class="reading-plan-option-note">${escapeHtml(__('reading_plan_whole_quran'))}</span>` +
          `</button>`
        );
      }).join('') +
      `</div>`;
    bindPicker();
    return;
  }
  const s = getPlanSummary(plan, today);
  const statusKey = s.completed ? 'reading_plan_done' : s.onTrack ? 'reading_plan_on_track' : 'reading_plan_behind';
  const todayRange = `${toArabicNumeral(String(s.dueFrom))} - ${toArabicNumeral(String(s.dueTo))}`;
  container.innerHTML =
    `<div class="reading-plan-progress-bar"><div class="reading-plan-progress-fill" style="width:${s.progressPercent}%"></div></div>` +
    `<p class="reading-plan-status ${statusKey === 'reading_plan_on_track' ? 'on-track' : statusKey === 'reading_plan_done' ? 'done' : 'behind'}">${escapeHtml(__(statusKey))}</p>` +
    `<div class="reading-stats-grid">` +
    `<div class="stat-card"><div class="stat-number">${toArabicNumeral(String(s.progressPercent))}%</div><div class="stat-label">${escapeHtml(__('reading_plan_progress'))}</div></div>` +
    `<div class="stat-card"><div class="stat-number">${toArabicNumeral(String(s.dailyTarget))}</div><div class="stat-label">${escapeHtml(__('reading_plan_today_target'))}</div></div>` +
    `<div class="stat-card"><div class="stat-number">${toArabicNumeral(String(s.remaining))}</div><div class="stat-label">${escapeHtml(__('reading_plan_remaining'))}</div></div>` +
    `</div>` +
    `<p class="reading-plan-range">${escapeHtml(__('reading_plan_day', toArabicNumeral(String(s.elapsedDay)), toArabicNumeral(String(s.days))))} — ${escapeHtml(__('reading_plan_ayahs_range', todayRange))}</p>` +
    `<div class="reading-plan-actions">` +
    `<button type="button" id="readingPlanResetBtn" class="adhkar-close reading-plan-reset">${escapeHtml(__('reading_plan_reset'))}</button>` +
    `</div>`;
  const resetBtn = document.getElementById('readingPlanResetBtn');
  resetBtn?.addEventListener('click', () => {
    resetPlan();
    renderReadingPlans(today);
  });
}

function bindPicker(): void {
  const picker = document.getElementById('readingPlanPicker');
  picker?.querySelectorAll<HTMLElement>('.reading-plan-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      startPlan(btn.dataset['planId'] as string);
      renderReadingPlans();
    });
  });
}

/** Open the reading plans panel and refresh its content. */
export function openReadingPlanPanel(): void {
  dom.readingPlanPanel?.classList.add('open');
  renderReadingPlans();
  dom.readingPlanCloseBtn?.addEventListener('click', closeReadingPlanPanel);
}

/** Close the reading plans panel. */
export function closeReadingPlanPanel(): void {
  dom.readingPlanPanel?.classList.remove('open');
}
