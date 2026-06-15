/**
 * Tests for state.ts — reactive state management system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  state,
  setState,
  subscribe,
  subscribeAll,
  batch,
  resetState,
  clearSubscribers,
  immutablePush,
  immutableSplice,
  immutableFilter,
  immutableMapSet,
  immutableMapDelete,
  createDefaultState,
  type AppState,
  type SurahInfo,
  type FavoriteEntry,
} from '../state.js';

describe('createDefaultState', () => {
  it('should create a state with all default values', () => {
    const defaults = createDefaultState();
    expect(defaults.currentSurah).toBe(1);
    expect(defaults.currentAyahIndex).toBe(0);
    expect(defaults.currentReciter).toBe('ar.alafasy');
    expect(defaults.isPlaying).toBe(false);
    expect(defaults.hifdhMode).toBe(false);
    expect(defaults.repeatMode).toBe(false);
    expect(defaults.fontSize).toBe(28);
    expect(defaults.nightMode).toBe(false);
    expect(defaults.surahCache).toBeInstanceOf(Map);
    expect(defaults.surahCache.size).toBe(0);
    expect(defaults.favorites).toEqual([]);
    expect(defaults.surahList).toEqual([]);
  });

  it('should return a fresh object each time (no shared references)', () => {
    const a = createDefaultState();
    const b = createDefaultState();
    expect(a).not.toBe(b);
    expect(a.surahCache).not.toBe(b.surahCache);
    expect(a.favorites).not.toBe(b.favorites);
  });
});

describe('Proxy reactivity', () => {
  beforeEach(() => {
    resetState();
    clearSubscribers();
  });

  it('should notify subscribers when a property changes', () => {
    const callback = vi.fn();
    subscribe('isPlaying', callback);
    state.isPlaying = true;
    expect(callback).toHaveBeenCalledWith(true, false);
  });

  it('should not notify when value does not change', () => {
    const callback = vi.fn();
    state.isPlaying = false; // default
    subscribe('isPlaying', callback);
    state.isPlaying = false; // same value
    expect(callback).not.toHaveBeenCalled();
  });

  it('should notify with correct types for different state properties', () => {
    const numCallback = vi.fn();
    const strCallback = vi.fn();
    subscribe('currentSurah', numCallback);
    subscribe('currentReciter', strCallback);

    state.currentSurah = 5;
    state.currentReciter = 'ar.abdulbasit';

    expect(numCallback).toHaveBeenCalledWith(5, 1);
    expect(strCallback).toHaveBeenCalledWith('ar.abdulbasit', 'ar.alafasy');
  });
});

describe('subscribe', () => {
  beforeEach(() => {
    resetState();
    clearSubscribers();
  });

  it('should return an unsubscribe function', () => {
    const callback = vi.fn();
    const unsub = subscribe('isPlaying', callback);
    expect(typeof unsub).toBe('function');

    state.isPlaying = true;
    expect(callback).toHaveBeenCalledTimes(1);

    unsub();
    state.isPlaying = false;
    expect(callback).toHaveBeenCalledTimes(1); // Not called after unsubscribe
  });

  it('should support multiple subscribers on the same key', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    subscribe('isPlaying', cb1);
    subscribe('isPlaying', cb2);

    state.isPlaying = true;
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('should isolate subscriber errors', () => {
    const errorCb = vi.fn(() => { throw new Error('test'); });
    const normalCb = vi.fn();
    subscribe('isPlaying', errorCb);
    subscribe('isPlaying', normalCb);

    // Should not throw
    expect(() => { state.isPlaying = true; }).not.toThrow();
    expect(normalCb).toHaveBeenCalled();
  });
});

describe('subscribeAll', () => {
  beforeEach(() => {
    resetState();
    clearSubscribers();
  });

  it('should be notified on any state change', () => {
    const callback = vi.fn();
    subscribeAll(callback);

    state.isPlaying = true;
    state.currentSurah = 5;

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith(true, false, 'isPlaying');
    expect(callback).toHaveBeenCalledWith(5, 1, 'currentSurah');
  });

  it('should return an unsubscribe function', () => {
    const callback = vi.fn();
    const unsub = subscribeAll(callback);

    state.isPlaying = true;
    expect(callback).toHaveBeenCalledTimes(1);

    unsub();
    state.currentSurah = 5;
    expect(callback).toHaveBeenCalledTimes(1); // Not called after unsubscribe
  });
});

describe('setState', () => {
  beforeEach(() => {
    resetState();
    clearSubscribers();
  });

  it('should update multiple properties at once', () => {
    const isPlayingCb = vi.fn();
    const surahCb = vi.fn();
    subscribe('isPlaying', isPlayingCb);
    subscribe('currentSurah', surahCb);

    setState({ isPlaying: true, currentSurah: 5 });

    expect(state.isPlaying).toBe(true);
    expect(state.currentSurah).toBe(5);
    expect(isPlayingCb).toHaveBeenCalledWith(true, false);
    expect(surahCb).toHaveBeenCalledWith(5, 1);
  });

  it('should only notify for properties that are actually set', () => {
    const callback = vi.fn();
    subscribe('isPlaying', callback);

    setState({ currentSurah: 5 }); // isPlaying not changed
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('batch', () => {
  beforeEach(() => {
    resetState();
    clearSubscribers();
  });

  it('should defer notifications until batch completes', () => {
    const callback = vi.fn();
    subscribe('isPlaying', callback);
    subscribe('currentSurah', callback);

    batch(() => {
      state.isPlaying = true;
      state.currentSurah = 5;
      // Callbacks should NOT have been called yet
      expect(callback).not.toHaveBeenCalled();
    });

    // After batch completes, both should be notified
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should preserve the oldest oldValue for each key in a batch', () => {
    const callback = vi.fn();
    subscribe('currentSurah', callback);

    batch(() => {
      state.currentSurah = 2;
      state.currentSurah = 3;
      state.currentSurah = 5;
    });

    // Should notify with oldest oldValue (1) and latest newValue (5)
    expect(callback).toHaveBeenCalledWith(5, 1);
  });

  it('should support nested batches', () => {
    const callback = vi.fn();
    subscribe('currentSurah', callback);

    batch(() => {
      state.currentSurah = 2;
      batch(() => {
        state.currentSurah = 3;
      });
      // Inner batch complete — but outer still active
      expect(callback).not.toHaveBeenCalled();
      state.currentSurah = 5;
    });

    // After outer batch completes
    expect(callback).toHaveBeenCalledWith(5, 1);
  });

  it('should return the function result', () => {
    const result = batch(() => {
      state.currentSurah = 5;
      return 'done';
    });
    expect(result).toBe('done');
  });
});

describe('resetState', () => {
  it('should reset all state to defaults', () => {
    state.currentSurah = 50;
    state.isPlaying = true;
    state.fontSize = 40;

    resetState();

    expect(state.currentSurah).toBe(1);
    expect(state.isPlaying).toBe(false);
    expect(state.fontSize).toBe(28);
  });
});

describe('Immutable helpers', () => {
  beforeEach(() => {
    resetState();
    clearSubscribers();
  });

  describe('immutablePush', () => {
    it('should add items to array immutably', () => {
      const entry: FavoriteEntry = {
        key: '1-1', surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', timestamp: Date.now(),
      };
      immutablePush(state, 'favorites', entry);
      expect(state.favorites).toHaveLength(1);
      expect(state.favorites[0].key).toBe('1-1');
    });

    it('should notify subscribers', () => {
      const callback = vi.fn();
      subscribe('favorites', callback);
      immutablePush(state, 'favorites', {
        key: '1-1', surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', timestamp: Date.now(),
      });
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('immutableSplice', () => {
    it('should remove items from array immutably', () => {
      state.favorites = [
        { key: '1', surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'a', timestamp: 1 },
        { key: '2', surah: 2, surahName: 'البقرة', ayah: 1, text: 'b', timestamp: 2 },
      ];
      immutableSplice(state, 'favorites', 0, 1);
      expect(state.favorites).toHaveLength(1);
      expect(state.favorites[0].key).toBe('2');
    });
  });

  describe('immutableFilter', () => {
    it('should filter items immutably', () => {
      state.favorites = [
        { key: '1', surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'a', timestamp: 1 },
        { key: '2', surah: 2, surahName: 'البقرة', ayah: 1, text: 'b', timestamp: 2 },
      ];
      immutableFilter(state, 'favorites', f => f.surah !== 1);
      expect(state.favorites).toHaveLength(1);
      expect(state.favorites[0].surah).toBe(2);
    });
  });

  describe('immutableMapSet', () => {
    it('should add entry to map immutably', () => {
      const mockSurahData = { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', ayahs: [] };
      immutableMapSet(state, 'surahCache', 1, mockSurahData as any);
      expect(state.surahCache.get(1)).toBe(mockSurahData);
    });
  });

  describe('immutableMapDelete', () => {
    it('should remove entry from map immutably', () => {
      state.surahCache = new Map([[1, { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', ayahs: [] }]]);
      immutableMapDelete(state, 'surahCache', 1);
      expect(state.surahCache.has(1)).toBe(false);
    });
  });
});

describe('SurahCache type safety', () => {
  it('surahCache should be typed as Map<number, SurahData>', () => {
    expect(state.surahCache).toBeInstanceOf(Map);
    // This test verifies the type at compile time
    state.surahCache.set(1, { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', ayahs: [] });
    const cached = state.surahCache.get(1);
    expect(cached).toBeDefined();
    expect(cached!.number).toBe(1);
  });
});
