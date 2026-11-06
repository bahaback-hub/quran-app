/**
 * Surah audio pipeline — audio helpers and timings for the reader.
 * Extracted from surah-loader.ts. Everything here is independent of the
 * text/render path except the shared loader generation counter, which
 * guarantees that only the latest load mutates reader/tail state.
 */
import { state, immutableMapSet, immutableMapDelete } from './state.js';
import { __ } from './i18n.js';
import { getReciterById, buildAudioUrl, getTimingApiId } from './reciters.js';
import { apiFetch, jsonFetch } from './api-client.js';
import { getOfflinePackAudioUrls } from './offline-pack.js';
import { QURAN_COM_API_BASE } from './external-sources.js';
import type { AyahEntry } from './types.js';
import type { CachedSurahEntry } from './surah-cache.js';
import type { SurahTextData } from './surah-render.js';

// Shared generation counter — only the latest load applies its results.
let loadGeneration = 0;
let loadedAudioSurah = -1;
let loadedAudioReciter = '';
export function nextLoadGeneration(): number {
  return ++loadGeneration;
}
export function isCurrentLoad(gen: number): boolean {
  return gen === loadGeneration;
}
export function currentAudioMarkers(): { surah: number; reciter: string } {
  return { surah: loadedAudioSurah, reciter: loadedAudioReciter };
}
export function markCurrentAudio(surah: number, reciter: string): void {
  loadedAudioSurah = surah;
  loadedAudioReciter = reciter;
}

/* ===================== LOCAL INTERFACES ===================== */

/** Reciter info from reciters module. */
export interface ReciterInfo {
  id: string;
  name: string;
  source: 'api' | 'mp3quran';
  server?: string;
}

/** Result of audio loading (mp3quran or API). */
export interface AudioResult {
  audios: (string | null)[];
  timings: number[];
}

/** Timestamp entry from quran.com API. */
export interface TimestampEntry {
  timestamp_from: number;
  timestamp_to: number;
}

function countArabicChars(text: string): number {
  return (text.match(/[\u0621-\u064A\u0660-\u0669]/g) || []).length;
}

/**
 * Fetch real ayah timings from quran.com API for supported reciters.
 * Returns fractions (0-1) matching the calculateAyahTimings() format,
 * or null if unavailable (triggers character-count fallback).
 */
async function fetchAyahTimings(reciterId: string, surahNum: number, ayahs: AyahEntry[]): Promise<number[] | null> {
  const apiId = getTimingApiId(reciterId);
  if (!apiId) {
    return null;
  }
  try {
    const data: { audio_file?: { timestamps?: TimestampEntry[] } } = (await jsonFetch(
      `${QURAN_COM_API_BASE}/chapter_recitations/${apiId}/${surahNum}?segments=true`,
      { silent: true, timeout: 8000 },
    )) as { audio_file?: { timestamps?: TimestampEntry[] } };
    if (!data) {
      return null;
    }
    const timestamps: TimestampEntry[] | undefined = data?.audio_file?.timestamps;
    if (!timestamps?.length || timestamps.length !== ayahs.length) {
      return null;
    }
    const totalDuration = timestamps[timestamps.length - 1]!.timestamp_to;
    if (!totalDuration || totalDuration <= 0) {
      return null;
    }
    return timestamps.map((t: TimestampEntry) => t.timestamp_from / totalDuration);
  } catch {
    return null;
  }
}

/**
 * Fallback ayah timings computed from Arabic character weights. Used when a
 * reciter has no quran.com timing API (e.g. hthfi, salamah, qtm, mtrod) or the
 * API payload is unavailable/incomplete. Because the timing array is derived
 * one-to-one from the ayah list, the audio↔ayah binding is exact by construction.
 * @internal Exported for the audio-binding integrity tests, which verify a
 *   one-to-one timing↔ayah binding for every surah against the bundled text.
 * @knip-ignore
 */
export function calculateAyahTimings(ayahs: AyahEntry[], surahNumber: number): number[] {
  const timings: number[] = [];
  const MIN_PER_AYAH = 5;
  const BASMALAH_MIN = 24;
  let basmalahChars = 0;
  const counts = ayahs.map((a: AyahEntry, i: number) => {
    const n = countArabicChars(a.text);
    if (i === 0 && surahNumber !== 1 && surahNumber !== 9) {
      const without = a.text.replace(/^بِسۡمِ ٱللَّهِ ٱلرَّحۡمَـٰنِ ٱلرَّحِيمِ\s*/u, '');
      basmalahChars = Math.max(BASMALAH_MIN, n - countArabicChars(without));
      return Math.max(MIN_PER_AYAH, countArabicChars(without));
    }
    return Math.max(MIN_PER_AYAH, n);
  });
  const total = counts.reduce((a: number, b: number) => a + b, 0) + basmalahChars;
  if (!total) {
    return ayahs.map(() => 0);
  }
  let cum = basmalahChars / total;
  for (let i = 0; i < ayahs.length; i++) {
    timings.push(cum);
    cum += counts[i]! / total;
  }
  return timings;
}

/* ===================== AUDIO HELPERS (independent from text) ===================== */

/** Load audio for mp3quran reciter source. */
export async function loadMp3quranAudio(
  surahNum: number,
  textData: SurahTextData,
  reciterInfo: ReciterInfo,
  currentLoad: number,
): Promise<AudioResult | null> {
  try {
    const audios: (string | null)[] = textData.ayahs.map(() => buildAudioUrl(reciterInfo, surahNum));
    const timings =
      (await fetchAyahTimings(state.currentReciter, surahNum, textData.ayahs)) ??
      calculateAyahTimings(textData.ayahs, surahNum);
    if (!isCurrentLoad(currentLoad)) {
      return null;
    }
    return { audios, timings };
  } catch (e) {
    console.warn('[Audio] mp3quran load failed:', e);
    return null;
  }
}

/** Load audio for standard API reciter source. */
export async function loadApiAudio(
  surahNum: number,
  reciterId: string,
  currentLoad: number,
  signal: AbortSignal,
): Promise<AudioResult | null> {
  try {
    const json: { data?: { ayahs?: AyahEntry[] } } = (await apiFetch(`/surah/${surahNum}/${reciterId}`, {
      signal,
      silent: true,
    })) as { data?: { ayahs?: AyahEntry[] } };
    const data = json?.data;
    if (!data?.ayahs?.length) {
      throw new Error(__('no_audio_data'));
    }
    const audios: (string | null)[] = data.ayahs.map((a: AyahEntry) => a.audio ?? null);
    if (!isCurrentLoad(currentLoad)) {
      return null;
    }
    return { audios, timings: [] };
  } catch (e) {
    console.warn('[API] Audio load failed (non-fatal):', e);
    return null;
  }
}

export async function getOfflinePackAudioResult(
  surahNum: number,
  textData: SurahTextData,
): Promise<AudioResult | null> {
  const urls = await getOfflinePackAudioUrls(state.currentReciter, surahNum);
  if (!urls.length) {
    return null;
  }
  if (urls.length === 1) {
    return {
      audios: Array.from({ length: textData.ayahs.length }, () => urls[0]!),
      timings: calculateAyahTimings(textData.ayahs, surahNum),
    };
  }
  if (urls.length !== textData.ayahs.length) {
    return null;
  }
  return { audios: urls, timings: [] };
}

/**
 * Fetch audio URLs for a chosen reciter without loading or rendering the reader.
 * Used by the web-only Memorization Room to download just its selected range.
 */
export async function loadAudioUrlsForSession(
  surahNum: number,
  reciterId: string,
  ayahCount: number,
): Promise<string[]> {
  const reciterInfo = getReciterById(reciterId) as ReciterInfo;
  if (reciterInfo.source === 'mp3quran') {
    const url = buildAudioUrl(reciterInfo, surahNum);
    return url ? Array.from({ length: ayahCount }, () => url) : [];
  }

  try {
    const json = (await apiFetch(`/surah/${surahNum}/${reciterId}`, { silent: true })) as {
      data?: { ayahs?: AyahEntry[] };
    };
    return json?.data?.ayahs?.map((ayah) => ayah.audio || '') || [];
  } catch {
    return [];
  }
}

/**
 * Re-fetch audio URLs for the currently open surah+reciter and refill the
 * playback lists. Used when play is pressed but the boot-time audio fetch
 * failed (e.g. API rate-limit burst on page load) so the button recovers
 * instead of staying silent. Returns true when playable audio is available.
 */
export async function reloadCurrentSurahAudio(): Promise<boolean> {
  const surahNum = state.currentSurah;
  const reciterId = state.currentReciter;
  const ayahs = state.surahData?.ayahs;
  const reciterInfo = getReciterById(reciterId) as ReciterInfo | undefined;
  if (!surahNum || !reciterInfo || !ayahs?.length) {
    return false;
  }
  try {
    if (reciterInfo.source === 'mp3quran') {
      const url = buildAudioUrl(reciterInfo, surahNum);
      if (!url) {
        return false;
      }
      state.ayahsAudios = Array.from({ length: ayahs.length }, () => url);
      state.ayahTimings = (await fetchAyahTimings(reciterId, surahNum, ayahs)) ?? calculateAyahTimings(ayahs, surahNum);
    } else {
      const json = (await apiFetch(`/surah/${surahNum}/${reciterId}`, { silent: true })) as {
        data?: { ayahs?: AyahEntry[] };
      };
      const fetched = json?.data?.ayahs;
      if (!fetched?.length) {
        return false;
      }
      state.ayahsAudios = fetched.map((a) => a.audio ?? '');
      state.ayahTimings = [];
    }
    markCurrentAudio(surahNum, reciterId);
    return state.ayahsAudios.some((a) => Boolean(a));
  } catch {
    return false;
  }
}

/**
 * Find the last good audio list cached for the same surah+reciter under any
 * translation suffix. When a reload's audio fetch fails (e.g. rate-limited
 * exactly when translation adds a third parallel request), reusing stale
 * audio keeps the reader working instead of stranding it silent.
 */
export function findFallbackAudio(surahNum: number, reciterId: string): { audios: string[]; timings: number[] } | null {
  const prefix = `${surahNum}_${reciterId}_`;
  for (const [key, entry] of state.surahCache) {
    if (!key.startsWith(prefix)) {
      continue;
    }
    const audios = Array.isArray(entry.audios)
      ? entry.audios.map((a): string => a ?? '')
      : entry.audio?.ayahs?.map((a: AyahEntry) => a.audio || '');
    if (audios?.length) {
      return { audios, timings: Array.isArray(entry.timings) ? [...entry.timings] : [] };
    }
  }
  return null;
}

/**
 * Insert (or refresh) an entry in the in-memory surah cache. A Map keeps
 * insertion order, so re-inserting moves the key to the end (most recently
 * used) — which turns the eviction at CACHE_LIMIT into true LRU instead of
 * FIFO (ARC-10).
 */
export function setSurahCacheEntry(key: string, entry: CachedSurahEntry): void {
  if (state.surahCache.has(key)) {
    immutableMapDelete(state, 'surahCache', key);
  }
  immutableMapSet(state, 'surahCache', key, entry);
}
