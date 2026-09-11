/**
 * Surah rendering — chunks, virtual scroll, highlight, player info, locale.
 *
 * Extracted from surah-loader.ts. Rendering reads module-local chunk state
 * and never imports the loader, so the dependency flows one way:
 * surah-loader → surah-render. Public functions are re-exported from
 * surah-loader.js so existing imports keep working unchanged.
 */

import { state } from './state.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { __, getLang, toArabicDigits } from './i18n.js';
import { escapeHtml, collapsedPlayerInfo } from './templates.js';
import { tajweedColorWord, buildColorMap } from './tajweed.js';
import type { TajweedRule } from './tajweed.js';
import { getAyahAnnotations } from './tajweed-data.js';
import { isSajdaAyah, isJuzStart } from './quran-meta.js';
import { SURAH_SECRETS } from './surahs-data.js';
import { playCurrentAyah } from './features/audio/audio.js';
import { loadTafsirForCurrentAyah } from './tafsir.js';
import type { SurahData, AyahEntry } from './types.js';

/** Surah text data returned from the API. */
export interface SurahTextData {
  number: number;
  name: string;
  englishName: string;
  ayahs: AyahEntry[];
}

/** Options for loading a surah. */
export interface LoadSurahOptions {
  startAyah?: number;
  autoPlay?: boolean;
}

/** Tajweed annotation entry. */
interface TajweedAnnotation {
  rule: string;
  start: number;
  end: number;
}

/** Saved position entry. */
interface SavedPosition {
  surah: number;
  ayah: number;
  surahName: string;
  ayahNumberInSurah: number;
  timestamp: number;
}

const VIRTUAL_CHUNK_SIZE = 20;
const VISIBLE_WINDOW_CHUNKS = 2; // chunks to keep visible above and below viewport
let _ayahsReadyCount = 0;
let _virtualObserver: IntersectionObserver | null = null;

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
      import('./features/mushaf/mushaf.js').then(
        (m: { showSurahSecret: (surahNum: number, surahName?: string) => void }) =>
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
      // حافظ على التفسير مفتوحاً واحمِه من الإغلاق عند فشل التحميل
      if (tafsirIsOpen && dom.tafsirCurtain) {
        dom.tafsirCurtain.classList.add('open');
        loadTafsirForCurrentAyah().catch(() => {
          /* لا تُغلق التفسير عند فشل التحميل */
        });
      }
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

export function finalizeSurahLoad(opts: LoadSurahOptions): void {
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
  // Keep the surah dropdown in sync with what is actually displayed — on app
  // start the dropdown is populated with the default surah before the restored
  // surah finishes loading, so it must be corrected here.
  if (dom.surahSelect && dom.surahSelect.value !== String(state.currentSurah)) {
    dom.surahSelect.value = String(state.currentSurah);
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
    import('./features/mushaf/mushaf.js').then((m: { highlightMushafAyah: () => void }) => m.highlightMushafAyah());
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
