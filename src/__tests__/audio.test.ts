import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../state.js';
import { dom } from '../dom.js';
import { toggleHifdh, toggleRepeat } from '../audio.js';

// Mock scrollIntoView for jsdom
Element.prototype.scrollIntoView = function () {};

describe('toggleHifdh', () => {
  beforeEach(() => {
    state.hifdhMode = false;
    state.currentAyahIndex = 0;
    state.surahData = null;
    dom.hifdhBtn = document.createElement('button');
    document.body.innerHTML = '<div class="ayah" data-index="0">test</div>';
  });

  it('should enable hifdh mode', () => {
    toggleHifdh();
    expect(state.hifdhMode).toBe(true);
    expect(dom.hifdhBtn!.classList.contains('active')).toBe(true);
  });

  it('should disable hifdh mode', () => {
    toggleHifdh();
    toggleHifdh();
    expect(state.hifdhMode).toBe(false);
    expect(dom.hifdhBtn!.classList.contains('active')).toBe(false);
  });

  it('should add hifdh-mode class to ayahs', () => {
    toggleHifdh();
    document.querySelectorAll('.ayah').forEach((el) => {
      expect(el.classList.contains('hifdh-mode')).toBe(true);
    });
  });

  it('should work without hifdhBtn', () => {
    dom.hifdhBtn = null;
    expect(() => toggleHifdh()).not.toThrow();
  });
});

describe('toggleRepeat', () => {
  beforeEach(() => {
    state.repeatMode = false;
    state.repeatCounter = 0;
    dom.repeatBtn = document.createElement('button');
    dom.repeatControls = document.createElement('div');
  });

  it('should enable repeat mode', () => {
    toggleRepeat();
    expect(state.repeatMode).toBe(true);
    expect(dom.repeatBtn!.classList.contains('active')).toBe(true);
    expect(dom.repeatControls!.style.display).toBe('flex');
  });

  it('should disable repeat mode', () => {
    toggleRepeat();
    toggleRepeat();
    expect(state.repeatMode).toBe(false);
    expect(dom.repeatBtn!.classList.contains('active')).toBe(false);
    expect(dom.repeatControls!.style.display).toBe('none');
  });

  it('should reset repeat counter on toggle', () => {
    state.repeatCounter = 5;
    toggleRepeat();
    expect(state.repeatCounter).toBe(0);
  });

  it('should work without repeatControls', () => {
    dom.repeatControls = null;
    expect(() => toggleRepeat()).not.toThrow();
  });
});
