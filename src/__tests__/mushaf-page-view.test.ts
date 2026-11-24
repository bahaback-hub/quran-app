import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const {
  domMock,
  stateMock,
  renderPageMock,
  getCanvasMock,
  loadPageDataMock,
  clearGeomMock,
  getGeomMock,
  playMushafAyahMock,
  highlightMock,
  loadTafsirMock,
  showToastMock,
  loadingHideMock,
  handlePageClickMock,
  apiFetchMock,
} = vi.hoisted(() => ({
  domMock: { surahContent: null as HTMLElement | null },
  stateMock: { currentPage: 2, currentPageLayout: null as unknown, mushafMode: true },
  renderPageMock: vi.fn(),
  getCanvasMock: vi.fn(),
  loadPageDataMock: vi.fn(() => Promise.resolve()),
  clearGeomMock: vi.fn(),
  getGeomMock: vi.fn(() => ({})),
  playMushafAyahMock: vi.fn(),
  highlightMock: vi.fn(async () => {}),
  loadTafsirMock: vi.fn(),
  showToastMock: vi.fn(),
  loadingHideMock: vi.fn(),
  handlePageClickMock: vi.fn(),
  apiFetchMock: vi.fn(),
}));

vi.mock('../dom.js', () => ({ dom: domMock }));
vi.mock('../state.js', () => ({ state: stateMock }));
vi.mock('../api-client.js', () => ({ apiFetch: apiFetchMock }));
vi.mock('../ayah-click.js', () => ({ handlePageClick: (...args: any[]) => handlePageClickMock(...args) }));
vi.mock('../i18n.js', () => ({ __: (k: string, v?: unknown) => (v ? `${k}:${v}` : k) }));
vi.mock('../safe-html.js', () => ({
  setTrustedHtml: (el: HTMLElement, html: string) => {
    el.innerHTML = html;
  },
}));
vi.mock('../templates.js', () => ({
  mushafErrorFallback: () => '<button data-action="reload">reload</button>',
  mushafHeaderRow: (s: string) => `<div>${s}</div>`,
  mushafSurahNameSpan: (n: string) => `<span>${n}</span>`,
}));
vi.mock('../ui.js', () => ({
  loadingBar: { hide: (...a: any[]) => (loadingHideMock as any)(...a) },
  showToast: (...a: any[]) => (showToastMock as any)(...a),
}));
vi.mock('../utils.js', () => ({ toArabicNumeral: (n: number) => String(n) }));
vi.mock('../tafsir.js', () => ({ loadTafsirForSurahAyah: (...a: any[]) => (loadTafsirMock as any)(...a) }));
vi.mock('../features/mushaf/mushaf-renderer.js', () => ({
  getCanvas: () => getCanvasMock(),
  loadPageData: (...a: any[]) => loadPageDataMock(...(a as [])),
  renderPage: (...a: any[]) => renderPageMock(...(a as [])),
}));
vi.mock('../features/mushaf/mushaf-page-extras.js', () => ({
  buildTajweedLegend: () => {
    const d = document.createElement('div');
    d.className = 'legend';
    return d;
  },
  getJuzForPage: () => 1,
  renderMushafTextAlternative: vi.fn(),
}));
vi.mock('../features/mushaf/mushaf-highlight.js', () => ({
  clearMushafGeomCache: (...a: any[]) => clearGeomMock(...(a as [])),
  getMushafPageGeometry: (...a: any[]) => getGeomMock(...(a as [])),
  playMushafAyah: (...a: any[]) => playMushafAyahMock(...(a as [])),
}));

import { renderMushafPageImage } from '../features/mushaf/mushaf-page-view.js';

describe('renderMushafPageImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    domMock.surahContent = document.createElement('div');
    document.body.innerHTML = '<div id="mushafSurahNames"></div>';
    stateMock.currentPage = 2;
    stateMock.currentPageLayout = null;
    stateMock.mushafMode = true;
    const canvas = document.createElement('canvas');
    canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 100, height: 200 }) as DOMRect;
    getCanvasMock.mockReturnValue(canvas);
    renderPageMock.mockResolvedValue({ canvas, layout: { page: 2 } });
    apiFetchMock.mockResolvedValue({
      data: { ayahs: [{ surah: { number: 1, name: 'الفاتحة' } }, { surah: { number: 1, name: 'الفاتحة' } }] },
    });
    handlePageClickMock.mockResolvedValue(null);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns early when surah content container is missing', () => {
    domMock.surahContent = null;
    renderMushafPageImage(1, 1, false, {
      loadPage: vi.fn(),
      highlightMushafAyah: highlightMock,
      isCurrentLoad: () => true,
    });
    expect(clearGeomMock).not.toHaveBeenCalled();
  });

  it('renders page, wires nav/click, and handles surah names', async () => {
    const loadPage = vi.fn();
    renderMushafPageImage(2, 1, false, {
      loadPage,
      highlightMushafAyah: highlightMock,
      isCurrentLoad: () => true,
    });

    expect(domMock.surahContent?.querySelector('.mushaf-container')).toBeTruthy();
    const next = domMock.surahContent?.querySelector('.mushaf-page-nav-next') as HTMLButtonElement;
    const prev = domMock.surahContent?.querySelector('.mushaf-page-nav-prev') as HTMLButtonElement;
    next.click();
    prev.click();
    expect(loadPage).toHaveBeenCalledWith(3, true);
    expect(loadPage).toHaveBeenCalledWith(1, true);

    const canvasWrapper = domMock.surahContent?.querySelector('.mushaf-image-wrapper') as HTMLElement;
    canvasWrapper.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 20, clientY: 40 }));
    await Promise.resolve();
    await Promise.resolve();
    expect(handlePageClickMock).toHaveBeenCalled();

    handlePageClickMock.mockResolvedValueOnce({ surah: 2, ayah: 5 });
    canvasWrapper.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 20, clientY: 40 }));
    await new Promise((r) => setTimeout(r, 0));
    expect(playMushafAyahMock).toHaveBeenCalledWith(2, 5);
    expect(loadTafsirMock).toHaveBeenCalledWith(2, 5);

    await new Promise((r) => setTimeout(r, 0));
    expect(document.getElementById('mushafSurahNames')?.innerHTML).toContain('الفاتحة');
  });

  it('handles stale render, render error fallback, and rejected render', async () => {
    const loadPage = vi.fn();
    renderMushafPageImage(2, 1, false, { loadPage, highlightMushafAyah: highlightMock, isCurrentLoad: () => false });
    await new Promise((r) => setTimeout(r, 0));
    expect(loadingHideMock).not.toHaveBeenCalled();

    renderPageMock.mockResolvedValueOnce({ canvas: null, layout: null });
    renderMushafPageImage(2, 2, false, { loadPage, highlightMushafAyah: highlightMock, isCurrentLoad: () => true });
    await new Promise((r) => setTimeout(r, 0));
    expect(showToastMock).toHaveBeenCalled();
    const reloadBtn = domMock.surahContent?.querySelector('[data-action="reload"]') as HTMLElement;
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', { value: { reload: reloadSpy }, writable: true, configurable: true });
    reloadBtn.click();
    expect(reloadSpy).toHaveBeenCalled();

    renderPageMock.mockRejectedValueOnce(new Error('boom'));
    renderMushafPageImage(2, 3, false, { loadPage, highlightMushafAyah: highlightMock, isCurrentLoad: () => true });
    await new Promise((r) => setTimeout(r, 0));
    expect(loadingHideMock).toHaveBeenCalled();
  });
});
