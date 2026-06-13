import { state } from './state.js';
import { CONFIG, JUZ_PAGES } from './config.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { showToast, loadingBar } from './ui.js';
import { escapeHtml, toArabicNumeral } from './utils.js';
import { SURAH_SECRETS, SURAH_SECRETS_AUTH_KEYS } from './surahs-data.js';
import { loadSurah, updatePlayerInfo, renderSurah, highlightCurrentAyah } from './app.js';
import { prepareAudioForNewSurah, playCurrentAyah, updatePlayPauseBtn } from './audio.js';
import { handlePageClick, getAyahHighlightRects } from './ayah-click.js';
import { renderPage, loadPageData } from './mushaf-renderer.js';
import type { PageLayoutData } from './mushaf-renderer.js';
import { loadTafsirForSurahAyah } from './tafsir.js';
import { __ } from './i18n.js';

/* ===================== INTERFACES ===================== */

/** Result from handlePageClick — identifies a clicked ayah. */
interface AyahClickResult {
  surah: number;
  ayah: number;
}

/** Highlight rect for a single line segment of an ayah. */
interface AyahHighlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Shape of surahData when accessed in mushaf module. */
interface SurahDataLike {
  number: number;
  name: string;
  englishName: string;
  ayahs: { numberInSurah: number; number: number; audio: string }[];
}

/** Shape of the ayah API response (for page lookup). */
interface AyahPageResponse {
  data?: {
    page?: number;
  };
}

/** Shape of surah list entry (subset used in mushaf). */
interface SurahListEntry {
  number: number;
  name: string;
  englishName: string;
}

/** Shape of the surah audio API response. */
interface SurahAudioResponse {
  data?: {
    ayahs?: { audio: string; numberInSurah: number }[];
  };
}

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
    if (state.mushafMode) {
      b.classList.toggle('active', (b as HTMLElement).dataset.mode === 'mushaf');
    } else {
      b.classList.toggle('active', (b as HTMLElement).dataset.mode === 'surah');
    }
  });
  if (state.mushafMode) {
    // === Add body class for CSS targeting ===
    // This allows CSS to hide panels and prevent horizontal scroll
    document.body.classList.add('mushaf-active');

    // === Close all open panels ===
    // Use correct CSS property for each panel:
    // settings/favorites use 'right' (slide from right)
    // adhkar uses 'left' (slide from left)
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
    if (mushafOverlay) { mushafOverlay.classList.add('hidden'); }
    const secretsOverlay = document.getElementById('surahSecretsOverlay');
    if (secretsOverlay) { secretsOverlay.classList.add('hidden'); }

    // Show immediate loading state in surahContent
    if (dom.surahContent) {
      dom.surahContent.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:400px;gap:16px;padding:40px;">
          <div style="font-size:48px;animation:pulse 1.5s ease-in-out infinite;">📄</div>
          <div style="font-size:18px;color:var(--text-secondary);text-align:center;">جاري تحميل صفحة المصحف...</div>
          <div style="font-size:14px;color:var(--text-muted);text-align:center;">يتم تحميل خطوط المصحف وقد يستغرق بعض الوقت</div>
        </div>
      `;
    }

    if (dom.pageIndicator) dom.pageIndicator.style.display = 'inline';
    populatePageSelect();

    if (state.currentSurah) {
      const surahData = state.surahData as any;
      const currentAyah =
        (surahData?.number === state.currentSurah && surahData?.ayahs?.[state.currentAyahIndex]?.numberInSurah) || 1;
      try {
        const res = await fetch(`${CONFIG.API_BASE}/ayah/${state.currentSurah}:${currentAyah}/quran-uthmani`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as AyahPageResponse;
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
      dom.audioPlayer.play().catch(() => {});
      state.isPlaying = true;
      updatePlayPauseBtn();
    }
  } else {
    // === Remove body class ===
    document.body.classList.remove('mushaf-active');

    if (dom.pageIndicator) dom.pageIndicator.style.display = 'none';

    // No need to reset inline styles — CSS handles panel visibility automatically
    // The body.mushaf-active class is removed above, which restores normal panel behavior

    const surahData = state.surahData as any;
    if (surahData && surahData.number === state.currentSurah) {
      renderSurah(state.surahData as any);
      highlightCurrentAyah();
      updatePlayerInfo();
    } else {
      let surahToLoad = state.currentSurah && state.currentSurah > 0 ? state.currentSurah : 1;
      dom.surahContent!.innerHTML = `<p class="loading">${__('loading_surah')}...</p>`;
      setTimeout(() => loadSurah(surahToLoad), 50);
    }
  }
  storage.set('mushaf_mode', state.mushafMode);
}

/* ===================== PAGE SELECT ===================== */

function populatePageSelect(): void {
  if (!dom.pageSelect) return;
  dom.pageSelect.innerHTML = '';
  for (let i = 1; i <= 604; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${__('page')} ${i}`;
    dom.pageSelect.appendChild(opt);
  }
  dom.pageSelect.value = String(state.currentPage);
  if (dom.pageSlider) dom.pageSlider.value = String(state.currentPage);
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
  if (!pageNum) return;
  _mushafLoadCounter++;
  const currentLoad = _mushafLoadCounter;
  const hasContainer = !!dom.surahContent?.querySelector('.mushaf-container');
  if (!force && hasContainer && pageNum === state.currentPage) return;
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
    if (_mushafLoadCounter !== currentLoad) return;
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
        { once: true }
      );
    }
  });
}

/* ===================== JUZ HELPER ===================== */

/** Get the Juz number for a given page number (1-604). */
export function getJuzForPage(pageNum: number): number {
  let juz = 1;
  for (let i = JUZ_PAGES.length - 1; i >= 0; i--) {
    if (pageNum >= JUZ_PAGES[i]) {
      juz = i + 1;
      break;
    }
  }
  return juz;
}

/* ===================== RENDER MUSHAF PAGE ===================== */

function renderMushafPageImage(pageNum: number, currentLoad: number, skipNav?: boolean): void {
  if (!dom.surahContent) return;
  const juz = getJuzForPage(pageNum);

  const container = document.createElement('div');
  container.className = 'mushaf-container';

  const header = document.createElement('div');
  header.className = 'mushaf-header';
  header.innerHTML = `
    <div class="mushaf-header-row">
      <div class="mushaf-surah-names" id="mushafSurahNames"></div>
      <div class="mushaf-juz">${__('mushaf_juz', toArabicNumeral(juz))}</div>
    </div>
  `;

  const canvasWrapper = document.createElement('div');
  canvasWrapper.className = 'mushaf-image-wrapper';

  const canvas = document.createElement('canvas');
  canvas.className = 'mushaf-page-canvas';
  canvas.width = 1080;
  canvas.height = 1540;

  canvasWrapper.appendChild(canvas);

  let pageLayout: PageLayoutData | null = null;

  const clickHandler = async (e: MouseEvent): Promise<void> => {
    const target = e.target as Element;
    if (target.closest('.mushaf-page-nav')) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const result = (await handlePageClick(
      pageNum,
      x,
      y,
      rect.width,
      rect.height,
      pageLayout
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
  footer.innerHTML = `${toArabicNumeral(pageNum)}`;

  const navPrev = document.createElement('button');
  navPrev.className = 'mushaf-page-nav-btn mushaf-page-nav-prev';
  navPrev.textContent = '▶';
  navPrev.setAttribute('aria-label', __('previous_page'));
  navPrev.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    if (state.currentPage > 1) loadPage(state.currentPage - 1, true);
  });

  const navNext = document.createElement('button');
  navNext.className = 'mushaf-page-nav-btn mushaf-page-nav-next';
  navNext.textContent = '◀';
  navNext.setAttribute('aria-label', __('next_page'));
  navNext.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    if (state.currentPage < 604) loadPage(state.currentPage + 1, true);
  });

  container.appendChild(header);
  container.appendChild(canvasWrapper);
  container.appendChild(footer);
  container.appendChild(navPrev);
  container.appendChild(navNext);

  dom.surahContent.innerHTML = '';
  dom.surahContent.appendChild(container);
  dom.surahContent.appendChild(buildTajweedLegend());

  renderPage(pageNum, canvas).then(({ canvas: renderedCanvas, layout: layoutData }) => {
    // Race condition guard: if user navigated to another page while rendering, discard this result
    if (_mushafLoadCounter !== currentLoad) return;
    pageLayout = layoutData;
    state.currentPageLayout = layoutData as any;
    if (renderedCanvas && layoutData) {
      loadingBar.hide();
      if (state.mushafMode) highlightMushafAyah(skipNav);
    } else {
      showToast(__('mushaf_page_error'), 'error');
      // Show fallback error message in the container
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = 'text-align:center;padding:40px 20px;color:var(--text-primary);';
      errorDiv.innerHTML = `
        <p style="font-size:18px;margin-bottom:12px;">⚠️ فشل تحميل صفحة المصحف</p>
        <p style="font-size:14px;opacity:0.7;">تأكد من اتصالك بالإنترنت وحاول مرة أخرى</p>
        <button onclick="location.reload()" style="margin-top:16px;padding:8px 20px;border:2px solid var(--accent);border-radius:8px;background:var(--accent);color:#fff;font-size:16px;cursor:pointer;font-family:inherit;">إعادة المحاولة</button>
      `;
      canvasWrapper.appendChild(errorDiv);
      loadingBar.hide();
    }
  }).catch((err) => {
    console.error('[Mushaf] renderPage error:', err);
    showToast(__('mushaf_page_error'), 'error');
    loadingBar.hide();
  });

  preloadAdjacentLayouts(pageNum);

  // Fetch surah names for the page header — cancel any previous in-flight request
  if (_surahNamesController) _surahNamesController.abort();
  _surahNamesController = new AbortController();
  const surahNamesSignal = _surahNamesController.signal;

  fetch(`${CONFIG.API_BASE}/page/${pageNum}/quran-uthmani`, { signal: surahNamesSignal })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((json: { data?: { ayahs?: { surah: { number: number; name: string } }[] } }) => {
      const ayahs = json?.data?.ayahs;
      if (!ayahs?.length) return;

      const surahNamesEl = document.getElementById('mushafSurahNames');
      if (surahNamesEl) {
        const seen: Record<number, string> = {};
        ayahs.forEach((a: { surah: { number: number; name: string } }) => {
          if (!seen[a.surah.number]) seen[a.surah.number] = a.surah.name;
        });
        surahNamesEl.innerHTML = Object.values(seen)
          .map((n) => `<span class="mushaf-surah-name">${escapeHtml(n)}</span>`)
          .join(' ');
      }
    })
    .catch((err) => {
      if ((err as Error).name === 'AbortError') return; // cancelled — expected
      console.warn('Failed to fetch ayah list for page', pageNum);
    });
}

/* ===================== PRELOAD ===================== */

function preloadAdjacentLayouts(pageNum: number): void {
  const toPreload: number[] = [];
  if (pageNum > 1) toPreload.push(pageNum - 1);
  if (pageNum < 604) toPreload.push(pageNum + 1);

  for (const p of toPreload) {
    loadPageData(p).catch(() => {});
  }
}

/* ===================== SURAH OVERLAY ===================== */

export function populateSurahOverlay(): void {
  if (!dom.mushafSurahOverlayList || !state.surahList.length) return;
  dom.mushafSurahOverlayList.innerHTML = '';
  for (const s of state.surahList as SurahListEntry[]) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;';
    const btn = document.createElement('button');
    btn.className = 'mushaf-surah-overlay-btn';
    btn.textContent = `${s.number}. ${s.name} (${s.englishName})`;
    btn.style.flex = '1';
    btn.dataset.surah = String(s.number);
    btn.dataset.surahName = s.name;
    row.appendChild(btn);
    if (SURAH_SECRETS[s.number]) {
      const secretBtn = document.createElement('button');
      secretBtn.className = 'surah-secret-btn';
      secretBtn.textContent = 'ℹ️';
      secretBtn.title = __('surah_info_title');
      secretBtn.setAttribute('aria-label', `${__('surah_info_for', s.name)}`);
      secretBtn.dataset.surah = String(s.number);
      secretBtn.dataset.surahName = s.name;
      row.appendChild(secretBtn);
    }
    dom.mushafSurahOverlayList.appendChild(row);
  }

  const overlayList = dom.mushafSurahOverlayList as HTMLElement & { _delegationBound?: boolean };
  if (!overlayList._delegationBound) {
    overlayList._delegationBound = true;
    overlayList.addEventListener('click', async (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('mushaf-surah-overlay-btn')) {
        const surahNum = parseInt(target.dataset.surah!, 10);
        const surahName = target.dataset.surahName || '';
        dom.mushafSurahOverlay!.classList.add('hidden');
        dom.mushafSurahOverlay!.style.display = 'none';
        state.currentSurah = surahNum;
        state.currentAyahIndex = 0;
        state.surahData = null;
        loadingBar.show(`⏳ ${__('loading_surah')} ${surahName}...`);
        try {
          const res = await fetch(`${CONFIG.API_BASE}/ayah/${surahNum}:1`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as AyahPageResponse;
          const page = data?.data?.page || 1;
          if (dom.pageSelect) dom.pageSelect.value = String(page);
          if (dom.pageSlider) dom.pageSlider.value = String(page);
          loadPage(page, true);
        } catch {
          showToast(__('mushaf_page_not_found'), 'error');
        } finally {
          loadingBar.hide();
        }
        return;
      }
      if (target.classList.contains('surah-secret-btn')) {
        e.stopPropagation();
        showSurahSecret(parseInt(target.dataset.surah!, 10), target.dataset.surahName || '');
      }
    });
  }
}

/* ===================== SURAH SECRETS ===================== */

export function showSurahSecret(surahNum: number, surahName?: string): void {
  if (!dom.surahSecretsOverlay || !dom.surahSecretsBody || !dom.surahSecretsTitle || !dom.surahSecretsSurahName) return;
  const secret = SURAH_SECRETS[surahNum];
  if (!secret) {
    showToast(__('mushaf_no_secret'), 'error');
    return;
  }
  dom.surahSecretsSurahName.textContent = `ℹ️ ${surahNum}. ${surahName ?? ''}`;
  dom.surahSecretsTitle.textContent = __('mushaf_surah_info');
  let html = `<p>${escapeHtml(secret)}</p>`;
  const authKeys = SURAH_SECRETS_AUTH_KEYS[surahNum];
  if (authKeys && authKeys.length) {
    html += `<div class="secret-source">${__('mushaf_sources')} ${authKeys.map((k: string) => `<span>${escapeHtml(k)}</span>`).join(' ')}</div>`;
  }
  dom.surahSecretsBody.innerHTML = html;
  dom.surahSecretsOverlay.classList.remove('hidden');
  dom.surahSecretsOverlay.style.display = 'flex';
}

/* ===================== HIGHLIGHT MUSHAF AYAH ===================== */

/** Update the mushaf page highlight overlay to mark the current ayah. */
export async function highlightMushafAyah(skipNav?: boolean): Promise<void> {
  if (!state.mushafMode) return;
  const wrapper = dom.surahContent?.querySelector('.mushaf-image-wrapper') as HTMLElement | null;
  const canvasEl = wrapper?.querySelector('.mushaf-page-canvas') as HTMLCanvasElement | null;
  if (!wrapper || !canvasEl || !canvasEl.width) return;

  const surahData = state.surahData as any;
  const surah = surahData?.number;
  const ayah = surahData?.ayahs?.[state.currentAyahIndex]?.numberInSurah;
  if (!surah || !ayah) return;

  if (!skipNav) {
    const layout = state.currentPageLayout as any;
    if (layout) {
      const isOnPage = layout.lines.some((line: any) =>
        line.words?.some((w: any) => {
          const key = w.verse_key || w.location || '';
          const parts = key.split(':');
          return parts.length >= 2 && parseInt(parts[0], 10) === surah && parseInt(parts[1], 10) === ayah;
        })
      );
      if (!isOnPage) {
        try {
          const res = await fetch(`${CONFIG.API_BASE}/ayah/${surah}:${ayah}/quran-uthmani`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as AyahPageResponse;
          const page = data?.data?.page;
          if (page && page !== state.currentPage) {
            loadPage(page);
            return;
          }
        } catch (e: unknown) {
          console.warn('Failed to find page for ayah:', e);
        }
      }
    }
  }

  const rect = canvasEl.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const rects = (await getAyahHighlightRects(
    state.currentPage,
    surah,
    ayah,
    rect.width,
    rect.height,
    state.currentPageLayout as any
  )) as AyahHighlightRect[];
  if (!rects.length) return;

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

  overlay.innerHTML = '';
  for (const r of rects) {
    const bar = document.createElement('div');
    bar.className = 'mushaf-ayah-highlight';
    bar.style.cssText = `position:absolute;top:${r.top}px;left:${r.left}px;width:${r.width}px;height:${r.height}px;`;
    overlay.appendChild(bar);
  }
}

/* ===================== PLAY MUSHAF AYAH ===================== */

function playMushafAyah(surahNum: number, ayahNum: number): void {
  if (state.currentSurah !== surahNum || !state.surahData) {
    loadSurah(surahNum, { startAyah: ayahNum, autoPlay: true });
    return;
  }
  if (state.isPlaying) prepareAudioForNewSurah();
  const surahData = state.surahData as any;
  const idx = surahData.ayahs.findIndex((a: any) => a.numberInSurah === ayahNum);
  if (idx !== -1) {
    state.currentAyahIndex = idx;
    updatePlayerInfo();
    playCurrentAyah();
  }
}

/* ===================== TAJWEED LEGEND ===================== */

/** Build the tajweed color legend shown below mushaf pages. */
function buildTajweedLegend(): HTMLElement {
  const legend = document.createElement('div');
  legend.className = 'mushaf-tajweed-legend';

  const title = document.createElement('div');
  title.className = 'mushaf-tajweed-legend-title';
  title.textContent = 'ألوان التجويد';

  const grid = document.createElement('div');
  grid.className = 'mushaf-tajweed-legend-grid';

  const entries: { color: string; label: string }[] = [
    { color: '#ce9e00', label: 'مد ٢' },
    { color: '#ff7b00', label: 'مد ٢-٤-٦ والمنفصل' },
    { color: '#b50000', label: 'مد ٦ (لازم)' },
    { color: '#f40000', label: 'مد متصل' },
    { color: '#09b000', label: 'الغنة والإخفاء والإقلاب' },
    { color: '#2fadff', label: 'اللام الشمسية والقلقلة' },
    { color: '#a5a5a5', label: 'همزة الوصل والإدغام' },
    { color: '#8e44ad', label: 'السكون' },
  ];

  for (const entry of entries) {
    const item = document.createElement('div');
    item.className = 'mushaf-tajweed-legend-item';
    const swatch = document.createElement('span');
    swatch.className = 'mushaf-tajweed-legend-swatch';
    swatch.style.backgroundColor = entry.color;
    const label = document.createElement('span');
    label.className = 'mushaf-tajweed-legend-label';
    label.textContent = entry.label;
    item.appendChild(swatch);
    item.appendChild(label);
    grid.appendChild(item);
  }

  legend.appendChild(title);
  legend.appendChild(grid);
  return legend;
}
