import { CONFIG } from './config.js';
import { storage } from './storage.js';
import { dom } from './dom.js';
import { showToast, loadingBar } from './ui.js';
import { __ } from './i18n.js';
import { skeletonLoading, surahLoadError, escapeHtml } from './templates.js';
import { state, batch, immutableMapSet, immutableMapDelete, SurahInfo } from './state.js';
import { getReciterById, buildAudioUrl, getTimingApiId } from './reciters.js';
import { loadTajweedAnnotationsForSurah } from './tajweed-data.js';
import { prepareAudioForNewSurah, playCurrentAyah } from './features/audio/audio.js';
import { recordReadingSession } from './reading-stats.js';
import { apiFetch, jsonFetch } from './api-client.js';
import type { SurahData, AyahEntry } from './types.js';
import { cacheSurahToIDB, getCachedSurahFromIDB } from './surah-cache.js';
import type { CachedSurahEntry } from './surah-cache.js';
import { loadLocalSurahText } from './api-fallback.js';
import { getOfflinePackAudioUrls } from './offline-pack.js';
import { QURAN_COM_API_BASE } from './external-sources.js';
import { renderSurah, finalizeSurahLoad } from './surah-render.js';
import type { SurahTextData, LoadSurahOptions } from './surah-render.js';

// Re-export surah-list helpers so existing callers of surah-loader.loadSurahList /
// populateReciterSelect / buildSurahOffsets continue to work without changing import paths.
// The functions are imported lazily inside surah-loader where needed (via dynamic import
// or direct calls through the surah-list module).
export { loadSurahList, populateReciterSelect, buildSurahOffsets, absToSurahAyah, getAbsNumber } from './surah-list.js';

// Re-export the render cluster (now in surah-render.ts) so existing callers of
// surah-loader.renderSurah / highlightCurrentAyah / updatePlayerInfo /
// updateCurrentSurahLocale continue to work without changing import paths.
export { renderSurah, highlightCurrentAyah, updatePlayerInfo, updateCurrentSurahLocale } from './surah-render.js';

/* ===================== LOCAL INTERFACES ===================== */

/** Reciter info from reciters module. */
interface ReciterInfo {
  id: string;
  name: string;
  source: 'api' | 'mp3quran';
  server?: string;
}

/** Result of audio loading (mp3quran or API). */
interface AudioResult {
  audios: (string | null)[];
  timings: number[];
}

/** Timestamp entry from quran.com API. */
interface TimestampEntry {
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

function calculateAyahTimings(ayahs: AyahEntry[], surahNumber: number): number[] {
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
async function loadMp3quranAudio(
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
    if (_loadCounter !== currentLoad) {
      return null;
    }
    return { audios, timings };
  } catch (e) {
    console.warn('[Audio] mp3quran load failed:', e);
    return null;
  }
}

/** Load audio for standard API reciter source. */
async function loadApiAudio(
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
    if (_loadCounter !== currentLoad) {
      return null;
    }
    return { audios, timings: [] };
  } catch (e) {
    console.warn('[API] Audio load failed (non-fatal):', e);
    return null;
  }
}

function getOfflinePackAudioResult(surahNum: number, textData: SurahTextData): AudioResult | null {
  const urls = getOfflinePackAudioUrls(state.currentReciter, surahNum);
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

/* ===================== LOAD & RENDER SURAH ===================== */

let _loadCounter = 0;
let currentSurahController: AbortController | null = null;
/** Separate AbortController for background refresh — not cancelled when loading a new surah. */
let _refreshController: AbortController | null = null;
/**
 * Debounce handle for the background refresh. When the user flips quickly through
 * cached surahs, each one schedules a background re-fetch. We delay the first
 * refresh by a short window and coalesce — if another surah loads before the
 * window elapses, we reschedule against the newest surah only. This prevents a
 * burst of identical stale-while-revalidate requests during fast navigation.
 */
let _refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const REFRESH_DEBOUNCE_MS = 1200;

async function prepareTajweedForSurah(surahNum: number): Promise<void> {
  if (state.tajweedEnabled) {
    await loadTajweedAnnotationsForSurah(surahNum);
  }
}

/**
 * Load a surah (text + audio + translation), render it, finalize.
 */
export async function loadSurah(surahNum: number, opts: LoadSurahOptions = {}): Promise<void> {
  if (!surahNum) {
    return;
  }
  _loadCounter++;
  const currentLoad = _loadCounter;
  const surahLabel = state.surahList.find((s: SurahInfo) => s.number === surahNum)?.name || String(surahNum);
  const loadingMessage = `${__('loading_surah')} ${surahLabel}`;
  // Clear stale audio/translation before new load (batched to avoid intermediate notifications).
  // Also null out surahData and reset currentAyahIndex so consumers reading
  // state.currentSurah + state.surahData during the await below see a consistent
  // "loading" state (null surahData) rather than a stale previous surah.
  batch(() => {
    state.loadingSurah = surahNum;
    state.ayahsAudios = [];
    state.ayahTimings = [];
    state.translationData = null;
    state.isPlaying = false;
    state.surahData = null;
    state.currentAyahIndex = 0;
  });

  prepareAudioForNewSurah();

  if (dom.surahContent) {
    dom.surahContent.classList.add('is-loading');
    dom.surahContent.setAttribute('aria-busy', 'true');
  }

  if (state.hifdhMode) {
    batch(() => {
      state.hifdhMode = false;
      state.repeatMode = false;
      state.repeatCounter = 0;
    });
    dom.hifdhBtn?.classList.remove('active');
    document.querySelectorAll('.ayah').forEach((el) => el.classList.remove('hifdh-mode', 'revealed'));
    if (dom.repeatControls) {
      dom.repeatControls.style.display = 'none';
    }
  }
  // Note: at this point state.hifdhMode is always false (either it was already
  // false, or the branch above set it to false). The `!state.hifdhMode` guard
  // is kept for clarity but is effectively always true here.
  if (state.repeatMode && !state.hifdhMode) {
    state.repeatMode = false;
    state.repeatCounter = 0;
    dom.repeatBtn?.classList.remove('active');
    if (dom.repeatControls) {
      dom.repeatControls.style.display = 'none';
    }
  }
  state.currentSurah = surahNum;

  // Cancel previous in-flight request
  if (currentSurahController) {
    currentSurahController.abort();
  }
  currentSurahController = new AbortController();
  const signal = currentSurahController.signal;

  const cacheKey = `${surahNum}_${state.currentReciter}_${state.currentTranslation || 'notr'}`;
  const reciterInfo = getReciterById(state.currentReciter) as ReciterInfo;
  const isMp3quran = reciterInfo.source === 'mp3quran';
  if (state.surahCache.has(cacheKey)) {
    const cached = state.surahCache.get(cacheKey) as unknown as CachedSurahEntry;
    if (_loadCounter !== currentLoad) {
      return;
    }
    state.surahData = cached.text as unknown as SurahData;
    if (isMp3quran) {
      state.ayahsAudios = cached.text.ayahs.map(() => buildAudioUrl(reciterInfo, surahNum) || '');
      state.ayahTimings = cached.timings || calculateAyahTimings(cached.text.ayahs, surahNum);
    } else {
      state.ayahsAudios = Array.isArray(cached.audios)
        ? (cached.audios as string[])
        : cached.audio?.ayahs?.map((a: AyahEntry) => a.audio || '') || [];
      state.ayahTimings = [];
    }
    state.translationData = cached.translation || null;
    await prepareTajweedForSurah(surahNum);
    if (_loadCounter !== currentLoad) {
      return;
    }
    renderSurah(cached.text);
    finalizeSurahLoad(opts);
    state.loadingSurah = null;
    dom.surahContent?.classList.remove('is-loading');
    dom.surahContent?.setAttribute('aria-busy', 'false');
    return;
  }

  // Try IndexedDB cache for offline support before fetching from API
  const idbCached = await getCachedSurahFromIDB(cacheKey);
  if (idbCached) {
    if (_loadCounter !== currentLoad) {
      return;
    }
    // Also store in memory cache
    immutableMapSet(state, 'surahCache', cacheKey, idbCached);
    state.surahData = idbCached.text as unknown as SurahData;
    if (isMp3quran) {
      state.ayahsAudios = idbCached.text.ayahs.map(() => buildAudioUrl(reciterInfo, surahNum) || '');
      state.ayahTimings = idbCached.timings || calculateAyahTimings(idbCached.text.ayahs, surahNum);
    } else {
      state.ayahsAudios = Array.isArray(idbCached.audios)
        ? (idbCached.audios as string[])
        : idbCached.audio?.ayahs?.map((a: AyahEntry) => a.audio || '') || [];
      state.ayahTimings = [];
    }
    state.translationData = idbCached.translation || null;
    await prepareTajweedForSurah(surahNum);
    if (_loadCounter !== currentLoad) {
      return;
    }
    renderSurah(idbCached.text);
    finalizeSurahLoad(opts);
    state.loadingSurah = null;
    dom.surahContent?.classList.remove('is-loading');
    dom.surahContent?.setAttribute('aria-busy', 'false');
    // If online, still try to refresh the data in background (stale-while-revalidate)
    // Use a SEPARATE AbortController so the refresh isn't cancelled when the user loads a different surah.
    // Debounce so fast navigation across cached surahs coalesces into at most one
    // refresh for the most recently opened surah, instead of one request per surah.
    if (navigator.onLine) {
      if (_refreshDebounceTimer) {
        clearTimeout(_refreshDebounceTimer);
      }
      const debouncedSurahNum = surahNum;
      const debouncedCacheKey = cacheKey;
      const debouncedReciterInfo = reciterInfo;
      const debouncedIsMp3quran = isMp3quran;
      const debouncedCurrentLoad = currentLoad;
      _refreshDebounceTimer = setTimeout(() => {
        _refreshDebounceTimer = null;
        if (_refreshController) {
          _refreshController.abort();
        }
        _refreshController = new AbortController();
        void _refreshSurahFromAPI(
          debouncedSurahNum,
          debouncedCacheKey,
          debouncedReciterInfo,
          debouncedIsMp3quran,
          debouncedCurrentLoad,
          _refreshController.signal,
        );
      }, REFRESH_DEBOUNCE_MS);
    }
    return;
  }

  loadingBar.show(`${loadingMessage}...`);
  if (dom.surahContent) {
    dom.surahContent.innerHTML = `<div class="surah-loading-notice" role="status"><span class="surah-loading-orb" aria-hidden="true"></span>${escapeHtml(loadingMessage)}</div>${skeletonLoading()}`;
  }

  try {
    const textJson: { data?: SurahTextData } = (await apiFetch(`/surah/${surahNum}/quran-uthmani`, {
      signal,
      errorMsg: __('failed_load_surah'),
    })) as { data?: SurahTextData };
    const textData: SurahTextData = textJson?.data as SurahTextData;
    if (!textData?.ayahs?.length) {
      throw new Error(__('invalid_surah_data'));
    }
    if (_loadCounter !== currentLoad) {
      return;
    }
    state.surahData = textData as SurahData;

    await prepareTajweedForSurah(surahNum);
    if (_loadCounter !== currentLoad) {
      return;
    }
    renderSurah(textData);
    const autoPlay = opts.autoPlay;
    finalizeSurahLoad({ ...opts, autoPlay: false });
    recordReadingSession(surahNum, textData.ayahs.length);
    loadingBar.hide();

    // Load audio and translation independently (don't block render)
    const audioPromise = isMp3quran
      ? loadMp3quranAudio(surahNum, textData, reciterInfo, currentLoad)
      : loadApiAudio(surahNum, state.currentReciter, currentLoad, signal);
    const transPromise =
      state.translationEnabled && state.currentTranslation
        ? apiFetch(`/surah/${surahNum}/${state.currentTranslation}`, { signal, silent: true })
            .then((d: unknown) => (d as { data?: Record<string, unknown> })?.data || null)
            .catch(() => null)
        : Promise.resolve(null);

    const [audioResult, transResult]: [AudioResult | null, Record<string, unknown> | null] = await Promise.all([
      audioPromise,
      transPromise,
    ]);
    if (_loadCounter !== currentLoad) {
      return;
    }
    if (audioResult) {
      // Preserve array indices — replace nulls with empty strings instead of filtering
      // so that ayahsAudios[i] always corresponds to ayah index i
      state.ayahsAudios = audioResult.audios.map((a): string => a ?? '');
      state.ayahTimings = audioResult.timings;
    }
    state.translationData = transResult;
    if (transResult && state.surahData) {
      renderSurah(state.surahData);
      highlightCurrentAyah();
    }

    if (autoPlay && audioResult) {
      playCurrentAyah();
    }

    if (state.surahCache.size >= CONFIG.CACHE_LIMIT) {
      const firstKey = state.surahCache.keys().next().value;
      if (firstKey) {
        immutableMapDelete(state, 'surahCache', firstKey);
      }
    }
    const cacheEntry: CachedSurahEntry = {
      text: textData,
      audios: state.ayahsAudios,
      timings: state.ayahTimings,
      translation: state.translationData,
    };
    immutableMapSet(state, 'surahCache', cacheKey, cacheEntry);
    // Also persist to IndexedDB for offline access
    cacheSurahToIDB(cacheKey, cacheEntry);
  } catch (e: unknown) {
    if ((e as Error).name === 'AbortError') {
      return;
    }
    if (state.fullQuranLoaded && state.fullQuranText) {
      if (_loadCounter !== currentLoad) {
        return;
      }
      const ayahs = state.fullQuranText.filter((a: { surah: number }) => a.surah === surahNum);
      if (ayahs.length) {
        const firstAyah = ayahs[0]!;
        state.surahData = {
          number: surahNum,
          name: firstAyah.surahName,
          englishName: state.surahList.find((s: SurahInfo) => s.number === surahNum)?.englishName || '',
          ayahs: ayahs.map((a: { ayah: number; text: string }) => ({ numberInSurah: a.ayah, text: a.text })),
        };
        const offlineAudio = getOfflinePackAudioResult(surahNum, state.surahData);
        state.ayahsAudios = offlineAudio?.audios.map((audio) => audio ?? '') ?? [];
        state.ayahTimings = offlineAudio?.timings ?? [];
        renderSurah(state.surahData!);
        finalizeSurahLoad(opts);
        loadingBar.hide();
        // showToast(__('offline_no_audio'), ''); // disabled at startup
        state.loadingSurah = null;
        return;
      }
    }
    // Final fallback: try the local bundled Quran text (public/data/quran-uthmani.json).
    // This works even when fully offline because the file is bundled with the app
    // and precached by the PWA service worker.
    try {
      const localSurah = await loadLocalSurahText(surahNum);
      if (localSurah && _loadCounter === currentLoad) {
        state.surahData = localSurah;
        const offlineAudio = getOfflinePackAudioResult(surahNum, localSurah);
        state.ayahsAudios = offlineAudio?.audios.map((audio) => audio ?? '') ?? [];
        state.ayahTimings = offlineAudio?.timings ?? [];
        renderSurah(localSurah);
        finalizeSurahLoad(opts);
        loadingBar.hide();
        showToast(__('offline_mode'), 'success');
        state.loadingSurah = null;
        return;
      }
    } catch {
      /* local fallback also failed — fall through to error display */
    }
    if (_loadCounter !== currentLoad) {
      return;
    }
    if (dom.surahContent) {
      dom.surahContent.innerHTML = surahLoadError();
    }
    // showToast(__('failed_load_surah'), 'error'); // disabled at startup
    loadingBar.hide();
  } finally {
    // Only clear loading state if this is still the active load
    // (prevents a stale load from clearing a newer load's indicator)
    if (_loadCounter === currentLoad) {
      state.loadingSurah = null;
      dom.surahContent?.classList.remove('is-loading');
      dom.surahContent?.setAttribute('aria-busy', 'false');
    }
  }
}

/**
 * Background refresh: re-fetch surah data from API and update caches.
 * Used when the surah was loaded from IDB cache but we want fresh data.
 */
async function _refreshSurahFromAPI(
  surahNum: number,
  cacheKey: string,
  reciterInfo: ReciterInfo,
  isMp3quran: boolean,
  currentLoad: number,
  signal: AbortSignal,
): Promise<void> {
  try {
    const textJson = await apiFetch<{ data?: SurahTextData }>(`/surah/${surahNum}/quran-uthmani`, {
      signal,
      silent: true,
    });
    const textData: SurahTextData | undefined = textJson?.data;
    if (!textData?.ayahs?.length || _loadCounter !== currentLoad) {
      return;
    }

    // Update in-memory state
    state.surahData = textData as SurahData;

    // Load audio
    const audioPromise = isMp3quran
      ? loadMp3quranAudio(surahNum, textData, reciterInfo, currentLoad)
      : loadApiAudio(surahNum, state.currentReciter, currentLoad, signal);
    const transPromise =
      state.translationEnabled && state.currentTranslation
        ? apiFetch(`/surah/${surahNum}/${state.currentTranslation}`, { signal, silent: true })
            .then((d: unknown) => (d as { data?: Record<string, unknown> })?.data || null)
            .catch(() => null)
        : Promise.resolve(null);

    const [audioResult, transResult]: [AudioResult | null, Record<string, unknown> | null] = await Promise.all([
      audioPromise,
      transPromise,
    ]);
    if (_loadCounter !== currentLoad) {
      return;
    }

    if (audioResult) {
      // Preserve array indices — replace nulls with empty strings instead of filtering
      state.ayahsAudios = audioResult.audios.map((a): string => a ?? '');
      state.ayahTimings = audioResult.timings;
    }
    state.translationData = transResult;

    // Update caches
    const cacheEntry: CachedSurahEntry = {
      text: textData,
      audios: state.ayahsAudios,
      timings: state.ayahTimings,
      translation: state.translationData,
    };
    immutableMapSet(state, 'surahCache', cacheKey, cacheEntry);
    cacheSurahToIDB(cacheKey, cacheEntry);

    // Re-render with fresh data
    renderSurah(textData);
    highlightCurrentAyah();
  } catch {
    // Background refresh failure is silent — the cached data is still displayed
  }
}

/* Render cluster (chunks, highlight, player info) lives in surah-render.ts. */

/* ===================== TRANSLATION ===================== */

/**
 * Toggle the translation overlay on/off.
 * Persists the preference to storage and reloads the current surah
 * with or without translation data.
 */
export function toggleTranslation(): void {
  state.translationEnabled = !state.translationEnabled;
  storage.set('translation_enabled', state.translationEnabled);
  if (state.translationEnabled && !state.currentTranslation) {
    state.currentTranslation = dom.translationSelect?.value || 'en.sahih';
    storage.set('translation_edition', state.currentTranslation);
  }
  if (dom.translationSelect) {
    dom.translationSelect.value = state.translationEnabled ? state.currentTranslation || '' : '';
  }
  showToast(state.translationEnabled ? __('translation_on') : __('translation_off'), 'success');
  if (state.currentSurah) {
    loadSurah(state.currentSurah);
  }
}
