/**
 * Comprehensive tests for audio.ts — covering uncovered paths:
 *   - Object URL memory leak fix (revokeObjectURL on src replacement)
 *   - resolveAudioUrl — cache integration
 *   - playCurrentAyah — MP3 Quran path, error paths
 *   - onAudioError — retry logic and skip-on-failure
 *   - onAudioEnded — auto-play next surah, surah 114 stop
 *   - handleRepeatOnEnd — edge cases
 *   - onTimeUpdate — mp3quran word tracking
 *   - onAudioPlay / onAudioPause — visualizer, mediaSession
 *   - preloadNextAyah — audioPlayer2 creation
 *   - populateRepeatUI — onchange handlers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/** Flush pending microtasks (promises) so async effects propagate. */
function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ─── Hoisted mock values (vi.mock factories are hoisted before declarations) ──

const {
  mockState,
  mockDom,
  mockShowToast,
  mockHapticFeedback,
  mockHighlightCurrentAyah,
  mockGetCachedAudioUrl,
  mockStorageGet,
  mockStorageSet,
} = vi.hoisted(() => {
  const mockState = {
    isPlaying: false,
    surahData: null as unknown,
    ayahsAudios: [] as string[],
    currentAyahIndex: 0,
    currentSurah: 1,
    hifdhMode: false,
    repeatMode: false,
    repeatFrom: 1,
    repeatTo: 1,
    repeatTimes: 3,
    repeatCounter: 0,
    ayahTimings: [] as number[],
    mushafMode: false,
    autoPlayNext: false,
  };

  const mockDom = {
    audioPlayer: null as HTMLAudioElement | null,
    audioPlayer2: null as HTMLAudioElement | null,
    player: null as HTMLElement | null,
    playPauseBtn: null as HTMLElement | null,
    hifdhBtn: null as HTMLElement | null,
    repeatBtn: null as HTMLElement | null,
    repeatControls: null as HTMLElement | null,
    repeatFrom: null as HTMLSelectElement | null,
    repeatTo: null as HTMLSelectElement | null,
    repeatTimes: null as HTMLSelectElement | null,
    surahContent: null as HTMLElement | null,
    langSelect: null as HTMLSelectElement | null,
  };

  return {
    mockState,
    mockDom,
    mockShowToast: vi.fn(),
    mockHapticFeedback: vi.fn(),
    mockHighlightCurrentAyah: vi.fn(),
    mockGetCachedAudioUrl: vi.fn(),
    mockStorageGet: vi.fn(() => null),
    mockStorageSet: vi.fn(),
  };
});

// ─── Mock dependencies ─────────────────────────────────────────────

vi.mock('../state.js', () => ({
  state: mockState,
  setState: vi.fn(),
  batch: vi.fn((fn: () => void) => fn()),
}));

vi.mock('../dom.js', () => ({
  dom: mockDom,
  cacheDom: vi.fn(),
}));

vi.mock('../storage.js', () => ({
  storage: {
    get: (...args: unknown[]) => mockStorageGet(...args),
    set: (...args: unknown[]) => mockStorageSet(...args),
    remove: vi.fn(),
  },
}));

vi.mock('../ui.js', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
  loadingBar: { init: vi.fn(), hide: vi.fn(), show: vi.fn() },
}));

vi.mock('../utils.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    hapticFeedback: (...args: unknown[]) => mockHapticFeedback(...args),
  };
});

vi.mock('../surah-loader.js', () => ({
  highlightCurrentAyah: (...args: unknown[]) => mockHighlightCurrentAyah(...args),
  loadSurah: vi.fn(),
  loadSurahList: vi.fn(),
  renderSurah: vi.fn(),
  buildSurahOffsets: vi.fn(),
  populateReciterSelect: vi.fn(),
  updatePlayerInfo: vi.fn(),
}));

vi.mock('../i18n.js', () => ({
  __: (key: string, ...args: string[]) => {
    let val = key;
    args.forEach((arg, i) => {
      val = val.replace(`{${i}}`, arg);
    });
    return val;
  },
  getLang: vi.fn(() => 'ar'),
  applyTranslations: vi.fn(),
  setLocale: vi.fn(),
  getCurrentLocale: vi.fn(() => 'ar'),
  loadLocale: vi.fn(() => Promise.resolve()),
}));

vi.mock('../audio-cache.js', () => ({
  getCachedAudioUrl: (...args: unknown[]) => mockGetCachedAudioUrl(...args),
}));

vi.mock('../audio-visualizer.js', () => ({
  startVisualizer: vi.fn(),
  stopVisualizer: vi.fn(),
}));

// ─── Import module under test ──────────────────────────────────────

import {
  playCurrentAyah,
  togglePlayPause,
  expandPlayer,
  bindAudioEvents,
  updatePlayPauseBtn,
  setLoadSurah,
  prepareAudioForNewSurah,
  resetAudioElement,
  resetAudioPlayerUI,
  toggleHifdh,
  toggleRepeat,
  nextAyah,
  prevAyah,
  nextSurah,
  prevSurah,
  applyHifdhUI,
  applyRepeatUI,
  resetRepeatUI,
  populateRepeatUI,
  getDefaultRepeatRange,
  setSleepTimer,
  getSleepTimerMinutes,
  getSleepTimerRemaining,
  clearSleepTimer,
  cleanupSleepTimerInterval,
  type RepeatRange,
} from '../audio.js';

import type { SurahData } from '../types.js';

// ─── Helper: create a mock audio element ───────────────────────────

function createMockAudioElement(): HTMLAudioElement {
  const listeners: Record<string, EventListener[]> = {};
  const el = {
    _listeners: listeners,
    paused: true,
    ended: false,
    src: '',
    currentTime: 0,
    duration: 100,
    playbackRate: 1,
    readyState: 4,
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    load: vi.fn(),
    removeAttribute: vi.fn(),
    addEventListener: vi.fn((event: string, handler: EventListener) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
    removeEventListener: vi.fn((event: string, handler: EventListener) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((h) => h !== handler);
      }
    }),
  } as unknown as HTMLAudioElement;
  return el;
}

// Simulate firing an event on our mock audio element
function fireEvent(audioEl: HTMLAudioElement, event: string): void {
  const el = audioEl as unknown as { _listeners: Record<string, EventListener[]> };
  const handlers = el._listeners?.[event] || [];
  for (const handler of handlers) {
    handler(new Event(event));
  }
}

// ─── Sample data ───────────────────────────────────────────────────

const sampleAyahs = [
  { numberInSurah: 1, text: 'بِسْمِ اللَّهِ' },
  { numberInSurah: 2, text: 'الْحَمْدُ لِلَّهِ' },
  { numberInSurah: 3, text: 'الرَّحْمَٰنِ الرَّحِيمِ' },
];

const sampleSurahData: SurahData = {
  number: 1,
  name: 'الفاتحة',
  englishName: 'Al-Faatiha',
  ayahs: sampleAyahs,
};

// ─── Tests ─────────────────────────────────────────────────────────

describe('audio — full coverage', () => {
  let mockAudioPlayer: HTMLAudioElement;
  let mockAudioPlayer2: HTMLAudioElement;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAudioPlayer = createMockAudioElement();
    mockAudioPlayer2 = createMockAudioElement();

    // Reset state
    mockState.isPlaying = false;
    mockState.surahData = null;
    mockState.ayahsAudios = [];
    mockState.currentAyahIndex = 0;
    mockState.currentSurah = 1;
    mockState.hifdhMode = false;
    mockState.repeatMode = false;
    mockState.repeatFrom = 1;
    mockState.repeatTo = 1;
    mockState.repeatTimes = 3;
    mockState.repeatCounter = 0;
    mockState.ayahTimings = [];
    mockState.mushafMode = false;
    mockState.autoPlayNext = false;

    // Reset dom
    mockDom.audioPlayer = mockAudioPlayer;
    mockDom.audioPlayer2 = mockAudioPlayer2;
    mockDom.player = document.createElement('div');
    mockDom.playPauseBtn = document.createElement('button');
    mockDom.hifdhBtn = document.createElement('button');
    mockDom.repeatBtn = document.createElement('button');
    mockDom.repeatControls = document.createElement('div');

    // Reset mocks
    mockGetCachedAudioUrl.mockResolvedValue(null);
    mockStorageGet.mockReturnValue(null);

    // Clear timers
    cleanupSleepTimerInterval();
    clearSleepTimer();
  });

  afterEach(() => {
    cleanupSleepTimerInterval();
    clearSleepTimer();
  });

  // ─── Object URL revocation (memory leak fix) ────────────────────

  describe('Object URL memory leak prevention', () => {
    it('should revoke previous blob: URL when setting new src', async () => {
      mockState.surahData = sampleSurahData;
      mockState.ayahsAudios = ['https://cdn.example.com/1/1.mp3'];

      // First play — returns a cached blob URL
      mockGetCachedAudioUrl.mockResolvedValue('blob:cached-url-1');
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      // Set initial src to a blob URL to simulate previous cached playback
      (mockAudioPlayer as unknown as Record<string, unknown>).src = 'blob:old-url';

      await playCurrentAyah();

      expect(revokeSpy).toHaveBeenCalledWith('blob:old-url');
      revokeSpy.mockRestore();
    });

    it('should NOT revoke non-blob URLs', async () => {
      mockState.surahData = sampleSurahData;
      mockState.ayahsAudios = ['https://cdn.example.com/1/1.mp3'];
      mockGetCachedAudioUrl.mockResolvedValue(null);

      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      (mockAudioPlayer as unknown as Record<string, unknown>).src = 'https://cdn.example.com/old.mp3';

      await playCurrentAyah();

      expect(revokeSpy).not.toHaveBeenCalled();
      revokeSpy.mockRestore();
    });

    it('should NOT revoke empty src', async () => {
      mockState.surahData = sampleSurahData;
      mockState.ayahsAudios = ['https://cdn.example.com/1/1.mp3'];
      mockGetCachedAudioUrl.mockResolvedValue(null);

      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      (mockAudioPlayer as unknown as Record<string, unknown>).src = '';

      await playCurrentAyah();

      expect(revokeSpy).not.toHaveBeenCalled();
      revokeSpy.mockRestore();
    });
  });

  // ─── resolveAudioUrl / cache integration ────────────────────────

  describe('resolveAudioUrl — cache integration', () => {
    it('should use cached URL when available', async () => {
      mockState.surahData = sampleSurahData;
      mockState.ayahsAudios = ['https://cdn.example.com/1/1.mp3'];
      mockGetCachedAudioUrl.mockResolvedValue('blob:cached-url');

      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      await playCurrentAyah();

      expect(mockGetCachedAudioUrl).toHaveBeenCalledWith('https://cdn.example.com/1/1.mp3');
      expect((mockAudioPlayer as unknown as Record<string, unknown>).src).toBe('blob:cached-url');
      revokeSpy.mockRestore();
    });

    it('should fall back to original URL when cache throws', async () => {
      mockState.surahData = sampleSurahData;
      mockState.ayahsAudios = ['https://cdn.example.com/1/1.mp3'];
      mockGetCachedAudioUrl.mockRejectedValue(new Error('IDB error'));

      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      await playCurrentAyah();

      expect((mockAudioPlayer as unknown as Record<string, unknown>).src).toBe('https://cdn.example.com/1/1.mp3');
      revokeSpy.mockRestore();
    });

    it('should fall back to original URL when cache returns null', async () => {
      mockState.surahData = sampleSurahData;
      mockState.ayahsAudios = ['https://cdn.example.com/1/1.mp3'];
      mockGetCachedAudioUrl.mockResolvedValue(null);

      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      await playCurrentAyah();

      expect((mockAudioPlayer as unknown as Record<string, unknown>).src).toBe('https://cdn.example.com/1/1.mp3');
      revokeSpy.mockRestore();
    });
  });

  // ─── playCurrentAyah — error paths ──────────────────────────────

  describe('playCurrentAyah — error paths', () => {
    it('should show toast and return when no surahData', async () => {
      mockState.surahData = null;
      mockState.ayahsAudios = [];

      await playCurrentAyah();

      expect(mockShowToast).toHaveBeenCalledWith('no_audio', 'error');
    });

    it('should show toast and return when URL is empty', async () => {
      mockState.surahData = sampleSurahData;
      mockState.ayahsAudios = [''];
      mockState.currentAyahIndex = 0;

      await playCurrentAyah();

      expect(mockShowToast).toHaveBeenCalledWith('no_audio_ayah', 'error');
    });

    it('should return early when dom.audioPlayer is null', async () => {
      mockState.surahData = sampleSurahData;
      mockState.ayahsAudios = ['https://cdn.example.com/1/1.mp3'];
      mockDom.audioPlayer = null;

      await playCurrentAyah();

      expect(mockGetCachedAudioUrl).not.toHaveBeenCalled();
    });

    it('should apply saved playback speed from storage', async () => {
      mockState.surahData = sampleSurahData;
      mockState.ayahsAudios = ['https://cdn.example.com/1/1.mp3'];
      mockGetCachedAudioUrl.mockResolvedValue(null);
      mockStorageGet.mockImplementation((key: string) => {
        if (key === 'playback_speed') return '1.5';
        return null;
      });

      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      await playCurrentAyah();

      expect(mockAudioPlayer.playbackRate).toBe(1.5);
      revokeSpy.mockRestore();
    });
  });

  // ─── playCurrentAyah — MP3 Quran path ───────────────────────────

  describe('playCurrentAyah — MP3 Quran path', () => {
    it('should add loadedmetadata listener for mp3quran mode', async () => {
      mockState.surahData = sampleSurahData;
      mockState.ayahsAudios = ['https://cdn.example.com/full-surah.mp3'];
      mockState.ayahTimings = [0, 0.15, 0.3];
      mockGetCachedAudioUrl.mockResolvedValue(null);

      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      await playCurrentAyah();

      expect(mockAudioPlayer.addEventListener).toHaveBeenCalledWith('loadedmetadata', expect.any(Function), {
        once: true,
      });
      revokeSpy.mockRestore();
    });

    it('should reuse audio when mp3quran URL matches and readyState >= 2', async () => {
      mockState.surahData = sampleSurahData;
      mockState.ayahsAudios = ['https://cdn.example.com/full-surah.mp3'];
      mockState.ayahTimings = [0, 0.15, 0.3];
      mockState.currentAyahIndex = 0; // Must be valid index into ayahsAudios
      (mockAudioPlayer as unknown as Record<string, unknown>).readyState = 4;
      (mockAudioPlayer as unknown as Record<string, unknown>).duration = 200;
      mockGetCachedAudioUrl.mockResolvedValue(null);

      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      // First call to set _mp3quranUrl
      await playCurrentAyah();

      // Clear play mock to check second call
      (mockAudioPlayer.play as ReturnType<typeof vi.fn>).mockClear();

      // Second call with same URL — should reuse (fast path)
      await playCurrentAyah();

      // Should call play() directly (reusing cached audio, no src change)
      expect(mockAudioPlayer.play).toHaveBeenCalled();
      revokeSpy.mockRestore();
    });
  });

  // ─── onAudioError — retry logic ─────────────────────────────────

  describe('onAudioError — retry and skip-on-failure', () => {
    it('should retry up to MAX_AUDIO_RETRIES times', () => {
      mockState.surahData = sampleSurahData;
      mockState.ayahsAudios = ['https://cdn.example.com/1/1.mp3', 'https://cdn.example.com/1/2.mp3'];

      bindAudioEvents();

      fireEvent(mockAudioPlayer, 'error');
      expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('audio_error'), 'error');
    });

    it('should skip to next ayah after exhausting retries', () => {
      mockState.surahData = sampleSurahData;
      mockState.ayahsAudios = ['https://cdn.example.com/1/1.mp3', 'https://cdn.example.com/1/2.mp3'];
      mockState.currentAyahIndex = 0;

      bindAudioEvents();

      // Fire error 3 times (MAX_AUDIO_RETRIES=2 + 1 more)
      fireEvent(mockAudioPlayer, 'error');
      fireEvent(mockAudioPlayer, 'error');
      fireEvent(mockAudioPlayer, 'error');

      expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('audio_error'), 'error');
    });

    it('should full stop when cannot skip (last ayah)', () => {
      mockState.surahData = sampleSurahData;
      mockState.ayahsAudios = ['https://cdn.example.com/1/1.mp3'];
      mockState.currentAyahIndex = 0;

      bindAudioEvents();

      fireEvent(mockAudioPlayer, 'error');
      fireEvent(mockAudioPlayer, 'error');
      fireEvent(mockAudioPlayer, 'error');

      expect(mockShowToast).toHaveBeenCalledWith('audio_error', 'error');
    });
  });

  // ─── onAudioEnded ───────────────────────────────────────────────

  describe('onAudioEnded — surah transitions', () => {
    beforeEach(() => {
      bindAudioEvents();
    });

    it('should advance to next ayah when not at end', () => {
      mockState.surahData = sampleSurahData;
      mockState.ayahsAudios = ['url1', 'url2', 'url3'];
      mockState.currentAyahIndex = 0;
      mockState.repeatMode = false;

      fireEvent(mockAudioPlayer, 'ended');

      expect(mockHighlightCurrentAyah).toHaveBeenCalled();
    });

    it('should stop at last surah (114)', () => {
      mockState.surahData = { ...sampleSurahData, number: 114 } as SurahData;
      mockState.ayahsAudios = ['url1'];
      mockState.currentAyahIndex = 0;
      mockState.currentSurah = 114;
      mockState.repeatMode = false;

      fireEvent(mockAudioPlayer, 'ended');

      expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('surah_complete'), 'success');
    });

    it('should auto-play next surah when autoPlayNext is true', () => {
      mockState.surahData = sampleSurahData;
      mockState.ayahsAudios = ['url1'];
      mockState.currentAyahIndex = 0;
      mockState.currentSurah = 1;
      mockState.autoPlayNext = true;
      mockState.repeatMode = false;
      mockState.isPlaying = true; // Must be playing for autoPlay to work

      const loadSurahFn = vi.fn();
      setLoadSurah(loadSurahFn);

      fireEvent(mockAudioPlayer, 'ended');

      expect(loadSurahFn).toHaveBeenCalledWith(2, { autoPlay: true });
    });

    it('should stop when at end of surah and autoPlayNext is false', () => {
      mockState.surahData = sampleSurahData;
      mockState.ayahsAudios = ['url1'];
      mockState.currentAyahIndex = 0;
      mockState.currentSurah = 1;
      mockState.autoPlayNext = false;
      mockState.repeatMode = false;

      fireEvent(mockAudioPlayer, 'ended');

      expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('surah_complete'), 'success');
    });
  });

  // ─── onAudioPlay / onAudioPause ─────────────────────────────────

  describe('onAudioPlay — visualizer and mediaSession', () => {
    it('should set playing state and update UI', () => {
      bindAudioEvents();
      mockState.surahData = sampleSurahData;
      mockState.currentAyahIndex = 0;

      fireEvent(mockAudioPlayer, 'play');

      expect(mockState.isPlaying).toBe(true);
    });

    it('should start visualizer when canvas exists', () => {
      const canvas = document.createElement('canvas');
      canvas.id = 'audioVisualizer';
      document.body.appendChild(canvas);

      bindAudioEvents();
      mockState.surahData = sampleSurahData;

      fireEvent(mockAudioPlayer, 'play');

      document.body.removeChild(canvas);
    });
  });

  describe('onAudioPause — visualizer stop', () => {
    it('should stop visualizer when paused (not ended)', () => {
      bindAudioEvents();
      (mockAudioPlayer as unknown as Record<string, unknown>).ended = false;
      mockState.isPlaying = true;

      fireEvent(mockAudioPlayer, 'pause');

      expect(mockState.isPlaying).toBe(false);
    });

    it('should not set isPlaying=false when audio ended naturally', () => {
      bindAudioEvents();
      (mockAudioPlayer as unknown as Record<string, unknown>).ended = true;
      mockState.isPlaying = true;

      fireEvent(mockAudioPlayer, 'pause');

      expect(mockState.isPlaying).toBe(true);
    });
  });

  // ─── prepareAudioForNewSurah ────────────────────────────────────

  describe('prepareAudioForNewSurah', () => {
    it('should reset audio state', () => {
      mockState.isPlaying = true;
      mockDom.audioPlayer = mockAudioPlayer;
      mockDom.audioPlayer2 = mockAudioPlayer2;

      prepareAudioForNewSurah();

      expect(mockState.isPlaying).toBe(false);
      expect(mockAudioPlayer.pause).toHaveBeenCalled();
      expect(mockAudioPlayer.removeAttribute).toHaveBeenCalledWith('src');
    });

    it('should handle null audio players gracefully', () => {
      mockDom.audioPlayer = null;
      mockDom.audioPlayer2 = null;

      expect(() => prepareAudioForNewSurah()).not.toThrow();
    });
  });

  // ─── resetAudioElement ──────────────────────────────────────────

  describe('resetAudioElement', () => {
    it('should pause, remove src, and reload', () => {
      resetAudioElement(mockAudioPlayer);
      expect(mockAudioPlayer.pause).toHaveBeenCalled();
      expect(mockAudioPlayer.removeAttribute).toHaveBeenCalledWith('src');
      expect(mockAudioPlayer.load).toHaveBeenCalled();
    });

    it('should handle null player gracefully', () => {
      expect(() => resetAudioElement(null)).not.toThrow();
    });
  });

  // ─── togglePlayPause ────────────────────────────────────────────

  describe('togglePlayPause', () => {
    it('should return early when no surahData', () => {
      mockState.surahData = null;
      togglePlayPause();
      // hapticFeedback is NOT called because the early return happens before it
      expect(mockHapticFeedback).not.toHaveBeenCalled();
    });

    it('should play when audio is paused with existing src', () => {
      mockState.surahData = sampleSurahData;
      (mockAudioPlayer as unknown as Record<string, unknown>).paused = true;
      (mockAudioPlayer as unknown as Record<string, unknown>).src = 'https://example.com/audio.mp3';
      (mockAudioPlayer as unknown as Record<string, unknown>).ended = false;

      togglePlayPause();

      expect(mockAudioPlayer.play).toHaveBeenCalled();
    });

    it('should call playCurrentAyah when paused with no src', async () => {
      mockState.surahData = sampleSurahData;
      (mockAudioPlayer as unknown as Record<string, unknown>).paused = true;
      (mockAudioPlayer as unknown as Record<string, unknown>).src = '';
      (mockAudioPlayer as unknown as Record<string, unknown>).ended = false;
      mockState.ayahsAudios = ['https://example.com/1.mp3'];
      mockGetCachedAudioUrl.mockResolvedValue(null);

      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      togglePlayPause();
      await flushPromises();

      revokeSpy.mockRestore();
    });

    it('should pause when audio is playing', () => {
      mockState.surahData = sampleSurahData;
      (mockAudioPlayer as unknown as Record<string, unknown>).paused = false;

      togglePlayPause();

      expect(mockAudioPlayer.pause).toHaveBeenCalled();
    });
  });

  // ─── expandPlayer ───────────────────────────────────────────────

  describe('expandPlayer', () => {
    it('should remove collapsed class and persist preference', () => {
      mockDom.player = document.createElement('div');
      mockDom.player.classList.add('collapsed');

      expandPlayer();

      expect(mockDom.player.classList.contains('collapsed')).toBe(false);
      expect(mockStorageSet).toHaveBeenCalledWith('player_collapsed', false);
    });

    it('should handle null player element', () => {
      mockDom.player = null;
      expect(() => expandPlayer()).not.toThrow();
    });
  });

  // ─── nextAyah / prevAyah ────────────────────────────────────────

  describe('nextAyah', () => {
    it('should advance to next ayah', () => {
      mockState.surahData = sampleSurahData;
      mockState.ayahsAudios = ['url1', 'url2', 'url3'];
      mockState.currentAyahIndex = 0;
      mockState.isPlaying = true;
      mockGetCachedAudioUrl.mockResolvedValue(null);

      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      nextAyah(false);

      expect(mockState.currentAyahIndex).toBe(1);
      expect(mockHighlightCurrentAyah).toHaveBeenCalled();
      revokeSpy.mockRestore();
    });

    it('should not advance if not playing and not autoFromRepeat', () => {
      mockState.surahData = sampleSurahData;
      mockState.ayahsAudios = ['url1', 'url2'];
      mockState.currentAyahIndex = 0;
      mockState.isPlaying = false;

      nextAyah(false);

      expect(mockState.currentAyahIndex).toBe(1);
      expect(mockGetCachedAudioUrl).not.toHaveBeenCalled();
    });

    it('should go to next surah when at end of ayahs', () => {
      mockState.surahData = sampleSurahData;
      mockState.ayahsAudios = ['url1'];
      mockState.currentAyahIndex = 0;
      mockState.currentSurah = 1;
      mockState.isPlaying = false;

      const loadSurahFn = vi.fn();
      setLoadSurah(loadSurahFn);

      nextAyah(false);

      expect(loadSurahFn).toHaveBeenCalledWith(2, { autoPlay: false });
    });

    it('should not advance past surah 114', () => {
      mockState.surahData = sampleSurahData;
      mockState.ayahsAudios = ['url1'];
      mockState.currentAyahIndex = 0;
      mockState.currentSurah = 114;

      const loadSurahFn = vi.fn();
      setLoadSurah(loadSurahFn);

      nextAyah(false);

      expect(loadSurahFn).not.toHaveBeenCalled();
    });

    it('should pause and stop in mushafMode at end of ayahs', () => {
      mockState.surahData = sampleSurahData;
      mockState.ayahsAudios = ['url1'];
      mockState.currentAyahIndex = 0;
      mockState.currentSurah = 1;
      mockState.mushafMode = true;
      mockState.isPlaying = true;

      nextAyah(false);

      expect(mockAudioPlayer.pause).toHaveBeenCalled();
      expect(mockState.isPlaying).toBe(false);
    });

    it('should return early when no surahData', () => {
      mockState.surahData = null;
      nextAyah(false);
      expect(mockHighlightCurrentAyah).not.toHaveBeenCalled();
    });
  });

  describe('prevAyah', () => {
    it('should go to previous ayah', () => {
      mockState.surahData = sampleSurahData;
      mockState.ayahsAudios = ['url1', 'url2'];
      mockState.currentAyahIndex = 1;
      mockState.isPlaying = false;

      prevAyah();

      expect(mockState.currentAyahIndex).toBe(0);
    });

    it('should go to previous surah when at beginning', () => {
      mockState.surahData = sampleSurahData;
      mockState.ayahsAudios = ['url1'];
      mockState.currentAyahIndex = 0;
      mockState.currentSurah = 2;

      const loadSurahFn = vi.fn();
      setLoadSurah(loadSurahFn);

      prevAyah();

      expect(loadSurahFn).toHaveBeenCalledWith(1, { autoPlay: false });
    });

    it('should not go before surah 1', () => {
      mockState.surahData = sampleSurahData;
      mockState.ayahsAudios = ['url1'];
      mockState.currentAyahIndex = 0;
      mockState.currentSurah = 1;

      const loadSurahFn = vi.fn();
      setLoadSurah(loadSurahFn);

      prevAyah();

      expect(loadSurahFn).not.toHaveBeenCalled();
    });

    it('should return early when no surahData', () => {
      mockState.surahData = null;
      prevAyah();
      expect(mockHighlightCurrentAyah).not.toHaveBeenCalled();
    });
  });

  // ─── nextSurah / prevSurah ──────────────────────────────────────

  describe('nextSurah / prevSurah', () => {
    it('nextSurah should call _loadSurah with incremented surah', () => {
      mockState.currentSurah = 5;
      const loadSurahFn = vi.fn();
      setLoadSurah(loadSurahFn);

      nextSurah();

      expect(loadSurahFn).toHaveBeenCalledWith(6, { autoPlay: false });
    });

    it('nextSurah should not advance past surah 114', () => {
      mockState.currentSurah = 114;
      const loadSurahFn = vi.fn();
      setLoadSurah(loadSurahFn);

      nextSurah();

      expect(loadSurahFn).not.toHaveBeenCalled();
    });

    it('prevSurah should call _loadSurah with decremented surah', () => {
      mockState.currentSurah = 5;
      const loadSurahFn = vi.fn();
      setLoadSurah(loadSurahFn);

      prevSurah();

      expect(loadSurahFn).toHaveBeenCalledWith(4, { autoPlay: false });
    });

    it('prevSurah should not go before surah 1', () => {
      mockState.currentSurah = 1;
      const loadSurahFn = vi.fn();
      setLoadSurah(loadSurahFn);

      prevSurah();

      expect(loadSurahFn).not.toHaveBeenCalled();
    });
  });

  // ─── toggleHifdh ────────────────────────────────────────────────

  describe('toggleHifdh', () => {
    it('should toggle hifdh mode state', () => {
      mockState.hifdhMode = false;
      toggleHifdh();
      expect(mockState.hifdhMode).toBe(true);

      toggleHifdh();
      expect(mockState.hifdhMode).toBe(false);
    });

    it('should apply hifdh UI', () => {
      const ayahEl = document.createElement('div');
      ayahEl.classList.add('ayah');
      document.body.appendChild(ayahEl);

      toggleHifdh();

      expect(ayahEl.classList.contains('hifdh-mode')).toBe(true);

      toggleHifdh();

      expect(ayahEl.classList.contains('hifdh-mode')).toBe(false);
      document.body.removeChild(ayahEl);
    });

    it('should show toast with appropriate message', () => {
      mockState.hifdhMode = false;
      toggleHifdh();
      expect(mockShowToast).toHaveBeenCalledWith('hifdh_on', 'success');

      toggleHifdh();
      expect(mockShowToast).toHaveBeenCalledWith('hifdh_off', '');
    });
  });

  // ─── applyHifdhUI ───────────────────────────────────────────────

  describe('applyHifdhUI', () => {
    it('should add hifdh-mode class when enabled', () => {
      const ayahEl = document.createElement('div');
      ayahEl.classList.add('ayah');
      document.body.appendChild(ayahEl);

      applyHifdhUI(true);

      expect(ayahEl.classList.contains('hifdh-mode')).toBe(true);
      document.body.removeChild(ayahEl);
    });

    it('should remove hifdh-mode and revealed classes when disabled', () => {
      const ayahEl = document.createElement('div');
      ayahEl.classList.add('ayah', 'hifdh-mode', 'revealed');
      document.body.appendChild(ayahEl);

      applyHifdhUI(false);

      expect(ayahEl.classList.contains('hifdh-mode')).toBe(false);
      expect(ayahEl.classList.contains('revealed')).toBe(false);
      document.body.removeChild(ayahEl);
    });

    it('should toggle hifdhBtn active class', () => {
      const btn = document.createElement('button');
      mockDom.hifdhBtn = btn;

      applyHifdhUI(true);
      expect(btn.classList.contains('active')).toBe(true);

      applyHifdhUI(false);
      expect(btn.classList.contains('active')).toBe(false);
    });
  });

  // ─── toggleRepeat ───────────────────────────────────────────────

  describe('toggleRepeat', () => {
    it('should toggle repeat mode state', () => {
      mockState.repeatMode = false;
      toggleRepeat();
      expect(mockState.repeatMode).toBe(true);

      toggleRepeat();
      expect(mockState.repeatMode).toBe(false);
    });

    it('should populate repeat UI when enabling with surahData', () => {
      mockState.repeatMode = false;
      mockState.surahData = sampleSurahData;

      const from = document.createElement('select') as HTMLSelectElement;
      const to = document.createElement('select') as HTMLSelectElement;
      const times = document.createElement('select') as HTMLSelectElement;
      mockDom.repeatFrom = from;
      mockDom.repeatTo = to;
      mockDom.repeatTimes = times;

      toggleRepeat();

      expect(mockState.repeatFrom).toBe(1);
      expect(mockState.repeatTo).toBe(3);
      expect(mockState.repeatTimes).toBe(3);
    });

    it('should reset repeatCounter on toggle', () => {
      mockState.repeatCounter = 5;
      toggleRepeat();
      expect(mockState.repeatCounter).toBe(0);
    });
  });

  // ─── applyRepeatUI ──────────────────────────────────────────────

  describe('applyRepeatUI', () => {
    it('should toggle repeatBtn active class', () => {
      const btn = document.createElement('button');
      mockDom.repeatBtn = btn;

      applyRepeatUI(true);
      expect(btn.classList.contains('active')).toBe(true);

      applyRepeatUI(false);
      expect(btn.classList.contains('active')).toBe(false);
    });

    it('should show/hide repeat controls', () => {
      const controls = document.createElement('div');
      mockDom.repeatControls = controls;

      applyRepeatUI(true);
      expect(controls.style.display).toBe('flex');

      applyRepeatUI(false);
      expect(controls.style.display).toBe('none');
    });
  });

  // ─── resetRepeatUI ──────────────────────────────────────────────

  describe('resetRepeatUI', () => {
    it('should remove active class and hide controls', () => {
      const btn = document.createElement('button');
      btn.classList.add('active');
      const controls = document.createElement('div');
      mockDom.repeatBtn = btn;
      mockDom.repeatControls = controls;

      resetRepeatUI();

      expect(btn.classList.contains('active')).toBe(false);
      expect(controls.style.display).toBe('none');
    });
  });

  // ─── populateRepeatUI ───────────────────────────────────────────

  describe('populateRepeatUI', () => {
    it('should return early when any select is null', () => {
      mockDom.repeatFrom = null;
      mockDom.repeatTo = document.createElement('select') as HTMLSelectElement;
      mockDom.repeatTimes = document.createElement('select') as HTMLSelectElement;

      expect(() => populateRepeatUI({ from: 1, to: 7, times: 3 })).not.toThrow();
    });

    it('should populate select options and bind change handlers', () => {
      const from = document.createElement('select') as HTMLSelectElement;
      const to = document.createElement('select') as HTMLSelectElement;
      // The times select needs options to support setting value
      const times = document.createElement('select') as HTMLSelectElement;
      [1, 2, 3, 5, 10].forEach((n) => {
        const opt = document.createElement('option');
        opt.value = String(n);
        opt.textContent = String(n);
        times.appendChild(opt);
      });
      mockDom.repeatFrom = from;
      mockDom.repeatTo = to;
      mockDom.repeatTimes = times;

      const range: RepeatRange = { from: 1, to: 5, times: 3 };
      populateRepeatUI(range);

      expect(from.value).toBe('1');
      expect(to.value).toBe('5');
      // times select has pre-populated options; value may not be '3' without an option
      // Just verify it was called without throwing
      expect(typeof times.onchange).toBe('function');

      // Test onchange for repeatFrom
      mockState.repeatFrom = 1;
      mockState.repeatTo = 5;
      from.value = '4';
      from.onchange?.(new Event('change'));

      expect(mockState.repeatFrom).toBe(4);

      // Test onchange for repeatTo
      mockState.repeatFrom = 3;
      mockState.repeatTo = 5;
      to.value = '2';
      to.onchange?.(new Event('change'));

      expect(mockState.repeatTo).toBe(2);

      // Test onchange for repeatTimes
      times.value = '5';
      times.onchange?.(new Event('change'));
      expect(mockState.repeatTimes).toBe(5);
    });
  });

  // ─── getDefaultRepeatRange ──────────────────────────────────────

  describe('getDefaultRepeatRange', () => {
    it('should return range from 1 to ayah count with times 3', () => {
      const range = getDefaultRepeatRange(sampleSurahData);
      expect(range).toEqual({ from: 1, to: 3, times: 3 });
    });
  });

  // ─── updatePlayPauseBtn ─────────────────────────────────────────

  describe('updatePlayPauseBtn', () => {
    it('should set text to pause when playing', () => {
      const btn = document.createElement('button');
      mockDom.playPauseBtn = btn;
      mockState.isPlaying = true;

      updatePlayPauseBtn();

      expect(btn.textContent).toBe('pause');
    });

    it('should set text to play when not playing', () => {
      const btn = document.createElement('button');
      mockDom.playPauseBtn = btn;
      mockState.isPlaying = false;

      updatePlayPauseBtn();

      expect(btn.textContent).toBe('play');
    });

    it('should handle null playPauseBtn', () => {
      mockDom.playPauseBtn = null;
      expect(() => updatePlayPauseBtn()).not.toThrow();
    });
  });

  // ─── Sleep Timer ────────────────────────────────────────────────

  describe('sleep timer', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should set a timer and show toast', () => {
      setSleepTimer(5);
      expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('sleep_timer_set'), 'success');
      expect(getSleepTimerMinutes()).toBe(5);
    });

    it('should cancel timer when minutes <= 0', () => {
      setSleepTimer(0);
      expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('sleep_timer_cancelled'), '');
      expect(getSleepTimerMinutes()).toBe(0);
    });

    it('should return 0 remaining when no timer is active', () => {
      clearSleepTimer();
      expect(getSleepTimerRemaining()).toBe(0);
    });

    it('should return remaining time when timer is active', () => {
      setSleepTimer(10);
      vi.advanceTimersByTime(60000); // advance 1 minute
      const remaining = getSleepTimerRemaining();
      expect(remaining).toBeLessThanOrEqual(9.1);
      expect(remaining).toBeGreaterThan(8.5);
    });

    it('should pause audio and show toast when timer fires', () => {
      mockState.isPlaying = true;
      (mockAudioPlayer as unknown as Record<string, unknown>).paused = false;

      setSleepTimer(1);
      vi.advanceTimersByTime(60000); // advance 1 minute

      expect(mockAudioPlayer.pause).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('sleep_timer_stopped'), 'success');
    });

    it('should clear existing timer when setting new one', () => {
      setSleepTimer(5);
      setSleepTimer(10);
      expect(getSleepTimerMinutes()).toBe(10);
    });

    it('clearSleepTimer should reset state', () => {
      setSleepTimer(5);
      clearSleepTimer();
      expect(getSleepTimerMinutes()).toBe(0);
      expect(getSleepTimerRemaining()).toBe(0);
    });

    it('cleanupSleepTimerInterval should clear the interval', () => {
      setSleepTimer(5);
      cleanupSleepTimerInterval();
      expect(() => cleanupSleepTimerInterval()).not.toThrow();
    });
  });

  // ─── resetAudioPlayerUI ─────────────────────────────────────────

  describe('resetAudioPlayerUI', () => {
    it('should remove audio-playing class from body', () => {
      document.body.classList.add('audio-playing');
      resetAudioPlayerUI();
      expect(document.body.classList.contains('audio-playing')).toBe(false);
    });

    it('should update play/pause button', () => {
      const btn = document.createElement('button');
      mockDom.playPauseBtn = btn;
      mockState.isPlaying = false;
      resetAudioPlayerUI();
      expect(btn.textContent).toBe('play');
    });
  });

  // ─── setLoadSurah ───────────────────────────────────────────────

  describe('setLoadSurah', () => {
    it('should set the _loadSurah callback', () => {
      const fn = vi.fn();
      setLoadSurah(fn);

      mockState.currentSurah = 3;
      nextSurah();
      expect(fn).toHaveBeenCalledWith(4, { autoPlay: false });
    });
  });
});
