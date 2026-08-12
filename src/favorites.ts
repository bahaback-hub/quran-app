/**
 * @module favorites
 * @description Favorites and bookmarks management for the Quran app. Handles
 * loading, saving, toggling, rendering, and exporting favorite ayahs, as well
 * as setting and navigating to a single bookmark. Export supports both plain
 * text and JSON formats.
 */

import { state, immutablePush, immutableSplice, FavoriteEntry, BookmarkEntry } from './state.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { showToast } from './ui.js';
import { hapticFeedback, copyToClipboard } from './utils.js';
import { __ } from './i18n.js';
import { loadSurah } from './surah-loader.js';
import { favoritesEmptyMessage, favoriteMeta, favoritesCountMessage } from './templates.js';

/* ===================== INTERFACES ===================== */

/* ===================== FAVORITES ===================== */

/** Load favorites from localStorage into state. */
export function loadFavorites(): void {
  state.favorites = storage.get<FavoriteEntry[]>('favorites', []) || [];
}

function saveFavorites(): void {
  storage.set('favorites', state.favorites);
}

/** Toggle the current ayah in/out of favorites. */
export function toggleFavorite(): void {
  hapticFeedback();
  if (!state.surahData) {
    return;
  }
  const surahData = state.surahData;
  const a = surahData.ayahs[state.currentAyahIndex]!;
  const key = `${state.currentSurah}:${a.numberInSurah}`;
  const idx = state.favorites.findIndex((f: FavoriteEntry) => f.key === key);
  if (idx !== -1) {
    immutableSplice(state, 'favorites', idx, 1);
    showToast(__('removed_from_favorites'), '');
    dom.favoriteBtn?.classList.remove('active');
  } else {
    immutablePush(state, 'favorites', {
      key,
      surah: state.currentSurah,
      surahName: surahData.name,
      ayah: a.numberInSurah,
      text: a.text,
      timestamp: Date.now(),
    });
    showToast(__('added_to_favorites'), 'success');
    dom.favoriteBtn?.classList.add('active');
  }
  saveFavorites();
  renderFavorites();
}

/** Render the favorites list in the favorites panel. */
export function renderFavorites(): void {
  if (!dom.favoritesList) {
    return;
  }
  if (!state.favorites.length) {
    dom.favoritesList.innerHTML = favoritesEmptyMessage();
    return;
  }

  // Show localized count using plural forms (e.g. "٥ مفضلات")
  const countEl = document.querySelector('.favorites-count');
  if (countEl) {
    countEl.outerHTML = favoritesCountMessage(state.favorites.length);
  }
  const fragment = document.createDocumentFragment();
  for (const f of state.favorites.slice().reverse()) {
    const item = document.createElement('div');
    item.className = 'favorite-item';
    item.dataset['key'] = f.key || '';
    const meta = document.createElement('div');
    meta.className = 'favorite-meta';
    meta.innerHTML = favoriteMeta(f.surahName || '', f.ayah || '');
    const textDiv = document.createElement('div');
    textDiv.className = 'favorite-text';
    textDiv.textContent = f.text || '';
    const actions = document.createElement('div');
    actions.className = 'favorite-actions';
    const goBtn = document.createElement('button');
    goBtn.className = 'favorite-action-btn fav-go';
    goBtn.dataset['surah'] = String(f.surah || '');
    goBtn.dataset['ayah'] = String(f.ayah || '');
    goBtn.textContent = __('go_to');
    const removeBtn = document.createElement('button');
    removeBtn.className = 'favorite-action-btn favorite-remove-btn fav-remove';
    removeBtn.dataset['key'] = String(f.key || '');
    removeBtn.textContent = __('delete');
    const copyBtn = document.createElement('button');
    copyBtn.className = 'favorite-action-btn fav-copy';
    copyBtn.dataset['text'] = f.text || '';
    copyBtn.textContent = __('search_copy');
    const shareBtn = document.createElement('button');
    shareBtn.className = 'favorite-action-btn fav-share';
    shareBtn.dataset['text'] = f.text || '';
    shareBtn.dataset['surahName'] = f.surahName || '';
    shareBtn.dataset['ayah'] = String(f.ayah || '');
    shareBtn.textContent = __('search_share');
    actions.appendChild(goBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(shareBtn);
    actions.appendChild(removeBtn);
    item.appendChild(meta);
    item.appendChild(textDiv);
    item.appendChild(actions);
    fragment.appendChild(item);
  }
  dom.favoritesList.replaceChildren(fragment);

  const listEl = dom.favoritesList as HTMLElement & { _delegationBound?: boolean };
  if (!listEl._delegationBound) {
    listEl._delegationBound = true;
    listEl.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('fav-go')) {
        const surah = parseInt(target.dataset['surah'] as string, 10);
        const ayah = parseInt(target.dataset['ayah'] as string, 10);
        if (dom.surahSelect) {
          dom.surahSelect.value = String(surah);
        }
        loadSurah(surah, { startAyah: ayah });
        closeFavorites();
        return;
      }
      if (target.classList.contains('fav-copy')) {
        const text = target.dataset['text'] || '';
        if (text) {
          copyToClipboard(text);
          showToast(__('copied'), 'success');
        }
        return;
      }
      if (target.classList.contains('fav-share')) {
        const text = target.dataset['text'] || '';
        const surahName = target.dataset['surahName'] || '';
        const ayah = target.dataset['ayah'] || '';
        const shareText = `${text} — ${surahName} — ${__('ayah')} ${ayah}`;
        if (navigator.share) {
          navigator.share({ title: __('app_title'), text: shareText }).catch(() => {
            /* noop */
          });
        } else {
          copyToClipboard(shareText);
          showToast(__('copied'), 'success');
        }
        return;
      }
      if (target.classList.contains('fav-remove')) {
        const key = target.dataset['key'] as string;
        const idx = state.favorites.findIndex((f: FavoriteEntry) => f.key === key);
        if (idx !== -1) {
          immutableSplice(state, 'favorites', idx, 1);
          saveFavorites();
          const item = dom.favoritesList?.querySelector(`.favorite-item[data-key="${CSS.escape(key)}"]`);
          if (item) {
            item.remove();
          }
          if (!state.favorites.length && dom.favoritesList) {
            dom.favoritesList.innerHTML = favoritesEmptyMessage();
          }
          showToast(__('removed_from_favorites'), '');
        }
        return;
      }
    });
  }
}

/** Open the favorites panel. */
export function openFavorites(): void {
  renderFavorites();
  wireFavoritesExport();
  dom.favoritesPanel?.classList.add('open');
}
/** Close the favorites panel. */
export function closeFavorites(): void {
  dom.favoritesPanel?.classList.remove('open');
}

/* ===================== EXPORT ===================== */

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportFavoritesText(): void {
  if (!state.favorites.length) {
    showToast(__('favorites_export_none'), 'error');
    return;
  }
  let text = '';
  for (const f of state.favorites) {
    text += `﴿${f.text}﴾ — ${f.surahName || ''} — ${__('ayah')} ${f.ayah}\n\n`;
  }
  downloadFile(text, 'quran-favorites.txt', 'text/plain;charset=utf-8');
  showToast(__('favorites_exported_text'), 'success');
}

function exportFavoritesJson(): void {
  if (!state.favorites.length) {
    showToast(__('favorites_export_none'), 'error');
    return;
  }
  downloadFile(JSON.stringify(state.favorites, null, 2), 'quran-favorites.json', 'application/json');
  showToast(__('favorites_exported_json'), 'success');
}

/**
 * Wire up the favorites export buttons (text and JSON).
 * Uses clone-and-replace to remove any previously bound listeners before
 * attaching fresh ones, preventing duplicate triggers.
 *
 * @example
 * wireFavoritesExport(); // call after openFavorites()
 */
export function wireFavoritesExport(): void {
  const textBtn = document.getElementById('favExportTextBtn');
  const jsonBtn = document.getElementById('favExportJsonBtn');
  // Clone and replace to remove any previous listeners
  if (textBtn) {
    const newTextBtn = textBtn.cloneNode(true) as HTMLElement;
    textBtn.parentNode?.replaceChild(newTextBtn, textBtn);
    newTextBtn.addEventListener('click', exportFavoritesText);
  }
  if (jsonBtn) {
    const newJsonBtn = jsonBtn.cloneNode(true) as HTMLElement;
    jsonBtn.parentNode?.replaceChild(newJsonBtn, jsonBtn);
    newJsonBtn.addEventListener('click', exportFavoritesJson);
  }
}

/* ===================== BOOKMARK ===================== */

/** Save the current ayah as a bookmark. */
export function setBookmark(): void {
  hapticFeedback();
  if (!state.surahData) {
    return;
  }
  const surahData = state.surahData;
  const a = surahData.ayahs[state.currentAyahIndex]!;
  state.bookmark = {
    surah: state.currentSurah,
    surahName: surahData.name,
    ayah: a.numberInSurah,
    text: a.text,
    timestamp: Date.now(),
  };
  storage.set('bookmark', state.bookmark);
  showToast(__('bookmark_saved'), 'success');
}

/** Navigate to the saved bookmark. */
export function gotoBookmark(): void {
  const bm: BookmarkEntry | null = state.bookmark || storage.get<BookmarkEntry>('bookmark');
  if (!bm) {
    showToast(__('bookmark_not_found'), 'error');
    return;
  }
  if (dom.surahSelect) {
    dom.surahSelect.value = String(bm.surah);
  }
  loadSurah(bm.surah, { startAyah: bm.ayah });
}
