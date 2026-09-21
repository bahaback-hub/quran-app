/**
 * Behavioral tests for reading-plans.ts — khatma scheduling.
 *
 * Covers plan CRUD, day math, progress summaries, and auto-tracking from
 * (surah, ayah) positions without ever touching the network.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.unmock('../reading-plans.js');
vi.unmock('../surah-list.js');
vi.unmock('../storage.js');

vi.mock('../i18n.js', () => ({
  __: (key: string, ..._args: string[]) => key,
  setLocale: vi.fn(),
  getCurrentLocale: vi.fn(() => 'ar'),
  loadLocale: vi.fn(() => Promise.resolve()),
  getReciterName: (key: string) => key,
}));

import { state, resetState } from '../state.js';
import { storage } from '../storage.js';
import { dom } from '../dom.js';
import {
  READING_PLANS,
  TOTAL_AYAHS,
  startPlan,
  resetPlan,
  getPlan,
  ayahsPerDay,
  elapsedDay,
  getPlanSummary,
  recordReading,
  renderReadingPlans,
  openReadingPlanPanel,
  closeReadingPlanPanel,
} from '../reading-plans.js';

const FIXTURE = [
  { number: 1, name: 'x1', englishName: 'X1', numberOfAyahs: 7 },
  { number: 2, name: 'x2', englishName: 'X2', numberOfAyahs: 286 },
];

function seedSurahList(): void {
  state.surahList = FIXTURE.map((s) => ({ ...s }));
}

const T0 = new Date('2026-01-01T12:00:00');
const T1 = new Date('2026-01-02T08:00:00');

describe('reading-plans — core math', () => {
  beforeEach(() => {
    resetState();
    localStorage.clear();
    seedSurahList();
  });

  it('exposes six built-in plan durations', () => {
    expect(READING_PLANS.map((p) => p.days)).toEqual([7, 30, 60, 90, 180, 365]);
  });

  it('starts a plan and persists it, resetting any progress', () => {
    expect(getPlan()).toBeNull();
    const plan = startPlan('month', T0);
    expect(plan.days).toBe(30);
    expect(plan.completedAyahs).toBe(0);
    expect(plan.startDate).toBe('2026-01-01');
    expect(getPlan()).toEqual(plan);
  });

  it('falls back to the first plan for an unknown id', () => {
    const plan = startPlan('nope', T0);
    expect(plan.days).toBe(7);
  });

  it('computes ayahs per day, always rounding up', () => {
    expect(ayahsPerDay({ days: 30 })).toBe(Math.ceil(TOTAL_AYAHS / 30));
    expect(ayahsPerDay({ days: 365 })).toBe(Math.ceil(TOTAL_AYAHS / 365));
  });

  it('clamps elapsed day to [1, days]', () => {
    const plan = startPlan('month', T0);
    expect(elapsedDay(plan, T0)).toBe(1);
    expect(elapsedDay(plan, T1)).toBe(2);
    const late = new Date('2026-12-01T12:00:00');
    expect(elapsedDay(plan, late)).toBe(30);
  });

  it('derives today range and tracking status from progress', () => {
    const plan = startPlan('month', T0);
    const s = getPlanSummary(plan, T0);
    expect(s.ayahsPerDay).toBe(Math.ceil(TOTAL_AYAHS / 30));
    expect(s.dueFrom).toBe(1);
    expect(s.dueTo).toBe(s.ayahsPerDay);
    expect(s.dailyTarget).toBe(s.ayahsPerDay);
    expect(s.onTrack).toBe(false);
    expect(s.finishedToday).toBe(false);
    expect(s.completed).toBe(false);
    expect(s.remaining).toBe(TOTAL_AYAHS);

    plan.completedAyahs = s.dueTo;
    const s2 = getPlanSummary(plan, T0);
    expect(s2.onTrack).toBe(true);
    expect(s2.finishedToday).toBe(true);
    expect(s2.progressPercent).toBe(Math.round((s.dueTo / TOTAL_AYAHS) * 100));
  });

  it('caps progress percent and marks a finished plan complete', () => {
    const plan = startPlan('week', T0);
    const perDay = ayahsPerDay(plan);
    plan.completedAyahs = TOTAL_AYAHS;
    const s = getPlanSummary(plan, T0);
    expect(s.completed).toBe(true);
    expect(s.progressPercent).toBe(100);
    expect(s.remaining).toBe(0);
    expect(s.dailyTarget).toBe(perDay);
  });

  it('is behind when progress lags the day target', () => {
    const plan = startPlan('month', T0);
    plan.completedAyahs = 1;
    const s = getPlanSummary(plan, T0);
    expect(s.onTrack).toBe(false);
  });
});

describe('reading-plans — progress tracking', () => {
  beforeEach(() => {
    resetState();
    localStorage.clear();
    seedSurahList();
    startPlan('month', T0);
  });

  it('records the absolute ayah reached', () => {
    expect(recordReading(1, 3)).toBe(3);
    expect(getPlan()!.completedAyahs).toBe(3);
  });

  it('never regresses when reading earlier ayahs', () => {
    recordReading(1, 7);
    expect(recordReading(1, 2)).toBe(7);
  });

  it('crosses surah boundaries using absolute numbering', () => {
    recordReading(2, 1);
    expect(getPlan()!.completedAyahs).toBe(8);
  });

  it('is a no-op without an active plan', () => {
    resetPlan();
    expect(recordReading(1, 5)).toBe(0);
  });
});

describe('reading-plans — persistence robustness', () => {
  beforeEach(() => {
    resetState();
    localStorage.clear();
  });

  it('returns null for corrupted records', () => {
    storage.set('reading_plan', { foo: 1 });
    expect(getPlan()).toBeNull();
  });

  it('removes the plan on reset', () => {
    startPlan('month', T0);
    resetPlan();
    expect(getPlan()).toBeNull();
  });
});

describe('reading-plans — panel rendering', () => {
  beforeEach(() => {
    resetState();
    localStorage.clear();
    seedSurahList();
    dom.readingPlanContent = document.createElement('div');
    dom.readingPlanPanel = document.createElement('section');
  });

  it('renders the plan picker when no plan is active', () => {
    renderReadingPlans(T0);
    expect(dom.readingPlanContent!.querySelectorAll('.reading-plan-option')).toHaveLength(6);
  });

  it('renders progress once a plan is active', () => {
    startPlan('month', T0);
    renderReadingPlans(T0);
    expect(dom.readingPlanContent!.querySelector('.reading-plan-progress-bar')).not.toBeNull();
    expect(dom.readingPlanContent!.querySelector('.stat-card')).not.toBeNull();
  });

  it('re-renders the picker after canceling the plan', () => {
    startPlan('month', T0);
    renderReadingPlans(T0);
    resetPlan();
    renderReadingPlans(T0);
    expect(dom.readingPlanContent!.querySelectorAll('.reading-plan-option')).toHaveLength(6);
  });

  it('opens and closes the panel', () => {
    openReadingPlanPanel();
    expect(dom.readingPlanPanel!.classList.contains('open')).toBe(true);
    closeReadingPlanPanel();
    expect(dom.readingPlanPanel!.classList.contains('open')).toBe(false);
  });
});
