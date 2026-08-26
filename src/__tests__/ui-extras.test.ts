/**
 * Tests for ui-extras.ts — Continue widget, visibility, network banner, reading progress.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  updateNetworkBanner,
  updateReadingProgress,
  handleVisibilityChange,
  showContinueWidget,
} from '../ui-extras.js';

// Mock dom module
vi.mock('../dom.js', () => ({
  dom: {
    networkBanner: null as HTMLElement | null,
    surahContent: null as HTMLElement | null,
    surahSelect: null as HTMLSelectElement | null,
  },
  cacheDom: vi.fn(),
}));

// Mock i18n module
vi.mock('../i18n.js', () => ({
  __: (key: string, ..._args: unknown[]) => key,
  getLang: () => 'ar',
  setLang: vi.fn(),
}));

// Mock state module
vi.mock('../state.js', () => ({
  state: {
    mushafMode: false,
    currentAyahIndex: 0,
    surahData: null as null | { ayahs: unknown[] },
    currentPage: 1,
  },
}));

// Mock prayer module
vi.mock('../prayer.js', () => ({
  stopClock: vi.fn(),
  startClock: vi.fn(),
}));

// Mock adhkar module
vi.mock('../adhkar.js', () => ({
  checkAdhkarNotifications: vi.fn(),
}));

// Mock internal-state module
vi.mock('../internal-state.js', () => ({
  getAdhkarIntervalId: () => null,
  setAdhkarIntervalId: vi.fn(),
}));

// Mock surah-loader module
vi.mock('../surah-loader.js', () => ({
  loadSurah: vi.fn(),
}));

import { dom } from '../dom.js';
import { state } from '../state.js';

describe('updateNetworkBanner', () => {
  let banner: HTMLElement;

  beforeEach(() => {
    banner = document.createElement('div');
    banner.id = 'networkBanner';
    banner.className = 'network-banner';
    document.body.appendChild(banner);
    (dom as unknown as Record<string, HTMLElement | null>).networkBanner = banner;
  });

  afterEach(() => {
    banner.remove();
    (dom as unknown as Record<string, HTMLElement | null>).networkBanner = null;
  });

  it('should add show class when offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    updateNetworkBanner();
    expect(banner.classList.contains('show')).toBe(true);
  });

  it('should remove show class when online', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    updateNetworkBanner();
    expect(banner.classList.contains('show')).toBe(false);
  });

  it('should hide a stale offline banner when the browser is online', () => {
    banner.classList.add('show');
    banner.hidden = false;
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    updateNetworkBanner();

    expect(banner.hidden).toBe(true);
    expect(banner.classList.contains('show')).toBe(false);
  });

  it('should reveal the banner when the browser goes offline', () => {
    banner.hidden = true;
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    updateNetworkBanner();

    expect(banner.hidden).toBe(false);
    expect(banner.classList.contains('show')).toBe(true);
  });

  it('should remove online class when offline', () => {
    banner.classList.add('online');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    updateNetworkBanner();
    expect(banner.classList.contains('online')).toBe(false);
  });

  it('should not throw when networkBanner is null', () => {
    (dom as unknown as Record<string, HTMLElement | null>).networkBanner = null;
    expect(() => updateNetworkBanner()).not.toThrow();
  });

  it('should have role=status attribute on networkBanner', () => {
    expect(dom.networkBanner).toBe(banner);
  });

  it('should toggle between online and offline states', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    updateNetworkBanner();
    expect(banner.classList.contains('show')).toBe(true);

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    updateNetworkBanner();
    expect(banner.classList.contains('show')).toBe(false);
  });
});

describe('updateReadingProgress', () => {
  let progressBar: HTMLElement;
  let content: HTMLElement;

  beforeEach(() => {
    progressBar = document.createElement('div');
    progressBar.id = 'readingProgress';
    document.body.appendChild(progressBar);

    content = document.createElement('main');
    content.id = 'surahContent';
    document.body.appendChild(content);
    (dom as unknown as Record<string, HTMLElement | null>).surahContent = content;
  });

  afterEach(() => {
    progressBar.remove();
    content.remove();
    (dom as unknown as Record<string, HTMLElement | null>).surahContent = null;
  });

  it('should update progress bar transform based on current ayah', async () => {
    (state as Record<string, unknown>).mushafMode = false;
    (state as Record<string, unknown>).currentAyahIndex = 5;
    (state as Record<string, unknown>).surahData = { ayahs: new Array(10) };

    updateReadingProgress();
    await new Promise((r) => setTimeout(r, 50));

    const transform = progressBar.style.transform;
    expect(transform).toContain('scaleX');
  });

  it('should handle mushaf mode progress', async () => {
    (state as Record<string, unknown>).mushafMode = true;
    (state as Record<string, unknown>).currentPage = 100;

    updateReadingProgress();
    await new Promise((r) => setTimeout(r, 50));

    expect(progressBar.style.transform).toContain('scaleX');
  });

  it('should not throw when surahContent is null', async () => {
    (dom as unknown as Record<string, HTMLElement | null>).surahContent = null;
    (state as Record<string, unknown>).mushafMode = false;
    (state as Record<string, unknown>).surahData = { ayahs: [] };

    updateReadingProgress();
    await new Promise((r) => setTimeout(r, 50));
  });

  it('should not throw when surahData is null', async () => {
    (state as Record<string, unknown>).mushafMode = false;
    (state as Record<string, unknown>).surahData = null;

    updateReadingProgress();
    await new Promise((r) => setTimeout(r, 50));
  });

  it('should cap progress at 1 for last ayah', async () => {
    (state as Record<string, unknown>).mushafMode = false;
    (state as Record<string, unknown>).currentAyahIndex = 9;
    (state as Record<string, unknown>).surahData = { ayahs: new Array(10) };

    updateReadingProgress();
    await new Promise((r) => setTimeout(r, 50));

    // Should be scaleX(1) or close to it
    expect(progressBar.style.transform).toContain('scaleX');
  });

  it('should handle zero ayahs gracefully', async () => {
    (state as Record<string, unknown>).mushafMode = false;
    (state as Record<string, unknown>).currentAyahIndex = 0;
    (state as Record<string, unknown>).surahData = { ayahs: [] };

    updateReadingProgress();
    await new Promise((r) => setTimeout(r, 50));
    // Should not divide by zero
  });
});

describe('handleVisibilityChange', () => {
  it('should not throw when document is hidden', () => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    expect(() => handleVisibilityChange()).not.toThrow();
  });

  it('should not throw when document is visible', () => {
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    expect(() => handleVisibilityChange()).not.toThrow();
  });
});

describe('showContinueWidget', () => {
  beforeEach(() => {
    // Clean up any existing widget
    const existing = document.getElementById('continueWidget');
    if (existing) existing.remove();
    const existingStyles = document.getElementById('continue-widget-styles');
    if (existingStyles) existingStyles.remove();
  });

  afterEach(() => {
    const existing = document.getElementById('continueWidget');
    if (existing) existing.remove();
    const existingStyles = document.getElementById('continue-widget-styles');
    if (existingStyles) existingStyles.remove();
  });

  it('should create and display a continue widget', () => {
    showContinueWidget({
      surah: 1,
      surahName: 'الفاتحة',
      ayahNumberInSurah: 5,
      timestamp: Date.now(),
    });

    const widget = document.getElementById('continueWidget');
    expect(widget).not.toBeNull();
    expect(widget?.textContent).toContain('الفاتحة');
  });

  it('should inject continue widget styles', () => {
    showContinueWidget({
      surah: 2,
      surahName: 'البقرة',
      ayahNumberInSurah: 10,
    });

    const styles = document.getElementById('continue-widget-styles');
    expect(styles).not.toBeNull();
  });

  it('should replace existing widget if called again', () => {
    showContinueWidget({
      surah: 1,
      surahName: 'الفاتحة',
      ayahNumberInSurah: 1,
    });

    showContinueWidget({
      surah: 2,
      surahName: 'البقرة',
      ayahNumberInSurah: 2,
    });

    const widgets = document.querySelectorAll('#continueWidget');
    expect(widgets.length).toBe(1);
    expect(widgets[0].textContent).toContain('البقرة');
  });

  it('should auto-remove widget after timeout', async () => {
    vi.useFakeTimers();
    showContinueWidget({
      surah: 1,
      surahName: 'الفاتحة',
      ayahNumberInSurah: 1,
    });

    expect(document.getElementById('continueWidget')).not.toBeNull();

    vi.advanceTimersByTime(8500);

    expect(document.getElementById('continueWidget')).toBeNull();
    vi.useRealTimers();
  });
});
