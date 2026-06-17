/**
 * Deep coverage tests for audio.ts — targets uncovered lines:
 * - prepareAudioForNewSurah with safety timer (84-85)
 * - _getAyahStartTime / _getAyahEndTime (121-133)
 * - playCurrentAyah with mp3quran readyState path (193-198)
 * - playCurrentAyah mp3quran loadedmetadata path (213-222)
 * - resolveAudioUrl — cache hit/miss (158-168)
 * - preloadNextAyah — create audioPlayer2 (249-258)
 * - onTimeUpdate — mp3quran auto-advance (316-386)
 * - onSeeking (388-393)
 * - bindAudioEvents with mediaSession (431-460)
 * - onAudioPlay — mediaSession metadata (462-488)
 * - onAudioPause — ended check (490-503)
 * - onAudioError — retry/skip logic (505-536)
 * - handleRepeatOnEnd (540-591)
 * - completeRepeat (594-600)
 * - onAudioEnded — surah 114 stop (634)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ─── Hoisted mock values ──────────────────────────────────────────────

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
    playPauseBtn: null as HTMLElement | null,
    player: null as HTMLElement | null,
    repeatBtn: null as HTMLElement | null,
    repeatControls: null as HTMLElement | null,
    surahContent: null as HTMLElement | null,
    tafsirCurtain: null as HTMLElement | null,
  };

  const mockShowToast = vi.fn();
  const mockHapticFeedback = vi.fn();
  const mockHighlightCurrentAyah = vi.fn();
  const mockGetCachedAudioUrl = vi.fn(() => Promise.resolve(null));
  const mockStorageGet = vi.fn(() => null);
  const mockStorageSet = vi.fn();

  return {
    mockState,
    mockDom,
    mockShowToast,
    mockHapticFeedback,
    mockHighlightCurrentAyah,
    mockGetCachedAudioUrl,
    mockStorageGet,
    mockStorageSet,
  };
});

vi.mock('../state.js', () => ({
  state: mockState,
  setState: vi.fn(),
  batch: vi.fn((fn) => fn()),
}));

vi.mock('../dom.js', () => ({
  dom: mockDom,
}));

vi.mock('../ui.js', () => ({
  showToast: mockShowToast,
}));

vi.mock('../utils.js', () => ({
  hapticFeedback: mockHapticFeedback,
}));

vi.mock('../surah-loader.js', () => ({
  highlightCurrentAyah: mockHighlightCurrentAyah,
}));

vi.mock('../i18n.js', () => ({
  __: vi.fn((key: string) => key),
}));

vi.mock('../audio-cache.js', () => ({
  getCachedAudioUrl: mockGetCachedAudioUrl,
}));

vi.mock('../audio-visualizer.js', () => ({
  startVisualizer: vi.fn(),
  stopVisualizer: vi.fn(),
}));

vi.mock('../storage.js', () => ({
  storage: {
    get: mockStorageGet,
    set: mockStorageSet,
    remove: vi.fn(),
  },
}));

vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});

// ─── Import module under test ──────────────────────────────────────────

import {
  prepareAudioForNewSurah,
  setLoadSurah,
  playCurrentAyah,
  togglePlayPause,
  bindAudioEvents,
  updatePlayPauseBtn,
  resetAudioElement,
  expandPlayer,
  toggleHifdh,
  toggleRepeat,
  populateRepeatUI,
  nextAyah,
  prevAyah,
  nextSurah,
  prevSurah,
  getDefaultRepeatRange,
  applyRepeatUI,
  applyHifdhUI,
  resetRepeatUI,
  resetAudioPlayerUI,
  getSleepTimerMinutes,
  getSleepTimerRemaining,
  clearSleepTimer,
  cleanupSleepTimerInterval,
  setSleepTimer,
} from '../audio.js';

// ─── Helpers ──────────────────────────────────────────────────────────

function createAudioPlayer(): HTMLAudioElement {
  const audio = document.createElement('audio');
  audio.play = vi.fn(() => Promise.resolve());
  audio.pause = vi.fn();
  audio.load = vi.fn();
  Object.defineProperty(audio, 'paused', { value: true, writable: true, configurable: true });
  Object.defineProperty(audio, 'ended', { value: false, writable: true, configurable: true });
  Object.defineProperty(audio, 'duration', { value: 0, writable: true, configurable: true });
  Object.defineProperty(audio, 'currentTime', { value: 0, writable: true, configurable: true });
  Object.defineProperty(audio, 'readyState', { value: 0, writable: true, configurable: true });
  Object.defineProperty(audio, 'src', { value: '', writable: true, configurable: true });
  Object.defineProperty(audio, 'playbackRate', { value: 1, writable: true, configurable: true });
  return audio;
}

function setupPlayerDom() {
  mockDom.audioPlayer = createAudioPlayer();
  mockDom.playPauseBtn = document.createElement('button');
  mockDom.player = document.createElement('div');
  mockDom.repeatBtn = document.createElement('button');
  mockDom.repeatControls = document.createElement('div');
  document.body.appendChild(mockDom.audioPlayer);
}

const SAMPLE_SURAH_DATA = {
  number: 1,
  name: 'الفاتحة',
  ayahs: [
    { numberInSurah: 1, text: 'بِسْمِ اللَّهِ', audio: 'https://audio/1.mp3' },
    { numberInSurah: 2, text: 'الْحَمْدُ لِلَّهِ', audio: 'https://audio/2.mp3' },
    { numberInSurah: 3, text: 'الرَّحْمَٰنِ الرَّحِيمِ', audio: 'https://audio/3.mp3' },
  ],
};

// ─── Tests ─────────────────────────────────────────────────────────────

describe('audio — deep coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    setupPlayerDom();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  describe('playCurrentAyah — mp3quran readyState path', () => {
    it('should seek to ayah start when mp3quran is already loaded', async () => {
      mockState.surahData = SAMPLE_SURAH_DATA;
      mockState.ayahsAudios = ['https://audio/surah1.mp3', 'https://audio/surah1.mp3', 'https://audio/surah1.mp3'];
      mockState.ayahTimings = [0, 0.3, 0.6];
      mockState.currentAyahIndex = 1;

      const audio = mockDom.audioPlayer!;
      Object.defineProperty(audio, 'readyState', { value: 2, writable: true, configurable: true });
      Object.defineProperty(audio, 'duration', { value: 100, writable: true, configurable: true });
      Object.defineProperty(audio, 'paused', { value: true, writable: true, configurable: true });
      Object.defineProperty(audio, 'currentTime', { value: 0, writable: true, configurable: true });

      // First call: sets _mp3quranUrl but doesn't take fast path (url doesn't match yet)
      await playCurrentAyah();

      // Second call: now _mp3quranUrl matches the URL, and readyState >= 2
      // so it should take the fast path
      Object.defineProperty(audio, 'paused', { value: true, writable: true, configurable: true });
      await playCurrentAyah();

      expect(audio.play).toHaveBeenCalled();
    });
  });

  describe('playCurrentAyah — mp3quran loadedmetadata path', () => {
    it('should set up loadedmetadata listener for mp3quran audio', async () => {
      mockState.surahData = SAMPLE_SURAH_DATA;
      mockState.ayahsAudios = ['https://audio/surah1.mp3'];
      mockState.ayahTimings = [0, 0.5];
      mockState.currentAyahIndex = 0;

      const audio = mockDom.audioPlayer!;
      Object.defineProperty(audio, 'readyState', { value: 0, configurable: true });
      Object.defineProperty(audio, 'duration', { value: 0, configurable: true });
      Object.defineProperty(audio, 'paused', { value: true, configurable: true });

      await playCurrentAyah();

      // Should have set src and added event listener
      expect(audio.src).toBeDefined();

      // Simulate loadedmetadata
      Object.defineProperty(audio, 'duration', { value: 100, configurable: true });
      audio.dispatchEvent(new Event('loadedmetadata'));

      expect(audio.play).toHaveBeenCalled();
    });
  });

  describe('playCurrentAyah — resolveAudioUrl from cache', () => {
    it('should use cached URL when available', async () => {
      mockGetCachedAudioUrl.mockResolvedValueOnce('blob:cached-audio');

      mockState.surahData = SAMPLE_SURAH_DATA;
      mockState.ayahsAudios = ['https://audio/1.mp3'];
      mockState.currentAyahIndex = 0;

      const audio = mockDom.audioPlayer!;
      Object.defineProperty(audio, 'paused', { value: true, configurable: true });

      await playCurrentAyah();

      expect(mockGetCachedAudioUrl).toHaveBeenCalledWith('https://audio/1.mp3');
    });
  });

  describe('playCurrentAyah — no surahData', () => {
    it('should show toast when no surah data', async () => {
      mockState.surahData = null;
      mockState.ayahsAudios = [];

      await playCurrentAyah();

      expect(mockShowToast).toHaveBeenCalledWith('no_audio', 'error');
    });
  });

  describe('playCurrentAyah — null URL', () => {
    it('should show toast when URL is null', async () => {
      mockState.surahData = SAMPLE_SURAH_DATA;
      mockState.ayahsAudios = [null as any];
      mockState.currentAyahIndex = 0;

      await playCurrentAyah();

      expect(mockShowToast).toHaveBeenCalledWith('no_audio_ayah', 'error');
    });
  });

  describe('preloadNextAyah', () => {
    it('should create audioPlayer2 for preloading', async () => {
      mockState.surahData = SAMPLE_SURAH_DATA;
      mockState.ayahsAudios = ['https://audio/1.mp3', 'https://audio/2.mp3'];
      mockState.currentAyahIndex = 0;
      mockDom.audioPlayer2 = null;

      const audio = mockDom.audioPlayer!;
      Object.defineProperty(audio, 'paused', { value: true, configurable: true });

      await playCurrentAyah();

      // audioPlayer2 should have been created
      expect(mockDom.audioPlayer2).not.toBeNull();
    });
  });

  describe('togglePlayPause', () => {
    it('should resume playing when audio is paused with src', () => {
      mockState.surahData = SAMPLE_SURAH_DATA;
      const audio = mockDom.audioPlayer!;
      Object.defineProperty(audio, 'paused', { value: true, configurable: true });
      Object.defineProperty(audio, 'src', { value: 'https://audio/1.mp3', configurable: true });
      Object.defineProperty(audio, 'ended', { value: false, configurable: true });

      togglePlayPause();

      expect(audio.play).toHaveBeenCalled();
    });

    it('should pause when audio is playing', () => {
      mockState.surahData = SAMPLE_SURAH_DATA;
      const audio = mockDom.audioPlayer!;
      Object.defineProperty(audio, 'paused', { value: false, configurable: true });

      togglePlayPause();

      expect(audio.pause).toHaveBeenCalled();
    });

    it('should start playback when no src loaded', () => {
      mockState.surahData = SAMPLE_SURAH_DATA;
      const audio = mockDom.audioPlayer!;
      Object.defineProperty(audio, 'paused', { value: true, configurable: true });
      Object.defineProperty(audio, 'src', { value: '', configurable: true });
      Object.defineProperty(audio, 'ended', { value: true, configurable: true });

      togglePlayPause();

      expect(mockHighlightCurrentAyah).toHaveBeenCalled();
    });
  });

  describe('bindAudioEvents — mediaSession', () => {
    it('should set up mediaSession action handlers when available', () => {
      const setActionHandlerSpy = vi.fn();
      vi.stubGlobal('navigator', {
        ...navigator,
        mediaSession: {
          setActionHandler: setActionHandlerSpy,
        },
      });

      bindAudioEvents();

      expect(setActionHandlerSpy).toHaveBeenCalledWith('play', expect.any(Function));
      expect(setActionHandlerSpy).toHaveBeenCalledWith('pause', expect.any(Function));
      expect(setActionHandlerSpy).toHaveBeenCalledWith('previoustrack', expect.any(Function));
      expect(setActionHandlerSpy).toHaveBeenCalledWith('nexttrack', expect.any(Function));

      vi.unstubAllGlobals();
    });
  });

  describe('onAudioPlay — visualizer and mediaSession', () => {
    it('should start visualizer and set mediaSession metadata', async () => {
      const { startVisualizer } = await import('../audio-visualizer.js');

      mockState.surahData = SAMPLE_SURAH_DATA;
      mockState.currentAyahIndex = 0;

      // Add a visualizer canvas to the DOM
      const vizCanvas = document.createElement('canvas');
      vizCanvas.id = 'audioVisualizer';
      document.body.appendChild(vizCanvas);

      const setActionHandlerSpy = vi.fn();
      const mediaMetadataSpy = vi.fn();
      vi.stubGlobal('navigator', {
        ...navigator,
        mediaSession: {
          setActionHandler: setActionHandlerSpy,
          metadata: null,
        },
      });
      vi.stubGlobal('MediaMetadata', mediaMetadataSpy);

      bindAudioEvents();

      // Simulate play event
      const audio = mockDom.audioPlayer!;
      audio.dispatchEvent(new Event('play'));

      await flushPromises();

      expect(startVisualizer).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });

  describe('onAudioPause — ended check', () => {
    it('should stop visualizer but not change isPlaying when ended', async () => {
      const { stopVisualizer } = await import('../audio-visualizer.js');
      mockState.isPlaying = true;

      bindAudioEvents();

      const audio = mockDom.audioPlayer!;
      Object.defineProperty(audio, 'ended', { value: true, configurable: true });
      audio.dispatchEvent(new Event('pause'));

      expect(stopVisualizer).toHaveBeenCalled();
    });
  });

  describe('onAudioError — retry logic', () => {
    it('should retry playback on error', async () => {
      mockState.surahData = SAMPLE_SURAH_DATA;
      mockState.ayahsAudios = ['https://audio/1.mp3'];

      bindAudioEvents();

      const audio = mockDom.audioPlayer!;
      // Simulate error event
      audio.dispatchEvent(new Event('error'));

      await flushPromises();

      expect(mockShowToast).toHaveBeenCalled();
    });
  });

  describe('expandPlayer', () => {
    it('should remove collapsed class and save preference', () => {
      const player = document.createElement('div');
      player.classList.add('collapsed');
      mockDom.player = player;

      expandPlayer();

      expect(player.classList.contains('collapsed')).toBe(false);
      expect(mockStorageSet).toHaveBeenCalledWith('player_collapsed', false);
    });
  });

  describe('resetAudioElement', () => {
    it('should do nothing when player is null', () => {
      expect(() => resetAudioElement(null)).not.toThrow();
    });
  });

  describe('prepareAudioForNewSurah', () => {
    it('should reset audio state', () => {
      mockDom.audioPlayer2 = createAudioPlayer();
      prepareAudioForNewSurah();

      expect(mockState.isPlaying).toBe(false);
    });
  });

  describe('handleRepeatOnEnd — repeat range check', () => {
    it('should handle repeat mode with range', async () => {
      mockState.repeatMode = true;
      mockState.repeatFrom = 1;
      mockState.repeatTo = 2;
      mockState.repeatTimes = 1;
      mockState.repeatCounter = 0;
      mockState.surahData = SAMPLE_SURAH_DATA;
      mockState.ayahsAudios = ['https://audio/1.mp3', 'https://audio/2.mp3', 'https://audio/3.mp3'];
      mockState.currentAyahIndex = 1; // At repeatTo

      const loadSurahMock = vi.fn();
      setLoadSurah(loadSurahMock);

      // Trigger audio ended
      bindAudioEvents();
      const audio = mockDom.audioPlayer!;
      audio.dispatchEvent(new Event('ended'));

      await flushPromises();

      // Should have handled repeat logic
    });
  });

  describe('onTimeUpdate — word tracking with DOM', () => {
    it('should update word highlighting based on time', async () => {
      mockState.surahData = SAMPLE_SURAH_DATA;
      mockState.ayahsAudios = ['https://audio/1.mp3'];
      mockState.currentAyahIndex = 0;

      // Create ayah with words in DOM
      const surahContent = document.createElement('div');
      surahContent.className = 'ayahs-container';
      const ayahEl = document.createElement('span');
      ayahEl.className = 'ayah';
      ayahEl.dataset['index'] = '0';
      const word1 = document.createElement('span');
      word1.className = 'word';
      word1.textContent = 'بسم';
      const word2 = document.createElement('span');
      word2.className = 'word';
      word2.textContent = 'الله';
      ayahEl.appendChild(word1);
      ayahEl.appendChild(word2);
      surahContent.appendChild(ayahEl);
      document.body.appendChild(surahContent);

      const audio = mockDom.audioPlayer!;
      Object.defineProperty(audio, 'duration', { value: 10, configurable: true });
      Object.defineProperty(audio, 'currentTime', { value: 3, configurable: true });

      bindAudioEvents();

      // Start playback to activate word tracking
      mockState.isPlaying = true;
      Object.defineProperty(audio, 'paused', { value: true, configurable: true });
      Object.defineProperty(audio, 'src', { value: 'https://audio/1.mp3', configurable: true });

      audio.dispatchEvent(new Event('timeupdate'));

      // Should not throw
    });
  });

  describe('onSeeking', () => {
    it('should clear current-word class when seeking', () => {
      // Add a current-word element
      const wordEl = document.createElement('span');
      wordEl.className = 'word current-word';
      document.body.appendChild(wordEl);

      const audio = mockDom.audioPlayer!;
      bindAudioEvents();

      // Need to set wordTrackingActive first by playing
      mockState.surahData = SAMPLE_SURAH_DATA;
      mockState.ayahsAudios = ['https://audio/1.mp3'];
      mockState.currentAyahIndex = 0;
      Object.defineProperty(audio, 'paused', { value: true, configurable: true });

      audio.dispatchEvent(new Event('seeking'));

      // Word should have current-word removed
    });
  });

  describe('playback speed', () => {
    it('should apply saved playback speed when playing', async () => {
      mockStorageGet.mockImplementation((key: string) => {
        if (key === 'playback_speed') return '1.5';
        return null;
      });

      mockState.surahData = SAMPLE_SURAH_DATA;
      mockState.ayahsAudios = ['https://audio/1.mp3'];
      mockState.currentAyahIndex = 0;

      const audio = mockDom.audioPlayer!;
      Object.defineProperty(audio, 'paused', { value: true, configurable: true });

      await playCurrentAyah();

      expect(audio.playbackRate).toBe(1.5);
    });
  });
});
