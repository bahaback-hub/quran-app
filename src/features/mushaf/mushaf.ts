import './mushaf.css';

import { state } from '../../state.js';
import { dom } from '../../dom.js';
import { requireDom } from '../../dom-require.js';
import { storage } from '../../storage.js';
import { showToast, loadingBar } from '../../ui.js';
import { toArabicNumeral } from '../../utils.js';
import {
  buildMushafTextBlocks,
  buildTajweedLegend,
  getJuzForPage,
  renderMushafTextAlternative,
  type MushafTextBlock,
} from './mushaf-page-extras.js';
import {
  mushafLoadingState,
  surahLoadingMessage,
  mushafHeaderRow,
  mushafErrorFallback,
  mushafSurahNameSpan,
} from '../../templates.js';
import { loadSurah, updatePlayerInfo, renderSurah, highlightCurrentAyah } from '../../surah-loader.js';
import { setStoppedState, updatePlayPauseBtn } from '../audio/audio.js';
import { handlePageClick } from '../../ayah-click.js';
import { renderPage, loadPageData, releaseCanvas, getCanvas } from './mushaf-renderer.js';
import type { PageLayoutData } from './mushaf-renderer.js';
import {
  clearMushafGeomCache,
  getMushafPageGeometry,
  highlightMushafAyahImpl,
  playMushafAyah,
} from './mushaf-highlight.js';
import { populateSurahOverlayImpl, showSurahSecret } from './mushaf-overlays.js';
import { loadTafsirForSurahAyah } from '../../tafsir.js';
import { apiFetch } from '../../api-client.js';
import { __ } from '../../i18n.js';
import { setMushafAdapters } from '../../surah-render.js';
import { registerMushafPageReload } from '../../settings.js';
import type { SurahData, AyahPageResponse } from '../../types.js';
import { setTrustedHtml } from '../../safe-html.js';

/* ===================== INTERFACES ===================== */

/** Result from handlePageClick — identifies a clicked ayah. */
interface AyahClickResult {
  surah: number;
  ayah: number;
}

/* Surah list entry typing moved to mushaf-overlays.ts where needed. */

/* ===================== MODULE STATE ===================== */

/** Counter used to cancel stale page loads. */
let _mushafLoadCounter = 0;

/** AbortController for the surah-names fetch — cancelled when navigating to a new page. */
let _surahNamesController: AbortController | null = null;

/* ===================== TOGGLE MUSHAF MODE ===================== */

/** Toggle between mushaf mode and surah mode. */
export async function toggleMushafMode(): Promise<void> {
  const wasPlaying = state.isPlaying;
  state.mushafMode = !state.mushafMode;
  document.querySelectorAll('.view-mode-btn').forEach((b: Element) => {
    const activeMode = state.mushafMode ? 'mushaf' : 'surah';
    const active = (b as HTMLElement).dataset['mode'] === activeMode;
    b.classList.toggle('active', active);
    if (typeof (b as HTMLElement).setAttribute === 'function') {
      b.setAttribute('aria-pressed', String(active));
    }
  });
  if (state.mushafMode) {
    // === Add body class for CSS targeting ===
    // This allows CSS to hide panels and prevent horizontal scroll
    document.body.classList.add('mushaf-active');

    // === Close all open panels ===
    // Use correct CSS property for each panel:
    // settings uses 'right' (slides from right)
    // favorites/adhkar use 'left' (slide from left)
    if (dom.settingsPanel) {
      dom.settingsPanel.classList.remove('open');
    }
    if (dom.favoritesPanel) {
      dom.favoritesPanel.classList.remove('open');
    }
    if (dom.adhkarPanel) {
      dom.adhkarPanel.classList.remove('open');
      // CSS handles hiding panels in Capacitor via body.capacitor-native.mushaf-active
      // No need for inline style overrides — the CSS rules use display:none !important
    }
    // Also close any open overlays
    const mushafOverlay = document.getElementById('mushafSurahOverlay');
    if (mushafOverlay) {
      mushafOverlay.classList.add('hidden');
    }
    const secretsOverlay = document.getElementById('surahSecretsOverlay');
    if (secretsOverlay) {
      secretsOverlay.classList.add('hidden');
    }

    // Show immediate loading state in surahContent
    if (dom.surahContent) {
      setTrustedHtml(dom.surahContent, mushafLoadingState());
    }

    if (dom.pageIndicator) {
      dom.pageIndicator.style.display = 'inline';
    }
    populatePageSelect();

    if (state.currentSurah) {
      const surahData: SurahData | null = state.surahData;
      const currentAyah =
        (surahData?.number === state.currentSurah && surahData?.ayahs?.[state.currentAyahIndex]?.numberInSurah) || 1;
      try {
        const data = await apiFetch<AyahPageResponse>(`/ayah/${state.currentSurah}:${currentAyah}/quran-uthmani`, {
          silent: true,
        });
        const page = data?.data?.page;
        if (page && page >= 1 && page <= 604) {
          state.currentPage = page;
        }
      } catch (e: unknown) {
        console.warn('Failed to get page for ayah:', e);
      }
    }

    updatePageIndicator(state.currentPage);
    populateSurahOverlay();
    loadPage(state.currentPage);
    if (wasPlaying && dom.audioPlayer?.paused) {
      dom.audioPlayer.play().catch(() => {
        // Rejected — don't leave the button stuck on pause.
        setStoppedState();
      });
      state.isPlaying = true;
      updatePlayPauseBtn();
    }
  } else {
    // === Remove body class ===
    document.body.classList.remove('mushaf-active');

    if (dom.pageIndicator) {
      dom.pageIndicator.style.display = 'none';
    }

    // No need to reset inline styles — CSS handles panel visibility automatically
    // The body.mushaf-active class is removed above, which restores normal panel behavior

    const surahData: SurahData | null = state.surahData;
    if (surahData && surahData.number === state.currentSurah) {
      renderSurah(surahData);
      highlightCurrentAyah();
      updatePlayerInfo();
    } else {
      const surahToLoad = state.currentSurah && state.currentSurah > 0 ? state.currentSurah : 1;
      setTrustedHtml(requireDom('surahContent'), surahLoadingMessage());
      setTimeout(() => loadSurah(surahToLoad), 50);
    }
  }
  storage.set('mushaf_mode', state.mushafMode);
  import('../../settings.js').then(({ updateReaderZoomControl }) => updateReaderZoomControl());
}

/* ===================== PAGE SELECT ===================== */

function populatePageSelect(): void {
  if (!dom.pageSelect) {
    return;
  }
  dom.pageSelect.replaceChildren();
  for (let i = 1; i <= 604; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${__('page')} ${i}`;
    dom.pageSelect.appendChild(opt);
  }
  dom.pageSelect.value = String(state.currentPage);
  if (dom.pageSlider) {
    dom.pageSlider.value = String(state.currentPage);
  }
}

/** Update the page indicator text to show current page. */
export function updatePageIndicator(pageNum: number): void {
  if (dom.pageIndicator) {
    const arabic = pageNum.toLocaleString('ar-SA');
    dom.pageIndicator.textContent = `${__('mushaf_page_info', arabic)}`;
  }
}

/* ===================== LOAD PAGE ===================== */

/** Load and render a mushaf page image. */
export async function loadPage(pageNum: number, skipNav?: boolean, force?: boolean): Promise<void> {
  if (!pageNum) {
    return;
  }
  _mushafLoadCounter++;
  const currentLoad = _mushafLoadCounter;
  const hasContainer = !!dom.surahContent?.querySelector('.mushaf-container');
  if (!force && hasContainer && pageNum === state.currentPage) {
    return;
  }
  const prevPage = state.currentPage;
  const direction = pageNum > prevPage ? 'left' : 'right';
  state.currentPage = pageNum;
  storage.set('current_page', pageNum);
  updatePageIndicator(pageNum);
  loadingBar.show(`${__('mushaf_loading_page', String(pageNum))}`);

  const oldContainer = dom.surahContent?.querySelector('.mushaf-container');
  if (oldContainer) {
    oldContainer.classList.add('mushaf-flipping');
    const flipOut = direction === 'left' ? 'mushaf-flip-out-left' : 'mushaf-flip-out-right';
    oldContainer.classList.add(flipOut);
    await new Promise<void>((r) => setTimeout(r, 300));
    // Abort if user navigated to a different page during animation
    if (_mushafLoadCounter !== currentLoad) {
      return;
    }
    // Release old canvas back to pool for memory efficiency
    const oldCanvas = oldContainer.querySelector('.mushaf-page-canvas') as HTMLCanvasElement | null;
    if (oldCanvas) {
      releaseCanvas(oldCanvas);
    }
  }

  renderMushafPageImage(pageNum, currentLoad, skipNav);

  requestAnimationFrame(() => {
    const newContainer = dom.surahContent?.querySelector('.mushaf-container');
    if (newContainer) {
      newContainer.classList.add('mushaf-flipping');
      const flipIn = direction === 'left' ? 'mushaf-flip-in-right' : 'mushaf-flip-in-left';
      newContainer.classList.add(flipIn);
      newContainer.addEventListener(
        'animationend',
        () => {
          newContainer.classList.remove('mushaf-flipping', flipIn);
        },
        { once: true },
      );
    }
  });
}

/* ===================== SCREEN-READER TEXT / PAGE EXTRAS ===================== */

export { buildMushafTextBlocks, getJuzForPage, type MushafTextBlock };

/* ===================== RENDER MUSHAF PAGE ===================== */

function renderMushafPageImage(pageNum: number, currentLoad: number, skipNav?: boolean): void {
  if (!dom.surahContent) {
    return;
  }
  clearMushafGeomCache();
  const juz = getJuzForPage(pageNum);

  const container = document.createElement('div');
  container.className = 'mushaf-container';

  const header = document.createElement('div');
  header.className = 'mushaf-header';
  setTrustedHtml(header, mushafHeaderRow(__('mushaf_juz', toArabicNumeral(juz))));

  const canvasWrapper = document.createElement('div');
  canvasWrapper.className = 'mushaf-image-wrapper';

  const canvas = getCanvas();
  canvas.className = 'mushaf-page-canvas';
  // The page is painted glyph-by-glyph; its readable equivalent lives in the
  // screen-reader region below, so the bitmap itself must not be announced.
  canvas.setAttribute('aria-hidden', 'true');

  const a11yText = document.createElement('div');
  a11yText.className = 'sr-only mushaf-a11y-text';
  a11yText.setAttribute('role', 'region');
  a11yText.setAttribute('aria-label', `${__('page')} ${toArabicNumeral(pageNum)}`);

  canvasWrapper.appendChild(canvas);
  canvasWrapper.appendChild(a11yText);

  let pageLayout: PageLayoutData | null = null;

  const clickHandler = async (e: MouseEvent): Promise<void> => {
    const target = e.target as Element;
    if (target.closest('.mushaf-page-nav')) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const result = (await handlePageClick(
      pageNum,
      x,
      y,
      rect.width,
      rect.height,
      pageLayout,
      getMushafPageGeometry(canvas, pageNum),
    )) as AyahClickResult | null;
    if (result) {
      playMushafAyah(result.surah, result.ayah);
      loadTafsirForSurahAyah(result.surah, result.ayah);
      highlightMushafAyah();
    }
  };
  canvasWrapper.addEventListener('click', clickHandler);

  const footer = document.createElement('div');
  footer.className = 'mushaf-footer';
  setTrustedHtml(footer, `${toArabicNumeral(pageNum)}`);

  const navPrev = document.createElement('button');
  navPrev.className = 'mushaf-page-nav-btn mushaf-page-nav-prev';
  navPrev.textContent = '▶';
  navPrev.setAttribute('aria-label', __('previous_page'));
  navPrev.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    if (state.currentPage > 1) {
      loadPage(state.currentPage - 1, true);
    }
  });

  const navNext = document.createElement('button');
  navNext.className = 'mushaf-page-nav-btn mushaf-page-nav-next';
  navNext.textContent = '◀';
  navNext.setAttribute('aria-label', __('next_page'));
  navNext.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    if (state.currentPage < 604) {
      loadPage(state.currentPage + 1, true);
    }
  });

  container.appendChild(header);
  container.appendChild(canvasWrapper);
  container.appendChild(footer);
  container.appendChild(navPrev);
  container.appendChild(navNext);

  dom.surahContent.replaceChildren();
  dom.surahContent.appendChild(container);
  dom.surahContent.appendChild(buildTajweedLegend());

  renderPage(pageNum, canvas)
    .then(({ canvas: renderedCanvas, layout: layoutData }) => {
      // Race condition guard: if user navigated to another page while rendering, discard this result
      if (_mushafLoadCounter !== currentLoad) {
        return;
      }
      pageLayout = layoutData;
      state.currentPageLayout = layoutData;
      renderMushafTextAlternative(a11yText, layoutData);
      if (renderedCanvas && layoutData) {
        loadingBar.hide();
        if (state.mushafMode) {
          highlightMushafAyah(skipNav);
        }
      } else {
        showToast(__('mushaf_page_error'), 'error');
        // Show fallback error message in the container
        const errorDiv = document.createElement('div');
        errorDiv.className = 'mushaf-error-fallback';
        setTrustedHtml(errorDiv, mushafErrorFallback());
        canvasWrapper.appendChild(errorDiv);
        // Inline onclick handlers are blocked by CSP; wire the retry button here.
        errorDiv.querySelector<HTMLElement>('[data-action="reload"]')?.addEventListener('click', () => {
          location.reload();
        });
        loadingBar.hide();
      }
    })
    .catch((err) => {
      if (_mushafLoadCounter !== currentLoad) {
        return;
      }
      console.error('[Mushaf] renderPage error:', err);
      showToast(__('mushaf_page_error'), 'error');
      loadingBar.hide();
    });

  preloadAdjacentLayouts(pageNum);

  // Fetch surah names for the page header — cancel any previous in-flight request
  if (_surahNamesController) {
    _surahNamesController.abort();
  }
  _surahNamesController = new AbortController();
  const surahNamesSignal = _surahNamesController.signal;

  apiFetch<{ data?: { ayahs?: { surah: { number: number; name: string } }[] } }>(`/page/${pageNum}/quran-uthmani`, {
    signal: surahNamesSignal,
    silent: true,
  })
    .then((json) => {
      const ayahs = json?.data?.ayahs;
      if (!ayahs?.length) {
        return;
      }

      const surahNamesEl = document.getElementById('mushafSurahNames');
      if (surahNamesEl) {
        const seen: Record<number, string> = {};
        ayahs.forEach((a: { surah: { number: number; name: string } }) => {
          if (!seen[a.surah.number]) {
            seen[a.surah.number] = a.surah.name;
          }
        });
        setTrustedHtml(
          surahNamesEl,
          Object.values(seen)
            .map((n) => mushafSurahNameSpan(n))
            .join(' '),
        );
      }
    })
    .catch((err) => {
      if ((err as Error).name === 'AbortError') {
        return;
      } // cancelled — expected
      console.warn('Failed to fetch ayah list for page', pageNum);
    });
}

/* ===================== PRELOAD ===================== */

function preloadAdjacentLayouts(pageNum: number): void {
  const toPreload: number[] = [];
  if (pageNum > 1) {
    toPreload.push(pageNum - 1);
  }
  if (pageNum < 604) {
    toPreload.push(pageNum + 1);
  }

  for (const p of toPreload) {
    loadPageData(p).catch(() => {
      /* noop */
    });
  }
}

/* ===================== SURAH OVERLAY ===================== */

export function populateSurahOverlay(): void {
  populateSurahOverlayImpl(loadPage);
}

export { showSurahSecret };

/* ===================== HIGHLIGHT / PLAY MUSHAF AYAH ===================== */

/** Update the mushaf page highlight overlay to mark the current ayah. */
export async function highlightMushafAyah(skipNav?: boolean): Promise<void> {
  return highlightMushafAyahImpl(skipNav, loadPage);
}

/* ===================== TAJWEED LEGEND ===================== */
// (moved to mushaf-page-extras.ts)

// Register mushaf actions for surah-render (avoids an import cycle).
setMushafAdapters({ showSurahSecret, highlightMushafAyah });

// Register mushaf actions for surah-render (avoids an import cycle).
setMushafAdapters({ showSurahSecret, highlightMushafAyah });
// Refresh the mushaf page when a theme change lands from settings.ts.
registerMushafPageReload(() => {
  if (state.mushafMode && state.currentPage) {
    void loadPage(state.currentPage, true, true);
  }
});
