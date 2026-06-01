import { state } from './state.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { showToast } from './ui.js';
import { escapeHtml } from './utils.js';
import { loadSurah } from './app.js';
import { copyToClipboard } from './utils.js';

/* ===================== FAVORITES ===================== */

/** Load favorites from localStorage into state. */
export function loadFavorites() {
  state.favorites = storage.get('favorites', []);
}

function saveFavorites() {
  storage.set('favorites', state.favorites);
}

/** Toggle the current ayah in/out of favorites. */
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

/** Render the favorites list in the favorites panel. */
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
    const copyBtn = document.createElement('button');
    copyBtn.className = 'favorite-action-btn fav-copy';
    copyBtn.dataset.text = f.text || '';
    copyBtn.textContent = 'نسخ';
    const shareBtn = document.createElement('button');
    shareBtn.className = 'favorite-action-btn fav-share';
    shareBtn.dataset.text = f.text || '';
    shareBtn.dataset.surahName = f.surahName || '';
    shareBtn.dataset.ayah = String(f.ayah || '');
    shareBtn.textContent = 'مشاركة';
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

  dom.favoritesList.querySelectorAll('.fav-go').forEach(btn => {
    btn.addEventListener('click', () => {
      const surah = parseInt(btn.dataset.surah, 10);
      const ayah = parseInt(btn.dataset.ayah, 10);
      if (dom.surahSelect) dom.surahSelect.value = surah;
      loadSurah(surah, { startAyah: ayah });
      closeFavorites();
    });
  });
  dom.favoritesList.querySelectorAll('.fav-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.text || '';
      if (text) { copyToClipboard(text); showToast('📋 تم نسخ الآية', 'success'); }
    });
  });
  dom.favoritesList.querySelectorAll('.fav-share').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.text || '';
      const surahName = btn.dataset.surahname || '';
      const ayah = btn.dataset.ayah || '';
      const shareText = `${text} — ${surahName} — آية ${ayah}`;
      if (navigator.share) {
        navigator.share({ title: 'القرآن الكريم', text: shareText }).catch(() => {});
      } else {
        copyToClipboard(shareText);
        showToast('📋 تم نسخ الآية للمشاركة', 'success');
      }
    });
  });
  dom.favoritesList.querySelectorAll('.fav-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const idx = state.favorites.findIndex(f => f.key === key);
      if (idx !== -1) {
        state.favorites.splice(idx, 1);
        saveFavorites();
        renderFavorites();
        showToast('💔 تمت إزالة من المفضلة', '');
      }
    });
  });
}

/** Open the favorites panel. */
export function openFavorites() { renderFavorites(); dom.favoritesPanel?.classList.add('open'); }
/** Close the favorites panel. */
export function closeFavorites() { dom.favoritesPanel?.classList.remove('open'); }

/* ===================== BOOKMARK ===================== */

/** Save the current ayah as a bookmark. */
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

/** Navigate to the saved bookmark. */
export function gotoBookmark() {
  const bm = state.bookmark || storage.get('bookmark');
  if (!bm) { showToast('لا توجد علامة محفوظة', 'error'); return; }
  if (dom.surahSelect) dom.surahSelect.value = bm.surah;
  loadSurah(bm.surah, { startAyah: bm.ayah });
}
