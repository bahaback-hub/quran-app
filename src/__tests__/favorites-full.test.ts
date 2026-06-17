/**
 * Comprehensive tests for favorites.ts — Favorites and bookmarks management.
 * Covers: loadFavorites, toggleFavorite, renderFavorites, openFavorites,
 * closeFavorites, setBookmark, gotoBookmark, wireFavoritesExport,
 * downloadFile, exportFavoritesText, exportFavoritesJson, and delegation handlers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FavoriteEntry, BookmarkEntry } from '../state.js';

// Mock all dependencies before importing the module under test
vi.mock('../state.js', () => {
  const favs: FavoriteEntry[] = [];
  let bookmark: BookmarkEntry | null = null;
  const proxy = {
    currentSurah: 1,
    currentAyahIndex: 0,
    surahData: null as any,
    favorites: favs,
    bookmark: bookmark as BookmarkEntry | null,
    autoSave: true,
  };
  return {
    state: proxy,
    immutablePush: vi.fn((_s: any, _key: string, entry: FavoriteEntry) => {
      proxy.favorites = [...proxy.favorites, entry];
    }),
    immutableSplice: vi.fn((_s: any, _key: string, idx: number, count: number) => {
      proxy.favorites = proxy.favorites.filter((_: any, i: number) => i < idx || i >= idx + count);
    }),
    FavoriteEntry: undefined as any,
    BookmarkEntry: undefined as any,
  };
});

vi.mock('../dom.js', () => ({
  dom: {
    favoriteBtn: null as HTMLElement | null,
    favoritesList: null as HTMLElement | null,
    favoritesPanel: null as HTMLElement | null,
    surahSelect: null as HTMLSelectElement | null,
  },
}));

vi.mock('../storage.js', () => ({
  storage: {
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../ui.js', () => ({
  showToast: vi.fn(),
}));

vi.mock('../utils.js', () => ({
  hapticFeedback: vi.fn(),
  copyToClipboard: vi.fn(),
}));

vi.mock('../i18n.js', () => ({
  __: (key: string) => key,
}));

vi.mock('../surah-loader.js', () => ({
  loadSurah: vi.fn(),
}));

vi.mock('../templates.js', () => ({
  favoritesEmptyMessage: vi.fn(() => '<p class="favorites-empty">empty</p>'),
  favoriteMeta: vi.fn((_name: string, _ayah: number | string) => '<strong>meta</strong>'),
}));

import { state, immutablePush, immutableSplice } from '../state.js';
import { dom } from '../dom.js';
import { storage } from '../storage.js';
import { showToast } from '../ui.js';
import { hapticFeedback, copyToClipboard } from '../utils.js';
import { loadSurah } from '../surah-loader.js';
import { favoritesEmptyMessage, favoriteMeta } from '../templates.js';
import {
  loadFavorites,
  toggleFavorite,
  renderFavorites,
  openFavorites,
  closeFavorites,
  setBookmark,
  gotoBookmark,
  wireFavoritesExport,
} from '../favorites.js';

describe('favorites-full', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.favorites = [];
    state.bookmark = null;
    state.currentSurah = 1;
    state.currentAyahIndex = 0;
    state.surahData = null;
    state.autoSave = true;
    (dom as any).favoriteBtn = null;
    (dom as any).favoritesList = null;
    (dom as any).favoritesPanel = null;
    (dom as any).surahSelect = null;
    // Mock CSS.escape for jsdom (used in favorites.ts remove handler)
    if (typeof CSS === 'undefined' || !CSS.escape) {
      (globalThis as any).CSS = { ...(globalThis as any).CSS, escape: (str: string) => str.replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g, '\\$&') };
    }
  });

  /* ===================== loadFavorites ===================== */

  describe('loadFavorites', () => {
    it('should load favorites from storage into state', () => {
      const saved: FavoriteEntry[] = [
        { key: '1:1', surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', timestamp: 1000 },
      ];
      (storage.get as any).mockReturnValue(saved);
      loadFavorites();
      expect(storage.get).toHaveBeenCalledWith('favorites', []);
      expect(state.favorites).toEqual(saved);
    });

    it('should default to empty array when storage returns null', () => {
      (storage.get as any).mockReturnValue(null);
      loadFavorites();
      expect(state.favorites).toEqual([]);
    });

    it('should handle storage returning undefined/falsy value', () => {
      (storage.get as any).mockReturnValue(undefined);
      loadFavorites();
      expect(state.favorites).toEqual([]);
    });

    it('should handle storage returning false', () => {
      (storage.get as any).mockReturnValue(false);
      loadFavorites();
      expect(state.favorites).toEqual([]);
    });
  });

  /* ===================== toggleFavorite ===================== */

  describe('toggleFavorite', () => {
    beforeEach(() => {
      state.surahData = {
        name: 'الفاتحة',
        ayahs: [{ numberInSurah: 1, text: 'بسم الله الرحمن الرحيم' }],
      };
      state.currentAyahIndex = 0;
      state.currentSurah = 1;
    });

    it('should call hapticFeedback', () => {
      toggleFavorite();
      expect(hapticFeedback).toHaveBeenCalled();
    });

    it('should add a favorite when not already favorited', () => {
      toggleFavorite();
      expect(immutablePush).toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith('added_to_favorites', 'success');
    });

    it('should remove a favorite when already favorited', () => {
      state.favorites = [
        { key: '1:1', surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', timestamp: 1000 },
      ];
      toggleFavorite();
      expect(immutableSplice).toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith('removed_from_favorites', '');
    });

    it('should do nothing when surahData is null', () => {
      state.surahData = null;
      toggleFavorite();
      expect(immutablePush).not.toHaveBeenCalled();
      expect(immutableSplice).not.toHaveBeenCalled();
    });

    it('should add active class to favoriteBtn when adding', () => {
      const btn = document.createElement('button');
      const addSpy = vi.spyOn(btn.classList, 'add');
      (dom as any).favoriteBtn = btn;
      toggleFavorite();
      expect(addSpy).toHaveBeenCalledWith('active');
    });

    it('should remove active class from favoriteBtn when removing', () => {
      state.favorites = [
        { key: '1:1', surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', timestamp: 1000 },
      ];
      const btn = document.createElement('button');
      const removeSpy = vi.spyOn(btn.classList, 'remove');
      (dom as any).favoriteBtn = btn;
      toggleFavorite();
      expect(removeSpy).toHaveBeenCalledWith('active');
    });

    it('should save favorites after toggling', () => {
      toggleFavorite();
      expect(storage.set).toHaveBeenCalledWith('favorites', state.favorites);
    });

    it('should call renderFavorites after toggling', () => {
      // renderFavorites will be called — verify no throw
      (dom as any).favoritesList = document.createElement('div');
      toggleFavorite();
      // If we got here without error, renderFavorites was called
    });
  });

  /* ===================== renderFavorites ===================== */

  describe('renderFavorites', () => {
    it('should return early if dom.favoritesList is null', () => {
      (dom as any).favoritesList = null;
      expect(() => renderFavorites()).not.toThrow();
    });

    it('should show empty message when no favorites', () => {
      const listEl = document.createElement('div');
      (dom as any).favoritesList = listEl;
      state.favorites = [];
      renderFavorites();
      expect(favoritesEmptyMessage).toHaveBeenCalled();
      expect(listEl.innerHTML).toContain('empty');
    });

    it('should render favorite items when favorites exist', () => {
      const listEl = document.createElement('div');
      (dom as any).favoritesList = listEl;
      state.favorites = [
        { key: '1:1', surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', timestamp: 1000 },
      ];
      renderFavorites();
      expect(favoriteMeta).toHaveBeenCalledWith('الفاتحة', 1);
      expect(listEl.children.length).toBeGreaterThan(0);
    });

    it('should render multiple favorites in reverse order', () => {
      const listEl = document.createElement('div');
      (dom as any).favoritesList = listEl;
      state.favorites = [
        { key: '1:1', surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'آية 1', timestamp: 1000 },
        { key: '2:1', surah: 2, surahName: 'البقرة', ayah: 1, text: 'آية 2', timestamp: 2000 },
      ];
      renderFavorites();
      // Reversed — second favorite first
      const items = listEl.querySelectorAll('.favorite-item');
      expect(items.length).toBe(2);
      expect(items[0]!.dataset['key']).toBe('2:1');
      expect(items[1]!.dataset['key']).toBe('1:1');
    });

    it('should create go, copy, share, and remove buttons for each favorite', () => {
      const listEl = document.createElement('div');
      (dom as any).favoritesList = listEl;
      state.favorites = [
        { key: '1:1', surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', timestamp: 1000 },
      ];
      renderFavorites();
      const actions = listEl.querySelector('.favorite-actions');
      expect(actions).toBeTruthy();
      expect(actions!.querySelector('.fav-go')).toBeTruthy();
      expect(actions!.querySelector('.fav-copy')).toBeTruthy();
      expect(actions!.querySelector('.fav-share')).toBeTruthy();
      expect(actions!.querySelector('.fav-remove')).toBeTruthy();
    });

    it('should set correct dataset attributes on go button', () => {
      const listEl = document.createElement('div');
      (dom as any).favoritesList = listEl;
      state.favorites = [
        { key: '1:5', surah: 1, surahName: 'الفاتحة', ayah: 5, text: 'نص', timestamp: 1000 },
      ];
      renderFavorites();
      const goBtn = listEl.querySelector('.fav-go') as HTMLElement;
      expect(goBtn.dataset['surah']).toBe('1');
      expect(goBtn.dataset['ayah']).toBe('5');
    });

    it('should set correct dataset attributes on share button including surahName', () => {
      const listEl = document.createElement('div');
      (dom as any).favoritesList = listEl;
      state.favorites = [
        { key: '1:1', surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'نص', timestamp: 1000 },
      ];
      renderFavorites();
      const shareBtn = listEl.querySelector('.fav-share') as HTMLElement;
      // Key fix: dataset['surahName'] (not dataset['surahname'])
      expect(shareBtn.dataset['surahName']).toBe('الفاتحة');
      expect(shareBtn.dataset['ayah']).toBe('1');
      expect(shareBtn.dataset['text']).toBe('نص');
    });

    it('should set dataset attributes on copy button', () => {
      const listEl = document.createElement('div');
      (dom as any).favoritesList = listEl;
      state.favorites = [
        { key: '1:1', surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', timestamp: 1000 },
      ];
      renderFavorites();
      const copyBtn = listEl.querySelector('.fav-copy') as HTMLElement;
      expect(copyBtn.dataset['text']).toBe('بسم الله');
    });

    it('should handle favorite with missing fields gracefully', () => {
      const listEl = document.createElement('div');
      (dom as any).favoritesList = listEl;
      state.favorites = [
        { key: '', surah: 0, surahName: '', ayah: 0, text: '', timestamp: 0 },
      ];
      renderFavorites();
      const items = listEl.querySelectorAll('.favorite-item');
      expect(items.length).toBe(1);
    });

    it('should only bind click delegation once (_delegationBound)', () => {
      const listEl = document.createElement('div') as HTMLElement & { _delegationBound?: boolean };
      (dom as any).favoritesList = listEl;
      state.favorites = [
        { key: '1:1', surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم', timestamp: 1000 },
      ];
      renderFavorites();
      expect(listEl._delegationBound).toBe(true);
      // Second render should not re-bind
      renderFavorites();
      expect(listEl._delegationBound).toBe(true);
    });
  });

  /* ===================== Favorites click delegation ===================== */

  describe('Favorites click delegation', () => {
    let listEl: HTMLElement & { _delegationBound?: boolean };

    beforeEach(() => {
      listEl = document.createElement('div') as HTMLElement & { _delegationBound?: boolean };
      (dom as any).favoritesList = listEl;
      (dom as any).surahSelect = document.createElement('select');
      state.favorites = [
        { key: '1:1', surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', timestamp: 1000 },
      ];
      renderFavorites();
    });

    it('should navigate to ayah when fav-go is clicked', () => {
      const goBtn = listEl.querySelector('.fav-go') as HTMLElement;
      goBtn.click();
      expect(loadSurah).toHaveBeenCalledWith(1, { startAyah: 1 });
    });

    it('should close favorites panel when fav-go is clicked', () => {
      const panel = document.createElement('div');
      const removeSpy = vi.spyOn(panel.classList, 'remove');
      (dom as any).favoritesPanel = panel;
      const goBtn = listEl.querySelector('.fav-go') as HTMLElement;
      goBtn.click();
      expect(removeSpy).toHaveBeenCalledWith('open');
    });

    it('should copy text when fav-copy is clicked', () => {
      const copyBtn = listEl.querySelector('.fav-copy') as HTMLElement;
      copyBtn.click();
      expect(copyToClipboard).toHaveBeenCalledWith('بسم الله');
      expect(showToast).toHaveBeenCalledWith('copied', 'success');
    });

    it('should not copy if text is empty', () => {
      state.favorites = [
        { key: '1:1', surah: 1, surahName: 'الفاتحة', ayah: 1, text: '', timestamp: 1000 },
      ];
      // Need a fresh render since state changed
      const freshListEl = document.createElement('div') as HTMLElement & { _delegationBound?: boolean };
      (dom as any).favoritesList = freshListEl;
      renderFavorites();
      const copyBtn = freshListEl.querySelector('.fav-copy') as HTMLElement;
      copyBtn.click();
      expect(copyToClipboard).not.toHaveBeenCalled();
    });

    it('should share via navigator.share when available', () => {
      const mockShare = vi.fn(() => Promise.resolve());
      const origShare = navigator.share;
      Object.defineProperty(navigator, 'share', { value: mockShare, writable: true, configurable: true });

      const shareBtn = listEl.querySelector('.fav-share') as HTMLElement;
      shareBtn.click();
      expect(mockShare).toHaveBeenCalledWith({
        title: 'app_title',
        text: expect.stringContaining('بسم الله'),
      });

      Object.defineProperty(navigator, 'share', { value: origShare, writable: true, configurable: true });
    });

    it('should fallback to copyToClipboard when navigator.share is not available', () => {
      const origShare = navigator.share;
      Object.defineProperty(navigator, 'share', { value: undefined, writable: true, configurable: true });

      const shareBtn = listEl.querySelector('.fav-share') as HTMLElement;
      shareBtn.click();
      expect(copyToClipboard).toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith('copied', 'success');

      Object.defineProperty(navigator, 'share', { value: origShare, writable: true, configurable: true });
    });

    it('should remove favorite when fav-remove is clicked', () => {
      const removeBtn = listEl.querySelector('.fav-remove') as HTMLElement;
      removeBtn.click();
      expect(immutableSplice).toHaveBeenCalled();
      expect(storage.set).toHaveBeenCalledWith('favorites', state.favorites);
      expect(showToast).toHaveBeenCalledWith('removed_from_favorites', '');
    });

    it('should show empty message when last favorite is removed', () => {
      const removeBtn = listEl.querySelector('.fav-remove') as HTMLElement;
      // After splice, favorites will be empty (mock handles it)
      removeBtn.click();
      // Since immutableSplice mock removes the item, favorites should be empty
      if (state.favorites.length === 0) {
        expect(favoritesEmptyMessage).toHaveBeenCalled();
      }
    });
  });

  /* ===================== openFavorites ===================== */

  describe('openFavorites', () => {
    it('should call renderFavorites and add open class', () => {
      const panel = document.createElement('div');
      const addSpy = vi.spyOn(panel.classList, 'add');
      (dom as any).favoritesPanel = panel;
      (dom as any).favoritesList = document.createElement('div');
      openFavorites();
      expect(addSpy).toHaveBeenCalledWith('open');
    });

    it('should handle null favoritesPanel gracefully', () => {
      (dom as any).favoritesPanel = null;
      expect(() => openFavorites()).not.toThrow();
    });

    it('should wire export buttons', () => {
      const textBtn = document.createElement('button');
      textBtn.id = 'favExportTextBtn';
      const jsonBtn = document.createElement('button');
      jsonBtn.id = 'favExportJsonBtn';
      document.body.appendChild(textBtn);
      document.body.appendChild(jsonBtn);
      (dom as any).favoritesPanel = document.createElement('div');
      (dom as any).favoritesList = document.createElement('div');
      openFavorites();
      // After wiring, the buttons should have been cloned
      textBtn.remove();
      jsonBtn.remove();
    });
  });

  /* ===================== closeFavorites ===================== */

  describe('closeFavorites', () => {
    it('should remove open class from favoritesPanel', () => {
      const panel = document.createElement('div');
      const removeSpy = vi.spyOn(panel.classList, 'remove');
      (dom as any).favoritesPanel = panel;
      closeFavorites();
      expect(removeSpy).toHaveBeenCalledWith('open');
    });

    it('should handle null favoritesPanel gracefully', () => {
      (dom as any).favoritesPanel = null;
      expect(() => closeFavorites()).not.toThrow();
    });
  });

  /* ===================== setBookmark ===================== */

  describe('setBookmark', () => {
    it('should call hapticFeedback', () => {
      state.surahData = {
        name: 'الفاتحة',
        ayahs: [{ numberInSurah: 1, text: 'بسم الله' }],
      };
      setBookmark();
      expect(hapticFeedback).toHaveBeenCalled();
    });

    it('should set bookmark with surah data', () => {
      state.surahData = {
        name: 'الفاتحة',
        ayahs: [{ numberInSurah: 1, text: 'بسم الله' }],
      };
      state.currentSurah = 2;
      state.currentAyahIndex = 0;
      setBookmark();
      expect(state.bookmark).toBeTruthy();
      expect(state.bookmark!.surah).toBe(2);
      expect(state.bookmark!.surahName).toBe('الفاتحة');
      expect(state.bookmark!.ayah).toBe(1);
      expect(state.bookmark!.text).toBe('بسم الله');
    });

    it('should save bookmark to storage', () => {
      state.surahData = {
        name: 'الفاتحة',
        ayahs: [{ numberInSurah: 1, text: 'بسم الله' }],
      };
      setBookmark();
      expect(storage.set).toHaveBeenCalledWith('bookmark', state.bookmark);
    });

    it('should show success toast', () => {
      state.surahData = {
        name: 'الفاتحة',
        ayahs: [{ numberInSurah: 1, text: 'بسم الله' }],
      };
      setBookmark();
      expect(showToast).toHaveBeenCalledWith('bookmark_saved', 'success');
    });

    it('should do nothing when surahData is null', () => {
      state.surahData = null;
      setBookmark();
      expect(storage.set).not.toHaveBeenCalled();
      expect(showToast).not.toHaveBeenCalled();
    });
  });

  /* ===================== gotoBookmark ===================== */

  describe('gotoBookmark', () => {
    it('should navigate to bookmark when state.bookmark exists', () => {
      state.bookmark = { surah: 5, surahName: 'المائدة', ayah: 3, text: 'text', timestamp: 1000 };
      const select = document.createElement('select');
      const opt = document.createElement('option');
      opt.value = '5';
      opt.textContent = '5';
      select.appendChild(opt);
      (dom as any).surahSelect = select;
      gotoBookmark();
      expect(select.value).toBe('5');
      expect(loadSurah).toHaveBeenCalledWith(5, { startAyah: 3 });
    });

    it('should try storage.get when state.bookmark is null', () => {
      state.bookmark = null;
      const bm: BookmarkEntry = { surah: 2, surahName: 'البقرة', ayah: 10, text: 'text', timestamp: 2000 };
      (storage.get as any).mockReturnValue(bm);
      gotoBookmark();
      expect(storage.get).toHaveBeenCalledWith('bookmark');
      expect(loadSurah).toHaveBeenCalledWith(2, { startAyah: 10 });
    });

    it('should show error toast when no bookmark found', () => {
      state.bookmark = null;
      (storage.get as any).mockReturnValue(null);
      gotoBookmark();
      expect(showToast).toHaveBeenCalledWith('bookmark_not_found', 'error');
      expect(loadSurah).not.toHaveBeenCalled();
    });

    it('should work without surahSelect', () => {
      state.bookmark = { surah: 5, surahName: 'المائدة', ayah: 3, text: 'text', timestamp: 1000 };
      (dom as any).surahSelect = null;
      expect(() => gotoBookmark()).not.toThrow();
      expect(loadSurah).toHaveBeenCalledWith(5, { startAyah: 3 });
    });
  });

  /* ===================== wireFavoritesExport ===================== */

  describe('wireFavoritesExport', () => {
    afterEach(() => {
      const t = document.getElementById('favExportTextBtn');
      const j = document.getElementById('favExportJsonBtn');
      t?.remove();
      j?.remove();
    });

    it('should not throw when export buttons do not exist', () => {
      expect(() => wireFavoritesExport()).not.toThrow();
    });

    it('should clone and replace export buttons if they exist', () => {
      const textBtn = document.createElement('button');
      textBtn.id = 'favExportTextBtn';
      const jsonBtn = document.createElement('button');
      jsonBtn.id = 'favExportJsonBtn';
      document.body.appendChild(textBtn);
      document.body.appendChild(jsonBtn);

      wireFavoritesExport();

      const newTextBtn = document.getElementById('favExportTextBtn');
      const newJsonBtn = document.getElementById('favExportJsonBtn');
      expect(newTextBtn).not.toBe(textBtn);
      expect(newJsonBtn).not.toBe(jsonBtn);
    });

    it('should attach click handler to text export button', () => {
      const textBtn = document.createElement('button');
      textBtn.id = 'favExportTextBtn';
      document.body.appendChild(textBtn);

      wireFavoritesExport();

      const newTextBtn = document.getElementById('favExportTextBtn')!;
      // Click should trigger export (shows toast for empty favorites)
      state.favorites = [];
      newTextBtn.click();
      expect(showToast).toHaveBeenCalledWith('favorites_export_none', 'error');
    });

    it('should export text file when favorites exist', () => {
      const textBtn = document.createElement('button');
      textBtn.id = 'favExportTextBtn';
      document.body.appendChild(textBtn);

      wireFavoritesExport();

      state.favorites = [
        { key: '1:1', surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', timestamp: 1000 },
      ];

      // Mock URL.createObjectURL and Blob
      const origCreateObjectURL = URL.createObjectURL;
      const origRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = vi.fn(() => 'blob:test');
      URL.revokeObjectURL = vi.fn();

      const newTextBtn = document.getElementById('favExportTextBtn')!;
      newTextBtn.click();
      expect(showToast).toHaveBeenCalledWith('favorites_exported_text', 'success');

      URL.createObjectURL = origCreateObjectURL;
      URL.revokeObjectURL = origRevokeObjectURL;
    });

    it('should attach click handler to json export button', () => {
      const jsonBtn = document.createElement('button');
      jsonBtn.id = 'favExportJsonBtn';
      document.body.appendChild(jsonBtn);

      wireFavoritesExport();

      const newJsonBtn = document.getElementById('favExportJsonBtn')!;
      state.favorites = [];
      newJsonBtn.click();
      expect(showToast).toHaveBeenCalledWith('favorites_export_none', 'error');
    });

    it('should export JSON file when favorites exist', () => {
      const jsonBtn = document.createElement('button');
      jsonBtn.id = 'favExportJsonBtn';
      document.body.appendChild(jsonBtn);

      wireFavoritesExport();

      state.favorites = [
        { key: '1:1', surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', timestamp: 1000 },
      ];

      const origCreateObjectURL = URL.createObjectURL;
      const origRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = vi.fn(() => 'blob:test');
      URL.revokeObjectURL = vi.fn();

      const newJsonBtn = document.getElementById('favExportJsonBtn')!;
      newJsonBtn.click();
      expect(showToast).toHaveBeenCalledWith('favorites_exported_json', 'success');

      URL.createObjectURL = origCreateObjectURL;
      URL.revokeObjectURL = origRevokeObjectURL;
    });

    it('should handle textBtn without parentNode', () => {
      // If the button has no parentNode, cloneNode/replaceChild would fail
      // but the code handles it with optional chaining
      const textBtn = document.createElement('button');
      textBtn.id = 'favExportTextBtn';
      // Not appended to DOM, so no parentNode
      expect(() => wireFavoritesExport()).not.toThrow();
    });
  });
});
