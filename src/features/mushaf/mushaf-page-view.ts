/**
 * Mushaf page rendering and preloading helpers.
 * Extracted from `mushaf.ts`; behavior unchanged.
 */

import { apiFetch } from '../../api-client.js';
import { dom } from '../../dom.js';
import { handlePageClick } from '../../ayah-click.js';
import { __ } from '../../i18n.js';
import { setTrustedHtml } from '../../safe-html.js';
import { state } from '../../state.js';
import { mushafErrorFallback, mushafHeaderRow, mushafSurahNameSpan } from '../../templates.js';
import type { PageLayoutData } from './mushaf-renderer.js';
import { getCanvas, loadPageData, renderPage } from './mushaf-renderer.js';
import { buildTajweedLegend, getJuzForPage, renderMushafTextAlternative } from './mushaf-page-extras.js';
import { clearMushafGeomCache, getMushafPageGeometry, playMushafAyah } from './mushaf-highlight.js';
import { loadTafsirForSurahAyah } from '../../tafsir.js';
import { loadingBar, showToast } from '../../ui.js';
import { toArabicNumeral } from '../../utils.js';

interface AyahClickResult {
  surah: number;
  ayah: number;
}

type LoadPageFn = (pageNum: number, skipNav?: boolean, force?: boolean) => Promise<void> | void;
type HighlightFn = (skipNav?: boolean) => Promise<void> | void;
type IsCurrentLoadFn = (currentLoad: number) => boolean;

/** AbortController for the surah-names fetch — cancelled when navigating to a new page. */
let _surahNamesController: AbortController | null = null;

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

export function renderMushafPageImage(
  pageNum: number,
  currentLoad: number,
  skipNav: boolean | undefined,
  deps: {
    loadPage: LoadPageFn;
    highlightMushafAyah: HighlightFn;
    isCurrentLoad: IsCurrentLoadFn;
  },
): void {
  if (!dom.surahContent) {
    return;
  }
  const { loadPage, highlightMushafAyah, isCurrentLoad } = deps;
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
      void highlightMushafAyah();
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
      void loadPage(state.currentPage - 1, true);
    }
  });

  const navNext = document.createElement('button');
  navNext.className = 'mushaf-page-nav-btn mushaf-page-nav-next';
  navNext.textContent = '◀';
  navNext.setAttribute('aria-label', __('next_page'));
  navNext.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    if (state.currentPage < 604) {
      void loadPage(state.currentPage + 1, true);
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
      if (!isCurrentLoad(currentLoad)) {
        return;
      }
      pageLayout = layoutData;
      state.currentPageLayout = layoutData;
      renderMushafTextAlternative(a11yText, layoutData);
      if (renderedCanvas && layoutData) {
        loadingBar.hide();
        if (state.mushafMode) {
          void highlightMushafAyah(skipNav);
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
      if (!isCurrentLoad(currentLoad)) {
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
