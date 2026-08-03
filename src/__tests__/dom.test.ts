/**
 * Tests for dom.ts — DOM element caching and mapping.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Override the setup mock so we get the actual dom module
vi.unmock('../dom.js');

import { dom, cacheDom } from '../dom.js';

/** Reset dom to all-null state between tests. */
function resetDom(): void {
  const keys = Object.keys(dom);
  for (const key of keys) {
    (dom as Record<string, HTMLElement | null>)[key] = null;
  }
}

describe('dom', () => {
  beforeEach(resetDom);

  it('should be an object with all DOM_IDS keys initialized to null', () => {
    expect(dom).toBeDefined();
    expect(typeof dom).toBe('object');
    // Spot-check some keys exist and are null
    expect(dom).toHaveProperty('surahContent', null);
    expect(dom).toHaveProperty('audioPlayer', null);
    expect(dom).toHaveProperty('settingsPanel', null);
    expect(dom).toHaveProperty('toast', null);
  });

  it('should have null for HTMLElement-typed properties', () => {
    expect(dom.surahContent).toBeNull();
    expect(dom.settingsPanel).toBeNull();
    expect(dom.toast).toBeNull();
    expect(dom.prayerBar).toBeNull();
  });

  it('should have null for HTMLSelectElement-typed properties', () => {
    expect(dom.surahSelect).toBeNull();
    expect(dom.reciterSelect).toBeNull();
    expect(dom.methodSelect).toBeNull();
    expect(dom.speedSelect).toBeNull();
  });

  it('should have null for HTMLInputElement-typed properties', () => {
    expect(dom.searchInput).toBeNull();
    expect(dom.cityInput).toBeNull();
    expect(dom.repeatFrom).toBeNull();
  });

  it('should have null for HTMLAudioElement-typed properties', () => {
    expect(dom.audioPlayer).toBeNull();
    expect(dom.audioPlayer2).toBeNull();
    expect(dom.azanPlayer).toBeNull();
  });
});

describe('createEmptyDomMap (via dom export)', () => {
  beforeEach(resetDom);

  it('should initialize every property to null (no undefined values)', () => {
    const keys = Object.keys(dom);
    for (const key of keys) {
      expect((dom as Record<string, unknown>)[key]).toBeNull();
    }
  });

  it('should have no undefined properties', () => {
    const keys = Object.keys(dom);
    for (const key of keys) {
      expect((dom as Record<string, unknown>)[key]).not.toBeUndefined();
    }
  });
});

describe('cacheDom', () => {
  let getElementByIdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetDom();
    getElementByIdSpy = vi.spyOn(document, 'getElementById').mockReturnValue(null);
  });

  afterEach(() => {
    getElementByIdSpy.mockRestore();
  });

  it('should call document.getElementById for each DOM ID', () => {
    cacheDom();
    // Should be called many times (once per DOM_ID entry)
    expect(getElementByIdSpy).toHaveBeenCalled();
    // Spot-check specific IDs
    expect(getElementByIdSpy).toHaveBeenCalledWith('surahContent');
    expect(getElementByIdSpy).toHaveBeenCalledWith('audioPlayer');
    expect(getElementByIdSpy).toHaveBeenCalledWith('settingsPanel');
    expect(getElementByIdSpy).toHaveBeenCalledWith('toast');
  });

  it('should populate dom properties with found elements', () => {
    const mockElement = document.createElement('div');
    getElementByIdSpy.mockImplementation((id: string) => {
      if (id === 'surahContent') {
        return mockElement;
      }
      return null;
    });

    cacheDom();

    expect(dom.surahContent).toBe(mockElement);
    // Other properties should be null since getElementById returned null for them
    expect(dom.bigClockTime).toBeNull();
  });

  it('should set dom properties to null when elements are not found', () => {
    getElementByIdSpy.mockReturnValue(null);
    cacheDom();
    expect(dom.bigClockTime).toBeNull();
    expect(dom.surahContent).toBeNull();
  });

  it('should handle HTMLSelectElement lookups', () => {
    const mockSelect = document.createElement('select');
    getElementByIdSpy.mockImplementation((id: string) => {
      if (id === 'surahSelect') {
        return mockSelect;
      }
      return null;
    });

    cacheDom();
    expect(dom.surahSelect).toBe(mockSelect);
  });

  it('should handle HTMLInputElement lookups', () => {
    const mockInput = document.createElement('input');
    getElementByIdSpy.mockImplementation((id: string) => {
      if (id === 'searchInput') {
        return mockInput;
      }
      return null;
    });

    cacheDom();
    expect(dom.searchInput).toBe(mockInput);
  });

  it('should handle HTMLAudioElement lookups', () => {
    const mockAudio = document.createElement('audio');
    getElementByIdSpy.mockImplementation((id: string) => {
      if (id === 'audioPlayer') {
        return mockAudio;
      }
      return null;
    });

    cacheDom();
    expect(dom.audioPlayer).toBe(mockAudio);
  });

  it('should overwrite previous cached values on re-cache', () => {
    const firstElement = document.createElement('div');
    const secondElement = document.createElement('span');

    getElementByIdSpy.mockReturnValue(firstElement);
    cacheDom();
    expect(dom.surahContent).toBe(firstElement);

    getElementByIdSpy.mockReturnValue(secondElement);
    cacheDom();
    expect(dom.surahContent).toBe(secondElement);
  });

  it('should reset previously found elements to null if they are no longer in DOM', () => {
    const mockElement = document.createElement('div');
    getElementByIdSpy.mockImplementation((id: string) => {
      if (id === 'surahContent') {
        return mockElement;
      }
      return null;
    });
    cacheDom();
    expect(dom.surahContent).toBe(mockElement);

    // Now surahContent is gone from DOM
    getElementByIdSpy.mockReturnValue(null);
    cacheDom();
    expect(dom.surahContent).toBeNull();
  });
});

describe('DOM_IDS completeness', () => {
  beforeEach(resetDom);

  it('should include all expected top-level IDs', () => {
    const expectedKeys = [
      'nextPrayerName',
      'nextPrayerTime',
      'countdownDisplay',
      'prayerTimesRows',
      'prayerCountdown',
      'bigClockTime',
      'bigClockTime2',
      'bigClockDate',
      'bigClockHijri',
      'settingsPanel',
      'settingsCloseBtn',
      'settingsToggleBtn',
      'themeToggle',
      'surahSelect',
      'reciterSelect',
      'searchInput',
      'searchBtn',
      'searchResults',
      'surahContent',
      'audioPlayer',
      'audioPlayer2',
      'speedSelect',
      'toast',
      'controls',
    ];

    for (const key of expectedKeys) {
      expect(dom).toHaveProperty(key);
    }
  });

  it('should have over 100 DOM IDs defined', () => {
    const keyCount = Object.keys(dom).length;
    expect(keyCount).toBeGreaterThan(100);
  });
});
