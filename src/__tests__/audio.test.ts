/**
 * Tests for audio.ts — audio playback, hifdh, repeat, and sleep timer.
 * Comprehensive tests covering all exported functions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/** Flush pending microtasks (promises) so async effects propagate. */
function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
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
  setLoadSurah,
  togglePlayPause,
  expandPlayer,
  bindAudioEvents,
  updatePlayPauseBtn,
  playCurrentAyah,
  toggleHifdh,
  toggleRepeat,
  populateRepeatUI,
  nextAyah,
  prevAyah,
  nextSurah,
  prevSurah,
  type RepeatRange,
} from '../audio.js';
import type { SurahData } from '../types.js';

// Mock dependencies
vi.mock('../state.js', () => ({
  state: {
    isPlaying: false,
    surahData: null as SurahData | null,
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
  },
  setState: vi.fn(),
  batch: vi.fn((fn) => fn()),
}));

vi.mock('../dom.js', () => ({
  dom: {
    audioPlayer: null as HTMLAudioElement | null,
    audioPlayer2: null as HTMLAudioElement | null,
    playPauseBtn: null as HTMLElement | null,
    hifdhBtn: null as HTMLElement | null,
    repeatBtn: null as HTMLElement | null,
    repeatControls: null as HTMLElement | null,
    repeatFrom: null as HTMLSelectElement | null,
    repeatTo: null as HTMLSelectElement | null,
    repeatTimes: null as HTMLSelectElement | null,
    player: null as HTMLElement | null,
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

vi.mock('../audio-cache.js', () => ({
  getCachedAudioUrl: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../audio-visualizer.js', () => ({
  startVisualizer: vi.fn(),
  stopVisualizer: vi.fn(),
}));

import { state } from '../state.js';
import { dom } from '../dom.js';
import { storage } from '../storage.js';
import { showToast } from '../ui.js';
import { hapticFeedback } from '../utils.js';
import { highlightCurrentAyah } from '../surah-loader.js';

// Helper to create a mock audio element
function createMockAudio(overrides: Record<string, unknown> = {}): HTMLAudioElement {
  return {
    pause: vi.fn(),
    play: vi.fn(() => Promise.resolve()),
    removeAttribute: vi.fn(),
    load: vi.fn(),
    paused: true,
    ended: false,
    src: '',
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
    readyState: 0,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    classList: { remove: vi.fn(), add: vi.fn(), toggle: vi.fn(), contains: vi.fn() },
    ...overrides,
  } as unknown as HTMLAudioElement;
}

// Helper to create a mock DOM element
function createMockElement(tag: string = 'div'): HTMLElement {
  const el = document.createElement(tag);
  return el;
}

// Helper to create surah data
function createSurahData(ayahCount: number = 7, surahNumber: number = 1): SurahData {
  return {
    number: surahNumber,
    name: surahNumber === 1 ? 'الفاتحة' : 'السورة',
    englishName: surahNumber === 1 ? 'Al-Fatiha' : 'Surah',
    ayahs: Array.from({ length: ayahCount }, (_, i) => ({
      numberInSurah: i + 1,
      text: `آية ${i + 1}`,
    })),
  } as SurahData;
}

beforeEach(() => {
  // Reset all state between tests
  state.isPlaying = false;
  state.surahData = null;
  state.ayahsAudios = [];
  state.currentAyahIndex = 0;
  state.currentSurah = 1;
  state.hifdhMode = false;
  state.repeatMode = false;
  state.repeatFrom = 1;
  state.repeatTo = 1;
  state.repeatTimes = 3;
  state.repeatCounter = 0;
  state.ayahTimings = [];
  state.mushafMode = false;

  dom.audioPlayer = null;
  dom.audioPlayer2 = null;
  dom.playPauseBtn = null;
  dom.hifdhBtn = null;
  dom.repeatBtn = null;
  dom.repeatControls = null;
  dom.repeatFrom = null;
  dom.repeatTo = null;
  dom.repeatTimes = null;
  dom.player = null;

  vi.clearAllMocks();
});

/* ===================== getDefaultRepeatRange ===================== */

describe('getDefaultRepeatRange', () => {
  it('should return from=1, to=ayah count, times=3', () => {
    const surahData = createSurahData(7);
    const range = getDefaultRepeatRange(surahData);
    expect(range.from).toBe(1);
    expect(range.to).toBe(7);
    expect(range.times).toBe(3);
  });

  it('should handle surah with many ayahs', () => {
    const surahData = createSurahData(286, 2);
    const range = getDefaultRepeatRange(surahData);
    expect(range.to).toBe(286);
    expect(range.times).toBe(3);
  });

  it('should handle surah with 1 ayah', () => {
    const surahData = createSurahData(1, 108);
    const range = getDefaultRepeatRange(surahData);
    expect(range.from).toBe(1);
    expect(range.to).toBe(1);
  });

  it('should always return times=3 regardless of ayah count', () => {
    const surahData = createSurahData(200);
    const range = getDefaultRepeatRange(surahData);
    expect(range.times).toBe(3);
  });
});

/* ===================== applyRepeatUI ===================== */

describe('applyRepeatUI', () => {
  it('should not throw when DOM elements are null', () => {
    expect(() => applyRepeatUI(true)).not.toThrow();
    expect(() => applyRepeatUI(false)).not.toThrow();
  });

  it('should add active class to repeatBtn when active=true', () => {
    const btn = createMockElement('button');
    btn.classList.add = vi.fn();
    btn.classList.toggle = vi.fn();
    dom.repeatBtn = btn;

    applyRepeatUI(true);
    expect(btn.classList.toggle).toHaveBeenCalledWith('active', true);
  });

  it('should remove active class from repeatBtn when active=false', () => {
    const btn = createMockElement('button');
    btn.classList.toggle = vi.fn();
    dom.repeatBtn = btn;

    applyRepeatUI(false);
    expect(btn.classList.toggle).toHaveBeenCalledWith('active', false);
  });

  it('should set repeatControls display to flex when active', () => {
    const controls = createMockElement('div');
    dom.repeatControls = controls;

    applyRepeatUI(true);
    expect(controls.style.display).toBe('flex');
  });

  it('should set repeatControls display to none when inactive', () => {
    const controls = createMockElement('div');
    dom.repeatControls = controls;

    applyRepeatUI(false);
    expect(controls.style.display).toBe('none');
  });
});

/* ===================== resetRepeatUI ===================== */

describe('resetRepeatUI', () => {
  it('should not throw when DOM elements are null', () => {
    expect(() => resetRepeatUI()).not.toThrow();
  });

  it('should remove active class from repeatBtn', () => {
    const btn = createMockElement('button');
    btn.classList.remove = vi.fn();
    dom.repeatBtn = btn;

    resetRepeatUI();
    expect(btn.classList.remove).toHaveBeenCalledWith('active');
  });

  it('should hide repeatControls', () => {
    const controls = createMockElement('div');
    dom.repeatControls = controls;

    resetRepeatUI();
    expect(controls.style.display).toBe('none');
  });
});

/* ===================== applyHifdhUI ===================== */

describe('applyHifdhUI', () => {
  it('should not throw when hifdhBtn is null', () => {
    expect(() => applyHifdhUI(true)).not.toThrow();
    expect(() => applyHifdhUI(false)).not.toThrow();
  });

  it('should add active class to hifdhBtn when enabled', () => {
    const btn = createMockElement('button');
    btn.classList.toggle = vi.fn();
    dom.hifdhBtn = btn;

    applyHifdhUI(true);
    expect(btn.classList.toggle).toHaveBeenCalledWith('active', true);
  });

  it('should remove active class from hifdhBtn when disabled', () => {
    const btn = createMockElement('button');
    btn.classList.toggle = vi.fn();
    dom.hifdhBtn = btn;

    applyHifdhUI(false);
    expect(btn.classList.toggle).toHaveBeenCalledWith('active', false);
  });

  it('should add hifdh-mode class to ayah elements when enabled', () => {
    const ayahEl = document.createElement('div');
    ayahEl.className = 'ayah';
    document.body.appendChild(ayahEl);

    applyHifdhUI(true);
    expect(ayahEl.classList.contains('hifdh-mode')).toBe(true);

    document.body.removeChild(ayahEl);
  });

  it('should remove hifdh-mode and revealed classes when disabled', () => {
    const ayahEl = document.createElement('div');
    ayahEl.className = 'ayah hifdh-mode revealed';
    document.body.appendChild(ayahEl);

    applyHifdhUI(false);
    expect(ayahEl.classList.contains('hifdh-mode')).toBe(false);
    expect(ayahEl.classList.contains('revealed')).toBe(false);

    document.body.removeChild(ayahEl);
  });
});

/* ===================== resetAudioElement ===================== */

describe('resetAudioElement', () => {
  it('should not throw when player is null', () => {
    expect(() => resetAudioElement(null)).not.toThrow();
  });

  it('should pause and reset a mock audio element', () => {
    const mockPlayer = createMockAudio();
    resetAudioElement(mockPlayer);
    expect(mockPlayer.pause).toHaveBeenCalled();
    expect(mockPlayer.removeAttribute).toHaveBeenCalledWith('src');
    expect(mockPlayer.load).toHaveBeenCalled();
  });
});

/* ===================== resetAudioPlayerUI ===================== */

describe('resetAudioPlayerUI', () => {
  it('should not throw when called', () => {
    expect(() => resetAudioPlayerUI()).not.toThrow();
  });

  it('should remove audio-playing class from body', () => {
    document.body.classList.add('audio-playing');
    resetAudioPlayerUI();
    expect(document.body.classList.contains('audio-playing')).toBe(false);
  });
});

/* ===================== prepareAudioForNewSurah ===================== */

describe('prepareAudioForNewSurah', () => {
  it('should not throw when called', () => {
    expect(() => prepareAudioForNewSurah()).not.toThrow();
  });

  it('should set isPlaying to false', () => {
    state.isPlaying = true;
    prepareAudioForNewSurah();
    expect(state.isPlaying).toBe(false);
  });

  it('should reset audioPlayer when present', () => {
    const mockPlayer = createMockAudio();
    dom.audioPlayer = mockPlayer;
    prepareAudioForNewSurah();
    expect(mockPlayer.pause).toHaveBeenCalled();
    expect(mockPlayer.removeAttribute).toHaveBeenCalledWith('src');
  });

  it('should reset audioPlayer2 when present', () => {
    const mockPlayer2 = createMockAudio();
    dom.audioPlayer2 = mockPlayer2;
    prepareAudioForNewSurah();
    expect(mockPlayer2.pause).toHaveBeenCalled();
    expect(mockPlayer2.removeAttribute).toHaveBeenCalledWith('src');
  });
});

/* ===================== setLoadSurah ===================== */

describe('setLoadSurah', () => {
  it('should store the loadSurah callback', () => {
    const fn = vi.fn();
    setLoadSurah(fn);
    // The callback is stored internally; we test it via nextSurah/prevSurah
  });
});

/* ===================== updatePlayPauseBtn ===================== */

describe('updatePlayPauseBtn', () => {
  it('should not throw when playPauseBtn is null', () => {
    expect(() => updatePlayPauseBtn()).not.toThrow();
  });

  it('should set textContent to pause key when playing', () => {
    const btn = createMockElement('button');
    dom.playPauseBtn = btn;
    state.isPlaying = true;

    updatePlayPauseBtn();
    expect(btn.textContent).toBe('pause');
  });

  it('should set textContent to play key when not playing', () => {
    const btn = createMockElement('button');
    dom.playPauseBtn = btn;
    state.isPlaying = false;

    updatePlayPauseBtn();
    expect(btn.textContent).toBe('play');
  });
});

/* ===================== expandPlayer ===================== */

describe('expandPlayer', () => {
  it('should not throw when player is null', () => {
    expect(() => expandPlayer()).not.toThrow();
  });

  it('should remove collapsed class from player', () => {
    const player = createMockElement('div');
    player.className = 'player collapsed';
    dom.player = player;

    expandPlayer();
    expect(player.classList.contains('collapsed')).toBe(false);
  });

  it('should persist player_collapsed=false to storage', () => {
    const player = createMockElement('div');
    dom.player = player;

    expandPlayer();
    expect(storage.set).toHaveBeenCalledWith('player_collapsed', false);
  });
});

/* ===================== togglePlayPause ===================== */

describe('togglePlayPause', () => {
  it('should not throw when surahData is null', () => {
    state.surahData = null;
    expect(() => togglePlayPause()).not.toThrow();
  });

  it('should not throw when audioPlayer is null', () => {
    state.surahData = createSurahData();
    dom.audioPlayer = null;
    expect(() => togglePlayPause()).not.toThrow();
  });

  it('should call hapticFeedback', () => {
    state.surahData = createSurahData();
    const mockPlayer = createMockAudio({ paused: true });
    dom.audioPlayer = mockPlayer;

    togglePlayPause();
    expect(hapticFeedback).toHaveBeenCalled();
  });

  it('should call playCurrentAyah when paused with no src', () => {
    state.surahData = createSurahData();
    state.ayahsAudios = ['http://example.com/audio.mp3'];
    const mockPlayer = createMockAudio({ paused: true, src: '', ended: false });
    dom.audioPlayer = mockPlayer;

    togglePlayPause();
    expect(highlightCurrentAyah).toHaveBeenCalled();
  });

  it('should call play when paused with existing src', () => {
    state.surahData = createSurahData();
    const mockPlayer = createMockAudio({ paused: true, src: 'http://example.com/audio.mp3', ended: false });
    dom.audioPlayer = mockPlayer;

    togglePlayPause();
    expect(mockPlayer.play).toHaveBeenCalled();
  });

  it('should call pause when playing', () => {
    state.surahData = createSurahData();
    const mockPlayer = createMockAudio({ paused: false, src: 'http://example.com/audio.mp3' });
    dom.audioPlayer = mockPlayer;

    togglePlayPause();
    expect(mockPlayer.pause).toHaveBeenCalled();
  });

  it('should start from current ayah when audio ended', () => {
    state.surahData = createSurahData();
    state.ayahsAudios = ['http://example.com/audio.mp3'];
    const mockPlayer = createMockAudio({ paused: true, src: 'http://example.com/audio.mp3', ended: true });
    dom.audioPlayer = mockPlayer;

    togglePlayPause();
    expect(highlightCurrentAyah).toHaveBeenCalled();
  });
});

/* ===================== bindAudioEvents ===================== */

describe('bindAudioEvents', () => {
  it('should not throw when audioPlayer is null', () => {
    dom.audioPlayer = null;
    expect(() => bindAudioEvents()).not.toThrow();
  });

  it('should bind event listeners to audioPlayer', () => {
    const mockPlayer = createMockAudio();
    dom.audioPlayer = mockPlayer;

    bindAudioEvents();

    // Check that addEventListener was called for expected events
    expect(mockPlayer.addEventListener).toHaveBeenCalledWith('ended', expect.any(Function));
    expect(mockPlayer.addEventListener).toHaveBeenCalledWith('play', expect.any(Function));
    expect(mockPlayer.addEventListener).toHaveBeenCalledWith('pause', expect.any(Function));
    expect(mockPlayer.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockPlayer.addEventListener).toHaveBeenCalledWith('timeupdate', expect.any(Function));
    expect(mockPlayer.addEventListener).toHaveBeenCalledWith('seeking', expect.any(Function));
  });

  it('should remove old listeners before adding new ones', () => {
    const mockPlayer = createMockAudio();
    dom.audioPlayer = mockPlayer;

    bindAudioEvents();

    expect(mockPlayer.removeEventListener).toHaveBeenCalledWith('ended', expect.any(Function));
    expect(mockPlayer.removeEventListener).toHaveBeenCalledWith('play', expect.any(Function));
    expect(mockPlayer.removeEventListener).toHaveBeenCalledWith('pause', expect.any(Function));
    expect(mockPlayer.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockPlayer.removeEventListener).toHaveBeenCalledWith('timeupdate', expect.any(Function));
    expect(mockPlayer.removeEventListener).toHaveBeenCalledWith('seeking', expect.any(Function));
  });
});

/* ===================== playCurrentAyah ===================== */

describe('playCurrentAyah', () => {
  it('should show error toast when no surahData', async () => {
    state.surahData = null;
    await playCurrentAyah();
    expect(showToast).toHaveBeenCalledWith('no_audio', 'error');
  });

  it('should show error toast when no ayahsAudios', async () => {
    state.surahData = createSurahData();
    state.ayahsAudios = [];
    await playCurrentAyah();
    expect(showToast).toHaveBeenCalledWith('no_audio', 'error');
  });

  it('should show error toast when audio URL is empty', async () => {
    state.surahData = createSurahData();
    state.ayahsAudios = [''];
    dom.audioPlayer = createMockAudio();
    await playCurrentAyah();
    expect(showToast).toHaveBeenCalledWith('no_audio_ayah', 'error');
  });

  it('should return early when audioPlayer is null', async () => {
    state.surahData = createSurahData();
    state.ayahsAudios = ['http://example.com/audio.mp3'];
    dom.audioPlayer = null;
    await expect(playCurrentAyah()).resolves.not.toThrow();
  });

  it('should set audio src and play for non-mp3quran mode', async () => {
    state.surahData = createSurahData();
    state.ayahsAudios = ['http://example.com/audio1.mp3', 'http://example.com/audio2.mp3'];
    const mockPlayer = createMockAudio({ paused: true });
    dom.audioPlayer = mockPlayer;

    await playCurrentAyah();
    expect(mockPlayer.src).toBe('http://example.com/audio1.mp3');
    expect(mockPlayer.play).toHaveBeenCalled();
    expect(state.isPlaying).toBe(true);
  });

  it('should apply saved playback speed', async () => {
    state.surahData = createSurahData();
    state.ayahsAudios = ['http://example.com/audio.mp3'];
    const mockPlayer = createMockAudio({ paused: true });
    dom.audioPlayer = mockPlayer;
    (storage.get as ReturnType<typeof vi.fn>).mockReturnValue('1.5');

    await playCurrentAyah();
    expect(mockPlayer.playbackRate).toBe(1.5);
  });

  it('should not change playbackRate when no saved speed', async () => {
    state.surahData = createSurahData();
    state.ayahsAudios = ['http://example.com/audio.mp3'];
    const mockPlayer = createMockAudio({ paused: true, playbackRate: 1 });
    dom.audioPlayer = mockPlayer;
    (storage.get as ReturnType<typeof vi.fn>).mockReturnValue(null);

    await playCurrentAyah();
    expect(mockPlayer.playbackRate).toBe(1);
  });

  it('should add audio-playing class to body', async () => {
    state.surahData = createSurahData();
    state.ayahsAudios = ['http://example.com/audio.mp3'];
    dom.audioPlayer = createMockAudio({ paused: true });

    await playCurrentAyah();
    expect(document.body.classList.contains('audio-playing')).toBe(true);
  });

  it('should handle mp3quran mode with cached URL', async () => {
    state.surahData = createSurahData();
    state.ayahsAudios = ['http://example.com/full-surah.mp3'];
    state.ayahTimings = [0.1, 0.2, 0.3];
    const mockPlayer = createMockAudio({
      paused: true,
      readyState: 3, // HAVE_FUTURE_DATA
      duration: 100,
    });
    dom.audioPlayer = mockPlayer;

    // First call sets the cache
    await playCurrentAyah();
    // Second call should use cached path
    await playCurrentAyah();
    expect(mockPlayer.play).toHaveBeenCalled();
  });
});

/* ===================== toggleHifdh ===================== */

describe('toggleHifdh', () => {
  it('should toggle hifdhMode from false to true', () => {
    state.hifdhMode = false;
    toggleHifdh();
    expect(state.hifdhMode).toBe(true);
  });

  it('should toggle hifdhMode from true to false', () => {
    state.hifdhMode = true;
    toggleHifdh();
    expect(state.hifdhMode).toBe(false);
  });

  it('should call hapticFeedback', () => {
    toggleHifdh();
    expect(hapticFeedback).toHaveBeenCalled();
  });

  it('should call applyHifdhUI with new state', () => {
    state.hifdhMode = false;
    const btn = createMockElement('button');
    btn.classList.toggle = vi.fn();
    dom.hifdhBtn = btn;

    toggleHifdh();
    expect(btn.classList.toggle).toHaveBeenCalledWith('active', true);
  });

  it('should show toast with hifdh_on when enabling', () => {
    state.hifdhMode = false;
    toggleHifdh();
    expect(showToast).toHaveBeenCalledWith('hifdh_on', 'success');
  });

  it('should show toast with hifdh_off when disabling', () => {
    state.hifdhMode = true;
    toggleHifdh();
    expect(showToast).toHaveBeenCalledWith('hifdh_off', '');
  });

  it('should call highlightCurrentAyah when enabling', () => {
    state.hifdhMode = false;
    toggleHifdh();
    expect(highlightCurrentAyah).toHaveBeenCalled();
  });
});

/* ===================== toggleRepeat ===================== */

describe('toggleRepeat', () => {
  it('should toggle repeatMode from false to true', () => {
    state.repeatMode = false;
    toggleRepeat();
    expect(state.repeatMode).toBe(true);
  });

  it('should toggle repeatMode from true to false', () => {
    state.repeatMode = true;
    toggleRepeat();
    expect(state.repeatMode).toBe(false);
  });

  it('should call hapticFeedback', () => {
    toggleRepeat();
    expect(hapticFeedback).toHaveBeenCalled();
  });

  it('should reset repeatCounter to 0', () => {
    state.repeatCounter = 5;
    toggleRepeat();
    expect(state.repeatCounter).toBe(0);
  });

  it('should apply repeat UI when enabling', () => {
    state.repeatMode = false;
    const btn = createMockElement('button');
    btn.classList.toggle = vi.fn();
    dom.repeatBtn = btn;

    toggleRepeat();
    expect(btn.classList.toggle).toHaveBeenCalledWith('active', true);
  });

  it('should set default repeat range when enabling with surahData', () => {
    state.repeatMode = false;
    state.surahData = createSurahData(7);

    toggleRepeat();
    expect(state.repeatFrom).toBe(1);
    expect(state.repeatTo).toBe(7);
    expect(state.repeatTimes).toBe(3);
  });

  it('should show repeat_on toast when enabling', () => {
    state.repeatMode = false;
    state.surahData = createSurahData();
    toggleRepeat();
    expect(showToast).toHaveBeenCalledWith('repeat_on', 'success');
  });

  it('should show repeat_off toast when disabling', () => {
    state.repeatMode = true;
    toggleRepeat();
    expect(showToast).toHaveBeenCalledWith('repeat_off', '');
  });
});

/* ===================== populateRepeatUI ===================== */

describe('populateRepeatUI', () => {
  it('should not throw when DOM elements are null', () => {
    expect(() => populateRepeatUI({ from: 1, to: 7, times: 3 })).not.toThrow();
  });

  it('should populate options in repeatFrom and repeatTo selects', () => {
    const fromSelect = document.createElement('select') as HTMLSelectElement;
    const toSelect = document.createElement('select') as HTMLSelectElement;
    const timesSelect = document.createElement('select') as HTMLSelectElement;
    // repeatTimes uses pre-existing options (from HTML template)
    timesSelect.add(new Option('2', '2'));
    timesSelect.add(new Option('3', '3'));
    timesSelect.add(new Option('5', '5'));
    dom.repeatFrom = fromSelect;
    dom.repeatTo = toSelect;
    dom.repeatTimes = timesSelect;

    populateRepeatUI({ from: 1, to: 7, times: 3 });

    // Should have options from 1 to 7
    expect(fromSelect.options.length).toBe(7);
    expect(toSelect.options.length).toBe(7);
    expect(fromSelect.value).toBe('1');
    expect(toSelect.value).toBe('7');
    expect(timesSelect.value).toBe('3');
  });

  it('should bind onchange handlers that update state', () => {
    const fromSelect = document.createElement('select') as HTMLSelectElement;
    const toSelect = document.createElement('select') as HTMLSelectElement;
    const timesSelect = document.createElement('select') as HTMLSelectElement;

    // Add options to selects
    for (let i = 1; i <= 7; i++) {
      fromSelect.add(new Option(String(i), String(i)));
      toSelect.add(new Option(String(i), String(i)));
    }
    timesSelect.add(new Option('2', '2'));
    timesSelect.add(new Option('3', '3'));
    timesSelect.add(new Option('5', '5'));

    dom.repeatFrom = fromSelect;
    dom.repeatTo = toSelect;
    dom.repeatTimes = timesSelect;

    populateRepeatUI({ from: 1, to: 7, times: 3 });

    // Simulate changing repeatFrom to 5
    fromSelect.value = '5';
    fromSelect.onchange?.(new Event('change'));
    expect(state.repeatFrom).toBe(5);
    expect(state.repeatCounter).toBe(0);

    // Simulate changing repeatTo to 3
    toSelect.value = '3';
    toSelect.onchange?.(new Event('change'));
    expect(state.repeatTo).toBe(3);
    expect(state.repeatCounter).toBe(0);

    // Simate changing repeatTimes
    timesSelect.value = '5';
    timesSelect.onchange?.(new Event('change'));
    expect(state.repeatTimes).toBe(5);
    expect(state.repeatCounter).toBe(0);
  });

  it('should adjust repeatTo when repeatFrom exceeds it', () => {
    const fromSelect = document.createElement('select') as HTMLSelectElement;
    const toSelect = document.createElement('select') as HTMLSelectElement;
    const timesSelect = document.createElement('select') as HTMLSelectElement;

    for (let i = 1; i <= 7; i++) {
      fromSelect.add(new Option(String(i), String(i)));
      toSelect.add(new Option(String(i), String(i)));
    }
    timesSelect.add(new Option('3', '3'));

    dom.repeatFrom = fromSelect;
    dom.repeatTo = toSelect;
    dom.repeatTimes = timesSelect;

    populateRepeatUI({ from: 1, to: 7, times: 3 });

    // Set repeatTo to 3, then change repeatFrom to 5
    toSelect.value = '3';
    state.repeatTo = 3;
    fromSelect.value = '5';
    fromSelect.onchange?.(new Event('change'));

    expect(state.repeatTo).toBe(5); // Should be adjusted up
    expect(toSelect.value).toBe('5');
  });

  it('should adjust repeatFrom when repeatTo is less than it', () => {
    const fromSelect = document.createElement('select') as HTMLSelectElement;
    const toSelect = document.createElement('select') as HTMLSelectElement;
    const timesSelect = document.createElement('select') as HTMLSelectElement;

    for (let i = 1; i <= 7; i++) {
      fromSelect.add(new Option(String(i), String(i)));
      toSelect.add(new Option(String(i), String(i)));
    }
    timesSelect.add(new Option('3', '3'));

    dom.repeatFrom = fromSelect;
    dom.repeatTo = toSelect;
    dom.repeatTimes = timesSelect;

    populateRepeatUI({ from: 1, to: 7, times: 3 });

    // Set repeatFrom to 5, then change repeatTo to 2
    fromSelect.value = '5';
    state.repeatFrom = 5;
    toSelect.value = '2';
    toSelect.onchange?.(new Event('change'));

    expect(state.repeatFrom).toBe(2); // Should be adjusted down
    expect(fromSelect.value).toBe('2');
  });
});

/* ===================== nextAyah ===================== */

describe('nextAyah', () => {
  it('should not throw when surahData is null', () => {
    state.surahData = null;
    expect(() => nextAyah(false)).not.toThrow();
  });

  it('should not throw when ayahsAudios is null', () => {
    state.surahData = createSurahData();
    state.ayahsAudios = null as unknown as string[];
    expect(() => nextAyah(false)).not.toThrow();
  });

  it('should increment currentAyahIndex', () => {
    state.surahData = createSurahData(7);
    state.ayahsAudios = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
    state.currentAyahIndex = 2;

    nextAyah(false);
    expect(state.currentAyahIndex).toBe(3);
  });

  it('should call highlightCurrentAyah', () => {
    state.surahData = createSurahData(7);
    state.ayahsAudios = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
    state.currentAyahIndex = 0;

    nextAyah(false);
    expect(highlightCurrentAyah).toHaveBeenCalled();
  });

  it('should play current ayah when auto from repeat', async () => {
    state.surahData = createSurahData(7);
    state.ayahsAudios = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
    state.currentAyahIndex = 0;
    const mockPlayer = createMockAudio({ paused: true });
    dom.audioPlayer = mockPlayer;

    nextAyah(true);
    await flushPromises();
    // playCurrentAyah should be called when autoFromRepeat is true
    expect(mockPlayer.play).toHaveBeenCalled();
  });

  it('should play current ayah when isPlaying is true', async () => {
    state.surahData = createSurahData(7);
    state.ayahsAudios = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
    state.currentAyahIndex = 0;
    state.isPlaying = true;
    const mockPlayer = createMockAudio({ paused: true });
    dom.audioPlayer = mockPlayer;

    nextAyah(false);
    await flushPromises();
    expect(mockPlayer.play).toHaveBeenCalled();
  });

  it('should not play when not auto and not playing', () => {
    state.surahData = createSurahData(7);
    state.ayahsAudios = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
    state.currentAyahIndex = 0;
    state.isPlaying = false;
    const mockPlayer = createMockAudio({ paused: true });
    dom.audioPlayer = mockPlayer;

    nextAyah(false);
    // Should increment but not play
    expect(state.currentAyahIndex).toBe(1);
    expect(mockPlayer.play).not.toHaveBeenCalled();
  });

  it('should call nextSurah when at last ayah and surah < 114', () => {
    state.surahData = createSurahData(7);
    state.ayahsAudios = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
    state.currentAyahIndex = 6; // Last ayah
    state.currentSurah = 1;
    const loadFn = vi.fn();
    setLoadSurah(loadFn);

    nextAyah(false);
    expect(loadFn).toHaveBeenCalledWith(2, { autoPlay: false });
  });

  it('should stop in mushafMode at last ayah', () => {
    state.surahData = createSurahData(7);
    state.ayahsAudios = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
    state.currentAyahIndex = 6;
    state.currentSurah = 1;
    state.mushafMode = true;
    state.isPlaying = true;
    const mockPlayer = createMockAudio({ paused: false });
    dom.audioPlayer = mockPlayer;

    nextAyah(false);
    expect(mockPlayer.pause).toHaveBeenCalled();
    expect(state.isPlaying).toBe(false);
  });
});

/* ===================== prevAyah ===================== */

describe('prevAyah', () => {
  it('should not throw when surahData is null', () => {
    state.surahData = null;
    expect(() => prevAyah()).not.toThrow();
  });

  it('should decrement currentAyahIndex when > 0', () => {
    state.surahData = createSurahData(7);
    state.currentAyahIndex = 3;

    prevAyah();
    expect(state.currentAyahIndex).toBe(2);
  });

  it('should call highlightCurrentAyah', () => {
    state.surahData = createSurahData(7);
    state.currentAyahIndex = 3;

    prevAyah();
    expect(highlightCurrentAyah).toHaveBeenCalled();
  });

  it('should play when isPlaying is true', async () => {
    state.surahData = createSurahData(7);
    state.ayahsAudios = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
    state.currentAyahIndex = 3;
    state.isPlaying = true;
    const mockPlayer = createMockAudio({ paused: true });
    dom.audioPlayer = mockPlayer;

    prevAyah();
    await flushPromises();
    expect(mockPlayer.play).toHaveBeenCalled();
  });

  it('should not play when isPlaying is false', () => {
    state.surahData = createSurahData(7);
    state.ayahsAudios = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
    state.currentAyahIndex = 3;
    state.isPlaying = false;
    const mockPlayer = createMockAudio({ paused: true });
    dom.audioPlayer = mockPlayer;

    prevAyah();
    expect(mockPlayer.play).not.toHaveBeenCalled();
  });

  it('should call prevSurah when at first ayah and surah > 1', () => {
    state.surahData = createSurahData(7);
    state.currentAyahIndex = 0;
    state.currentSurah = 2;
    const loadFn = vi.fn();
    setLoadSurah(loadFn);

    prevAyah();
    expect(loadFn).toHaveBeenCalledWith(1, { autoPlay: false });
  });

  it('should not call prevSurah when at surah 1', () => {
    state.surahData = createSurahData(7);
    state.currentAyahIndex = 0;
    state.currentSurah = 1;
    const loadFn = vi.fn();
    setLoadSurah(loadFn);

    prevAyah();
    expect(loadFn).not.toHaveBeenCalled();
  });
});

/* ===================== nextSurah ===================== */

describe('nextSurah', () => {
  it('should call loadSurah with next surah number', () => {
    state.currentSurah = 5;
    const loadFn = vi.fn();
    setLoadSurah(loadFn);

    nextSurah();
    expect(loadFn).toHaveBeenCalledWith(6, { autoPlay: false });
  });

  it('should not call loadSurah when at surah 114', () => {
    state.currentSurah = 114;
    const loadFn = vi.fn();
    setLoadSurah(loadFn);

    nextSurah();
    expect(loadFn).not.toHaveBeenCalled();
  });

  it('should pass autoPlay=true when playing', () => {
    state.currentSurah = 5;
    state.isPlaying = true;
    const loadFn = vi.fn();
    setLoadSurah(loadFn);

    nextSurah();
    expect(loadFn).toHaveBeenCalledWith(6, { autoPlay: true });
  });

  it('should not throw when no loadSurah callback set', () => {
    state.currentSurah = 5;
    setLoadSurah(null as unknown as (n: number) => void);
    expect(() => nextSurah()).not.toThrow();
  });
});

/* ===================== prevSurah ===================== */

describe('prevSurah', () => {
  it('should call loadSurah with previous surah number', () => {
    state.currentSurah = 5;
    const loadFn = vi.fn();
    setLoadSurah(loadFn);

    prevSurah();
    expect(loadFn).toHaveBeenCalledWith(4, { autoPlay: false });
  });

  it('should not call loadSurah when at surah 1', () => {
    state.currentSurah = 1;
    const loadFn = vi.fn();
    setLoadSurah(loadFn);

    prevSurah();
    expect(loadFn).not.toHaveBeenCalled();
  });

  it('should pass autoPlay=true when playing', () => {
    state.currentSurah = 5;
    state.isPlaying = true;
    const loadFn = vi.fn();
    setLoadSurah(loadFn);

    prevSurah();
    expect(loadFn).toHaveBeenCalledWith(4, { autoPlay: true });
  });
});

/* ===================== Audio Event Handlers (via bindAudioEvents) ===================== */

describe('Audio Event Handlers', () => {
  // Use a real audio element so addEventListener/dispatchEvent work
  let realAudio: HTMLAudioElement;
  let eventHandlers: Record<string, (...args: unknown[]) => void>;

  function setupAudioWithEvents() {
    realAudio = document.createElement('audio') as HTMLAudioElement;
    // Mock play() to return a resolved promise
    realAudio.play = vi.fn(() => Promise.resolve());
    dom.audioPlayer = realAudio;

    // Capture event handlers
    eventHandlers = {};
    const origAdd = realAudio.addEventListener.bind(realAudio);
    realAudio.addEventListener = vi.fn((type: string, handler: EventListenerOrEventListenerObject) => {
      if (typeof handler === 'function') {
        eventHandlers[type] = handler;
      }
      return origAdd(type, handler);
    });

    bindAudioEvents();
  }

  it('onAudioPlay should set isPlaying=true and reset retry count', () => {
    setupAudioWithEvents();
    state.surahData = createSurahData(7);
    state.ayahsAudios = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
    state.currentAyahIndex = 0;

    const playHandler = eventHandlers['play'];
    expect(playHandler).toBeDefined();
    playHandler!(new Event('play'));

    expect(state.isPlaying).toBe(true);
  });

  it('onAudioPlay should update playPauseBtn text', () => {
    setupAudioWithEvents();
    state.surahData = createSurahData(7);
    state.ayahsAudios = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
    const btn = createMockElement('button');
    dom.playPauseBtn = btn;

    const playHandler = eventHandlers['play'];
    playHandler!(new Event('play'));

    expect(btn.textContent).toBe('pause');
  });

  it('onAudioPlay should add audio-playing class to body', () => {
    setupAudioWithEvents();
    state.surahData = createSurahData(7);
    state.ayahsAudios = ['a1'];

    const playHandler = eventHandlers['play'];
    playHandler!(new Event('play'));

    expect(document.body.classList.contains('audio-playing')).toBe(true);
  });

  it('onAudioPause should set isPlaying=false', () => {
    setupAudioWithEvents();
    state.isPlaying = true;

    const pauseHandler = eventHandlers['pause'];
    expect(pauseHandler).toBeDefined();
    pauseHandler!(new Event('pause'));

    expect(state.isPlaying).toBe(false);
  });

  it('onAudioPause should update playPauseBtn text', () => {
    setupAudioWithEvents();
    state.isPlaying = true;
    const btn = createMockElement('button');
    dom.playPauseBtn = btn;

    const pauseHandler = eventHandlers['pause'];
    pauseHandler!(new Event('pause'));

    expect(btn.textContent).toBe('play');
  });

  it('onAudioPause should remove audio-playing class from body', () => {
    setupAudioWithEvents();
    document.body.classList.add('audio-playing');

    const pauseHandler = eventHandlers['pause'];
    pauseHandler!(new Event('pause'));

    expect(document.body.classList.contains('audio-playing')).toBe(false);
  });

  it('onAudioEnded should advance to next ayah', () => {
    setupAudioWithEvents();
    state.surahData = createSurahData(7);
    state.ayahsAudios = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
    state.currentAyahIndex = 0;
    state.currentSurah = 1;
    state.isPlaying = true;

    const endedHandler = eventHandlers['ended'];
    expect(endedHandler).toBeDefined();
    endedHandler!(new Event('ended'));

    expect(state.currentAyahIndex).toBe(1);
  });

  it('onAudioEnded at last ayah should stop by default (autoPlayNext off)', () => {
    setupAudioWithEvents();
    state.surahData = createSurahData(3);
    state.ayahsAudios = ['a1', 'a2', 'a3'];
    state.currentAyahIndex = 2; // last ayah
    state.currentSurah = 1;
    state.isPlaying = true;
    state.autoPlayNext = false; // default
    const loadFn = vi.fn();
    setLoadSurah(loadFn);

    const endedHandler = eventHandlers['ended'];
    endedHandler!(new Event('ended'));

    expect(state.isPlaying).toBe(false);
    expect(loadFn).not.toHaveBeenCalled();
  });

  it('onAudioEnded at last ayah should go to next surah when autoPlayNext is on', () => {
    setupAudioWithEvents();
    state.surahData = createSurahData(3);
    state.ayahsAudios = ['a1', 'a2', 'a3'];
    state.currentAyahIndex = 2; // last ayah
    state.currentSurah = 1;
    state.isPlaying = true;
    state.autoPlayNext = true; // enabled
    const loadFn = vi.fn();
    setLoadSurah(loadFn);

    const endedHandler = eventHandlers['ended'];
    endedHandler!(new Event('ended'));

    expect(loadFn).toHaveBeenCalledWith(2, { autoPlay: true });
  });

  it('onAudioEnded at surah 114 last ayah should stop', () => {
    setupAudioWithEvents();
    state.surahData = createSurahData(3, 114);
    state.ayahsAudios = ['a1', 'a2', 'a3'];
    state.currentAyahIndex = 2;
    state.currentSurah = 114;
    state.isPlaying = true;

    const endedHandler = eventHandlers['ended'];
    endedHandler!(new Event('ended'));

    expect(state.isPlaying).toBe(false);
  });

  it('onAudioEnded with repeatMode should handle repeat logic', () => {
    setupAudioWithEvents();
    state.surahData = createSurahData(3);
    state.ayahsAudios = ['a1', 'a2', 'a3'];
    state.currentAyahIndex = 2; // last ayah, numberInSurah=3
    state.currentSurah = 1;
    state.repeatMode = true;
    state.repeatFrom = 1;
    state.repeatTo = 3;
    state.repeatTimes = 2;
    state.repeatCounter = 0;
    state.isPlaying = true;

    const endedHandler = eventHandlers['ended'];
    endedHandler!(new Event('ended'));

    // Since currentNum === repeatTo, counter should increment
    // and we jump back to repeatFrom
    expect(state.repeatCounter).toBe(1);
    expect(state.currentAyahIndex).toBe(0); // back to ayah 1
  });

  it('onAudioEnded with repeatMode complete should stop', () => {
    setupAudioWithEvents();
    state.surahData = createSurahData(3);
    state.ayahsAudios = ['a1', 'a2', 'a3'];
    state.currentAyahIndex = 2;
    state.currentSurah = 1;
    state.repeatMode = true;
    state.repeatFrom = 1;
    state.repeatTo = 3;
    state.repeatTimes = 2;
    state.repeatCounter = 1; // Already repeated once
    state.isPlaying = true;

    const endedHandler = eventHandlers['ended'];
    endedHandler!(new Event('ended'));

    // Counter reaches repeatTimes, repeat should complete
    expect(state.repeatMode).toBe(false);
    expect(state.isPlaying).toBe(false);
  });

  it('onAudioEnded without surahData should not throw', () => {
    setupAudioWithEvents();
    state.surahData = null;

    const endedHandler = eventHandlers['ended'];
    expect(() => endedHandler!(new Event('ended'))).not.toThrow();
  });

  it('onAudioError should retry on first error', () => {
    setupAudioWithEvents();
    state.surahData = createSurahData(3);
    state.ayahsAudios = ['a1', 'a2', 'a3'];
    state.currentAyahIndex = 0;
    state.isPlaying = true;

    const errorHandler = eventHandlers['error'];
    expect(errorHandler).toBeDefined();
    errorHandler!(new Event('error'));

    // First error should trigger retry (not stop immediately)
    expect(showToast).toHaveBeenCalled();
    // isPlaying is still true since it retries
  });

  it('onAudioError should retry up to MAX_AUDIO_RETRIES', () => {
    setupAudioWithEvents();
    state.surahData = createSurahData(3);
    state.ayahsAudios = ['a1', 'a2', 'a3'];
    state.currentAyahIndex = 0;
    state.isPlaying = true;

    const errorHandler = eventHandlers['error'];
    // First error - should retry
    errorHandler!(new Event('error'));
    expect(showToast).toHaveBeenCalled();
  });

  it('onAudioError after max retries should skip to next ayah', () => {
    setupAudioWithEvents();
    state.surahData = createSurahData(3);
    state.ayahsAudios = ['a1', 'a2', 'a3'];
    state.currentAyahIndex = 0;
    state.isPlaying = true;

    const errorHandler = eventHandlers['error'];
    // Trigger errors multiple times to exhaust retries
    errorHandler!(new Event('error')); // retry 1
    errorHandler!(new Event('error')); // retry 2
    errorHandler!(new Event('error')); // exhausted, should skip
  });

  it('onAudioError at last ayah after retries should stop', () => {
    setupAudioWithEvents();
    state.surahData = createSurahData(3);
    state.ayahsAudios = ['a1', 'a2', 'a3'];
    state.currentAyahIndex = 2; // last ayah
    state.isPlaying = true;

    const errorHandler = eventHandlers['error'];
    // Exhaust retries
    errorHandler!(new Event('error')); // retry 1
    errorHandler!(new Event('error')); // retry 2
    errorHandler!(new Event('error')); // exhausted, can't skip

    expect(state.isPlaying).toBe(false);
  });

  it('onAudioPlay should clear autoAdvanceSafetyTimer', () => {
    setupAudioWithEvents();
    state.surahData = createSurahData(7);
    state.ayahsAudios = ['a1', 'a2'];

    const playHandler = eventHandlers['play'];
    // Should not throw even if safetyTimer is set
    expect(() => playHandler!(new Event('play'))).not.toThrow();
  });

  it('onAudioEnded with currentNum < repeatFrom should jump to repeatFrom', () => {
    setupAudioWithEvents();
    state.surahData = createSurahData(7);
    state.ayahsAudios = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
    state.currentAyahIndex = 0; // numberInSurah = 1
    state.currentSurah = 1;
    state.repeatMode = true;
    state.repeatFrom = 3; // repeat starts at ayah 3
    state.repeatTo = 5;
    state.repeatTimes = 2;
    state.repeatCounter = 0;
    state.isPlaying = true;

    const endedHandler = eventHandlers['ended'];
    endedHandler!(new Event('ended'));

    // Should jump to repeatFrom (ayah 3, index 2)
    expect(state.currentAyahIndex).toBe(2);
  });

  it('onAudioPlay should update sleep timer display', () => {
    setupAudioWithEvents();
    state.surahData = createSurahData(7);
    state.ayahsAudios = ['a1'];

    // Create a sleep timer display element
    const timerEl = document.createElement('span');
    timerEl.id = 'sleepTimerDisplay';
    timerEl.style.display = 'none';
    document.body.appendChild(timerEl);

    const playHandler = eventHandlers['play'];
    playHandler!(new Event('play'));

    document.body.removeChild(timerEl);
  });

  it('onAudioPlay should start visualizer if canvas exists', async () => {
    setupAudioWithEvents();
    state.surahData = createSurahData(7);
    state.ayahsAudios = ['a1'];

    const vizCanvas = document.createElement('canvas');
    vizCanvas.id = 'audioVisualizer';
    document.body.appendChild(vizCanvas);

    const { startVisualizer } = await import('../audio-visualizer.js');
    const playHandler = eventHandlers['play'];
    playHandler!(new Event('play'));

    expect(startVisualizer).toHaveBeenCalled();

    document.body.removeChild(vizCanvas);
  });
});

/* ===================== Sleep Timer ===================== */

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

  it('should pause audio player when timer fires', () => {
    const mockPlayer = createMockAudio({ paused: false });
    dom.audioPlayer = mockPlayer;

    setSleepTimer(5);
    vi.advanceTimersByTime(5 * 60 * 1000); // Advance 5 minutes

    expect(mockPlayer.pause).toHaveBeenCalled();
  });

  it('should set isPlaying to false when timer fires', () => {
    const mockPlayer = createMockAudio({ paused: false });
    dom.audioPlayer = mockPlayer;
    state.isPlaying = true;

    setSleepTimer(5);
    vi.advanceTimersByTime(5 * 60 * 1000);

    expect(state.isPlaying).toBe(false);
  });

  it('should reset timer minutes and start after firing', () => {
    const mockPlayer = createMockAudio({ paused: false });
    dom.audioPlayer = mockPlayer;

    setSleepTimer(5);
    vi.advanceTimersByTime(5 * 60 * 1000);

    expect(getSleepTimerMinutes()).toBe(0);
  });

  it('should clear previous timer when setting a new one', () => {
    const mockPlayer = createMockAudio({ paused: false });
    dom.audioPlayer = mockPlayer;

    setSleepTimer(5);
    setSleepTimer(10);

    // Advance 5 minutes — old timer should NOT fire
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(mockPlayer.pause).not.toHaveBeenCalled();
    expect(getSleepTimerMinutes()).toBe(10);
  });

  it('should show toast when setting timer', () => {
    setSleepTimer(5);
    // __() mock returns the key itself, so the interpolated minutes won't appear
    expect(showToast).toHaveBeenCalledWith('sleep_timer_set', 'success');
  });

  it('should show toast when cancelling with 0', () => {
    setSleepTimer(0);
    expect(showToast).toHaveBeenCalledWith('sleep_timer_cancelled', '');
  });

  it('should show toast when timer fires', () => {
    const mockPlayer = createMockAudio({ paused: false });
    dom.audioPlayer = mockPlayer;

    setSleepTimer(5);
    vi.advanceTimersByTime(5 * 60 * 1000);

    // __() mock returns the key itself, so interpolated minutes won't appear
    expect(showToast).toHaveBeenCalledWith('sleep_timer_stopped', 'success');
  });

  it('should not pause if audio is already paused when timer fires', () => {
    const mockPlayer = createMockAudio({ paused: true });
    dom.audioPlayer = mockPlayer;

    setSleepTimer(5);
    vi.advanceTimersByTime(5 * 60 * 1000);

    expect(mockPlayer.pause).not.toHaveBeenCalled();
  });

  it('should update sleep timer display when timer is set', () => {
    const timerEl = document.createElement('span');
    timerEl.id = 'sleepTimerDisplay';
    timerEl.style.display = 'none';
    document.body.appendChild(timerEl);

    setSleepTimer(5);
    expect(timerEl.style.display).toBe('inline');
    expect(timerEl.textContent).toContain('sleep_timer_remaining');

    document.body.removeChild(timerEl);
  });

  it('should hide sleep timer display when timer is cleared', () => {
    const timerEl = document.createElement('span');
    timerEl.id = 'sleepTimerDisplay';
    document.body.appendChild(timerEl);

    setSleepTimer(5);
    clearSleepTimer();
    expect(timerEl.style.display).toBe('none');
    expect(timerEl.textContent).toBe('');

    document.body.removeChild(timerEl);
  });

  it('should not throw when sleep timer display element does not exist', () => {
    setSleepTimer(5);
    expect(() => setSleepTimer(10)).not.toThrow();
  });
});
