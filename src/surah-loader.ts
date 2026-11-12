import { CONFIG } from './config.js';
import { storage } from './storage.js';
import { dom } from './dom.js';
import { showToast, loadingBar } from './ui.js';
import { __ } from './i18n.js';
import { skeletonLoading, surahLoadError, escapeHtml } from './templates.js';
import { state, batch, immutableMapDelete, immutableMapSet, SurahInfo } from './state.js';
import { getReciterById, buildAudioUrl } from './reciters.js';
import { loadTajweedAnnotationsForSurah } from './tajweed-data.js';
import { prepareAudioForNewSurah, playCurrentAyah } from './features/audio/audio.js';
import { recordReadingSession } from './reading-stats.js';
import { apiFetch, jsonFetch } from './api-client.js';
import type { SurahData, AyahEntry } from './types.js';
import { cacheSurahToIDB, getCachedSurahFromIDB } from './surah-cache.js';
import type { CachedSurahEntry } from './surah-cache.js';
import { loadLocalSurahText, loadLocalTranslation } from './api-fallback.js';
import {
  renderSurah,
  finalizeSurahLoad,
  highlightCurrentAyah,
  patchTranslations,
  renderSurahIfChanged,
} from './surah-render.js';
import type { SurahTextData, LoadSurahOptions } from './surah-render.js';

// Re-export surah-list helpers so existing callers of surah-loader.loadSurahList /
// populateReciterSelect / buildSurahOffsets continue to work without changing import paths.
// The functions are imported lazily inside surah-loader where needed (via dynamic import
// or direct calls through the surah-list module).
export { loadSurahList, populateReciterSelect, buildSurahOffsets, absToSurahAyah, getAbsNumber } from './surah-list.js';

// Re-export the render cluster (now in surah-render.ts) so existing callers of
// surah-loader.renderSurah / highlightCurrentAyah / updatePlayerInfo /
// updateCurrentSurahLocale continue to work without changing import paths.
export {
  renderSurah,
  highlightCurrentAyah,
  updatePlayerInfo,
  updateCurrentSurahLocale,
  patchTranslations,
  renderSurahIfChanged,
} from './surah-render.js';
import {
  AudioResult,
  ReciterInfo,
  calculateAyahTimings,
  loadMp3quranAudio,
  loadApiAudio,
  getOfflinePackAudioResult,
  findFallbackAudio,
  setSurahCacheEntry,
  nextLoadGeneration,
  isCurrentLoad,
  currentAudioMarkers,
  markCurrentAudio,
} from './surah-audio.js';
import { setTrustedHtml } from './safe-html.js';

export { loadAudioUrlsForSession, reloadCurrentSurahAudio, calculateAyahTimings } from './surah-audio.js';

/* ===================== LOAD & RENDER SURAH ===================== */

/** Surah + reciter of the last audio list actually assigned to the player.
 *  Used to decide whether a new load is a "same surah reload" (keep audio)
 *  or a real switch (clear audio). */
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
 * Everything a load needs after the shared reset: the request signal, the
 * cache identity, and the reciter flags each branch reads.
 */
interface SurahLoadContext {
  signal: AbortSignal;
  cacheKey: string;
  reciterInfo: ReciterInfo;
  isMp3quran: boolean;
  currentLoad: number;
}

/**
 * Shared prologue for every surah load: reset stale audio/translation state,
 * leave hifdh/repeat modes, cancel the previous request, and derive the cache
 * key for this surah + reciter + translation.
 */
function beginSurahLoad(surahNum: number, currentLoad: number): SurahLoadContext {
  // Clear stale audio/translation before the new load (batched to avoid
  // intermediate notifications). Also null out surahData and reset
  // currentAyahIndex so consumers reading state.currentSurah + state.surahData
  // during the await below see a consistent "loading" state (null surahData)
  // rather than a stale previous surah.
  // Audio lists survive a reload of the SAME surah+reciter (e.g. toggling
  // translation) so the player is never left silent while the new list loads.
  const keepAudio = surahNum === currentAudioMarkers().surah && state.currentReciter === currentAudioMarkers().reciter;
  batch(() => {
    state.loadingSurah = surahNum;
    state.ayahsAudios = keepAudio ? state.ayahsAudios : [];
    state.ayahTimings = keepAudio ? state.ayahTimings : [];
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

  const cacheKey = `${surahNum}_${state.currentReciter}_${state.currentTranslation || 'notr'}`;
  const reciterInfo = getReciterById(state.currentReciter) as ReciterInfo;
  return {
    signal: currentSurahController.signal,
    cacheKey,
    reciterInfo,
    isMp3quran: reciterInfo.source === 'mp3quran',
    currentLoad,
  };
}

/**
 * Assign the audio list and translation that came with a cached surah.
 * MP3QURAN sources rebuild per-ayah URLs from the reciter template; API
 * sources keep the per-ayah URLs the provider returned.
 */
function applyCachedSurahData(entry: CachedSurahEntry, surahNum: number, ctx: SurahLoadContext): void {
  state.surahData = entry.text as unknown as SurahData;
  if (ctx.isMp3quran) {
    state.ayahsAudios = entry.text.ayahs.map(() => buildAudioUrl(ctx.reciterInfo, surahNum) || '');
    state.ayahTimings = entry.timings || calculateAyahTimings(entry.text.ayahs, surahNum);
  } else {
    state.ayahsAudios = Array.isArray(entry.audios)
      ? (entry.audios as string[])
      : entry.audio?.ayahs?.map((a: AyahEntry) => a.audio || '') || [];
    state.ayahTimings = [];
  }
  state.translationData = entry.translation || null;
}

/**
 * Memory-cache path. Returns true when the load was satisfied (or superseded),
 * so the caller can stop; false when there is no entry and the caller should
 * try IndexedDB.
 */
async function tryMemoryCache(surahNum: number, opts: LoadSurahOptions, ctx: SurahLoadContext): Promise<boolean> {
  if (!state.surahCache.has(ctx.cacheKey)) {
    return false;
  }
  const cached = state.surahCache.get(ctx.cacheKey) as unknown as CachedSurahEntry;
  if (!isCurrentLoad(ctx.currentLoad)) {
    return true;
  }
  // ARC-10: a pure memory hit must refresh recency too (delete + re-insert,
  // same as setSurahCacheEntry) — otherwise the CACHE_LIMIT eviction is LRU
  // for writes but FIFO for reads, and the 20 most-read surahs can be evicted
  // by write churn of surahs nobody reopened.
  immutableMapDelete(state, 'surahCache', ctx.cacheKey);
  immutableMapSet(state, 'surahCache', ctx.cacheKey, cached);
  applyCachedSurahData(cached, surahNum, ctx);
  await prepareTajweedForSurah(surahNum);
  if (!isCurrentLoad(ctx.currentLoad)) {
    return true;
  }
  renderSurah(cached.text);
  finalizeSurahLoad(opts);
  clearSurahLoadingState();
  return true;
}

/**
 * IndexedDB-cache path (offline support). Returns true when an entry was found
 * and rendered — the caller then stops. When online, a debounced background
 * refresh keeps the cached copy fresh (stale-while-revalidate).
 */
async function tryIdbCache(surahNum: number, opts: LoadSurahOptions, ctx: SurahLoadContext): Promise<boolean> {
  const idbCached = await getCachedSurahFromIDB(ctx.cacheKey);
  if (!idbCached) {
    return false;
  }
  if (!isCurrentLoad(ctx.currentLoad)) {
    return true;
  }
  // Also store in memory cache
  setSurahCacheEntry(ctx.cacheKey, idbCached);
  applyCachedSurahData(idbCached, surahNum, ctx);
  markCurrentAudio(surahNum, state.currentReciter);
  await prepareTajweedForSurah(surahNum);
  if (!isCurrentLoad(ctx.currentLoad)) {
    return true;
  }
  renderSurah(idbCached.text);
  finalizeSurahLoad(opts);
  clearSurahLoadingState();
  scheduleBackgroundRefresh(surahNum, ctx);
  return true;
}

/**
 * Queue one trailing re-fetch of the surah that was just served from cache.
 * Uses a SEPARATE AbortController so the refresh isn't cancelled when the user
 * loads a different surah, and debounces so fast navigation coalesces into at
 * most one request for the most recently opened surah.
 */
function scheduleBackgroundRefresh(surahNum: number, ctx: SurahLoadContext): void {
  if (!navigator.onLine) {
    return;
  }
  if (_refreshDebounceTimer) {
    clearTimeout(_refreshDebounceTimer);
  }
  _refreshDebounceTimer = setTimeout(() => {
    _refreshDebounceTimer = null;
    if (_refreshController) {
      _refreshController.abort();
    }
    _refreshController = new AbortController();
    void _refreshSurahFromAPI(
      surahNum,
      ctx.cacheKey,
      ctx.reciterInfo,
      ctx.isMp3quran,
      ctx.currentLoad,
      _refreshController.signal,
    );
  }, REFRESH_DEBOUNCE_MS);
}

/** Immediate loading affordance shown while the network fetch is in flight. */
function showSurahLoadingNotice(message: string): void {
  loadingBar.show(`${message}...`);
  if (dom.surahContent) {
    setTrustedHtml(
      dom.surahContent,
      `<div class="surah-loading-notice" role="status"><span class="surah-loading-orb" aria-hidden="true"></span>${escapeHtml(message)}</div>${skeletonLoading()}`,
    );
  }
}

/**
 * Download the surah text: bundled local JSON first (no network wait), then the
 * API. Throws when neither yields a usable ayah list.
 */
async function fetchSurahTextData(surahNum: number, signal: AbortSignal): Promise<SurahTextData> {
  // Bundled local text first (data/surah-{n}.json) — a tiny file served with
  // NO network wait, keeping the first-surah text off the LCP critical path.
  // Served from the service worker's runtime cache on repeat visits. Any
  // surah without a bundle falls straight through to the API.
  let textJson: { data?: SurahTextData } | null = null;
  try {
    textJson = (await jsonFetch(`data/surah-${surahNum}.json`, { silent: true })) as {
      data?: SurahTextData;
    };
  } catch {
    /* no local bundle — fall back to API */
  }
  if (!textJson?.data?.ayahs?.length) {
    textJson = (await apiFetch(`/surah/${surahNum}/quran-uthmani`, {
      signal,
      errorMsg: __('failed_load_surah'),
    })) as { data?: SurahTextData };
  }
  const textData: SurahTextData = textJson?.data as SurahTextData;
  if (!textData?.ayahs?.length) {
    throw new Error(__('invalid_surah_data'));
  }
  return textData;
}

/**
 * Fetch audio + translation in parallel and apply them to the freshly rendered
 * surah. Returns false when a newer load superseded this one, so the caller
 * must stop before caching the stale result.
 */
async function loadNetworkAudioAndTranslation(
  surahNum: number,
  textData: SurahTextData,
  autoPlay: boolean | undefined,
  ctx: SurahLoadContext,
): Promise<boolean> {
  const audioPromise = ctx.isMp3quran
    ? loadMp3quranAudio(surahNum, textData, ctx.reciterInfo, ctx.currentLoad)
    : loadApiAudio(surahNum, state.currentReciter, ctx.currentLoad, ctx.signal);
  const transPromise =
    state.translationEnabled && state.currentTranslation
      ? apiFetch(`/surah/${surahNum}/${state.currentTranslation}`, { signal: ctx.signal, silent: true })
          .then((d: unknown) => (d as { data?: Record<string, unknown> })?.data || null)
          // When the edition endpoint is unreachable, serve the bundled
          // translation file instead of dropping to Arabic-only silence.
          .catch(() => loadLocalTranslation(surahNum, state.currentTranslation as string))
      : Promise.resolve(null);

  const [audioResult, transResult]: [AudioResult | null, Record<string, unknown> | null] = await Promise.all([
    audioPromise,
    transPromise,
  ]);
  if (!isCurrentLoad(ctx.currentLoad)) {
    return false;
  }
  if (audioResult) {
    // Preserve array indices — replace nulls with empty strings instead of filtering
    state.ayahsAudios = audioResult.audios.map((a): string => a ?? '');
    state.ayahTimings = audioResult.timings;
  } else {
    // Audio fetch failed (rate-limit, flake): reuse the last good list for
    // this surah+reciter instead of leaving the reader permanently silent.
    const fallback = findFallbackAudio(surahNum, state.currentReciter);
    if (fallback) {
      state.ayahsAudios = fallback.audios;
      state.ayahTimings = fallback.timings;
    }
  }
  markCurrentAudio(surahNum, state.currentReciter);
  state.translationData = transResult;
  if (transResult && state.surahData && !state.mushafMode) {
    // N-02: while the mushaf canvas is open, the reader DOM is not mounted,
    // so patchTranslations() would report failure and its full-render
    // fallback would replace the open canvas with the ayah list. The
    // translation is already in state; leaving mushaf mode re-renders
    // from it (mushaf.ts exit path).
    // Translation arrived after the text render: patch the missing spans in
    // place instead of rebuilding ~6,300 word spans. Falls back to a full
    // render if the DOM no longer matches the surah.
    if (!patchTranslations()) {
      renderSurah(state.surahData);
    }
    highlightCurrentAyah();
  }

  if (autoPlay && state.ayahsAudios.length) {
    playCurrentAyah();
  }
  return true;
}

/**
 * Offline/failure fallbacks, in order: the in-memory full Quran, then the
 * bundled local text. Returns true when one of them produced a rendered surah.
 */
async function renderOfflineFallback(
  error: unknown,
  surahNum: number,
  opts: LoadSurahOptions,
  ctx: SurahLoadContext,
): Promise<boolean> {
  // Only treat an abort as "user navigated to another surah" when THIS load's
  // controller was actually cancelled. The internal per-attempt timeout also
  // surfaces as an AbortError (15s stall = real outage); bailing silently there
  // would leave the reader stuck on the loading notice and skip the offline
  // fallback, so those must still fall through to the local text.
  if ((error as Error).name === 'AbortError' && ctx.signal.aborted) {
    return true;
  }
  if (state.fullQuranLoaded && state.fullQuranText) {
    if (!isCurrentLoad(ctx.currentLoad)) {
      return true;
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
      const offlineAudio = await getOfflinePackAudioResult(surahNum, state.surahData);
      state.ayahsAudios = offlineAudio?.audios.map((audio) => audio ?? '') ?? [];
      state.ayahTimings = offlineAudio?.timings ?? [];
      renderSurah(state.surahData!);
      finalizeSurahLoad(opts);
      loadingBar.hide();
      state.loadingSurah = null;
      return true;
    }
  }
  // Final fallback: try the local bundled Quran text (public/data/quran-uthmani.json).
  // This works even when fully offline because the file is bundled with the app
  // and precached by the PWA service worker.
  try {
    const localSurah = await loadLocalSurahText(surahNum);
    if (localSurah && isCurrentLoad(ctx.currentLoad)) {
      state.surahData = localSurah;
      const offlineAudio = await getOfflinePackAudioResult(surahNum, localSurah);
      state.ayahsAudios = offlineAudio?.audios.map((audio) => audio ?? '') ?? [];
      state.ayahTimings = offlineAudio?.timings ?? [];
      renderSurah(localSurah);
      finalizeSurahLoad(opts);
      loadingBar.hide();
      showToast(__('offline_mode'), 'success');
      state.loadingSurah = null;
      return true;
    }
  } catch {
    /* local fallback also failed — fall through to error display */
  }
  return false;
}

/**
 * Load a surah (text + audio + translation), render it, finalize.
 *
 * The body is a small orchestrator over the paths above: memory cache →
 * IndexedDB cache → network, with the offline fallbacks on failure.
 */
export async function loadSurah(surahNum: number, opts: LoadSurahOptions = {}): Promise<void> {
  if (!surahNum) {
    return;
  }
  const currentLoad = nextLoadGeneration();
  const ctx = beginSurahLoad(surahNum, currentLoad);

  if (await tryMemoryCache(surahNum, opts, ctx)) {
    return;
  }
  if (await tryIdbCache(surahNum, opts, ctx)) {
    return;
  }

  const surahLabel = state.surahList.find((s: SurahInfo) => s.number === surahNum)?.name || String(surahNum);
  showSurahLoadingNotice(`${__('loading_surah')} ${surahLabel}`);

  try {
    const textData = await fetchSurahTextData(surahNum, ctx.signal);
    if (!isCurrentLoad(currentLoad)) {
      return;
    }
    state.surahData = textData as SurahData;

    await prepareTajweedForSurah(surahNum);
    if (!isCurrentLoad(currentLoad)) {
      return;
    }
    renderSurah(textData);
    const autoPlay = opts.autoPlay;
    finalizeSurahLoad({ ...opts, autoPlay: false });
    recordReadingSession(surahNum, textData.ayahs.length);
    loadingBar.hide();

    // Load audio and translation independently (don't block render)
    if (!(await loadNetworkAudioAndTranslation(surahNum, textData, autoPlay, ctx))) {
      return;
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
    setSurahCacheEntry(ctx.cacheKey, cacheEntry);
    // Also persist to IndexedDB for offline access
    cacheSurahToIDB(ctx.cacheKey, cacheEntry);
  } catch (e: unknown) {
    if (await renderOfflineFallback(e, surahNum, opts, ctx)) {
      return;
    }
    if (!isCurrentLoad(currentLoad)) {
      return;
    }
    if (dom.surahContent) {
      setTrustedHtml(dom.surahContent, surahLoadError());
    }
    loadingBar.hide();
  } finally {
    // Only clear loading state if this is still the active load
    // (prevents a stale load from clearing a newer load's indicator)
    if (isCurrentLoad(currentLoad)) {
      state.loadingSurah = null;
      dom.surahContent?.classList.remove('is-loading');
      dom.surahContent?.setAttribute('aria-busy', 'false');
    }
  }
}

/** Clear the loading affordances once a cached surah has been rendered. */
function clearSurahLoadingState(): void {
  state.loadingSurah = null;
  dom.surahContent?.classList.remove('is-loading');
  dom.surahContent?.setAttribute('aria-busy', 'false');
}

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
    if (!textData?.ayahs?.length || !isCurrentLoad(currentLoad)) {
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
            // When the edition endpoint is unreachable, serve the bundled
            // translation file instead of dropping to Arabic-only silence.
            .catch(() => loadLocalTranslation(surahNum, state.currentTranslation as string))
        : Promise.resolve(null);

    const [audioResult, transResult]: [AudioResult | null, Record<string, unknown> | null] = await Promise.all([
      audioPromise,
      transPromise,
    ]);
    if (!isCurrentLoad(currentLoad)) {
      return;
    }

    if (audioResult) {
      // Preserve array indices — replace nulls with empty strings instead of filtering
      state.ayahsAudios = audioResult.audios.map((a): string => a ?? '');
      state.ayahTimings = audioResult.timings;
    } else {
      // Audio fetch failed during a background refresh: keep/restore the last
      // good list for this surah+reciter instead of going silent.
      const fallback = findFallbackAudio(surahNum, state.currentReciter);
      if (fallback) {
        state.ayahsAudios = fallback.audios;
        state.ayahTimings = fallback.timings;
      }
    }
    markCurrentAudio(surahNum, state.currentReciter);
    state.translationData = transResult;

    // Update caches
    const cacheEntry: CachedSurahEntry = {
      text: textData,
      audios: state.ayahsAudios,
      timings: state.ayahTimings,
      translation: state.translationData,
    };
    setSurahCacheEntry(cacheKey, cacheEntry);
    cacheSurahToIDB(cacheKey, cacheEntry);

    // Re-render only when the data actually changed. Background refreshes
    // almost always deliver byte-identical text: skipping the rebuild avoids
    // thousands of word-span repaints and never moves the reader's scroll.
    // On a real change, preserve the scroll position across the rebuild.
    // N-02: never rebuild the reader while the mushaf canvas is open — the
    // refresh only needs to update state and the caches; leaving mushaf mode
    // re-renders from the refreshed state (mushaf.ts exit path).
    if (!state.mushafMode) {
      const scroller = dom.surahContent;
      const savedTop = scroller?.scrollTop ?? 0;
      const savedY = window.scrollY;
      if (renderSurahIfChanged(textData)) {
        if (scroller && scroller.scrollTop !== savedTop) {
          scroller.scrollTop = savedTop;
        }
        if (window.scrollY !== savedY) {
          window.scrollTo(0, savedY);
        }
      }
      highlightCurrentAyah();
    }
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
