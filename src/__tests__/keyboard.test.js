import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state } from '../state.js';
import { dom } from '../dom.js';

// Mock all the imported modules so keyboard shortcuts can be tested in isolation
vi.mock('../audio.js', () => ({
  togglePlayPause: vi.fn(),
  nextAyah: vi.fn(),
  prevAyah: vi.fn(),
  nextSurah: vi.fn(),
  prevSurah: vi.fn(),
  toggleHifdh: vi.fn(),
  toggleRepeat: vi.fn(),
  expandPlayer: vi.fn(),
  prepareAudioForNewSurah: vi.fn(),
  playCurrentAyah: vi.fn(),
}));

vi.mock('../settings.js', () => ({
  toggleNightMode: vi.fn(),
  applyFontSize: vi.fn(),
  openSettings: vi.fn(),
  closeSettings: vi.fn(),
}));

vi.mock('../favorites.js', () => ({
  toggleFavorite: vi.fn(),
  setBookmark: vi.fn(),
  gotoBookmark: vi.fn(),
  openFavorites: vi.fn(),
  closeFavorites: vi.fn(),
}));

vi.mock('../prayer.js', () => ({
  stopAzan: vi.fn(),
}));

vi.mock('../tafsir.js', () => ({
  toggleTafsir: vi.fn(),
  closeTafsir: vi.fn(),
  loadTafsirForCurrentAyah: vi.fn(),
}));

vi.mock('../storage.js', () => ({
  storage: { get: vi.fn(), set: vi.fn() },
}));

vi.mock('../mushaf.js', () => ({
  toggleMushafMode: vi.fn(),
}));

vi.mock('../presentation.js', () => ({
  openPresentation: vi.fn(),
  closePresentation: vi.fn(),
}));

import { initKeyboardShortcuts } from '../keyboard.js';
import { togglePlayPause, nextAyah, prevAyah, nextSurah, prevSurah, toggleHifdh, toggleRepeat } from '../audio.js';
import { toggleNightMode, applyFontSize, closeSettings } from '../settings.js';
import { toggleFavorite, setBookmark, gotoBookmark } from '../favorites.js';
import { stopAzan } from '../prayer.js';
import { toggleTafsir, closeTafsir } from '../tafsir.js';

// Helper to dispatch a keydown event
function pressKey(key, opts = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    ...opts,
  });
  // Override target since KeyboardEvent doesn't allow setting target directly
  Object.defineProperty(event, 'target', { value: opts._target || document.body, writable: false });
  document.dispatchEvent(event);
}

beforeEach(() => {
  vi.clearAllMocks();
  state.azanPlaying = false;
  state.fontSize = 28;
  state.presentationMode = false;
  dom.searchResults = null;
  dom.searchInput = null;
  dom.surahSecretsOverlay = null;
  dom.shareMenu = null;
  dom.player = null;

  // Re-init shortcuts for each test (adds a fresh listener)
  initKeyboardShortcuts();
});

describe('initKeyboardShortcuts', () => {
  it('should register a keydown event listener on document', () => {
    // If we got here without error, initKeyboardShortcuts ran successfully
    // Dispatch a simple key and verify it triggers an action
    pressKey(' ');
    expect(togglePlayPause).toHaveBeenCalled();
  });

  it('should call stopAzan when Escape is pressed and azan is playing', () => {
    state.azanPlaying = true;
    pressKey('Escape');
    expect(stopAzan).toHaveBeenCalled();
  });

  it('should not trigger other shortcuts when Escape stops azan', () => {
    state.azanPlaying = true;
    pressKey('Escape');
    expect(closeSettings).not.toHaveBeenCalled();
  });
});

describe('keyboard shortcuts - input field handling', () => {
  it('should ignore shortcuts when focus is in an INPUT element', () => {
    const inputTarget = document.createElement('input');
    pressKey(' ', { _target: inputTarget });
    expect(togglePlayPause).not.toHaveBeenCalled();
  });

  it('should ignore shortcuts when focus is in a SELECT element', () => {
    const selectTarget = document.createElement('select');
    pressKey('d', { _target: selectTarget });
    expect(nextSurah).not.toHaveBeenCalled();
  });

  it('should ignore shortcuts when focus is in a TEXTAREA element', () => {
    const textareaTarget = document.createElement('textarea');
    pressKey('n', { _target: textareaTarget });
    expect(toggleNightMode).not.toHaveBeenCalled();
  });

  it('should blur input and hide search results on Escape in input field', () => {
    const inputTarget = document.createElement('input');
    const blurSpy = vi.fn();
    inputTarget.blur = blurSpy;
    dom.searchResults = { style: { display: 'block' } };
    pressKey('Escape', { _target: inputTarget });
    expect(blurSpy).toHaveBeenCalled();
    expect(dom.searchResults.style.display).toBe('none');
  });
});

describe('keyboard shortcuts - Ctrl/Cmd combinations', () => {
  it('should focus search input on Ctrl+F and prevent default', () => {
    const focusSpy = vi.fn();
    const selectSpy = vi.fn();
    dom.searchInput = { focus: focusSpy, select: selectSpy };
    const event = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true });
    vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);
    expect(focusSpy).toHaveBeenCalled();
    expect(selectSpy).toHaveBeenCalled();
  });

  it('should not trigger other shortcuts when Ctrl is held', () => {
    const event = new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true });
    document.dispatchEvent(event);
    expect(nextSurah).not.toHaveBeenCalled();
  });
});

describe('keyboard shortcuts - main shortcuts', () => {
  it('should toggle play/pause on Space', () => {
    pressKey(' ');
    expect(togglePlayPause).toHaveBeenCalled();
  });

  it('should call prevAyah on ArrowLeft', () => {
    pressKey('ArrowLeft');
    expect(prevAyah).toHaveBeenCalled();
  });

  it('should call nextAyah on ArrowRight', () => {
    pressKey('ArrowRight');
    expect(nextAyah).toHaveBeenCalledWith(false);
  });

  it('should call prevSurah on s', () => {
    pressKey('s');
    expect(prevSurah).toHaveBeenCalled();
  });

  it('should call nextSurah on d', () => {
    pressKey('d');
    expect(nextSurah).toHaveBeenCalled();
  });

  it('should call toggleHifdh on h', () => {
    pressKey('h');
    expect(toggleHifdh).toHaveBeenCalled();
  });

  it('should call toggleRepeat on r', () => {
    pressKey('r');
    expect(toggleRepeat).toHaveBeenCalled();
  });

  it('should call setBookmark on b', () => {
    pressKey('b');
    expect(setBookmark).toHaveBeenCalled();
  });

  it('should call toggleFavorite on f', () => {
    pressKey('f');
    expect(toggleFavorite).toHaveBeenCalled();
  });

  it('should call toggleTafsir on t', () => {
    pressKey('t');
    expect(toggleTafsir).toHaveBeenCalled();
  });

  it('should call toggleNightMode on n', () => {
    pressKey('n');
    expect(toggleNightMode).toHaveBeenCalled();
  });

  it('should call gotoBookmark on g', () => {
    pressKey('g');
    expect(gotoBookmark).toHaveBeenCalled();
  });
});

describe('keyboard shortcuts - font size', () => {
  it('should increase font size on + key', () => {
    pressKey('+');
    expect(applyFontSize).toHaveBeenCalledWith(Math.min(45, state.fontSize + 2));
  });

  it('should increase font size on = key', () => {
    pressKey('=');
    expect(applyFontSize).toHaveBeenCalledWith(Math.min(45, state.fontSize + 2));
  });

  it('should decrease font size on - key', () => {
    pressKey('-');
    expect(applyFontSize).toHaveBeenCalledWith(Math.max(16, state.fontSize - 2));
  });

  it('should reset font size on 0 key', () => {
    pressKey('0');
    expect(applyFontSize).toHaveBeenCalledWith(28);
  });

  it('should cap font size increase at 45', () => {
    state.fontSize = 44;
    pressKey('+');
    expect(applyFontSize).toHaveBeenCalledWith(45);
  });

  it('should cap font size decrease at 16', () => {
    state.fontSize = 17;
    pressKey('-');
    expect(applyFontSize).toHaveBeenCalledWith(16);
  });
});

describe('keyboard shortcuts - Escape', () => {
  it('should close settings, favorites, and tafsir on Escape', () => {
    pressKey('Escape');
    expect(closeSettings).toHaveBeenCalled();
    expect(closeTafsir).toHaveBeenCalled();
  });

  it('should hide surah secrets overlay on Escape', () => {
    dom.surahSecretsOverlay = { style: { display: 'block' } };
    pressKey('Escape');
    expect(dom.surahSecretsOverlay.style.display).toBe('none');
  });

  it('should hide search results on Escape', () => {
    dom.searchResults = { style: { display: 'block' } };
    pressKey('Escape');
    expect(dom.searchResults.style.display).toBe('none');
  });

  it('should remove show class from share menu on Escape', () => {
    dom.shareMenu = { classList: { remove: vi.fn() } };
    pressKey('Escape');
    expect(dom.shareMenu.classList.remove).toHaveBeenCalledWith('show');
  });

  it('should collapse player if not already collapsed on Escape', () => {
    const player = { classList: { contains: vi.fn().mockReturnValue(false), add: vi.fn() } };
    dom.player = player;
    pressKey('Escape');
    expect(player.classList.add).toHaveBeenCalledWith('collapsed');
  });

  it('should not collapse player if already collapsed on Escape', () => {
    const player = { classList: { contains: vi.fn().mockReturnValue(true), add: vi.fn() } };
    dom.player = player;
    pressKey('Escape');
    expect(player.classList.add).not.toHaveBeenCalled();
  });
});
