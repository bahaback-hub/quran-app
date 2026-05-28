import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state } from '../state.js';
import { dom } from '../dom.js';
import { storage } from '../storage.js';

// Mock localStorage
const store = {};
beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  globalThis.localStorage = {
    getItem: (key) => store[key] === undefined ? null : store[key],
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };
  state.fontSize = 28;
  state.nightMode = false;
  state.azanEnabled = true;
  state.azanFajrEnabled = true;
  state.autoSave = true;
  state.currentReciter = 'ar.alafasy';
  state.currentTafsirEdition = 'ar-tafsir-muyassar';
  state.city = 'مكة';
  state.country = 'SA';
  state.method = '4';
  state.translationEnabled = false;
  state.currentTranslation = null;
  state.barCollapsed = false;
});

function applyNightMode(enabled) {
  state.nightMode = enabled;
  if (enabled) document.body.classList.add('night-mode');
  else document.body.classList.remove('night-mode');
}

function toggleNightMode() { applyNightMode(!state.nightMode); }

function applyFontSize(size) {
  state.fontSize = size;
  const container = document.querySelector('.ayahs-container');
  if (container) container.style.fontSize = size + 'px';
}

describe('applyNightMode', () => {
  it('should enable night mode', () => {
    applyNightMode(true);
    expect(state.nightMode).toBe(true);
    expect(document.body.classList.contains('night-mode')).toBe(true);
  });

  it('should disable night mode', () => {
    document.body.classList.add('night-mode');
    applyNightMode(false);
    expect(state.nightMode).toBe(false);
    expect(document.body.classList.contains('night-mode')).toBe(false);
  });
});

describe('toggleNightMode', () => {
  it('should toggle from off to on', () => {
    state.nightMode = false;
    toggleNightMode();
    expect(state.nightMode).toBe(true);
  });

  it('should toggle from on to off', () => {
    state.nightMode = true;
    document.body.classList.add('night-mode');
    toggleNightMode();
    expect(state.nightMode).toBe(false);
  });
});

describe('applyFontSize', () => {
  it('should update state.fontSize', () => {
    applyFontSize(36);
    expect(state.fontSize).toBe(36);
  });

  it('should update container font size', () => {
    const container = document.createElement('div');
    container.className = 'ayahs-container';
    document.body.appendChild(container);
    applyFontSize(32);
    expect(container.style.fontSize).toBe('32px');
    document.body.removeChild(container);
  });

  it('should handle missing container gracefully', () => {
    expect(() => applyFontSize(28)).not.toThrow();
  });
});
