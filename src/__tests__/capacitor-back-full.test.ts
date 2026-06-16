/**
 * Comprehensive tests for capacitor-back.ts — Capacitor hardware back button handler.
 * Covers: initCapacitorBackButton, all priority levels of back button handling,
 * global Capacitor detection, error handling, and edge cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock state module
vi.mock('../state.js', () => ({
  state: {
    presentationMode: false,
    mushafMode: false,
    adhkarPanelOpen: false,
  },
}));

// Mock settings module
vi.mock('../settings.js', () => ({
  closeSettings: vi.fn(),
}));

// Mock adhkar module
vi.mock('../adhkar.js', () => ({
  closeAdhkarPanel: vi.fn(),
}));

// Mock favorites module
vi.mock('../favorites.js', () => ({
  closeFavorites: vi.fn(),
}));

// Mock tafsir module
vi.mock('../tafsir.js', () => ({
  closeTafsir: vi.fn(),
}));

// Mock types module
vi.mock('../types.js', () => ({
  getCapacitor: vi.fn(() => undefined),
}));

import { initCapacitorBackButton } from '../capacitor-back.js';
import { state } from '../state.js';
import { closeSettings } from '../settings.js';
import { closeAdhkarPanel } from '../adhkar.js';
import { closeFavorites } from '../favorites.js';
import { closeTafsir } from '../tafsir.js';
import { getCapacitor } from '../types.js';

describe('capacitor-back-full', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    state.presentationMode = false;
    state.mushafMode = false;
    state.adhkarPanelOpen = false;
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).Capacitor;
  });

  /** Helper to create a back button listener via initCapacitorBackButton */
  function createBackListener(overrides?: Record<string, unknown>): () => void {
    let listener: (() => void) | undefined;
    const addListener = vi.fn((_event: string, cb: () => void) => {
      listener = cb;
    });
    initCapacitorBackButton({ App: { addListener }, ...overrides });
    expect(listener).toBeDefined();
    return listener!;
  }

  /* ===================== Initialization ===================== */

  it('should do nothing when no Capacitor or plugins provided', () => {
    expect(() => initCapacitorBackButton()).not.toThrow();
    expect(() => initCapacitorBackButton({})).not.toThrow();
  });

  it('should add backButton listener when plugins.App provided', () => {
    const addListener = vi.fn();
    initCapacitorBackButton({ App: { addListener } });
    expect(addListener).toHaveBeenCalledWith('backButton', expect.any(Function));
  });

  it('should fall back to global Capacitor when no plugins param', () => {
    const addListener = vi.fn();
    (globalThis as Record<string, unknown>).Capacitor = { Plugins: { App: { addListener } } };
    (getCapacitor as ReturnType<typeof vi.fn>).mockReturnValue({ Plugins: { App: { addListener } } });
    initCapacitorBackButton();
    expect(addListener).toHaveBeenCalledWith('backButton', expect.any(Function));
  });

  it('should handle addListener errors gracefully', () => {
    const addListener = vi.fn(() => {
      throw new Error('fail');
    });
    expect(() => initCapacitorBackButton({ App: { addListener } })).not.toThrow();
  });

  it('should prefer plugins param over global Capacitor', () => {
    const globalAddListener = vi.fn();
    const pluginAddListener = vi.fn();
    (globalThis as Record<string, unknown>).Capacitor = { Plugins: { App: { addListener: globalAddListener } } };
    (getCapacitor as ReturnType<typeof vi.fn>).mockReturnValue({ Plugins: { App: { addListener: globalAddListener } } });
    initCapacitorBackButton({ App: { addListener: pluginAddListener } });
    expect(pluginAddListener).toHaveBeenCalled();
    expect(globalAddListener).not.toHaveBeenCalled();
  });

  it('should use global Capacitor when plugins.App is not provided', () => {
    const globalAddListener = vi.fn();
    (globalThis as Record<string, unknown>).Capacitor = { Plugins: { App: { addListener: globalAddListener } } };
    (getCapacitor as ReturnType<typeof vi.fn>).mockReturnValue({ Plugins: { App: { addListener: globalAddListener } } });
    initCapacitorBackButton({});
    expect(globalAddListener).toHaveBeenCalledWith('backButton', expect.any(Function));
  });

  /* ===================== Priority 1: Close presentation mode ===================== */

  it('should close presentation mode first when active', async () => {
    state.presentationMode = true;
    const listener = createBackListener();
    listener();
    // Should attempt to import presentation.js
    // Since presentation.js is dynamically imported, we just verify no other close was called
    expect(closeSettings).not.toHaveBeenCalled();
    expect(closeFavorites).not.toHaveBeenCalled();
  });

  /* ===================== Priority 2: Close mushaf surah overlay ===================== */

  it('should close mushaf surah overlay when visible', () => {
    state.presentationMode = false;
    const overlay = document.createElement('div');
    overlay.id = 'mushafSurahOverlay';
    // Not hidden — visible
    document.body.appendChild(overlay);

    const listener = createBackListener();
    listener();

    expect(overlay.classList.contains('hidden')).toBe(true);
    expect(overlay.style.display).toBe('none');
  });

  it('should skip mushaf overlay when it has hidden class', () => {
    state.presentationMode = false;
    const overlay = document.createElement('div');
    overlay.id = 'mushafSurahOverlay';
    overlay.classList.add('hidden');
    document.body.appendChild(overlay);

    const panel = document.createElement('div');
    panel.id = 'settingsPanel';
    panel.style.display = 'flex';
    document.body.appendChild(panel);

    const listener = createBackListener();
    listener();

    // Should have fallen through to active panels
    expect(closeSettings).toHaveBeenCalled();
  });

  it('should skip mushaf overlay when it does not exist', () => {
    state.presentationMode = false;
    // No overlay in DOM
    const panel = document.createElement('div');
    panel.id = 'settingsPanel';
    panel.style.display = 'flex';
    document.body.appendChild(panel);

    const listener = createBackListener();
    listener();

    expect(closeSettings).toHaveBeenCalled();
  });

  /* ===================== Priority 3: Close surah secrets overlay ===================== */

  it('should close surah secrets overlay when visible', () => {
    state.presentationMode = false;
    const overlay = document.createElement('div');
    overlay.id = 'surahSecretsOverlay';
    document.body.appendChild(overlay);

    const listener = createBackListener();
    listener();

    expect(overlay.classList.contains('hidden')).toBe(true);
    expect(overlay.style.display).toBe('none');
  });

  it('should skip secrets overlay when it has hidden class', () => {
    state.presentationMode = false;
    const overlay = document.createElement('div');
    overlay.id = 'surahSecretsOverlay';
    overlay.classList.add('hidden');
    document.body.appendChild(overlay);

    const panel = document.createElement('div');
    panel.id = 'settingsPanel';
    panel.style.display = 'flex';
    document.body.appendChild(panel);

    const listener = createBackListener();
    listener();

    expect(closeSettings).toHaveBeenCalled();
  });

  /* ===================== Priority 4: Close active panels/modals ===================== */

  it('should close settings panel when visible (open class)', () => {
    const panel = document.createElement('div');
    panel.id = 'settingsPanel';
    panel.classList.add('open');
    document.body.appendChild(panel);

    const listener = createBackListener();
    listener();
    expect(closeSettings).toHaveBeenCalled();
  });

  it('should close settings panel when visible (inline display)', () => {
    const panel = document.createElement('div');
    panel.id = 'settingsPanel';
    panel.style.display = 'flex';
    document.body.appendChild(panel);

    const listener = createBackListener();
    listener();
    expect(closeSettings).toHaveBeenCalled();
  });

  it('should close adhkar panel when adhkarPanelOpen is true', () => {
    state.adhkarPanelOpen = true;
    const panel = document.createElement('div');
    panel.id = 'adhkarPanel';
    panel.classList.add('open');
    document.body.appendChild(panel);

    const listener = createBackListener();
    listener();
    expect(closeAdhkarPanel).toHaveBeenCalled();
  });

  it('should not close adhkar panel when adhkarPanelOpen is false', () => {
    state.adhkarPanelOpen = false;
    const panel = document.createElement('div');
    panel.id = 'adhkarPanel';
    panel.classList.add('open');
    document.body.appendChild(panel);

    // Add another panel so the back button does something
    const player = document.createElement('div');
    player.id = 'player';
    document.body.appendChild(player);

    const listener = createBackListener();
    listener();
    expect(closeAdhkarPanel).not.toHaveBeenCalled();
  });

  it('should close favorites panel when visible', () => {
    const panel = document.createElement('div');
    panel.id = 'favoritesPanel';
    panel.classList.add('open');
    document.body.appendChild(panel);

    const listener = createBackListener();
    listener();
    expect(closeFavorites).toHaveBeenCalled();
  });

  it('should close ayah modal when visible', () => {
    const modal = document.createElement('div');
    modal.id = 'ayahModal';
    modal.style.display = 'flex';
    document.body.appendChild(modal);

    const closeBtn = document.createElement('button');
    closeBtn.id = 'ayahModalCloseBtn';
    const clickSpy = vi.spyOn(closeBtn, 'click');
    document.body.appendChild(closeBtn);

    const listener = createBackListener();
    listener();
    expect(clickSpy).toHaveBeenCalled();
  });

  it('should close tafsir curtain when visible', () => {
    const curtain = document.createElement('div');
    curtain.id = 'tafsirCurtain';
    curtain.classList.add('open');
    document.body.appendChild(curtain);

    const listener = createBackListener();
    listener();
    expect(closeTafsir).toHaveBeenCalled();
  });

  it('should check panels in priority order (settings before adhkar)', () => {
    const settingsPanel = document.createElement('div');
    settingsPanel.id = 'settingsPanel';
    settingsPanel.classList.add('open');
    document.body.appendChild(settingsPanel);

    const adhkarPanel = document.createElement('div');
    adhkarPanel.id = 'adhkarPanel';
    adhkarPanel.classList.add('open');
    document.body.appendChild(adhkarPanel);

    state.adhkarPanelOpen = true;

    const listener = createBackListener();
    listener();

    // Settings should be closed first since it's higher in the array
    expect(closeSettings).toHaveBeenCalled();
    expect(closeAdhkarPanel).not.toHaveBeenCalled();
  });

  it('should skip panel that is hidden', () => {
    const panel = document.createElement('div');
    panel.id = 'settingsPanel';
    panel.classList.add('hidden');
    panel.style.display = 'none';
    document.body.appendChild(panel);

    const favPanel = document.createElement('div');
    favPanel.id = 'favoritesPanel';
    favPanel.classList.add('open');
    document.body.appendChild(favPanel);

    const listener = createBackListener();
    listener();

    expect(closeSettings).not.toHaveBeenCalled();
    expect(closeFavorites).toHaveBeenCalled();
  });

  /* ===================== Priority 5: Collapse player ===================== */

  it('should collapse player when no panel is open and player is expanded', () => {
    const player = document.createElement('div');
    player.id = 'player';
    document.body.appendChild(player);

    const listener = createBackListener();
    listener();
    expect(player.classList.contains('collapsed')).toBe(true);
  });

  it('should not collapse player that already has collapsed class', () => {
    const player = document.createElement('div');
    player.id = 'player';
    player.classList.add('collapsed');
    document.body.appendChild(player);

    const listener = createBackListener();
    listener();
    // Player was already collapsed, should not proceed to mushaf mode
    expect(player.classList.contains('collapsed')).toBe(true);
  });

  /* ===================== Priority 6: Exit mushaf mode ===================== */

  it('should exit mushaf mode when player is collapsed', () => {
    state.mushafMode = true;
    const player = document.createElement('div');
    player.id = 'player';
    player.classList.add('collapsed');
    document.body.appendChild(player);

    const viewSurahBtn = document.createElement('button');
    viewSurahBtn.id = 'viewSurahBtn';
    const clickSpy = vi.spyOn(viewSurahBtn, 'click');
    document.body.appendChild(viewSurahBtn);

    const listener = createBackListener();
    listener();
    expect(clickSpy).toHaveBeenCalled();
  });

  it('should handle missing viewSurahBtn in mushaf mode', () => {
    state.mushafMode = true;
    const player = document.createElement('div');
    player.id = 'player';
    player.classList.add('collapsed');
    document.body.appendChild(player);

    const listener = createBackListener();
    expect(() => listener()).not.toThrow();
  });

  /* ===================== Priority 7: Close search ===================== */

  it('should close search when search is visible', () => {
    const searchInputGroup = document.createElement('div');
    searchInputGroup.id = 'searchInputGroup';
    document.body.appendChild(searchInputGroup);

    const player = document.createElement('div');
    player.id = 'player';
    player.classList.add('collapsed');
    document.body.appendChild(player);

    const listener = createBackListener();
    listener();
    expect(searchInputGroup.classList.contains('hidden')).toBe(true);
  });

  it('should not close search that already has hidden class', () => {
    const searchInputGroup = document.createElement('div');
    searchInputGroup.id = 'searchInputGroup';
    searchInputGroup.classList.add('hidden');
    document.body.appendChild(searchInputGroup);

    const player = document.createElement('div');
    player.id = 'player';
    player.classList.add('collapsed');
    document.body.appendChild(player);

    const listener = createBackListener();
    listener();
    // Should have exited without doing anything (no further actions)
    // Just verify it doesn't throw
  });

  /* ===================== Edge cases ===================== */

  it('should do nothing when nothing is open', () => {
    const player = document.createElement('div');
    player.id = 'player';
    player.classList.add('collapsed');
    document.body.appendChild(player);

    const searchInputGroup = document.createElement('div');
    searchInputGroup.id = 'searchInputGroup';
    searchInputGroup.classList.add('hidden');
    document.body.appendChild(searchInputGroup);

    const listener = createBackListener();
    expect(() => listener()).not.toThrow();
    expect(closeSettings).not.toHaveBeenCalled();
    expect(closeFavorites).not.toHaveBeenCalled();
    expect(closeTafsir).not.toHaveBeenCalled();
  });

  it('should handle missing DOM elements gracefully', () => {
    // No DOM elements at all
    const listener = createBackListener();
    expect(() => listener()).not.toThrow();
  });

  it('should handle panel with no classList display', () => {
    const panel = document.createElement('div');
    panel.id = 'settingsPanel';
    // No display set, no open class
    document.body.appendChild(panel);

    const listener = createBackListener();
    listener();
    // Panel is not visible, so nothing should be closed
    expect(closeSettings).not.toHaveBeenCalled();
  });

  it('should detect panel visibility via inline display style (not none)', () => {
    const panel = document.createElement('div');
    panel.id = 'settingsPanel';
    panel.style.display = 'block';
    document.body.appendChild(panel);

    const listener = createBackListener();
    listener();
    expect(closeSettings).toHaveBeenCalled();
  });
});
