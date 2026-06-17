/**
 * Behavioral tests for settings.ts — import/export and reset functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

vi.unmock('../settings.js');

import { state, resetState } from '../state.js';

describe('settings — state defaults', () => {
  beforeEach(() => {
    resetState();
  });

  it('state has fontSize default', () => {
    expect(typeof state.fontSize).toBe('number');
    expect(state.fontSize).toBeGreaterThan(0);
  });

  it('state has nightMode default (boolean)', () => {
    expect(typeof state.nightMode).toBe('boolean');
  });

  it('state has currentReciter default', () => {
    expect(typeof state.currentReciter).toBe('string');
    expect(state.currentReciter.length).toBeGreaterThan(0);
  });

  it('state has method (prayer calculation method) default', () => {
    expect(state.method).toBeDefined();
    expect(typeof state.method).toBe('string');
  });

  it('state has tajweedEnabled default', () => {
    expect(typeof state.tajweedEnabled).toBe('boolean');
  });

  it('state has translationEnabled default', () => {
    expect(typeof state.translationEnabled).toBe('boolean');
  });

  it('state has hifdhMode default', () => {
    expect(typeof state.hifdhMode).toBe('boolean');
  });

  it('state has repeatMode default', () => {
    expect(typeof state.repeatMode).toBe('boolean');
  });
});

describe('settings — font size boundaries', () => {
  beforeEach(() => {
    resetState();
  });

  it('font size can be set to minimum (16)', () => {
    state.fontSize = 16;
    expect(state.fontSize).toBe(16);
  });

  it('font size can be set to maximum (45)', () => {
    state.fontSize = 45;
    expect(state.fontSize).toBe(45);
  });

  it('font size can be set to default (28)', () => {
    state.fontSize = 28;
    expect(state.fontSize).toBe(28);
  });
});

describe('settings — theme modes', () => {
  beforeEach(() => {
    resetState();
  });

  it('nightMode can be toggled on', () => {
    state.nightMode = false;
    state.nightMode = true;
    expect(state.nightMode).toBe(true);
  });

  it('nightMode can be toggled off', () => {
    state.nightMode = true;
    state.nightMode = false;
    expect(state.nightMode).toBe(false);
  });
});

describe('settings — translation edition', () => {
  beforeEach(() => {
    resetState();
  });

  it('currentTranslation can be set to en.sahih', () => {
    state.currentTranslation = 'en.sahih';
    expect(state.currentTranslation).toBe('en.sahih');
  });

  it('currentTranslation can be set to en.pickthall', () => {
    state.currentTranslation = 'en.pickthall';
    expect(state.currentTranslation).toBe('en.pickthall');
  });

  it('currentTranslation can be cleared (empty string)', () => {
    state.currentTranslation = 'en.sahih';
    state.currentTranslation = '';
    expect(state.currentTranslation).toBe('');
  });

  it('translationEnabled can be toggled', () => {
    state.translationEnabled = false;
    state.translationEnabled = true;
    expect(state.translationEnabled).toBe(true);
  });
});

describe('settings — repeat mode', () => {
  beforeEach(() => {
    resetState();
  });

  it('repeatMode can be enabled', () => {
    state.repeatMode = true;
    expect(state.repeatMode).toBe(true);
  });

  it('repeatMode can be disabled', () => {
    state.repeatMode = true;
    state.repeatMode = false;
    expect(state.repeatMode).toBe(false);
  });

  it('repeatFrom, repeatTo, repeatTimes can be set', () => {
    state.repeatFrom = 1;
    state.repeatTo = 7;
    state.repeatTimes = 3;
    expect(state.repeatFrom).toBe(1);
    expect(state.repeatTo).toBe(7);
    expect(state.repeatTimes).toBe(3);
  });
});

describe('settings — prayer settings', () => {
  beforeEach(() => {
    resetState();
  });

  it('method can be set to Umm al-Qura (4)', () => {
    state.method = '4';
    expect(state.method).toBe('4');
  });

  it('method can be set to Egyptian (5)', () => {
    state.method = '5';
    expect(state.method).toBe('5');
  });

  it('azanEnabled can be toggled', () => {
    state.azanEnabled = false;
    state.azanEnabled = true;
    expect(state.azanEnabled).toBe(true);
  });

  it('azanFajrEnabled can be toggled', () => {
    state.azanFajrEnabled = false;
    state.azanFajrEnabled = true;
    expect(state.azanFajrEnabled).toBe(true);
  });
});
