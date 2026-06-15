/**
 * Tests for audio.ts — audio playback, hifdh, repeat, and sleep timer.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getDefaultRepeatRange,
  applyRepeatUI,
  applyHifdhUI,
  resetRepeatUI,
  resetAudioElement,
  resetAudioPlayerUI,
  getSleepTimerMinutes,
  getSleepTimerRemaining,
  clearSleepTimer,
  cleanupSleepTimerInterval,
  setSleepTimer,
  prepareAudioForNewSurah,
  type RepeatRange,
} from '../audio.js';
import type { SurahData } from '../types.js';

// Mock dependencies
vi.mock('../state.js', () => ({
  state: {
    isPlaying: false,
    surahData: null,
    ayahsAudios: [],
    currentAyahIndex: 0,
    currentSurah: 1,
    hifdhMode: false,
    repeatMode: false,
    repeatFrom: 1,
    repeatTo: 1,
    repeatTimes: 3,
    repeatCounter: 0,
    ayahTimings: [],
    mushafMode: false,
  },
  setState: vi.fn(),
  batch: vi.fn((fn) => fn()),
}));

vi.mock('../dom.js', () => ({
  dom: {
    audioPlayer: null,
    audioPlayer2: null,
    playPauseBtn: null,
    hifdhBtn: null,
    repeatBtn: null,
    repeatControls: null,
    repeatFrom: null,
    repeatTo: null,
    repeatTimes: null,
    player: null,
  },
}));

vi.mock('../storage.js', () => ({
  storage: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('../ui.js', () => ({
  showToast: vi.fn(),
}));

vi.mock('../utils.js', () => ({
  hapticFeedback: vi.fn(),
}));

vi.mock('../surah-loader.js', () => ({
  highlightCurrentAyah: vi.fn(),
}));

vi.mock('../i18n.js', () => ({
  __: (key: string) => key,
}));

vi.mock('../audio-visualizer.js', () => ({
  startVisualizer: vi.fn(),
  stopVisualizer: vi.fn(),
}));

describe('getDefaultRepeatRange', () => {
  it('should return from=1, to=ayah count, times=3', () => {
    const surahData = {
      number: 1,
      name: 'الفاتحة',
      englishName: 'Al-Fatiha',
      ayahs: Array.from({ length: 7 }, (_, i) => ({ numberInSurah: i + 1, text: `آية ${i + 1}` })),
    } as SurahData;

    const range = getDefaultRepeatRange(surahData);
    expect(range.from).toBe(1);
    expect(range.to).toBe(7);
    expect(range.times).toBe(3);
  });

  it('should handle surah with many ayahs', () => {
    const surahData = {
      number: 2,
      name: 'البقرة',
      englishName: 'Al-Baqarah',
      ayahs: Array.from({ length: 286 }, (_, i) => ({ numberInSurah: i + 1, text: `آية ${i + 1}` })),
    } as SurahData;

    const range = getDefaultRepeatRange(surahData);
    expect(range.to).toBe(286);
    expect(range.times).toBe(3);
  });
});

describe('applyRepeatUI', () => {
  it('should not throw when DOM elements are null', () => {
    expect(() => applyRepeatUI(true)).not.toThrow();
    expect(() => applyRepeatUI(false)).not.toThrow();
  });
});

describe('resetRepeatUI', () => {
  it('should not throw when DOM elements are null', () => {
    expect(() => resetRepeatUI()).not.toThrow();
  });
});

describe('applyHifdhUI', () => {
  it('should not throw when hifdhBtn is null', () => {
    expect(() => applyHifdhUI(true)).not.toThrow();
    expect(() => applyHifdhUI(false)).not.toThrow();
  });
});

describe('resetAudioElement', () => {
  it('should not throw when player is null', () => {
    expect(() => resetAudioElement(null)).not.toThrow();
  });

  it('should pause and reset a mock audio element', () => {
    const mockPlayer = {
      pause: vi.fn(),
      removeAttribute: vi.fn(),
      load: vi.fn(),
    } as unknown as HTMLAudioElement;

    resetAudioElement(mockPlayer);
    expect(mockPlayer.pause).toHaveBeenCalled();
    expect(mockPlayer.removeAttribute).toHaveBeenCalledWith('src');
    expect(mockPlayer.load).toHaveBeenCalled();
  });
});

describe('resetAudioPlayerUI', () => {
  it('should not throw when called', () => {
    expect(() => resetAudioPlayerUI()).not.toThrow();
  });
});

describe('prepareAudioForNewSurah', () => {
  it('should not throw when called', () => {
    expect(() => prepareAudioForNewSurah()).not.toThrow();
  });
});

describe('Sleep Timer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearSleepTimer();
    cleanupSleepTimerInterval();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('getSleepTimerMinutes should return 0 when no timer is set', () => {
    expect(getSleepTimerMinutes()).toBe(0);
  });

  it('getSleepTimerRemaining should return 0 when no timer is set', () => {
    expect(getSleepTimerRemaining()).toBe(0);
  });

  it('setSleepTimer with positive minutes should set the timer', () => {
    setSleepTimer(5);
    expect(getSleepTimerMinutes()).toBe(5);
    expect(getSleepTimerRemaining()).toBeGreaterThan(4);
  });

  it('setSleepTimer with 0 should cancel the timer', () => {
    setSleepTimer(5);
    setSleepTimer(0);
    expect(getSleepTimerMinutes()).toBe(0);
  });

  it('setSleepTimer with negative minutes should cancel the timer', () => {
    setSleepTimer(-1);
    expect(getSleepTimerMinutes()).toBe(0);
  });

  it('clearSleepTimer should reset timer state', () => {
    setSleepTimer(10);
    clearSleepTimer();
    expect(getSleepTimerMinutes()).toBe(0);
    expect(getSleepTimerRemaining()).toBe(0);
  });

  it('getSleepTimerRemaining should decrease over time', () => {
    setSleepTimer(10);
    const initial = getSleepTimerRemaining();
    vi.advanceTimersByTime(60 * 1000); // Advance 1 minute
    const after = getSleepTimerRemaining();
    expect(after).toBeLessThan(initial);
  });

  it('cleanupSleepTimerInterval should not throw', () => {
    expect(() => cleanupSleepTimerInterval()).not.toThrow();
  });
});
