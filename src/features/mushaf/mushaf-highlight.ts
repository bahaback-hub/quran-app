/**
 * Mushaf ayah highlight/playback helpers.
 * Extracted from `mushaf.ts`; behavior unchanged.
 */

import { apiFetch } from '../../api-client.js';
import { dom } from '../../dom.js';
import { getAyahHighlightRects, type HighlightRect } from '../../ayah-click.js';
import { loadSurah, updatePlayerInfo } from '../../surah-loader.js';
import { state } from '../../state.js';
import type { AyahPageResponse, SurahData } from '../../types.js';
import { prepareAudioForNewSurah, playCurrentAyah } from '../audio/audio.js';
import { computeMushafPageGeometry } from './mushaf-renderer.js';
import type { MushafLineLayout, PageLayoutData } from './mushaf-renderer.js';

/** Cached measured page geometry keyed by `${pageNum}:${renderToken}`. */
const _mushafGeomCache = new Map<string, MushafLineLayout>();

export function clearMushafGeomCache(): void {
  _mushafGeomCache.clear();
}

/**
 * Return the measured geometry of the current page (exact pixel layout), or
 * null when it cannot be measured (no canvas context / mocked renderer).
 */
export function getMushafPageGeometry(canvasEl: HTMLCanvasElement, pageNum: number): MushafLineLayout | null {
  const layout = state.currentPageLayout;
  if (!layout || typeof computeMushafPageGeometry !== 'function') {
    return null;
  }
  const key = `${pageNum}:${canvasEl.dataset['renderToken'] ?? ''}`;
  const cached = _mushafGeomCache.get(key);
  if (cached) {
    return cached;
  }
  const ctx = canvasEl.getContext('2d');
  if (!ctx) {
    return null;
  }
  const geometry = computeMushafPageGeometry(ctx, layout, pageNum);
  if (geometry && geometry.lines.length) {
    _mushafGeomCache.set(key, geometry);
  }
  return geometry;
}

type LoadPageFn = (pageNum: number, skipNav?: boolean, force?: boolean) => Promise<void> | void;

/** Update the mushaf page highlight overlay to mark the current ayah. */
export async function highlightMushafAyahImpl(skipNav: boolean | undefined, loadPage: LoadPageFn): Promise<void> {
  if (!state.mushafMode) {
    return;
  }
  const wrapper = dom.surahContent?.querySelector('.mushaf-image-wrapper') as HTMLElement | null;
  const canvasEl = wrapper?.querySelector('.mushaf-page-canvas') as HTMLCanvasElement | null;
  if (!wrapper || !canvasEl || !canvasEl.width) {
    return;
  }

  const surahData: SurahData | null = state.surahData;
  const surah = surahData?.number;
  const ayah = surahData?.ayahs?.[state.currentAyahIndex]?.numberInSurah;
  if (!surah || !ayah) {
    return;
  }

  if (!skipNav) {
    const layout: PageLayoutData | null = state.currentPageLayout;
    if (layout) {
      const isOnPage = layout.lines.some((line) =>
        line.words?.some((w) => {
          const key = w.verse_key || w.location || '';
          const parts = key.split(':');
          return parts.length >= 2 && parseInt(parts[0]!, 10) === surah && parseInt(parts[1]!, 10) === ayah;
        }),
      );
      if (!isOnPage) {
        try {
          const data = await apiFetch<AyahPageResponse>(`/ayah/${surah}:${ayah}/quran-uthmani`, { silent: true });
          const page = data?.data?.page;
          if (page && page !== state.currentPage) {
            void loadPage(page);
            return;
          }
        } catch (e: unknown) {
          console.warn('Failed to find page for ayah:', e);
        }
      }
    }
  }

  const rect = canvasEl.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }

  const rects = (await getAyahHighlightRects(
    state.currentPage,
    surah,
    ayah,
    rect.width,
    rect.height,
    state.currentPageLayout,
    getMushafPageGeometry(canvasEl, state.currentPage),
  )) as HighlightRect[];
  if (!rects.length) {
    return;
  }

  const wrapperRect = wrapper.getBoundingClientRect();
  const imgLeft = rect.left - wrapperRect.left;
  const imgTop = rect.top - wrapperRect.top;

  let overlay = wrapper.querySelector('.mushaf-highlight-overlay') as HTMLElement | null;
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'mushaf-highlight-overlay';
    overlay.style.cssText = 'position:absolute;pointer-events:none;z-index:5;';
    wrapper.appendChild(overlay);
  }
  overlay.style.left = `${imgLeft}px`;
  overlay.style.top = `${imgTop}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;

  overlay.replaceChildren();
  for (const r of rects) {
    const bar = document.createElement('div');
    bar.className = 'mushaf-ayah-highlight';
    bar.style.cssText = `position:absolute;top:${r.top}px;left:${r.left}px;width:${r.width}px;height:${r.height}px;`;
    overlay.appendChild(bar);
  }
}

export function playMushafAyah(surahNum: number, ayahNum: number): void {
  if (state.currentSurah !== surahNum || !state.surahData) {
    loadSurah(surahNum, { startAyah: ayahNum, autoPlay: true });
    return;
  }
  if (state.isPlaying) {
    prepareAudioForNewSurah();
  }
  const surahData: SurahData | null = state.surahData;
  if (!surahData) {
    return;
  }
  const idx = surahData.ayahs.findIndex((a) => a.numberInSurah === ayahNum);
  if (idx !== -1) {
    state.currentAyahIndex = idx;
    updatePlayerInfo();
    playCurrentAyah();
  }
}
