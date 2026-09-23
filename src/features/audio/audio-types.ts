/**
 * Shared audio module types — extracted from audio.ts so the player logic
 * stays focused on behavior while consumers import types from one place.
 */

/** Options for loading a surah (used by setLoadSurah callback). */
export interface LoadSurahOptions {
  startAyah?: number;
  autoPlay?: boolean;
}

/** Type for the loadSurah callback injected via setLoadSurah. */
export type LoadSurahFn = (surahNum: number, opts?: LoadSurahOptions) => void;

/** Type for the reloadCurrentSurahAudio callback injected via setReloadAudio. */
export type ReloadAudioFn = () => Promise<boolean>;

/** Cached word-weight data for word-by-word tracking. */
export interface WordWeightsResult {
  wordCount: number;
  startTimes: number[];
}

/** Repeat range configuration — extracted from toggleRepeat for clarity. */
export interface RepeatRange {
  from: number;
  to: number;
  times: number;
}