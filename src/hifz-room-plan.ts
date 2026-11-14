/**
 * Hifz Room plan model — plan shape, normalization, persistence, and ayah
 * lookup. Extracted from hifz-room.ts so the controller focuses on DOM
 * orchestration while plan data handling lives in one cohesive module.
 */

import { __ } from './i18n.js';
import { state } from './state.js';
import { storage } from './storage.js';
import { RECITERS } from './reciters.js';

const PLAN_STORAGE_KEY = 'hifz_plan_v1';
const DOWNLOAD_STORAGE_KEY = 'hifz_session_downloads_v1';

export const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5];

export type ReviewChoice = 'today' | 'tomorrow' | 'later' | 'custom';

export interface HifzPlan {
  version: 1;
  surah: number;
  from: number;
  to: number;
  times: number;
  review: ReviewChoice;
  reviewAt?: string;
  reciter: string;
  speed: number;
  updatedAt: number;
}

export interface SessionDownloadRecord {
  urls: string[];
  downloadedAt: number;
}

export function label(key: string, ...args: string[]): string {
  return __(key, ...args);
}

export function getAyahCount(surah: number): number {
  if (state.currentSurah === surah && state.surahData?.ayahs.length) {
    return state.surahData.ayahs.length;
  }
  return state.surahList.find((item) => item.number === surah)?.numberOfAyahs || 1;
}

export function getCurrentAyah(): number {
  return state.surahData?.ayahs[state.currentAyahIndex]?.numberInSurah || Math.max(1, state.currentAyahIndex + 1);
}

export function getSurahName(surah: number): string {
  const item = state.surahList.find((entry) => entry.number === surah);
  const isArabicInterface = document.documentElement.lang === 'ar' || !document.documentElement.lang;
  const storedName = isArabicInterface ? item?.name : item?.englishName || item?.name;
  if (storedName) {
    return storedName;
  }
  if (state.currentSurah === surah && state.surahData?.name) {
    return state.surahData.name;
  }
  const mainOption = (document.getElementById('surahSelect') as HTMLSelectElement | null)?.querySelector(
    `option[value="${surah}"]`,
  );
  return mainOption?.textContent?.replace(/^\d+\.\s*/, '') || String(surah);
}

export function normalizeRepeatCount(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(1, Math.trunc(value))) : 5;
}

export function normalizeReviewAt(value?: string): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? value : undefined;
}

export function normalizePlan(
  candidate: Omit<HifzPlan, 'updatedAt' | 'reciter' | 'speed'> &
    Partial<Pick<HifzPlan, 'updatedAt' | 'reciter' | 'speed'>>,
): HifzPlan {
  const surah = Math.min(Math.max(1, candidate.surah), 114);
  const count = getAyahCount(surah);
  const from = Math.min(Math.max(1, candidate.from), count);
  const to = Math.min(Math.max(from, candidate.to), count);
  const reviewAt = normalizeReviewAt(candidate.reviewAt);
  return {
    version: 1,
    surah,
    from,
    to,
    times: normalizeRepeatCount(candidate.times),
    review: reviewAt
      ? 'custom'
      : candidate.review === 'tomorrow' || candidate.review === 'later'
        ? candidate.review
        : 'today',
    reviewAt,
    reciter: RECITERS.some((reciter) => reciter.id === candidate.reciter) ? candidate.reciter! : state.currentReciter,
    speed: PLAYBACK_SPEEDS.includes(candidate.speed || 1) ? candidate.speed || 1 : 1,
    updatedAt: candidate.updatedAt || Date.now(),
  };
}

export function getDefaultPlan(): HifzPlan {
  const stored = storage.get<HifzPlan>(PLAN_STORAGE_KEY);
  if (
    stored?.version === 1 &&
    Number.isInteger(stored.surah) &&
    Number.isInteger(stored.from) &&
    Number.isInteger(stored.to)
  ) {
    return normalizePlan(stored);
  }
  const from = getCurrentAyah();
  const savedSpeed = parseFloat(storage.get<string>('playback_speed') || '1');
  return normalizePlan({
    version: 1,
    surah: state.currentSurah || 1,
    from,
    to: from + 4,
    times: 5,
    review: 'today',
    reciter: state.currentReciter,
    speed: PLAYBACK_SPEEDS.includes(savedSpeed) ? savedSpeed : 1,
  });
}

export function savePlan(plan: HifzPlan): void {
  storage.set(PLAN_STORAGE_KEY, { ...plan, updatedAt: Date.now() });
}

function sessionDownloadKey(plan: HifzPlan): string {
  return `${plan.surah}:${plan.from}:${plan.to}:${plan.reciter}`;
}

export function getSavedSessionDownload(plan: HifzPlan): SessionDownloadRecord | null {
  const records = storage.get<Record<string, SessionDownloadRecord>>(DOWNLOAD_STORAGE_KEY);
  const record = records?.[sessionDownloadKey(plan)];
  return record && Array.isArray(record.urls) && record.urls.length === plan.to - plan.from + 1 ? record : null;
}

export function saveSessionDownload(plan: HifzPlan, urls: string[]): void {
  const records = storage.get<Record<string, SessionDownloadRecord>>(DOWNLOAD_STORAGE_KEY) || {};
  records[sessionDownloadKey(plan)] = { urls, downloadedAt: Date.now() };
  storage.set(DOWNLOAD_STORAGE_KEY, records);
}

const SESSION_PROGRESS_STORAGE_KEY = 'hifz_session_progress_v1';

/** Unfinished session state, so a reload can continue instead of restarting. */
export interface HifzSessionProgress {
  version: 1;
  plan: HifzPlan;
  /** Ayah (numberInSurah) the reader was on. */
  ayah: number;
  /** Completed repetitions of the range (0-based). */
  repeat: number;
  updatedAt: number;
}

/** How long an unfinished session stays resumable. */
export const SESSION_PROGRESS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Persist the in-progress position of a focused hifz session. */
export function saveSessionProgress(plan: HifzPlan, ayah: number, repeat: number): void {
  const normalized = normalizePlan(plan);
  const record: HifzSessionProgress = {
    version: 1,
    plan: normalized,
    ayah: Math.min(Math.max(normalized.from, Math.trunc(ayah) || normalized.from), normalized.to),
    repeat: Math.min(Math.max(0, Math.trunc(repeat) || 0), normalized.times - 1),
    updatedAt: Date.now(),
  };
  storage.set(SESSION_PROGRESS_STORAGE_KEY, record);
}

/** Read a resumable session, ignoring stale or malformed records. */
export function getSavedSessionProgress(now = Date.now()): HifzSessionProgress | null {
  const stored = storage.get<HifzSessionProgress>(SESSION_PROGRESS_STORAGE_KEY);
  if (stored?.version !== 1 || !stored.plan) {
    return null;
  }
  const updatedAt = Number(stored.updatedAt);
  if (!Number.isFinite(updatedAt) || now - updatedAt > SESSION_PROGRESS_TTL_MS) {
    return null;
  }
  const plan = normalizePlan(stored.plan);
  const ayah = Math.min(Math.max(plan.from, Math.trunc(stored.ayah) || plan.from), plan.to);
  const repeat = Math.min(Math.max(0, Math.trunc(stored.repeat) || 0), plan.times - 1);
  return { version: 1, plan, ayah, repeat, updatedAt };
}

export function clearSessionProgress(): void {
  storage.remove(SESSION_PROGRESS_STORAGE_KEY);
}

export function getPlanAyahs(plan: HifzPlan): { numberInSurah: number; text: string }[] {
  if (state.currentSurah !== plan.surah || !state.surahData) {
    return [];
  }
  return state.surahData.ayahs.filter((ayah) => ayah.numberInSurah >= plan.from && ayah.numberInSurah <= plan.to);
}

export function currentPlanAyah(plan: HifzPlan): { numberInSurah: number; text: string } | null {
  const ayahs = getPlanAyahs(plan);
  if (!ayahs.length) {
    return null;
  }
  return ayahs.find((ayah) => ayah.numberInSurah === getCurrentAyah()) || ayahs[0]!;
}
