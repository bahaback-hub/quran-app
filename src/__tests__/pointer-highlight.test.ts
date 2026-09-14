/**
 * Tests for item 4: highlightCurrentAyah must not scroll the page while the
 * TV pointer cursor is active — auto-advance still moves the highlight, but
 * the content must stay put under the aimed cursor (e.g. background picker).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../state.js', () => ({
  state: {
    surahData: null as unknown,
    surahList: [] as unknown[],
    currentSurah: 1,
    currentAyahIndex: 0,
    currentReciter: 'ar.alafasy',
    currentTranslation: '',
    translationEnabled: false,
    translationData: null as unknown,
    hifdhMode: false,
    mushafMode: false,
    pointerMode: false,
    tvMode: false,
  },
  batch: vi.fn((fn: () => void) => fn()),
  setState: vi.fn(),
}));

vi.mock('../dom.js', () => ({
  dom: {
    surahContent: null as HTMLElement | null,
    surahSelect: null as HTMLElement | null,
    tafsirCurtain: null as HTMLElement | null,
    playerSurahName: null as HTMLElement | null,
    playerReciterName: null as HTMLElement | null,
    playerCurrentAyah: null as HTMLElement | null,
    collapsedInfo: null as HTMLElement | null,
    reciterSelect: null as HTMLElement | null,
  },
  cacheDom: vi.fn(),
}));

vi.mock('../storage.js', () => ({
  storage: { get: vi.fn(), set: vi.fn() },
}));

vi.mock('../ui.js', () => ({
  showToast: vi.fn(),
  loadingBar: { init: vi.fn(), show: vi.fn(), hide: vi.fn() },
}));

vi.mock('../i18n.js', () => ({
  __: (key: string) => key,
  getLang: () => 'ar',
  toArabicDigits: (s: string) => s,
}));

vi.mock('../templates.js', () => ({
  escapeHtml: (s: string) => s,
  collapsedPlayerInfo: () => '',
  skeletonLoading: () => '',
  surahLoadError: () => '',
}));

vi.mock('../tajweed.js', () => ({
  tajweedColorWord: (w: string) => w,
  buildColorMap: () => new Map(),
}));

vi.mock('../tajweed-data.js', () => ({
  getAyahAnnotations: () => [],
}));

vi.mock('../quran-meta.js', () => ({
  isSajdaAyah: () => ({ isSajda: false }),
  isJuzStart: () => false,
}));

vi.mock('../surahs-data.js', () => ({
  SURAH_SECRETS: [],
}));

vi.mock('../features/audio/audio.js', () => ({
  playCurrentAyah: vi.fn(),
}));

vi.mock('../tafsir.js', () => ({
  loadTafsirForCurrentAyah: vi.fn(),
}));

import { state } from '../state.js';
import { dom } from '../dom.js';
import { highlightCurrentAyah } from '../surah-render.js';

function buildContent(): HTMLElement {
  const content = document.createElement('main');
  const container = document.createElement('div');
  container.className = 'ayahs-container';
  for (let i = 0; i < 3; i++) {
    const ayah = document.createElement('span');
    ayah.className = 'ayah';
    ayah.dataset['index'] = String(i);
    ayah.textContent = `ayah ${i + 1}`;
    container.append(ayah);
  }
  content.append(container);
  document.body.append(content);
  return content;
}

describe('highlightCurrentAyah pointer-mode scroll suppression', () => {
  let content: HTMLElement;
  let scrollSpy: ReturnType<typeof vi.fn>;
  let prevScroll: unknown;
  const proto = Element.prototype as unknown as Record<string, unknown>;

  beforeEach(() => {
    (state as unknown as Record<string, unknown>).surahData = {
      number: 1,
      name: 'الفاتحة',
      englishName: 'Al-Fatiha',
      ayahs: [
        { numberInSurah: 1, text: 'a' },
        { numberInSurah: 2, text: 'b' },
        { numberInSurah: 3, text: 'c' },
      ],
    };
    (state as unknown as Record<string, unknown>).currentAyahIndex = 1;
    (state as unknown as Record<string, unknown>).hifdhMode = false;
    (state as unknown as Record<string, unknown>).mushafMode = false;
    (state as unknown as Record<string, unknown>).pointerMode = false;
    content = buildContent();
    (dom as unknown as Record<string, unknown>).surahContent = content;
    prevScroll = proto['scrollIntoView'];
    scrollSpy = vi.fn();
    proto['scrollIntoView'] = scrollSpy;
  });

  afterEach(() => {
    if (prevScroll === undefined) {
      delete proto['scrollIntoView'];
    } else {
      proto['scrollIntoView'] = prevScroll;
    }
    content.remove();
    (dom as unknown as Record<string, unknown>).surahContent = null;
    vi.clearAllMocks();
  });

  it('should still move the highlight class while pointer mode is active', () => {
    (state as unknown as Record<string, unknown>).pointerMode = true;
    highlightCurrentAyah();
    const current = content.querySelector('.ayah.current');
    expect(current?.getAttribute('data-index')).toBe('1');
  });

  it('should NOT scroll the page while pointer mode is active', () => {
    (state as unknown as Record<string, unknown>).pointerMode = true;
    highlightCurrentAyah();
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('should scroll normally when pointer mode is off', () => {
    (state as unknown as Record<string, unknown>).pointerMode = false;
    highlightCurrentAyah();
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });
});
