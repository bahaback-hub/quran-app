import { describe, it, expect, beforeEach, vi } from 'vitest';

const {
  domMock,
  stateMock,
  apiFetchMock,
  getAyahHighlightRectsMock,
  loadSurahMock,
  updatePlayerInfoMock,
  prepareAudioForNewSurahMock,
  playCurrentAyahMock,
  computeMushafPageGeometryMock,
} = vi.hoisted(() => ({
  domMock: { surahContent: null as HTMLElement | null },
  stateMock: {
    mushafMode: true,
    surahData: null as any,
    currentAyahIndex: 0,
    currentPageLayout: null as any,
    currentPage: 1,
    currentSurah: 1,
    isPlaying: false,
  },
  apiFetchMock: vi.fn(),
  getAyahHighlightRectsMock: vi.fn(),
  loadSurahMock: vi.fn(),
  updatePlayerInfoMock: vi.fn(),
  prepareAudioForNewSurahMock: vi.fn(),
  playCurrentAyahMock: vi.fn(),
  computeMushafPageGeometryMock: vi.fn(),
}));

vi.mock('../dom.js', () => ({ dom: domMock }));
vi.mock('../state.js', () => ({ state: stateMock }));
vi.mock('../api-client.js', () => ({ apiFetch: apiFetchMock }));
vi.mock('../ayah-click.js', () => ({ getAyahHighlightRects: (...a: any[]) => (getAyahHighlightRectsMock as any)(...a) }));
vi.mock('../surah-loader.js', () => ({ loadSurah: (...a: any[]) => (loadSurahMock as any)(...a), updatePlayerInfo: (...a: any[]) => (updatePlayerInfoMock as any)(...a) }));
vi.mock('../features/audio/audio.js', () => ({ prepareAudioForNewSurah: (...a: any[]) => (prepareAudioForNewSurahMock as any)(...a), playCurrentAyah: (...a: any[]) => (playCurrentAyahMock as any)(...a) }));
vi.mock('../features/mushaf/mushaf-renderer.js', () => ({ computeMushafPageGeometry: (...a: any[]) => (computeMushafPageGeometryMock as any)(...a) }));

import { clearMushafGeomCache, getMushafPageGeometry, highlightMushafAyahImpl, playMushafAyah } from '../features/mushaf/mushaf-highlight.js';

function makeWrapper() {
  const wrapper = document.createElement('div');
  wrapper.className = 'mushaf-image-wrapper';
  wrapper.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 200 } as DOMRect);
  const canvas = document.createElement('canvas');
  canvas.className = 'mushaf-page-canvas';
  Object.defineProperty(canvas, 'width', { value: 300, configurable: true });
  canvas.getBoundingClientRect = () => ({ left: 5, top: 10, width: 100, height: 200 } as DOMRect);
  canvas.getContext = vi.fn(() => ({})) as any;
  wrapper.appendChild(canvas);
  const root = document.createElement('div');
  root.appendChild(wrapper);
  domMock.surahContent = root;
  return { wrapper, canvas };
}

describe('mushaf-highlight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMushafGeomCache();
    stateMock.mushafMode = true;
    stateMock.currentPage = 5;
    stateMock.currentSurah = 2;
    stateMock.currentAyahIndex = 0;
    stateMock.isPlaying = false;
    stateMock.surahData = { number: 2, ayahs: [{ numberInSurah: 1 }, { numberInSurah: 2 }] };
    stateMock.currentPageLayout = { lines: [{ words: [{ verse_key: '2:1' }] }] };
    getAyahHighlightRectsMock.mockResolvedValue([{ top: 1, left: 2, width: 30, height: 10 }]);
  });

  it('getMushafPageGeometry returns null/cached geometry as appropriate', () => {
    const canvas = document.createElement('canvas');
    canvas.getContext = vi.fn(() => ({})) as any;
    computeMushafPageGeometryMock.mockReturnValue({ lines: [{ id: 1 }] });
    expect(getMushafPageGeometry(canvas, 5)).toEqual({ lines: [{ id: 1 }] });
    expect(getMushafPageGeometry(canvas, 5)).toEqual({ lines: [{ id: 1 }] });
    expect(computeMushafPageGeometryMock).toHaveBeenCalledTimes(1);

    stateMock.currentPageLayout = null;
    expect(getMushafPageGeometry(canvas, 6)).toBeNull();
  });

  it('highlightMushafAyahImpl exits on invalid state and draws overlay on success', async () => {
    const loadPage = vi.fn();
    stateMock.mushafMode = false;
    await highlightMushafAyahImpl(undefined, loadPage);
    expect(getAyahHighlightRectsMock).not.toHaveBeenCalled();

    stateMock.mushafMode = true;
    const { wrapper } = makeWrapper();
    await highlightMushafAyahImpl(false, loadPage);
    expect(wrapper.querySelectorAll('.mushaf-ayah-highlight')).toHaveLength(1);

    getAyahHighlightRectsMock.mockResolvedValueOnce([]);
    await highlightMushafAyahImpl(true, loadPage);
    expect(wrapper.querySelectorAll('.mushaf-ayah-highlight')).toHaveLength(1);
  });

  it('highlightMushafAyahImpl navigates to ayah page when not on current layout', async () => {
    makeWrapper();
    stateMock.currentPageLayout = { lines: [{ words: [{ verse_key: '2:99' }] }] };
    apiFetchMock.mockResolvedValue({ data: { page: 12 } });
    const loadPage = vi.fn();
    await highlightMushafAyahImpl(false, loadPage);
    expect(loadPage).toHaveBeenCalledWith(12);
  });

  it('playMushafAyah loads surah or plays selected ayah', () => {
    stateMock.currentSurah = 1;
    playMushafAyah(2, 3);
    expect(loadSurahMock).toHaveBeenCalledWith(2, { startAyah: 3, autoPlay: true });

    stateMock.currentSurah = 2;
    stateMock.isPlaying = true;
    stateMock.surahData = { number: 2, ayahs: [{ numberInSurah: 1 }, { numberInSurah: 3 }] };
    playMushafAyah(2, 3);
    expect(prepareAudioForNewSurahMock).toHaveBeenCalled();
    expect(stateMock.currentAyahIndex).toBe(1);
    expect(updatePlayerInfoMock).toHaveBeenCalled();
    expect(playCurrentAyahMock).toHaveBeenCalled();
  });
});
