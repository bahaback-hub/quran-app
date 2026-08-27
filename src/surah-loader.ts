import { CONFIG } from './config.js';
import { storage } from './storage.js';
import { dom } from './dom.js';
import { showToast, loadingBar } from './ui.js';
import { __, getLang, toArabicDigits } from './i18n.js';
import { skeletonLoading, surahLoadError, collapsedPlayerInfo, escapeHtml } from './templates.js';
import { state, batch, immutableMapSet, immutableMapDelete, SurahInfo } from './state.js';
import { getReciterById, buildAudioUrl, getTimingApiId } from './reciters.js';
import { tajweedColorWord, buildColorMap } from './tajweed.js';
import type { TajweedRule } from './tajweed.js';
import { getAyahAnnotations, loadTajweedAnnotationsForSurah } from './tajweed-data.js';
import { SURAH_SECRETS } from './surahs-data.js';
import { isSajdaAyah, isJuzStart } from './quran-meta.js';
import { prepareAudioForNewSurah, playCurrentAyah } from './audio.js';
import { recordReadingSession } from './reading-stats.js';
import { loadTafsirForCurrentAyah } from './tafsir.js';
import { apiFetch, jsonFetch } from './api-client.js';
import type { SurahData, AyahEntry } from './types.js';
import { cacheSurahToIDB, getCachedSurahFromIDB } from './surah-cache.js';
import type { CachedSurahEntry } from './surah-cache.js';
import { loadLocalSurahText } from './api-fallback.js';
import { getOfflinePackAudioUrls } from './offline-pack.js';

// Re-export surah-list helpers so existing callers of surah-loader.loadSurahList /
// populateReciterSelect / buildSurahOffsets continue to work without changing import paths.
// The functions are imported lazily inside surah-loader where needed (via dynamic import
// or direct calls through the surah-list module).
export { loadSurahList, populateReciterSelect, buildSurahOffsets, absToSurahAyah, getAbsNumber } from './surah-list.js';

/* ===================== LOCAL INTERFACES ===================== */

/** Surah text data returned from the API. */
interface SurahTextData {
  number: number;
  name: string;
  englishName: string;
  ayahs: AyahEntry[];
}

/** Reciter info from reciters module. */
interface ReciterInfo {
  id: string;
  name: string;
  source: 'api' | 'mp3quran';
  server?: string;
}

/** Options for loading a surah. */
interface LoadSurahOptions {
  startAyah?: number;
  autoPlay?: boolean;
}

/** Result of audio loading (mp3quran or API). */
interface AudioResult {
  audios: (string | null)[];
  timings: number[];
}

/** Tajweed annotation entry. */
interface TajweedAnnotation {
  rule: string;
  start: number;
  end: number;
}

/** Timestamp entry from quran.com API. */
interface TimestampEntry {
  timestamp_from: number;
  timestamp_to: number;
}

/** Saved position entry. */
interface SavedPosition {
  surah: number;
  ayah: number;
  surahName: string;
  ayahNumberInSurah: number;
  timestamp: number;
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
      `https://api.quran.com/api/v4/chapter_recitations/${apiId}/${surahNum}?segments=true`,
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
    // Use a SEPARATE AbortController so the refresh isn't cancelled when the user loads a different surah
    if (navigator.onLine) {
      if (_refreshController) {
        _refreshController.abort();
      }
      _refreshController = new AbortController();
      _refreshSurahFromAPI(surahNum, cacheKey, reciterInfo, isMp3quran, currentLoad, _refreshController.signal);
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

const VIRTUAL_CHUNK_SIZE = 20;
const VISIBLE_WINDOW_CHUNKS = 2; // chunks to keep visible above and below viewport
let _ayahsReadyCount = 0;
let _virtualObserver: IntersectionObserver | null = null;
const _scrollObserver: IntersectionObserver | null = null;

/** Cached heights of rendered chunks for accurate spacer sizing. */
const _chunkHeightCache = new Map<string, number>();

/** Currently rendered chunk ranges: Set of chunk indices currently in DOM. */
const _renderedChunks = new Set<number>();

/** Total number of chunks for current surah. */
const _totalChunks = 0;

/** Reference to current surah text data for virtual scroll operations. */
let _currentTextData: SurahTextData | null = null;

/** Select one concise, locale-appropriate surah name for the reader title. */
function getLocalizedSurahName(textData: SurahTextData): string {
  return getLang() === 'ar' ? textData.name : textData.englishName;
}

/** Format a juz marker without exposing a missing translation key to readers. */
function getLocalizedJuzLabel(juz: number): string {
  const lang = getLang();
  const numeral = lang === 'ar' ? toArabicDigits(juz) : String(juz);
  return __('juz_info', numeral);
}

/** Update language-dependent reader metadata without re-rendering ayahs or audio state. */
export function updateCurrentSurahLocale(): void {
  if (!dom.surahContent || !_currentTextData) {
    return;
  }

  const titleName = dom.surahContent.querySelector<HTMLElement>('[data-surah-title-name]');
  if (titleName) {
    const isArabic = getLang() === 'ar';
    titleName.textContent = getLocalizedSurahName(_currentTextData);
    titleName.dir = isArabic ? 'rtl' : 'ltr';
  }

  for (const marker of dom.surahContent.querySelectorAll<HTMLElement>('[data-juz-number]')) {
    const juz = Number(marker.dataset['juzNumber']);
    if (Number.isFinite(juz)) {
      marker.textContent = getLocalizedJuzLabel(juz);
    }
  }
}

/** Get the chunk index for a given ayah index. */
function getChunkIndex(ayahIndex: number): number {
  return Math.floor(ayahIndex / VIRTUAL_CHUNK_SIZE);
}

/** Get the cache key for a chunk. */
function chunkCacheKey(surahNum: number, chunkIdx: number): string {
  return `${surahNum}_${chunkIdx}`;
}

function buildAyahHtml(a: AyahEntry, i: number, textData: SurahTextData): string {
  const isRtlTranslation = state.currentTranslation && state.currentTranslation.startsWith('ur.');
  let txt = a.text;
  let offsetAdj = 0;
  if (textData.number !== 1 && a.numberInSurah === 1) {
    const stripped = txt.replace(
      /^ب[\u064B-\u065F\u0670]*س[\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*[هة][\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*[حخ][\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*[نث][\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*[حخ][\u064B-\u065F\u0670]*[يى][\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*/u,
      '',
    );
    offsetAdj = txt.length - stripped.length;
    txt = stripped;
  }
  let colorMap: Map<number, TajweedRule> | null = null;
  if (state.tajweedEnabled) {
    const annotations: TajweedAnnotation[] = getAyahAnnotations(textData.number, a.numberInSurah);
    if (annotations.length > 0) {
      const adjusted =
        offsetAdj > 0
          ? annotations.map((ann: TajweedAnnotation) => ({
              rule: ann.rule,
              start: ann.start - offsetAdj,
              end: ann.end - offsetAdj,
            }))
          : annotations;
      colorMap = buildColorMap(adjusted);
    }
  }
  let html = '';
  // Juz marker: if this ayah starts a new juz, insert a divider
  const juzNum = isJuzStart(textData.number, a.numberInSurah);
  if (juzNum !== null) {
    html += `<div class="juz-marker"><span class="juz-label" data-juz-number="${juzNum}">${getLocalizedJuzLabel(juzNum)}</span></div>`;
  }
  html += `<span class="ayah" data-index="${i}" data-surah="${textData.number}" data-ayah="${a.numberInSurah}">`;
  html += buildAyahWordsHtml(txt, i, colorMap);
  // Sajda indicator
  const sajda = isSajdaAyah(textData.number, a.numberInSurah);
  if (sajda.isSajda) {
    const sajdaTitle = sajda.type === 'obligatory' ? __('sajdah_wajib') : __('sajdah_mustahab');
    html += ` <span class="sajda-indicator" title="${sajdaTitle}">۩</span>`;
  }
  html += ` <span class="ayah-number"><span class="ayah-number-inner">${a.numberInSurah}</span></span>`;
  const translationData = state.translationData as { ayahs?: { text: string }[] } | null;
  if (state.translationEnabled && translationData?.ayahs?.[i]) {
    const transText = escapeHtml(translationData.ayahs[i].text);
    html += `<span class="translation-text${isRtlTranslation ? ' rtl-lang' : ''}">${transText}</span>`;
  }
  html += `</span> `;
  return html;
}

function renderAyahChunk(textData: SurahTextData, start: number, count: number): void {
  if (!dom.surahContent) {
    return;
  }
  const ayahsContainer = dom.surahContent.querySelector('.ayahs-container');
  if (!ayahsContainer) {
    return;
  }
  const end = Math.min(start + count, textData.ayahs.length);
  let html = '';
  for (let i = start; i < end; i++) {
    html += buildAyahHtml(textData.ayahs[i]!, i, textData);
  }

  // Find or create the chunk container
  const chunkIdx = getChunkIndex(start);
  const chunkId = `chunk-${chunkIdx}`;
  let chunkEl: HTMLElement | null = ayahsContainer.querySelector(`#${chunkId}`) as HTMLElement | null;

  if (chunkEl) {
    // Replace spacer with rendered content
    chunkEl.innerHTML = html;
    chunkEl.removeAttribute('data-spacer');
    chunkEl.style.height = '';
  } else {
    // Create new chunk element
    const newChunkEl: HTMLElement = document.createElement('div') as HTMLElement;
    newChunkEl.id = chunkId;
    newChunkEl.className = 'virtual-chunk';
    newChunkEl.dataset['chunk'] = String(chunkIdx);
    newChunkEl.innerHTML = html;
    // Insert in the correct order
    // @ts-expect-error — document.createElement returns HTMLDivElement which is HTMLElement
    // but TS6 infers Element due to global.d.ts augmentation
    insertChunkInOrder(ayahsContainer, newChunkEl, chunkIdx);
    chunkEl = newChunkEl;
  }

  // Cache the height of this chunk
  requestAnimationFrame(() => {
    if (chunkEl && chunkEl.offsetHeight > 0) {
      _chunkHeightCache.set(chunkCacheKey(textData.number, chunkIdx), chunkEl.offsetHeight);
    }
  });

  _ayahsReadyCount = Math.max(_ayahsReadyCount, end);
  _renderedChunks.add(chunkIdx);
}

/**
 * Insert a chunk element in the correct DOM order within the ayahs container.
 * Ensures chunks are always in ascending order regardless of render sequence.
 */
function insertChunkInOrder(container: HTMLElement, chunkEl: HTMLElement, chunkIdx: number): void {
  // Find the right position by looking at existing chunks
  const existingChunks = container.querySelectorAll('.virtual-chunk');
  let inserted = false;
  for (const existing of existingChunks) {
    const existingIdx = parseInt((existing as HTMLElement).dataset['chunk'] || '0', 10);
    if (existingIdx > chunkIdx) {
      container.insertBefore(chunkEl, existing);
      inserted = true;
      break;
    }
  }
  if (!inserted) {
    container.appendChild(chunkEl);
  }
}

/**
 * Replace a rendered chunk with a spacer div of the same height.
 * This removes the DOM nodes while preserving scroll position.
 */
function replaceChunkWithSpacer(surahNum: number, chunkIdx: number): void {
  const ayahsContainer = dom.surahContent?.querySelector('.ayahs-container');
  if (!ayahsContainer) {
    return;
  }

  const chunkEl = ayahsContainer.querySelector(`#chunk-${chunkIdx}`) as HTMLElement | null;
  if (!chunkEl || chunkEl.dataset['spacer'] === 'true') {
    return; // Already a spacer or not found
  }

  // Cache height before replacing
  const height = chunkEl.offsetHeight;
  if (height > 0) {
    _chunkHeightCache.set(chunkCacheKey(surahNum, chunkIdx), height);
  }

  // Replace with spacer
  chunkEl.innerHTML = '';
  chunkEl.dataset['spacer'] = 'true';
  chunkEl.style.height = `${height}px`;
  _renderedChunks.delete(chunkIdx);
}

/**
 * Determine which chunks should be visible based on the current viewport.
 * Returns the set of chunk indices that should be rendered.
 */
function getVisibleChunks(): Set<number> {
  const visibleChunks = new Set<number>();
  const ayahsContainer = dom.surahContent?.querySelector('.ayahs-container');
  if (!ayahsContainer || !_currentTextData) {
    return visibleChunks;
  }

  // Find which chunks are currently in the viewport
  const containerRect = ayahsContainer.getBoundingClientRect();
  const viewportTop = containerRect.top - 300; // 300px buffer above
  const viewportBottom = containerRect.bottom + 300; // 300px buffer below

  // Check each existing chunk/spacer
  const chunks = ayahsContainer.querySelectorAll('.virtual-chunk');
  for (const chunk of chunks) {
    const rect = chunk.getBoundingClientRect();
    if (rect.bottom >= viewportTop && rect.top <= viewportBottom) {
      const chunkIdx = parseInt((chunk as HTMLElement).dataset['chunk'] || '0', 10);
      // Add the visible chunk and its neighbors
      for (let i = chunkIdx - VISIBLE_WINDOW_CHUNKS; i <= chunkIdx + VISIBLE_WINDOW_CHUNKS; i++) {
        if (i >= 0 && i < _totalChunks) {
          visibleChunks.add(i);
        }
      }
    }
  }

  // Always keep the playing ayah's chunk visible
  if (state.isPlaying && state.currentAyahIndex >= 0) {
    const playingChunk = getChunkIndex(state.currentAyahIndex);
    for (let i = playingChunk - 1; i <= playingChunk + 1; i++) {
      if (i >= 0 && i < _totalChunks) {
        visibleChunks.add(i);
      }
    }
  }

  return visibleChunks;
}

/**
 * Update which chunks are rendered vs spacered based on current scroll position.
 * This is the core of the virtual scrolling mechanism.
 */
function updateVisibleChunks(): void {
  if (!_currentTextData || _totalChunks === 0) {
    return;
  }

  const visibleChunks = getVisibleChunks();
  const surahNum = _currentTextData.number;

  // Remove chunks that are too far from viewport
  for (const chunkIdx of _renderedChunks) {
    if (!visibleChunks.has(chunkIdx)) {
      replaceChunkWithSpacer(surahNum, chunkIdx);
    }
  }

  // Render chunks that should be visible but aren't
  for (const chunkIdx of visibleChunks) {
    if (!_renderedChunks.has(chunkIdx)) {
      const startAyah = chunkIdx * VIRTUAL_CHUNK_SIZE;
      const isSpacer = dom.surahContent?.querySelector(`#chunk-${chunkIdx}[data-spacer="true"]`);
      if (isSpacer) {
        // Restore from spacer — re-render the chunk
        renderAyahChunk(_currentTextData, startAyah, VIRTUAL_CHUNK_SIZE);
      } else if (!_ayahsReadyCount || startAyah >= _ayahsReadyCount) {
        // Never rendered before
        renderAyahChunk(_currentTextData, startAyah, VIRTUAL_CHUNK_SIZE);
      }
    }
  }
}

/** Throttled scroll handler for virtual scrolling. */
let _scrollRafPending = false;
function onVirtualScroll(): void {
  if (_scrollRafPending) {
    return;
  }
  _scrollRafPending = true;
  requestAnimationFrame(() => {
    _scrollRafPending = false;
    updateVisibleChunks();
  });
}

/**
 * Set up the scroll-based virtual scrolling observer.
 * Uses a scroll event listener with requestAnimationFrame throttling.
 *
 * NOTE: Currently unused — renderSurah() renders all ayahs at once instead of
 * using virtual scrolling. Kept for future re-enablement if performance requires it.
 */
function _setupVirtualScrollObserver(): void {
  cleanupVirtualScrollObserver();
  window.addEventListener('scroll', onVirtualScroll, { passive: true });
}

function cleanupVirtualScrollObserver(): void {
  window.removeEventListener('scroll', onVirtualScroll);
  _scrollRafPending = false;
}

function cleanupVirtualObserver(): void {
  if (_virtualObserver) {
    _virtualObserver.disconnect();
    _virtualObserver = null;
  }
  const existing = document.getElementById('virtualSentinel');
  if (existing) {
    existing.remove();
  }
}

/** Render surah content into dom.surahContent. */
export function renderSurah(textData: SurahTextData): void {
  if (!dom.surahContent) {
    return;
  }
  cleanupVirtualObserver();
  cleanupVirtualScrollObserver();
  _currentTextData = textData;

  // Update breadcrumbs
  const breadcrumbSurah = document.getElementById('breadcrumbSurah');
  if (breadcrumbSurah) {
    breadcrumbSurah.textContent = `${textData.name} (${textData.englishName})`;
    breadcrumbSurah.classList.add('breadcrumb-surah');
  }

  const isArabicTitle = getLang() === 'ar';
  let html = `<h2 class="surah-title"><span class="surah-title-name" data-surah-title-name dir="${isArabicTitle ? 'rtl' : 'ltr'}">${escapeHtml(getLocalizedSurahName(textData))}</span>`;
  if (SURAH_SECRETS[textData.number]) {
    html += `<button class="surah-secret-title-btn" data-surah="${textData.number}" data-surahname="${escapeHtml(textData.name)}" title="${__('surah_info_title')}" aria-label="${__('surah_info_title')}">ℹ️</button>`;
  }
  html += `</h2>`;
  if (textData.number !== 1 && textData.number !== 9) {
    html +=
      '<div class="bismillah-wrapper"><span class="bismillah-ornament">﴿</span><p class="bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p><span class="bismillah-ornament">﴾</span></div>';
  }
  html += `<div class="ayahs-container" style="--ayah-font-size:${state.fontSize}px">`;

  // Render ALL ayahs at once — no virtual scrolling, no chunks, no spacers.
  // Modern browsers handle 286 ayahs (surah Al-Baqarah) without performance issues.
  // This eliminates the visual gaps that appeared every 20 ayahs.
  for (let i = 0; i < textData.ayahs.length; i++) {
    html += buildAyahHtml(textData.ayahs[i]!, i, textData);
  }

  html += `</div>`;
  dom.surahContent.innerHTML = html;
  initAyahDelegation();

  const secretBtn = dom.surahContent.querySelector('.surah-secret-title-btn');
  if (secretBtn) {
    (secretBtn as HTMLElement).addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      import('./mushaf.js').then((m: { showSurahSecret: (surahNum: number, surahName?: string) => void }) =>
        m.showSurahSecret(
          parseInt((secretBtn as HTMLElement).dataset['surah'] || '0', 10),
          (secretBtn as HTMLElement).dataset['surahname'],
        ),
      );
    });
  }
}

function buildAyahWordsHtml(text: string, ayahIdx: number, colorMap: Map<number, TajweedRule> | null): string {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const useTajweed = state.tajweedEnabled && colorMap;
  let outputPos = 0;
  return words
    .map((word: string, wIdx: number) => {
      const wordHtml = useTajweed ? tajweedColorWord(word, outputPos, colorMap!) : escapeHtml(word);
      outputPos += word.length + (wIdx < words.length - 1 ? 1 : 0); // +1 for space between words
      return `<span class="word" data-ayah-index="${ayahIdx}" data-word-index="${wIdx}">${wordHtml}</span>`;
    })
    .join(' ');
}

let _ayahDelegationBound = false;
function initAyahDelegation(): void {
  if (!dom.surahContent || _ayahDelegationBound) {
    return;
  }
  _ayahDelegationBound = true;
  dom.surahContent.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const ayahEl = target.closest('.ayah') as HTMLElement | null;
    if (!ayahEl) {
      return;
    }
    const idx = parseInt(ayahEl.getAttribute('data-index') || '0', 10);
    const surah = parseInt(ayahEl.dataset['surah'] || '0', 10);
    const ayah = parseInt(ayahEl.dataset['ayah'] || '0', 10);
    const surahData: SurahData | null = state.surahData;
    if (!surahData || surahData.number !== surah) {
      return;
    }
    const a = surahData.ayahs[idx];
    if (!a) {
      return;
    }

    const tafsirIsOpen = dom.tafsirCurtain?.classList.contains('open') === true;

    // When tafsir is visible, selecting any part of an ayah changes the active
    // ayah immediately so the curtain follows the reader's choice. Otherwise,
    // preserve the normal behavior: numbers play, while ayah text opens details.
    if (target.closest('.ayah-number') || tafsirIsOpen) {
      state.currentAyahIndex = idx;
      if (target.closest('.ayah-number')) {
        playCurrentAyah();
      }
      highlightCurrentAyah();
      updatePlayerInfo();
      return;
    }

    // Default: click on ayah text opens the modal
    import('./ayah-modal.js').then(
      (m: {
        openAyahModal: (opts: { surah: number; ayah: number; text: string; surahName: string; index: number }) => void;
      }) => m.openAyahModal({ surah, ayah, text: a.text, surahName: surahData.name, index: idx }),
    );
  });
}

// NOTE: ayahClickHandler removed — click delegation is handled by initAyahDelegation() above.

function finalizeSurahLoad(opts: LoadSurahOptions): void {
  const surahData: SurahData | null = state.surahData;
  if (opts.startAyah && surahData) {
    const idx = surahData.ayahs.findIndex((a: AyahEntry) => a.numberInSurah === opts.startAyah);
    if (idx !== -1) {
      state.currentAyahIndex = idx;
    }
  } else {
    state.currentAyahIndex = 0;
  }
  highlightCurrentAyah();
  updatePlayerInfo();
  if (opts.autoPlay) {
    playCurrentAyah();
  }
  if (state.autoSave) {
    saveCurrentPosition();
  }

  // Do not call `loadSurah` as a prefetch mechanism. It changes the active
  // surah, clears the visible ayahs, and aborts the reader's current request.
  // A future prefetch implementation must fetch and cache data independently
  // of the reader state; correctness of the current reading session takes
  // precedence over speculative loading.
}

/** Scroll to and highlight the current ayah. */
export function highlightCurrentAyah(): void {
  const container = dom.surahContent?.querySelector('.ayahs-container');
  // Remove 'current' class only from rendered ayahs (not iterating spacers)
  const currentAyahs = container?.querySelectorAll('.ayah.current');
  if (currentAyahs) {
    for (const el of currentAyahs) {
      el.classList.remove('current');
    }
  }

  const surahData: SurahData | null = state.surahData;
  if (!surahData) {
    return;
  }

  // All ayahs are rendered at once — no chunk checking needed
  const cur = container?.querySelector(`.ayah[data-index="${state.currentAyahIndex}"]`) as HTMLElement | null;
  if (cur) {
    cur.classList.add('current');
    if (state.hifdhMode) {
      // Remove 'revealed' from all ayahs first
      const revealedAyahs = container?.querySelectorAll('.ayah.revealed');
      if (revealedAyahs) {
        for (const el of revealedAyahs) {
          el.classList.remove('revealed');
        }
      }
      // Mark current and all rendered previous ayahs as revealed
      for (let i = 0; i <= state.currentAyahIndex; i++) {
        const prev = container?.querySelector(`.ayah[data-index="${i}"]`) as HTMLElement | null;
        if (prev) {
          prev.classList.add('revealed');
        }
      }
    }
    cur.scrollIntoView({ behavior: 'instant', block: 'center' });
  }
  updatePlayerInfo();
  import('./presentation.js')
    .then((m: { syncPresentation: () => void }) => m.syncPresentation())
    .catch(() => {
      /* noop */
    });
  if (dom.tafsirCurtain && dom.tafsirCurtain.classList.contains('open')) {
    loadTafsirForCurrentAyah();
  }
  if (state.mushafMode) {
    import('./mushaf.js').then((m: { highlightMushafAyah: () => void }) => m.highlightMushafAyah());
  }
}

/**
 * Update the player UI elements with current surah and ayah information.
 * Refreshes surah name, reciter name, current ayah preview,
 * and collapsed player info text.
 */
export function updatePlayerInfo(): void {
  const surahData: SurahData | null = state.surahData;
  if (!surahData) {
    return;
  }
  const a = surahData.ayahs[state.currentAyahIndex];
  const reciterText = dom.reciterSelect?.options[dom.reciterSelect.selectedIndex]?.text || '';
  if (dom.playerSurahName) {
    dom.playerSurahName.textContent = surahData.name;
  }
  if (dom.playerReciterName) {
    dom.playerReciterName.textContent = reciterText;
  }
  if (dom.playerCurrentAyah && a) {
    const preview = a.text.length > 80 ? a.text.substring(0, 80) + '...' : a.text;
    dom.playerCurrentAyah.textContent = `﴿${preview}﴾ — ${__('ayah')} ${a.numberInSurah}`;
  }
  if (dom.collapsedInfo) {
    dom.collapsedInfo.innerHTML = collapsedPlayerInfo(surahData.name);
  }
}

function saveCurrentPosition(): void {
  const surahData: SurahData | null = state.surahData;
  if (!surahData) {
    return;
  }
  const a = surahData.ayahs[state.currentAyahIndex];
  if (!a) {
    return;
  }
  storage.set('last_position', {
    surah: state.currentSurah,
    ayah: a.numberInSurah,
    surahName: surahData.name,
    ayahNumberInSurah: a.numberInSurah,
    timestamp: Date.now(),
  } satisfies SavedPosition);
}

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
