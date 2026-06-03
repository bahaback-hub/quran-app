import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { state, setState, subscribe, subscribeAll, resetState, clearSubscribers, createDefaultState } from '../state.js';

describe('State Management', () => {
  beforeEach(() => {
    resetState();
    clearSubscribers();
  });

  afterEach(() => {
    clearSubscribers();
  });

  /* ===================== DEFAULTS ===================== */

  describe('createDefaultState', () => {
    it('should create a state with all required properties', () => {
      const defaults = createDefaultState();
      expect(defaults.currentSurah).toBe(1);
      expect(defaults.currentAyahIndex).toBe(0);
      expect(defaults.isPlaying).toBe(false);
      expect(defaults.hifdhMode).toBe(false);
      expect(defaults.fontSize).toBe(28);
      expect(defaults.nightMode).toBe(false);
      expect(defaults.autoSave).toBe(true);
      expect(defaults.azanEnabled).toBe(true);
      expect(defaults.favorites).toEqual([]);
      expect(defaults.surahList).toEqual([]);
      expect(defaults.surahCache).toBeInstanceOf(Map);
      expect(defaults.ayahsAudios).toEqual([]);
      expect(defaults.mushafMode).toBe(false);
      expect(defaults.presentationMode).toBe(false);
    });

    it('should create independent instances (no shared references)', () => {
      const a = createDefaultState();
      const b = createDefaultState();
      expect(a.favorites).not.toBe(b.favorites);
      expect(a.surahList).not.toBe(b.surahList);
      expect(a.surahCache).not.toBe(b.surahCache);
    });
  });

  /* ===================== STATE INSTANCE ===================== */

  describe('state', () => {
    it('should be initialized with default values', () => {
      expect(state.currentSurah).toBe(1);
      expect(state.isPlaying).toBe(false);
    });

    it('should allow direct property assignment (backward compatible)', () => {
      state.currentSurah = 5;
      expect(state.currentSurah).toBe(5);
    });
  });

  /* ===================== setState ===================== */

  describe('setState', () => {
    it('should update multiple properties at once', () => {
      setState({ currentSurah: 2, currentAyahIndex: 10 });
      expect(state.currentSurah).toBe(2);
      expect(state.currentAyahIndex).toBe(10);
    });

    it('should not notify subscribers when value does not change', () => {
      state.currentSurah = 5;
      const callback = vi.fn();
      subscribe('currentSurah', callback);
      setState({ currentSurah: 5 }); // same value
      expect(callback).not.toHaveBeenCalled();
    });

    it('should notify subscribers when value changes', () => {
      const callback = vi.fn();
      subscribe('isPlaying', callback);
      setState({ isPlaying: true });
      expect(callback).toHaveBeenCalledWith(true, false, 'isPlaying');
    });

    it('should handle partial updates without affecting other properties', () => {
      state.currentSurah = 3;
      state.fontSize = 32;
      setState({ isPlaying: true });
      expect(state.currentSurah).toBe(3);
      expect(state.fontSize).toBe(32);
      expect(state.isPlaying).toBe(true);
    });
  });

  /* ===================== subscribe ===================== */

  describe('subscribe', () => {
    it('should call callback when subscribed key changes', () => {
      const callback = vi.fn();
      subscribe('fontSize', callback);
      setState({ fontSize: 36 });
      expect(callback).toHaveBeenCalledWith(36, 28, 'fontSize');
    });

    it('should not call callback for unsubscribed keys', () => {
      const callback = vi.fn();
      subscribe('fontSize', callback);
      setState({ currentSurah: 5 });
      expect(callback).not.toHaveBeenCalled();
    });

    it('should support multiple subscribers for the same key', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      subscribe('isPlaying', cb1);
      subscribe('isPlaying', cb2);
      setState({ isPlaying: true });
      expect(cb1).toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsub = subscribe('isPlaying', callback);
      unsub();
      setState({ isPlaying: true });
      expect(callback).not.toHaveBeenCalled();
    });

    it('should not break when subscriber throws', () => {
      const badCallback = vi.fn(() => { throw new Error('oops'); });
      const goodCallback = vi.fn();
      subscribe('isPlaying', badCallback);
      subscribe('isPlaying', goodCallback);
      setState({ isPlaying: true });
      expect(badCallback).toHaveBeenCalled();
      expect(goodCallback).toHaveBeenCalled();
    });
  });

  /* ===================== subscribeAll ===================== */

  describe('subscribeAll', () => {
    it('should be notified on any state change', () => {
      const callback = vi.fn();
      subscribeAll(callback);
      setState({ currentSurah: 7 });
      setState({ isPlaying: true });
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsub = subscribeAll(callback);
      unsub();
      setState({ currentSurah: 5 });
      expect(callback).not.toHaveBeenCalled();
    });
  });

  /* ===================== resetState ===================== */

  describe('resetState', () => {
    it('should reset all properties to defaults', () => {
      state.currentSurah = 10;
      state.isPlaying = true;
      state.fontSize = 40;
      state.nightMode = true;
      resetState();
      expect(state.currentSurah).toBe(1);
      expect(state.isPlaying).toBe(false);
      expect(state.fontSize).toBe(28);
      expect(state.nightMode).toBe(false);
    });

    it('should notify subscribers about resets', () => {
      state.currentSurah = 10;
      const callback = vi.fn();
      subscribe('currentSurah', callback);
      resetState();
      expect(callback).toHaveBeenCalledWith(1, 10, 'currentSurah');
    });
  });

  /* ===================== clearSubscribers ===================== */

  describe('clearSubscribers', () => {
    it('should remove all subscribers', () => {
      const callback = vi.fn();
      subscribe('isPlaying', callback);
      subscribeAll(callback);
      clearSubscribers();
      setState({ isPlaying: true });
      expect(callback).not.toHaveBeenCalled();
    });
  });

  /* ===================== INTEGRATION ===================== */

  describe('integration', () => {
    it('should work with typical app usage pattern', () => {
      const playCallback = vi.fn();
      const surahCallback = vi.fn();

      subscribe('isPlaying', playCallback);
      subscribe('currentSurah', surahCallback);

      // Load a surah
      setState({ currentSurah: 2, currentAyahIndex: 0, isPlaying: false });
      expect(surahCallback).toHaveBeenCalledWith(2, 1, 'currentSurah');
      expect(playCallback).not.toHaveBeenCalled();

      // Start playing
      setState({ isPlaying: true });
      expect(playCallback).toHaveBeenCalledWith(true, false, 'isPlaying');

      // Cleanup
      resetState();
      expect(state.currentSurah).toBe(1);
      expect(state.isPlaying).toBe(false);
    });

    it('should support unsubscribe during callback (no infinite loop)', () => {
      const callback = vi.fn();
      /** @type {(() => void)|null} */
      let unsub = null;
      unsub = subscribe('isPlaying', () => {
        callback();
        if (unsub) unsub();
      });
      setState({ isPlaying: true });
      expect(callback).toHaveBeenCalledTimes(1);
      // Second change should not trigger callback
      setState({ isPlaying: false });
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
