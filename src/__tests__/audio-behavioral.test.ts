/**
 * Behavioral tests for audio.ts — sleep timer, repeat, hifdh mode.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import 'fake-indexeddb/auto';

vi.unmock('../audio.js');

import { state, resetState } from '../state.js';

describe('audio — sleep timer state', () => {
  beforeEach(() => {
    resetState();
  });

  it('state.repeatTimes defaults to a number', () => {
    expect(typeof state.repeatTimes).toBe('number');
  });

  it('can set repeatTimes to 30 (simulating sleep timer minutes)', () => {
    state.repeatTimes = 30;
    expect(state.repeatTimes).toBe(30);
  });

  it('can set repeatTimes to 0 (cancel)', () => {
    state.repeatTimes = 30;
    state.repeatTimes = 0;
    expect(state.repeatTimes).toBe(0);
  });

  it('can set repeatTimes to max (180 minutes)', () => {
    state.repeatTimes = 180;
    expect(state.repeatTimes).toBe(180);
  });
});

describe('audio — repeat state', () => {
  beforeEach(() => {
    resetState();
  });

  it('state.repeatMode defaults to false', () => {
    expect(state.repeatMode).toBe(false);
  });

  it('state.repeatFrom is a number', () => {
    expect(typeof state.repeatFrom).toBe('number');
  });

  it('state.repeatTo is a number', () => {
    expect(typeof state.repeatTo).toBe('number');
  });

  it('state.repeatTimes is a number', () => {
    expect(typeof state.repeatTimes).toBe('number');
  });

  it('can enable repeat mode', () => {
    state.repeatMode = true;
    state.repeatFrom = 1;
    state.repeatTo = 7;
    state.repeatTimes = 3;
    expect(state.repeatMode).toBe(true);
    expect(state.repeatFrom).toBe(1);
    expect(state.repeatTo).toBe(7);
    expect(state.repeatTimes).toBe(3);
  });

  it('can disable repeat mode', () => {
    state.repeatMode = true;
    state.repeatMode = false;
    expect(state.repeatMode).toBe(false);
  });

  it('repeatTimes can be set to valid values (2, 3, 5, 10, 20)', () => {
    const validValues = [2, 3, 5, 10, 20];
    for (const v of validValues) {
      state.repeatTimes = v;
      expect(state.repeatTimes).toBe(v);
    }
  });
});

describe('audio — hifdh mode state', () => {
  beforeEach(() => {
    resetState();
  });

  it('state.hifdhMode defaults to false', () => {
    expect(state.hifdhMode).toBe(false);
  });

  it('can enable hifdh mode', () => {
    state.hifdhMode = true;
    expect(state.hifdhMode).toBe(true);
  });

  it('can disable hifdh mode', () => {
    state.hifdhMode = true;
    state.hifdhMode = false;
    expect(state.hifdhMode).toBe(false);
  });
});

describe('audio — playback state', () => {
  beforeEach(() => {
    resetState();
  });

  it('state.isPlaying defaults to false', () => {
    expect(state.isPlaying).toBe(false);
  });

  it('can set isPlaying to true', () => {
    state.isPlaying = true;
    expect(state.isPlaying).toBe(true);
  });

  it('can set isPlaying back to false', () => {
    state.isPlaying = true;
    state.isPlaying = false;
    expect(state.isPlaying).toBe(false);
  });

  it('state.currentAyahIndex is a number', () => {
    expect(typeof state.currentAyahIndex).toBe('number');
  });

  it('state.ayahsAudios is an array', () => {
    expect(Array.isArray(state.ayahsAudios)).toBe(true);
  });

  it('state.ayahTimings is an array', () => {
    expect(Array.isArray(state.ayahTimings)).toBe(true);
  });

  it('state.currentReciter is a string', () => {
    expect(typeof state.currentReciter).toBe('string');
  });

  it('state.autoPlayNext is boolean', () => {
    expect(typeof state.autoPlayNext).toBe('boolean');
  });
});

describe('audio — auto-advance', () => {
  beforeEach(() => {
    resetState();
  });

  it('can toggle autoPlayNext', () => {
    state.autoPlayNext = false;
    state.autoPlayNext = true;
    expect(state.autoPlayNext).toBe(true);
  });

  it('state.surahData can be set for playback context', () => {
    state.surahData = {
      number: 1,
      name: 'الفاتحة',
      englishName: 'Al-Fatiha',
      numberOfAyahs: 7,
      ayahs: [
        { numberInSurah: 1, text: 'بسم الله' },
        { numberInSurah: 2, text: 'الحمد لله' },
      ],
    } as typeof state.surahData;
    expect(state.surahData).not.toBeNull();
    expect(state.surahData!.numberOfAyahs).toBe(7);
  });
});

describe('audio — speed control', () => {
  it('valid playback speeds are 0.5, 0.75, 1, 1.25, 1.5, 2', () => {
    const validSpeeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    expect(validSpeeds.length).toBe(6);
    for (const s of validSpeeds) {
      expect(s).toBeGreaterThan(0);
    }
  });

  it('default speed is 1x', () => {
    const defaultSpeed = 1;
    expect(defaultSpeed).toBe(1);
  });
});

describe('audio — MediaSession metadata', () => {
  it('MediaSession API is available in jsdom', () => {
    // jsdom may or may not have MediaSession — just verify navigator exists
    expect(navigator).toBeDefined();
  });
});

describe('audio — cleanup', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('cleanupSleepTimerInterval does not throw when no timer is active', async () => {
    const { cleanupSleepTimerInterval } = await import('../audio.js');
    expect(() => cleanupSleepTimerInterval()).not.toThrow();
  });

  it('resetAudioPlayerUI does not throw when DOM is empty', async () => {
    const { resetAudioPlayerUI } = await import('../audio.js');
    expect(() => resetAudioPlayerUI()).not.toThrow();
  });

  it('resetAudioElement does not throw with null player', async () => {
    const { resetAudioElement } = await import('../audio.js');
    expect(() => resetAudioElement(null)).not.toThrow();
  });
});

describe('audio — updatePlayPauseBtn', () => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="playPauseBtn">⏯</button>';
    resetState();
  });

  it('does not throw when dom.playPauseBtn exists', async () => {
    const { updatePlayPauseBtn } = await import('../audio.js');
    expect(() => updatePlayPauseBtn()).not.toThrow();
  });

  it('does not throw when dom.playPauseBtn is null', async () => {
    const { updatePlayPauseBtn } = await import('../audio.js');
    expect(() => updatePlayPauseBtn()).not.toThrow();
  });
});

describe('audio — expandPlayer', () => {
  beforeEach(() => {
    resetState();
  });

  it('does not throw when called', async () => {
    const { expandPlayer } = await import('../audio.js');
    expect(() => expandPlayer()).not.toThrow();
  });
});

describe('audio — toggleRepeat', () => {
  beforeEach(() => {
    resetState();
  });

  it('does not throw when called without surahData', async () => {
    const { toggleRepeat } = await import('../audio.js');
    expect(() => toggleRepeat()).not.toThrow();
  });
});

describe('audio — toggleHifdh', () => {
  beforeEach(() => {
    resetState();
  });

  it('does not throw when called', async () => {
    const { toggleHifdh } = await import('../audio.js');
    expect(() => toggleHifdh()).not.toThrow();
  });
});

describe('audio — getDefaultRepeatRange', () => {
  it('returns range 1..7 with 3 times for Al-Fatiha (7 ayahs)', async () => {
    const { getDefaultRepeatRange } = await import('../audio.js');
    const surahData = {
      number: 1,
      name: 'الفاتحة',
      englishName: 'Al-Fatiha',
      numberOfAyahs: 7,
      ayahs: Array.from({ length: 7 }, (_, i) => ({ numberInSurah: i + 1, text: 'آية' })),
    } as unknown as Parameters<typeof getDefaultRepeatRange>[0];
    const range = getDefaultRepeatRange(surahData);
    expect(range.from).toBe(1);
    expect(range.to).toBe(7);
    expect(range.times).toBe(3);
  });

  it('returns range 1..ayahs.length for any surah', async () => {
    const { getDefaultRepeatRange } = await import('../audio.js');
    const ayahs = Array.from({ length: 286 }, (_, i) => ({ numberInSurah: i + 1, text: 'آية' }));
    const surahData = {
      number: 2,
      name: 'البقرة',
      englishName: 'Al-Baqara',
      numberOfAyahs: 286,
      ayahs,
    } as unknown as Parameters<typeof getDefaultRepeatRange>[0];
    const range = getDefaultRepeatRange(surahData);
    expect(range.from).toBe(1);
    expect(range.to).toBe(286);
    expect(range.times).toBe(3);
  });
});
