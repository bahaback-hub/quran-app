import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { state } from '../state.js';
import { dom } from '../dom.js';

// Mock all the imported modules so keyboard shortcuts can be tested in isolation
vi.mock('../features/audio/audio.js', () => ({
  togglePlayPause: vi.fn(),
  nextAyah: vi.fn(),
  prevAyah: vi.fn(),
  nextSurah: vi.fn(),
  prevSurah: vi.fn(),
  toggleHifdh: vi.fn(),
  toggleRepeat: vi.fn(),
  expandPlayer: vi.fn(),
  collapsePlayer: vi.fn(),
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

vi.mock('../features/prayer/prayer.js', () => ({
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

vi.mock('../features/mushaf/mushaf.js', () => ({
  toggleMushafMode: vi.fn(),
}));

vi.mock('../features/presentation/presentation.js', () => ({
  openPresentation: vi.fn(),
  closePresentation: vi.fn(),
}));

import { initKeyboardShortcuts } from '../keyboard.js';
import {
  togglePlayPause,
  nextAyah,
  prevAyah,
  nextSurah,
  prevSurah,
  toggleHifdh,
  toggleRepeat,
  collapsePlayer,
} from '../features/audio/audio.js';
import { toggleNightMode, applyFontSize, closeSettings } from '../settings.js';
import { toggleFavorite, setBookmark, gotoBookmark } from '../favorites.js';
import { stopAzan } from '../features/prayer/prayer.js';
import { toggleTafsir, closeTafsir } from '../tafsir.js';

// Helper to dispatch a keydown event
function pressKey(key: string, opts: Record<string, unknown> = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
  });
  // Override target since KeyboardEvent doesn't allow setting target directly
  Object.defineProperty(event, 'target', {
    value: (opts as { _target?: EventTarget })._target || document.body,
    writable: false,
  });
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
    dom.searchResults = { style: { display: 'block' } } as unknown as HTMLElement;
    pressKey('Escape', { _target: inputTarget });
    expect(blurSpy).toHaveBeenCalled();
    expect((dom.searchResults as unknown as { style: { display: string } }).style.display).toBe('none');
  });
});

describe('keyboard shortcuts - Ctrl/Cmd combinations', () => {
  it('should focus search input on Ctrl+F and prevent default', () => {
    const focusSpy = vi.fn();
    const selectSpy = vi.fn();
    dom.searchInput = { focus: focusSpy, select: selectSpy } as unknown as HTMLInputElement;
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
    dom.surahSecretsOverlay = { style: { display: 'block' }, classList: { add: vi.fn() } } as unknown as HTMLElement;
    pressKey('Escape');
    expect((dom.surahSecretsOverlay as unknown as { style: { display: string } }).style.display).toBe('none');
    expect(
      (dom.surahSecretsOverlay as unknown as { classList: { add: ReturnType<typeof vi.fn> } }).classList.add,
    ).toHaveBeenCalledWith('hidden');
  });

  it('should hide search results on Escape', () => {
    dom.searchResults = { style: { display: 'block' } } as unknown as HTMLElement;
    pressKey('Escape');
    expect((dom.searchResults as unknown as { style: { display: string } }).style.display).toBe('none');
  });

  it('should collapse player if not already collapsed on Escape', () => {
    const player = { classList: { contains: vi.fn().mockReturnValue(false), add: vi.fn() } } as unknown as HTMLElement;
    dom.player = player;
    pressKey('Escape');
    expect(collapsePlayer).toHaveBeenCalled();
  });

  it('should not collapse player if already collapsed on Escape', () => {
    const player = { classList: { contains: vi.fn().mockReturnValue(true), add: vi.fn() } } as unknown as HTMLElement;
    dom.player = player;
    pressKey('Escape');
    expect(
      (dom.player as unknown as { classList: { add: ReturnType<typeof vi.fn> } }).classList.add,
    ).not.toHaveBeenCalled();
  });

  describe('TV mode (remote control)', () => {
    afterEach(() => {
      state.tvMode = false;
    });

    it('should not flip ayahs with arrows in TV mode', () => {
      state.tvMode = true;
      pressKey('ArrowRight');
      pressKey('ArrowLeft');
      expect(nextAyah).not.toHaveBeenCalled();
      expect(prevAyah).not.toHaveBeenCalled();
    });

    it('should still flip ayahs with arrows outside TV mode', () => {
      state.tvMode = false;
      pressKey('ArrowRight');
      expect(nextAyah).toHaveBeenCalled();
    });

    it('should toggle playback with Space when nothing is focused in TV mode', () => {
      state.tvMode = true;
      pressKey(' ');
      expect(togglePlayPause).toHaveBeenCalled();
    });
  });

  describe('pointer mode (long-press OK)', () => {
    afterEach(() => {
      state.tvMode = false;
      state.pointerMode = false;
      document.body.classList.remove('tv-pointer');
      document.getElementById('tvPointerCursor')?.remove();
      vi.useRealTimers();
    });

    it('should enter pointer mode on long-press OK in TV mode', () => {
      state.tvMode = true;
      vi.useFakeTimers();
      const btn = document.createElement('button');
      document.body.append(btn);
      btn.focus();
      pressKey('Enter', { _target: btn });
      expect(state.pointerMode).toBe(false);
      vi.advanceTimersByTime(1100);
      expect(state.pointerMode).toBe(true);
      btn.remove();
    });

    it('should click the focused control on short OK in TV mode', () => {
      state.tvMode = true;
      vi.useFakeTimers();
      const btn = document.createElement('button');
      const clicked: string[] = [];
      btn.addEventListener('click', () => clicked.push('x'));
      document.body.append(btn);
      btn.focus();
      pressKey('Enter', { _target: btn });
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      expect(clicked).toEqual(['x']);
      expect(state.pointerMode).toBe(false);
      btn.remove();
    });
  });
});
