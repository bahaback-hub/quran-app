import { dom } from './dom.js';
import { storage } from './storage.js';
import { showToast } from './ui.js';
import { escapeHtml } from './utils.js';

export let state = {};

export function initFavState(s) {
  state = s;
}

/* ===================== FAVORITES ===================== */

export function loadFavorites() {
  state.favorites = storage.get('favorites', []);
}

function saveFavorites() {
  storage.set('favorites', state.favorites);
}

export function toggleFavorite() {
  if (!state.surahData) return;
  const a = state.surahData.ayahs[state.currentAyahIndex];
  const key = `${state.currentSurah}:${a.numberInSurah}`;
  const idx = state.favorites.findIndex(f => f.key === key);
  if (idx !== -1) {
    state.favorites.splice(idx, 1);
    showToast('💔 تمت إزالة من المفضلة', '');
    dom.favoriteBtn?.classList.remove('active');
  } else {
    state.favorites.push({
      key, surah: state.currentSurah, surahName: state.surahData.name,
      ayah: a.numberInSurah, text: a.text, timestamp: Date.now()
    });
    showToast('❤️ أُضيفت إلى المفضلة', 'success');
    dom.favoriteBtn?.classList.add('active');
  }
  saveFavorites();
  renderFavorites();
}

export function renderFavorites() {
  if (!dom.favoritesList) return;
  if (!state.favorites.length) {
    dom.favoritesList.innerHTML = '<p class="favorites-empty">لا توجد آيات مفضلة بعد</p>';
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const f of state.favorites.slice().reverse()) {
    const item = document.createElement('div');
    item.className = 'favorite-item';
    const meta = document.createElement('div');
    meta.className = 'favorite-meta';
    meta.innerHTML = `<strong>${escapeHtml(f.surahName || '')}</strong> — آية ${escapeHtml(String(f.ayah || ''))}`;
    const textDiv = document.createElement('div');
    textDiv.className = 'favorite-text';
    textDiv.textContent = f.text || '';
    const actions = document.createElement('div');
    actions.className = 'favorite-actions';
    const goBtn = document.createElement('button');
    goBtn.className = 'favorite-action-btn fav-go';
    goBtn.dataset.surah = String(f.surah || '');
    goBtn.dataset.ayah = String(f.ayah || '');
    goBtn.textContent = 'انتقال';
    const removeBtn = document.createElement('button');
    removeBtn.className = 'favorite-action-btn favorite-remove-btn fav-remove';
    removeBtn.dataset.key = String(f.key || '');
    removeBtn.textContent = 'حذف';
    actions.appendChild(goBtn);
    actions.appendChild(removeBtn);
    item.appendChild(meta);
    item.appendChild(textDiv);
    item.appendChild(actions);
    fragment.appendChild(item);
  }
  dom.favoritesList.replaceChildren(fragment);
}

export function openFavorites() { renderFavorites(); dom.favoritesPanel?.classList.add('open'); }
export function closeFavorites() { dom.favoritesPanel?.classList.remove('open'); }

/* ===================== BOOKMARK ===================== */

export function setBookmark() {
  if (!state.surahData) return;
  const a = state.surahData.ayahs[state.currentAyahIndex];
  state.bookmark = {
    surah: state.currentSurah, surahName: state.surahData.name,
    ayah: a.numberInSurah, text: a.text, timestamp: Date.now()
  };
  storage.set('bookmark', state.bookmark);
  showToast('🔖 تم حفظ العلامة', 'success');
}

export function gotoBookmark() {
  const bm = state.bookmark || storage.get('bookmark');
  if (!bm) { showToast('لا توجد علامة محفوظة', 'error'); return; }
  if (dom.surahSelect) dom.surahSelect.value = bm.surah;
  if (typeof loadSurahExternal === 'function') {
    loadSurahExternal(bm.surah, { startAyah: bm.ayah });
  }
}

let loadSurahExternal = null;
export function setLoadSurahCallback(fn) {
  loadSurahExternal = fn;
}
