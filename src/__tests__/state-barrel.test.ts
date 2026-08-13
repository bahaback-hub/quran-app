/**
 * Tests for state.ts barrel module.
 * Ensures all re-exports are accessible.
 */
import { describe, it, expect } from 'vitest';
import {
  state,
  setState,
  batch,
  resetState,
  subscribe,
  subscribeAll,
  createDefaultState,
  installStateDevTools,
  getStateHistory,
  clearStateHistory,
  isDevToolsInstalled,
  immutablePush,
  immutableSplice,
  immutableFilter,
  immutableMapSet,
  immutableMapDelete,
  clearSubscribers,
} from '../state.js';
import type { AppState, SurahInfo, FavoriteEntry } from '../state.js';

describe('state.ts barrel module', () => {
  it('exports state object', () => {
    expect(state).toBeDefined();
    expect(typeof state).toBe('object');
  });

  it('exports setState function', () => {
    expect(typeof setState).toBe('function');
  });

  it('exports batch function', () => {
    expect(typeof batch).toBe('function');
  });

  it('exports resetState function', () => {
    expect(typeof resetState).toBe('function');
  });

  it('exports subscribe function', () => {
    expect(typeof subscribe).toBe('function');
  });

  it('exports subscribeAll function', () => {
    expect(typeof subscribeAll).toBe('function');
  });

  it('exports createDefaultState function', () => {
    expect(typeof createDefaultState).toBe('function');
    const defaults = createDefaultState();
    expect(defaults.currentSurah).toBe(1);
    expect(defaults.isPlaying).toBe(false);
  });

  it('exports installStateDevTools function', () => {
    expect(typeof installStateDevTools).toBe('function');
  });

  it('exports getStateHistory function', () => {
    expect(typeof getStateHistory).toBe('function');
  });

  it('exports clearStateHistory function', () => {
    expect(typeof clearStateHistory).toBe('function');
  });

  it('exports isDevToolsInstalled function', () => {
    expect(typeof isDevToolsInstalled).toBe('function');
  });

  it('exports immutable helpers', () => {
    expect(typeof immutablePush).toBe('function');
    expect(typeof immutableSplice).toBe('function');
    expect(typeof immutableFilter).toBe('function');
    expect(typeof immutableMapSet).toBe('function');
    expect(typeof immutableMapDelete).toBe('function');
  });

  it('exports clearSubscribers function', () => {
    expect(typeof clearSubscribers).toBe('function');
  });

  it('exports types correctly', () => {
    const surah: SurahInfo = {
      number: 1,
      name: 'الفاتحة',
      englishName: 'Al-Fatiha',
      numberOfAyahs: 7,
    };
    expect(surah.number).toBe(1);

    const fav: FavoriteEntry = {
      key: '1:1',
      surah: 1,
      surahName: 'الفاتحة',
      ayah: 1,
      text: 'بسم الله',
      timestamp: Date.now(),
    };
    expect(fav.surah).toBe(1);
  });

  it('state.ts re-exports AppState type', () => {
    const s: AppState = state;
    expect(s).toBe(state);
  });
});
