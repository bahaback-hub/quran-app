/**
 * Surah List Loading & Offset Mapping.
 *
 * Extracted from surah-loader.ts to reduce its size (was 1198 lines).
 * This module handles:
 *   - Loading the surah list from cache, API, or local fallback
 *   - Populating the #surahSelect and #reciterSelect dropdowns
 *   - Building the surah offset map (cumulative ayah counts) for
 *     absolute-ayah ↔ surah:ayah lookups
 *
 * Refactoring rationale: surah-loader.ts was a 1198-line "god file".
 * The surah-list + offset logic is self-contained and rarely changes,
 * making it a clean extraction target.
 */

import { CONFIG } from './config.js';
import { storage } from './storage.js';
import { dom } from './dom.js';
import { surahSelectLoading, surahSelectError, surahSelectDefault, reciterOptions } from './templates.js';
import { state, SurahInfo, SurahOffset } from './state.js';
import { RECITERS, getReciterDisplayName } from './reciters.js';
import { apiFetch, jsonFetch } from './api-client.js';

/** Reciter info from reciters module. */
interface ReciterInfo {
  id: string;
  name: string;
  source: 'api' | 'mp3quran';
  server?: string;
}

/** Result of _absToSurahAyah lookup. */
export interface AbsToSurahAyahResult {
  surahNum: number;
  surahName: string;
  ayahNumInSurah: number;
}

/* ===================== SURAH LIST LOADING ===================== */

/**
 * Load surah list and populate the dropdown.
 *
 * Priority (best → worst):
 *   1. Bundled local file `data/surah-list.json` — it is precached by the
 *      service worker, so it resolves in a single local round-trip with NO
 *      network wait. This keeps the surah list off the critical LCP path on
 *      first load (previously we awaited api.alquran.cloud serially before
 *      starting the surah text fetch).
 *   2. localStorage cache (repeat visits / offline).
 *   3. API — used only to refresh the bundled data in the background.
 *
 * A successful local fill hands the network request to a non-blocking
 * background sync, mirroring the stale-while-revalidate pattern already used
 * by `loadSurah`. A failed local fill falls straight through to the API.
 */
export async function loadSurahList(): Promise<void> {
  const cached = storage.get<SurahInfo[]>('surah_list');
  if (cached && cached.length === CONFIG.SURAH_COUNT) {
    state.surahList = cached;
    state.surahOffsets = null;
    buildSurahOffsets();
    populateSurahSelect();
    // Refresh in the background so the dropdown eventually reflects any
    // upstream changes without blocking first paint.
    void refreshSurahListFromAPI();
    return;
  }

  try {
    const localData = (await jsonFetch('data/surah-list.json', { silent: true })) as SurahInfo[];
    if (localData && localData.length === CONFIG.SURAH_COUNT) {
      state.surahList = localData;
      state.surahOffsets = null;
      storage.set('surah_list', localData);
      populateSurahSelect();
      // Sync with the authoritative list silently in the background.
      void refreshSurahListFromAPI();
      return;
    }
  } catch {
    /* no local fallback — fall through to API */
  }
  if (dom.surahSelect) {
    dom.surahSelect.innerHTML = surahSelectLoading();
  }
  try {
    const data: { data?: SurahInfo[] } = (await apiFetch('/surah', { silent: true })) as { data?: SurahInfo[] };
    if (data?.data) {
      state.surahList = data.data;
      state.surahOffsets = null;
      storage.set('surah_list', data.data);
      populateSurahSelect();
      return;
    }
  } catch {
    /* last resort error state */
  }
  if (dom.surahSelect) {
    dom.surahSelect.innerHTML = surahSelectError();
  }
}

/** Background-only re-sync of the local/bundled surah list from the API. */
let _surahListRefreshController: AbortController | null = null;
async function refreshSurahListFromAPI(): Promise<void> {
  try {
    if (_surahListRefreshController) {
      _surahListRefreshController.abort();
    }
    _surahListRefreshController = new AbortController();
    const data: { data?: SurahInfo[] } = (await apiFetch('/surah', {
      silent: true,
      signal: _surahListRefreshController.signal,
    })) as { data?: SurahInfo[] };
    if (data?.data) {
      storage.set('surah_list', data.data);
    }
  } catch {
    /* non-critical, keep the local list */
  }
}

/** Populate the #surahSelect dropdown with all 114 surahs. */
function populateSurahSelect(): void {
  if (!dom.surahSelect) {
    return;
  }
  dom.surahSelect.innerHTML = surahSelectDefault();
  for (const s of state.surahList) {
    const opt = document.createElement('option');
    opt.value = String(s.number);
    opt.textContent = `${s.number}. ${s.name} (${s.englishName})`;
    dom.surahSelect.appendChild(opt);
  }
  dom.surahSelect.value = String(state.currentSurah);
}

/**
 * Populate the reciter dropdown with available reciter options.
 * Uses the RECITERS list and current selection to render option elements.
 */
export function populateReciterSelect(): void {
  if (!dom.reciterSelect) {
    return;
  }
  dom.reciterSelect.innerHTML = reciterOptions(
    RECITERS.map((r: ReciterInfo) => ({ id: r.id, name: getReciterDisplayName(r) })),
    state.currentReciter || CONFIG.DEFAULT_RECITER,
  );
}

/* ===================== SURAH OFFSETS ===================== */

/**
 * Build surah offset mappings from the surah list.
 * Computes cumulative ayah counts and absolute starting positions
 * for each surah, enabling quick ayah-to-surah lookups.
 *
 * After calling this, state.surahOffsets is an array of 114 entries,
 * each with {surahNum, startAbs, count, name}. The absolute ayah number
 * of the first ayah of surah N is offsets[N-1].startAbs.
 */
export function buildSurahOffsets(): void {
  if (state.surahOffsets || !state.surahList.length) {
    return;
  }
  state.surahOffsets = [];
  let cum = 1;
  const offsets: SurahOffset[] = [];
  for (const s of state.surahList) {
    offsets.push({ surahNum: s.number, startAbs: cum, count: s.numberOfAyahs, name: s.name });
    cum += s.numberOfAyahs;
  }
  state.surahOffsets = offsets;
}

/**
 * Convert an absolute ayah number (1..6236) to {surahNum, ayahNumInSurah, surahName}.
 * Returns null if the absolute number is out of range or surahOffsets is not built.
 */
export function absToSurahAyah(absNum: number): AbsToSurahAyahResult | null {
  if (!state.surahOffsets) {
    buildSurahOffsets();
  }
  if (!state.surahOffsets) {
    return null;
  }
  for (const o of state.surahOffsets) {
    if (absNum >= o.startAbs && absNum < o.startAbs + o.count) {
      return { surahNum: o.surahNum, surahName: o.name, ayahNumInSurah: absNum - o.startAbs + 1 };
    }
  }
  return null;
}

/**
 * Convert a (surah, ayahInSurah) pair to the absolute ayah number (1..6236).
 * Returns null if the surah is not found or surahOffsets is not built.
 */
export function getAbsNumber(surah: number, ayah: number): number | null {
  if (!state.surahOffsets) {
    buildSurahOffsets();
  }
  if (!state.surahOffsets) {
    return null;
  }
  for (const o of state.surahOffsets) {
    if (o.surahNum === surah) {
      return o.startAbs + ayah - 1;
    }
  }
  return null;
}
