/**
 * Tests for favorites.ts — Favorites and bookmarks management.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
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
  };
  return {
    state: proxy,
    immutablePush: vi.fn((_s: any, _key: string, entry: FavoriteEntry) => {
      proxy.favorites = [...proxy.favorites, entry];
    }),
    immutableSplice: vi.fn((_s: any, _key: string, idx: number, count: number) => {
      proxy.favorites = proxy.favorites.filter((_, i) => i < idx || i >= idx + count);
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

describe('favorites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset state
    state.favorites = [];
    state.bookmark = null;
    state.currentSurah = 1;
    state.currentAyahIndex = 0;
    state.surahData = null;
    // Reset dom mocks
    (dom as any).favoriteBtn = null;
    (dom as any).favoritesList = null;
    (dom as any).favoritesPanel = null;
    (dom as any).surahSelect = null;
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

    it('should handle storage returning falsy value', () => {
      (storage.get as any).mockReturnValue(undefined);
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
      const btn = { classList: { add: vi.fn(), remove: vi.fn() } };
      (dom as any).favoriteBtn = btn;
      toggleFavorite();
      expect(btn.classList.add).toHaveBeenCalledWith('active');
    });

    it('should remove active class from favoriteBtn when removing', () => {
      state.favorites = [
        { key: '1:1', surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', timestamp: 1000 },
      ];
      const btn = { classList: { add: vi.fn(), remove: vi.fn() } };
      (dom as any).favoriteBtn = btn;
      toggleFavorite();
      expect(btn.classList.remove).toHaveBeenCalledWith('active');
    });

    it('should save favorites after toggling', () => {
      toggleFavorite();
      expect(storage.set).toHaveBeenCalledWith('favorites', state.favorites);
    });
  });

  /* ===================== renderFavorites ===================== */

  describe('renderFavorites', () => {
    it('should return early if dom.favoritesList is null', () => {
      (dom as any).favoritesList = null;
      expect(() => renderFavorites()).not.toThrow();
    });

    it('should show empty message when no favorites', () => {
      (dom as any).favoritesList = document.createElement('div');
      state.favorites = [];
      renderFavorites();
      expect(favoritesEmptyMessage).toHaveBeenCalled();
      expect((dom as any).favoritesList.innerHTML).toContain('empty');
    });

    it('should render favorite items when favorites exist', () => {
      const listEl = document.createElement('div');
      (dom as any).favoritesList = listEl;
      state.favorites = [
        { key: '1:1', surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', timestamp: 1000 },
      ];
      renderFavorites();
      expect(favoriteMeta).toHaveBeenCalledWith('الفاتحة', 1);
      // Should have child elements (the favorite-item divs)
      expect(listEl.children.length).toBeGreaterThan(0);
    });
  });

  /* ===================== openFavorites ===================== */

  describe('openFavorites', () => {
    it('should call renderFavorites and add open class', () => {
      const panel = { classList: { add: vi.fn() } };
      (dom as any).favoritesPanel = panel;
      openFavorites();
      expect(panel.classList.add).toHaveBeenCalledWith('open');
    });

    it('should handle null favoritesPanel gracefully', () => {
      (dom as any).favoritesPanel = null;
      expect(() => openFavorites()).not.toThrow();
    });
  });

  /* ===================== closeFavorites ===================== */

  describe('closeFavorites', () => {
    it('should remove open class from favoritesPanel', () => {
      const panel = { classList: { remove: vi.fn() } };
      (dom as any).favoritesPanel = panel;
      closeFavorites();
      expect(panel.classList.remove).toHaveBeenCalledWith('open');
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
      const select = { value: '' } as any;
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

      // Buttons should have been replaced (cloned)
      const newTextBtn = document.getElementById('favExportTextBtn');
      const newJsonBtn = document.getElementById('favExportJsonBtn');
      expect(newTextBtn).not.toBe(textBtn);
      expect(newJsonBtn).not.toBe(jsonBtn);

      // Cleanup
      newTextBtn?.remove();
      newJsonBtn?.remove();
    });
  });
});
