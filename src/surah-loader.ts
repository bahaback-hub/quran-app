import { CONFIG } from './config.js';
import { storage } from './storage.js';
import { dom } from './dom.js';
import { showToast, loadingBar } from './ui.js';
import { __ } from './i18n.js';
import { escapeHtml } from './utils.js';
import { state, batch, immutablePush, immutableMapSet, immutableMapDelete, SurahInfo, SurahOffset } from './state.js';
import { RECITERS, getReciterById, buildAudioUrl, getTimingApiId } from './reciters.js';
import { tajweedColorWord, buildColorMap } from './tajweed.js';
import { getAyahAnnotations } from './tajweed-data.js';
import { SURAH_SECRETS } from './surahs-data.js';
import { isSajdaAyah, isJuzStart } from './quran-meta.js';
import { prepareAudioForNewSurah, playCurrentAyah } from './audio.js';
import { recordReadingSession } from './reading-stats.js';
import { loadTafsirForCurrentAyah } from './tafsir.js';
import { apiFetch, jsonFetch } from './api-client.js';

/* ===================== LOCAL INTERFACES ===================== */

/** A single ayah entry within surah data. */
interface AyahEntry {
  numberInSurah: number;
  text: string;
  number?: number;
  audio?: string;
}

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

/** Cached surah entry in surahCache. */
interface CachedSurahEntry {
  text: SurahTextData;
  audios?: (string | null)[];
  timings?: number[];
  audio?: { ayahs: AyahEntry[] };
  translation: Record<string, unknown> | null;
}

/** Saved position entry. */
interface SavedPosition {
  surah: number;
  ayah: number;
  surahName: string;
  ayahNumberInSurah: number;
  timestamp: number;
}

/* ===================== SURAH LIST ===================== */

/** Load surah list from cache, API, or local fallback, then populate dropdown. */
export async function loadSurahList(): Promise<void> {
  const cached = storage.get<SurahInfo[]>('surah_list');
  if (cached && cached.length === CONFIG.SURAH_COUNT) {
    state.surahList = cached;
    state.surahOffsets = null;
    buildSurahOffsets();
    populateSurahSelect();
    return;
  }
  if (dom.surahSelect) dom.surahSelect.innerHTML = `<option value="">${__('loading_surah_list')}</option>`;
  try {
    const data = await apiFetch('/surah', { silent: true });
    if (data?.data) {
      state.surahList = data.data;
      state.surahOffsets = null;
      storage.set('surah_list', data.data);
      populateSurahSelect();
      return;
    }
  } catch (_e) {
    /* fall through to local fallback */
  }
  try {
    const localData = await jsonFetch('data/surah-list.json', { silent: true });
    if (localData && localData.length === CONFIG.SURAH_COUNT) {
      state.surahList = localData;
      state.surahOffsets = null;
      storage.set('surah_list', localData);
      populateSurahSelect();
      return;
    }
  } catch (_e) {
    /* no local fallback */
  }
  if (dom.surahSelect) dom.surahSelect.innerHTML = `<option value="">${__('error_unexpected')}</option>`;
  // showToast(__('failed_load_surah'), 'error'); // disabled at startup
}

function populateSurahSelect(): void {
  if (!dom.surahSelect) return;
  dom.surahSelect.innerHTML = `<option value="">${__('select_surah')}</option>`;
  for (const s of state.surahList) {
    const opt = document.createElement('option');
    opt.value = String(s.number);
    opt.textContent = `${s.number}. ${s.name} (${s.englishName})`;
    dom.surahSelect.appendChild(opt);
  }
  dom.surahSelect.value = String(state.currentSurah);
}

export function populateReciterSelect(): void {
  if (!dom.reciterSelect) return;
  dom.reciterSelect.innerHTML = RECITERS.map((r: ReciterInfo) => `<option value="${r.id}">${r.name}</option>`).join('');
  dom.reciterSelect.value = state.currentReciter || CONFIG.DEFAULT_RECITER;
}

export function buildSurahOffsets(): void {
  if (state.surahOffsets || !state.surahList.length) return;
  state.surahOffsets = [];
  let cum = 1;
  const offsets: SurahOffset[] = [];
  for (const s of state.surahList) {
    offsets.push({ surahNum: s.number, startAbs: cum, count: s.numberOfAyahs, name: s.name });
    cum += s.numberOfAyahs;
  }
  state.surahOffsets = offsets;
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
  if (!apiId) return null;
  try {
    const data = await jsonFetch(
      `https://api.quran.com/api/v4/chapter_recitations/${apiId}/${surahNum}?segments=true`,
      { silent: true, timeout: 8000 }
    );
    if (!data) return null;
    const timestamps: TimestampEntry[] | undefined = data?.audio_file?.timestamps;
    if (!timestamps?.length || timestamps.length !== ayahs.length) return null;
    const totalDuration = timestamps[timestamps.length - 1].timestamp_to;
    if (!totalDuration || totalDuration <= 0) return null;
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
  if (!total) return ayahs.map(() => 0);
  let cum = basmalahChars / total;
  for (let i = 0; i < ayahs.length; i++) {
    timings.push(cum);
    cum += counts[i] / total;
  }
  return timings;
}

interface AbsToSurahAyahResult {
  surahNum: number;
  surahName: string;
  ayahNumInSurah: number;
}

function absToSurahAyah(absNum: number): AbsToSurahAyahResult | null {
  if (!state.surahOffsets) buildSurahOffsets();
  if (!state.surahOffsets) return null;
  for (const o of state.surahOffsets) {
    if (absNum >= o.startAbs && absNum < o.startAbs + o.count) {
      return { surahNum: o.surahNum, surahName: o.name, ayahNumInSurah: absNum - o.startAbs + 1 };
    }
  }
  return null;
}

function getAbsNumber(surah: number, ayah: number): number | null {
  if (!state.surahOffsets) buildSurahOffsets();
  if (!state.surahOffsets) return null;
  for (const o of state.surahOffsets) {
    if (o.surahNum === surah) return o.startAbs + ayah - 1;
  }
  return null;
}

/* ===================== AUDIO HELPERS (independent from text) ===================== */

/** Load audio for mp3quran reciter source. */
async function loadMp3quranAudio(
  surahNum: number,
  textData: SurahTextData,
  reciterInfo: ReciterInfo,
  currentLoad: number
): Promise<AudioResult | null> {
  try {
    const audios: (string | null)[] = textData.ayahs.map(() => buildAudioUrl(reciterInfo, surahNum));
    const timings =
      (await fetchAyahTimings(state.currentReciter, surahNum, textData.ayahs)) ??
      calculateAyahTimings(textData.ayahs, surahNum);
    if (_loadCounter !== currentLoad) return null;
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
  signal: AbortSignal
): Promise<AudioResult | null> {
  try {
    const json = await apiFetch(`/surah/${surahNum}/${reciterId}`, { signal, silent: true });
    const data = json?.data;
    if (!data?.ayahs?.length) throw new Error(__('no_audio_data'));
    const audios: (string | null)[] = data.ayahs.map((a: AyahEntry) => a.audio);
    if (_loadCounter !== currentLoad) return null;
    return { audios, timings: [] };
  } catch (e) {
    console.warn('[API] Audio load failed (non-fatal):', e);
    return null;
  }
}

/* ===================== LOAD & RENDER SURAH ===================== */

let _loadCounter = 0;
let currentSurahController: AbortController | null = null;

/**
 * Load a surah (text + audio + translation), render it, finalize.
 */
export async function loadSurah(surahNum: number, opts: LoadSurahOptions = {}): Promise<void> {
  if (!surahNum) return;
  _loadCounter++;
  const currentLoad = _loadCounter;
  // Clear stale audio/translation before new load (batched to avoid intermediate notifications)
  batch(() => {
    state.loadingSurah = surahNum;
    state.ayahsAudios = [];
    state.ayahTimings = [];
    state.translationData = null;
    state.isPlaying = false;
  });

  prepareAudioForNewSurah();

  if (state.hifdhMode) {
    batch(() => {
      state.hifdhMode = false;
      state.repeatMode = false;
      state.repeatCounter = 0;
    });
    dom.hifdhBtn?.classList.remove('active');
    document.querySelectorAll('.ayah').forEach((el) => el.classList.remove('hifdh-mode', 'revealed'));
    if (dom.repeatControls) dom.repeatControls.style.display = 'none';
  }
  if (state.repeatMode && !state.hifdhMode) {
    state.repeatMode = false;
    state.repeatCounter = 0;
    dom.repeatBtn?.classList.remove('active');
    if (dom.repeatControls) dom.repeatControls.style.display = 'none';
  }
  state.currentSurah = surahNum;

  // Cancel previous in-flight request
  if (currentSurahController) currentSurahController.abort();
  currentSurahController = new AbortController();
  const signal = currentSurahController.signal;

  const cacheKey = `${surahNum}_${state.currentReciter}_${state.currentTranslation || 'notr'}`;
  const reciterInfo = getReciterById(state.currentReciter) as ReciterInfo;
  const isMp3quran = reciterInfo.source === 'mp3quran';
  if (state.surahCache.has(cacheKey)) {
    const cached = state.surahCache.get(cacheKey) as CachedSurahEntry;
    if (_loadCounter !== currentLoad) return;
    state.surahData = cached.text as any;
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
    renderSurah(cached.text);
    finalizeSurahLoad(opts);
    state.loadingSurah = null;
    return;
  }

  loadingBar.show(
    `${__('loading_surah')} ${state.surahList.find((s: SurahInfo) => s.number === surahNum)?.name || surahNum}...`
  );
  if (dom.surahContent)
    dom.surahContent.innerHTML =
      '<div class="skeleton-loading"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div></div>';

  try {
    const textJson = await apiFetch(`/surah/${surahNum}/quran-uthmani`, { signal, errorMsg: __('failed_load_surah') });
    const textData: SurahTextData = textJson?.data;
    if (!textData?.ayahs?.length) {
      throw new Error(__('invalid_surah_data'));
    }
    if (_loadCounter !== currentLoad) return;
    state.surahData = textData as any;

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
            .then((d: { data?: Record<string, unknown> }) => d?.data || null)
            .catch(() => null)
        : Promise.resolve(null);

    const [audioResult, transResult]: [AudioResult | null, Record<string, unknown> | null] = await Promise.all([
      audioPromise,
      transPromise,
    ]);
    if (_loadCounter !== currentLoad) return;
    if (audioResult) {
      state.ayahsAudios = audioResult.audios.filter((a): a is string => a !== null);
      state.ayahTimings = audioResult.timings;
    }
    state.translationData = transResult;
    if (transResult && state.surahData) {
      renderSurah(state.surahData as any);
      highlightCurrentAyah();
    }

    if (autoPlay && audioResult) {
      playCurrentAyah();
    }

    if (state.surahCache.size >= CONFIG.CACHE_LIMIT) {
      const firstKey = state.surahCache.keys().next().value;
      immutableMapDelete(state, 'surahCache', firstKey);
    }
    immutableMapSet(state, 'surahCache', cacheKey, {
      text: textData,
      audios: state.ayahsAudios,
      timings: state.ayahTimings,
      translation: state.translationData,
    });
  } catch (e: unknown) {
    if ((e as Error).name === 'AbortError') return;
    if (state.fullQuranLoaded && state.fullQuranText) {
      if (_loadCounter !== currentLoad) return;
      const ayahs = state.fullQuranText.filter((a: { surah: number }) => a.surah === surahNum);
      if (ayahs.length) {
        state.surahData = {
          number: surahNum,
          name: ayahs[0].surahName,
          englishName: state.surahList.find((s: SurahInfo) => s.number === surahNum)?.englishName || '',
          ayahs: ayahs.map((a: { ayah: number; text: string }) => ({ numberInSurah: a.ayah, text: a.text })),
        };
        state.ayahsAudios = [];
        renderSurah(state.surahData as any);
        finalizeSurahLoad(opts);
        loadingBar.hide();
        // showToast(__('offline_no_audio'), ''); // disabled at startup
        state.loadingSurah = null;
        return;
      }
    }
    if (dom.surahContent) dom.surahContent.innerHTML = `<p class="error-msg">⚠️ ${__('failed_load_surah')}</p>`;
    // showToast(__('failed_load_surah'), 'error'); // disabled at startup
    loadingBar.hide();
  } finally {
    state.loadingSurah = null;
  }
}

const VIRTUAL_CHUNK_SIZE = 20;
let _ayahsReadyCount = 0;
let _virtualObserver: IntersectionObserver | null = null;

function buildAyahHtml(a: AyahEntry, i: number, textData: SurahTextData): string {
  const isRtlTranslation = state.currentTranslation && state.currentTranslation.startsWith('ur.');
  let txt = a.text;
  let offsetAdj = 0;
  if (textData.number !== 1 && a.numberInSurah === 1) {
    const stripped = txt.replace(
      /^ب[\u064B-\u065F\u0670]*س[\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*[هة][\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*[حخ][\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*[نث][\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*[حخ][\u064B-\u065F\u0670]*[يى][\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*/u,
      ''
    );
    offsetAdj = txt.length - stripped.length;
    txt = stripped;
  }
  let colorMap: Map<number, string> | null = null;
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
    html += `<div class="juz-marker"><span class="juz-label">الجزء ${juzNum}</span></div>`;
  }
  html += `<span class="ayah" data-index="${i}" data-surah="${textData.number}" data-ayah="${a.numberInSurah}">`;
  html += buildAyahWordsHtml(txt, i, colorMap);
  // Sajda indicator
  const sajda = isSajdaAyah(textData.number, a.numberInSurah);
  if (sajda.isSajda) {
    const sajdaTitle = sajda.type === 'obligatory' ? 'سجدة واجبة' : 'سجدة مستحبة';
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
  if (!dom.surahContent) return;
  const ayahsContainer = dom.surahContent.querySelector('.ayahs-container');
  if (!ayahsContainer) return;
  const end = Math.min(start + count, textData.ayahs.length);
  let html = '';
  for (let i = start; i < end; i++) {
    html += buildAyahHtml(textData.ayahs[i], i, textData);
  }
  ayahsContainer.insertAdjacentHTML('beforeend', html);
  _ayahsReadyCount = end;
  if (_ayahsReadyCount < textData.ayahs.length) {
    ensureVirtualSentinel(textData);
  } else {
    cleanupVirtualObserver();
  }
}

function ensureVirtualSentinel(textData: SurahTextData): void {
  cleanupVirtualObserver();
  const existing = document.getElementById('virtualSentinel');
  if (existing) existing.remove();
  const sentinel = document.createElement('div');
  sentinel.id = 'virtualSentinel';
  sentinel.style.height = '1px';
  dom.surahContent?.appendChild(sentinel);
  _virtualObserver = new IntersectionObserver(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && _ayahsReadyCount < textData.ayahs.length) {
        renderAyahChunk(textData, _ayahsReadyCount, VIRTUAL_CHUNK_SIZE);
      }
    },
    { rootMargin: '200px' }
  );
  _virtualObserver.observe(sentinel);
}

function cleanupVirtualObserver(): void {
  if (_virtualObserver) {
    _virtualObserver.disconnect();
    _virtualObserver = null;
  }
  const existing = document.getElementById('virtualSentinel');
  if (existing) existing.remove();
}

/** Render surah content into dom.surahContent. */
export function renderSurah(textData: SurahTextData): void {
  if (!dom.surahContent) return;
  cleanupVirtualObserver();
  _ayahsReadyCount = 0;

  // Update breadcrumbs
  const breadcrumbSurah = document.getElementById('breadcrumbSurah');
  if (breadcrumbSurah) {
    breadcrumbSurah.textContent = `${textData.name} (${textData.englishName})`;
    breadcrumbSurah.classList.add('breadcrumb-surah');
  }

  let html = `<h2 class="surah-title">${escapeHtml(textData.name)} — ${escapeHtml(textData.englishName)}`;
  if (SURAH_SECRETS[textData.number]) {
    html += ` <button class="surah-secret-title-btn" data-surah="${textData.number}" data-surahname="${escapeHtml(textData.name)}" title="${__('surah_info_title')}" aria-label="${__('surah_info_title')}">ℹ️</button>`;
  }
  html += `</h2>`;
  if (textData.number !== 1 && textData.number !== 9) {
    html +=
      '<div class="bismillah-wrapper"><span class="bismillah-ornament">﴿</span><p class="bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p><span class="bismillah-ornament">﴾</span></div>';
  }
  html += `<div class="ayahs-container" style="font-size:${state.fontSize}px"></div>`;
  dom.surahContent.innerHTML = html;
  initAyahDelegation();
  renderAyahChunk(textData, 0, VIRTUAL_CHUNK_SIZE);

  const secretBtn = dom.surahContent.querySelector('.surah-secret-title-btn');
  if (secretBtn) {
    (secretBtn as HTMLElement).addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      import('./mushaf.js').then((m: { showSurahSecret: (surahNum: number, surahName?: string) => void }) =>
        m.showSurahSecret(
          parseInt((secretBtn as HTMLElement).dataset.surah || '0', 10),
          (secretBtn as HTMLElement).dataset.surahname
        )
      );
    });
  }
}

function buildAyahWordsHtml(text: string, ayahIdx: number, colorMap: Map<number, string> | null): string {
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
  if (!dom.surahContent || _ayahDelegationBound) return;
  _ayahDelegationBound = true;
  dom.surahContent.addEventListener('click', (e: MouseEvent) => {
    const ayahEl = (e.target as HTMLElement).closest('.ayah') as HTMLElement | null;
    if (!ayahEl) return;
    const idx = parseInt(ayahEl.getAttribute('data-index') || '0', 10);
    const surah = parseInt(ayahEl.dataset.surah || '0', 10);
    const ayah = parseInt(ayahEl.dataset.ayah || '0', 10);
    const surahData = state.surahData as any;
    if (!surahData || surahData.number !== surah) return;
    const a = surahData.ayahs[idx];
    if (!a) return;
    import('./ayah-modal.js').then(
      (m: {
        openAyahModal: (opts: { surah: number; ayah: number; text: string; surahName: string; index: number }) => void;
      }) => m.openAyahModal({ surah, ayah, text: a.text, surahName: surahData.name, index: -1 })
    );
  });
}

// NOTE: ayahClickHandler removed — click delegation is handled by initAyahDelegation() above.

function finalizeSurahLoad(opts: LoadSurahOptions): void {
  const surahData = state.surahData as any;
  if (opts.startAyah && surahData) {
    const idx = surahData.ayahs.findIndex((a: AyahEntry) => a.numberInSurah === opts.startAyah);
    if (idx !== -1) state.currentAyahIndex = idx;
  } else {
    state.currentAyahIndex = 0;
  }
  highlightCurrentAyah();
  updatePlayerInfo();
  if (opts.autoPlay) playCurrentAyah();
  if (state.autoSave) saveCurrentPosition();
}

/** Scroll to and highlight the current ayah. */
export function highlightCurrentAyah(): void {
  const container = dom.surahContent?.querySelector('.ayahs-container');
  const ayahs = container?.children;
  if (ayahs) {
    for (let i = 0; i < ayahs.length; i++) ayahs[i].classList.remove('current');
  }
  const surahData = state.surahData as any;
  if (surahData && state.currentAyahIndex >= _ayahsReadyCount) {
    renderAyahChunk(surahData, _ayahsReadyCount, state.currentAyahIndex - _ayahsReadyCount + VIRTUAL_CHUNK_SIZE);
  }
  const cur = container?.querySelector(`.ayah[data-index="${state.currentAyahIndex}"]`) as HTMLElement | null;
  if (cur) {
    cur.classList.add('current');
    if (state.hifdhMode) {
      for (let i = 0; i < ayahs!.length; i++) ayahs![i].classList.remove('revealed');
      for (let i = 0; i <= state.currentAyahIndex; i++) {
        const prev = container!.querySelector(`.ayah[data-index="${i}"]`) as HTMLElement | null;
        if (prev) prev.classList.add('revealed');
      }
    }
    cur.scrollIntoView({ behavior: 'instant', block: 'center' });
  }
  updatePlayerInfo();
  import('./presentation.js').then((m: { syncPresentation: () => void }) => m.syncPresentation()).catch(() => {});
  if (dom.tafsirCurtain && dom.tafsirCurtain.classList.contains('open')) loadTafsirForCurrentAyah();
  if (state.mushafMode) import('./mushaf.js').then((m: { highlightMushafAyah: () => void }) => m.highlightMushafAyah());
}

export function updatePlayerInfo(): void {
  const surahData = state.surahData as any;
  if (!surahData) return;
  const a = surahData.ayahs[state.currentAyahIndex];
  const reciterText = dom.reciterSelect?.options[dom.reciterSelect.selectedIndex]?.text || '';
  if (dom.playerSurahName) dom.playerSurahName.textContent = surahData.name;
  if (dom.playerReciterName) dom.playerReciterName.textContent = reciterText;
  if (dom.playerCurrentAyah && a) {
    const preview = a.text.length > 80 ? a.text.substring(0, 80) + '...' : a.text;
    dom.playerCurrentAyah.textContent = `﴿${preview}﴾ — ${__('ayah')} ${a.numberInSurah}`;
  }
  if (dom.collapsedInfo && a) {
    const short = a.text.length > 50 ? a.text.substring(0, 50) + '...' : a.text;
    dom.collapsedInfo.innerHTML = `<span class="fi-surah">${escapeHtml(surahData.name)} — ${__('ayah')} ${escapeHtml(String(a.numberInSurah))}</span><span>${escapeHtml(short)}</span>`;
  }
}

function saveCurrentPosition(): void {
  const surahData = state.surahData as any;
  if (!surahData) return;
  const a = surahData.ayahs[state.currentAyahIndex];
  storage.set('last_position', {
    surah: state.currentSurah,
    ayah: state.currentAyahIndex,
    surahName: surahData.name,
    ayahNumberInSurah: a.numberInSurah,
    timestamp: Date.now(),
  } satisfies SavedPosition);
}

/* ===================== TRANSLATION ===================== */

export function toggleTranslation(): void {
  state.translationEnabled = !state.translationEnabled;
  storage.set('translation_enabled', state.translationEnabled);
  if (state.translationEnabled && !state.currentTranslation) {
    state.currentTranslation = dom.translationSelect?.value || 'en.sahih';
    storage.set('translation_edition', state.currentTranslation);
  }
  if (dom.translationSelect)
    dom.translationSelect.value = state.translationEnabled ? state.currentTranslation || '' : '';
  showToast(state.translationEnabled ? __('translation_on') : __('translation_off'), 'success');
  if (state.currentSurah) loadSurah(state.currentSurah);
}
