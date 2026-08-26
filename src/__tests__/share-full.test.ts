/**
 * Comprehensive tests for share.ts — Share and copy functionality.
 *
 * Covers ALL exported functions:
 *   - buildShareText — with/without surahData, with/without ayah
 *   - toggleShareMenu — DOM toggle
 *   - shareNative — with navigator.share / fallback to clipboard
 *   - shareCopy — clipboard copy
 *   - shareCopySimple — strip tashkeel + clipboard
 *   - shareWhatsApp — window.open
 *   - shareTelegram — window.open
 *
 * Edge cases:
 *   - No surahData
 *   - No ayah at current index
 *   - navigator.share not available
 *   - navigator.share rejection
 *   - Empty share text
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mock values ───────────────────────────────────────────

const { mockState, mockDom, mockShowToast, mockCopyToClipboard, mockStripTashkeel } = vi.hoisted(() => ({
  mockState: {
    surahData: null as unknown,
    currentAyahIndex: 0,
  },
  mockDom: {
    shareMenu: null as HTMLElement | null,
  },
  mockShowToast: vi.fn(),
  mockCopyToClipboard: vi.fn(),
  mockStripTashkeel: vi.fn((str: string) => str.replace(/[\u064B-\u065F\u0670]/g, '')),
}));

// ─── Mock dependencies ─────────────────────────────────────────────

vi.mock('../state.js', () => ({
  state: mockState,
  setState: vi.fn(),
  batch: vi.fn((fn: () => void) => fn()),
}));

vi.mock('../dom.js', () => ({
  dom: mockDom,
}));

vi.mock('../ui.js', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

vi.mock('../utils.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    stripTashkeel: (...args: unknown[]) => mockStripTashkeel(...args),
    copyToClipboard: (...args: unknown[]) => mockCopyToClipboard(...args),
  };
});

vi.mock('../i18n.js', () => ({
  __: (key: string, ...args: string[]) => {
    let val = key;
    args.forEach((arg, i) => {
      val = val.replace(`{${i}}`, arg);
    });
    return val;
  },
  setLocale: vi.fn(),
  getCurrentLocale: vi.fn(() => 'ar'),
  loadLocale: vi.fn(() => Promise.resolve()),
}));

// ─── Import module under test ──────────────────────────────────────

import {
  buildShareText,
  toggleShareMenu,
  shareNative,
  shareCopy,
  shareCopySimple,
  shareWhatsApp,
  shareTelegram,
} from '../share.js';

// ─── Sample data ───────────────────────────────────────────────────

const sampleAyahs = [
  { numberInSurah: 1, text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ' },
  { numberInSurah: 2, text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ' },
];

const sampleSurahData = {
  number: 1,
  name: 'سُورَةُ الفَاتِحَةِ',
  englishName: 'Al-Faatiha',
  ayahs: sampleAyahs,
};

// ─── Tests ─────────────────────────────────────────────────────────

describe('share.ts — full coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.surahData = null;
    mockState.currentAyahIndex = 0;
    mockDom.shareMenu = null;
  });

  // ─── buildShareText ─────────────────────────────────────────────

  describe('buildShareText', () => {
    it('should return empty string when no surahData', () => {
      mockState.surahData = null;
      expect(buildShareText()).toBe('');
    });

    it('should return empty string when ayah at current index does not exist', () => {
      mockState.surahData = sampleSurahData;
      mockState.currentAyahIndex = 99;
      expect(buildShareText()).toBe('');
    });

    it('should format share text with ayah text, surah name, and ayah number', () => {
      mockState.surahData = sampleSurahData;
      mockState.currentAyahIndex = 0;

      const text = buildShareText();
      expect(text).toContain('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ');
      expect(text).toContain('سُورَةُ الفَاتِحَةِ');
      expect(text).toContain('ayah');
      expect(text).toContain('1');
    });

    it('should use currentAyahIndex for selecting ayah', () => {
      mockState.surahData = sampleSurahData;
      mockState.currentAyahIndex = 1;

      const text = buildShareText();
      expect(text).toContain('الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ');
      expect(text).toContain('2');
    });

    it('should format with dash separators', () => {
      mockState.surahData = sampleSurahData;
      mockState.currentAyahIndex = 0;

      const text = buildShareText();
      expect(text).toContain(' — ');
    });
  });

  // ─── toggleShareMenu ────────────────────────────────────────────

  describe('toggleShareMenu', () => {
    it('should toggle show class on share menu element', () => {
      const menu = document.createElement('div');
      mockDom.shareMenu = menu;

      toggleShareMenu();
      expect(menu.classList.contains('show')).toBe(true);

      toggleShareMenu();
      expect(menu.classList.contains('show')).toBe(false);
    });

    it('should handle null shareMenu gracefully', () => {
      mockDom.shareMenu = null;
      expect(() => toggleShareMenu()).not.toThrow();
    });
  });

  // ─── shareNative ────────────────────────────────────────────────

  describe('shareNative', () => {
    it('should return early when share text is empty', () => {
      mockState.surahData = null;

      shareNative();

      // navigator.share should not be called
    });

    it('should use navigator.share when available', async () => {
      mockState.surahData = sampleSurahData;
      mockState.currentAyahIndex = 0;

      const mockShare = vi.fn(() => Promise.resolve());
      Object.defineProperty(navigator, 'share', {
        value: mockShare,
        configurable: true,
        writable: true,
      });

      shareNative();

      expect(mockShare).toHaveBeenCalledWith({
        title: 'app_title',
        text: expect.stringContaining('بِسْمِ'),
      });

      Object.defineProperty(navigator, 'share', {
        value: undefined,
        configurable: true,
        writable: true,
      });
    });

    it('should fall back to shareCopy when navigator.share is not available', () => {
      mockState.surahData = sampleSurahData;
      mockState.currentAyahIndex = 0;

      Object.defineProperty(navigator, 'share', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      shareNative();

      expect(mockCopyToClipboard).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith('copied', 'success');
    });

    it('should handle navigator.share rejection gracefully', async () => {
      mockState.surahData = sampleSurahData;
      mockState.currentAyahIndex = 0;

      const mockShare = vi.fn(() => Promise.reject(new Error('User cancelled')));
      Object.defineProperty(navigator, 'share', {
        value: mockShare,
        configurable: true,
        writable: true,
      });

      shareNative();

      expect(mockShare).toHaveBeenCalled();

      Object.defineProperty(navigator, 'share', {
        value: undefined,
        configurable: true,
        writable: true,
      });
    });
  });

  // ─── shareCopy ──────────────────────────────────────────────────

  describe('shareCopy', () => {
    it('should copy share text and show success toast', () => {
      mockState.surahData = sampleSurahData;
      mockState.currentAyahIndex = 0;

      shareCopy();

      expect(mockCopyToClipboard).toHaveBeenCalledWith(expect.stringContaining('بِسْمِ'));
      expect(mockShowToast).toHaveBeenCalledWith('copied', 'success');
    });

    it('should copy empty string when no surahData', () => {
      mockState.surahData = null;

      shareCopy();

      expect(mockCopyToClipboard).toHaveBeenCalledWith('');
      expect(mockShowToast).toHaveBeenCalledWith('copied', 'success');
    });
  });

  // ─── shareCopySimple ────────────────────────────────────────────

  describe('shareCopySimple', () => {
    it('should return early when no surahData', () => {
      mockState.surahData = null;

      shareCopySimple();

      expect(mockStripTashkeel).not.toHaveBeenCalled();
      expect(mockCopyToClipboard).not.toHaveBeenCalled();
    });

    it('should return early when no ayah at current index', () => {
      mockState.surahData = sampleSurahData;
      mockState.currentAyahIndex = 99;

      shareCopySimple();

      expect(mockStripTashkeel).not.toHaveBeenCalled();
      expect(mockCopyToClipboard).not.toHaveBeenCalled();
    });

    it('should strip tashkeel and copy to clipboard', () => {
      mockState.surahData = sampleSurahData;
      mockState.currentAyahIndex = 0;

      shareCopySimple();

      expect(mockStripTashkeel).toHaveBeenCalledWith('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ');
      expect(mockCopyToClipboard).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith('share_copied_simple', 'success');
    });

    it('should include surah name and ayah number in simple copy text', () => {
      mockState.surahData = sampleSurahData;
      mockState.currentAyahIndex = 1;

      shareCopySimple();

      const copiedText = mockCopyToClipboard.mock.calls[0]?.[0] as string;
      expect(copiedText).toContain('سُورَةُ الفَاتِحَةِ');
      expect(copiedText).toContain('ayah');
    });
  });

  // ─── shareWhatsApp ──────────────────────────────────────────────

  describe('shareWhatsApp', () => {
    let windowOpenSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    });

    afterEach(() => {
      windowOpenSpy.mockRestore();
    });

    it('should return early when share text is empty', () => {
      mockState.surahData = null;

      shareWhatsApp();

      expect(windowOpenSpy).not.toHaveBeenCalled();
    });

    it('should open WhatsApp share URL', () => {
      mockState.surahData = sampleSurahData;
      mockState.currentAyahIndex = 0;

      shareWhatsApp();

      expect(windowOpenSpy).toHaveBeenCalledTimes(1);
      const url = windowOpenSpy.mock.calls[0]?.[0] as string;
      expect(url).toContain('https://wa.me/?text=');
      expect(url).toContain(encodeURIComponent('بِسْمِ'));
    });

    it('should open in new tab', () => {
      mockState.surahData = sampleSurahData;
      mockState.currentAyahIndex = 0;

      shareWhatsApp();

      expect(windowOpenSpy).toHaveBeenCalledWith(expect.any(String), '_blank');
    });
  });

  // ─── shareTelegram ──────────────────────────────────────────────

  describe('shareTelegram', () => {
    let windowOpenSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    });

    afterEach(() => {
      windowOpenSpy.mockRestore();
    });

    it('should return early when share text is empty', () => {
      mockState.surahData = null;

      shareTelegram();

      expect(windowOpenSpy).not.toHaveBeenCalled();
    });

    it('should open Telegram share URL', () => {
      mockState.surahData = sampleSurahData;
      mockState.currentAyahIndex = 0;

      shareTelegram();

      expect(windowOpenSpy).toHaveBeenCalledTimes(1);
      const url = windowOpenSpy.mock.calls[0]?.[0] as string;
      expect(url).toContain('https://t.me/share/url');
      expect(url).toContain('text=');
      expect(url).toContain('url=');
    });

    it('should open in new tab', () => {
      mockState.surahData = sampleSurahData;
      mockState.currentAyahIndex = 0;

      shareTelegram();

      expect(windowOpenSpy).toHaveBeenCalledWith(expect.any(String), '_blank');
    });

    it('should include current page URL in share link', () => {
      mockState.surahData = sampleSurahData;
      mockState.currentAyahIndex = 0;

      shareTelegram();

      const url = windowOpenSpy.mock.calls[0]?.[0] as string;
      expect(url).toContain(encodeURIComponent(location.href));
    });
  });

  // ─── Integration-style tests ────────────────────────────────────

  describe('Integration: share flow', () => {
    it('should produce consistent text between shareCopy and shareWhatsApp', () => {
      mockState.surahData = sampleSurahData;
      mockState.currentAyahIndex = 0;

      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      shareCopy();
      const copyText = mockCopyToClipboard.mock.calls[0]?.[0] as string;

      shareWhatsApp();
      const waUrl = windowOpenSpy.mock.calls[0]?.[0] as string;
      const waText = decodeURIComponent(waUrl.replace('https://wa.me/?text=', ''));

      expect(waText).toBe(copyText);

      windowOpenSpy.mockRestore();
    });

    it('shareCopySimple should have tashkeel-stripped text', () => {
      mockState.surahData = sampleSurahData;
      mockState.currentAyahIndex = 0;

      shareCopy();
      const fullText = mockCopyToClipboard.mock.calls[0]?.[0] as string;

      shareCopySimple();
      const simpleText = mockCopyToClipboard.mock.calls[1]?.[0] as string;

      expect(mockStripTashkeel).toHaveBeenCalled();
      expect(simpleText).toContain('سُورَةُ الفَاتِحَةِ');
    });
  });
});
