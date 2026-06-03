import { state } from './state.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { showToast } from './ui.js';
import { escapeHtml, hapticFeedback } from './utils.js';
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
  hapticFeedback();
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
    item.dataset.key = f.key || '';
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

  if (!dom.favoritesList._delegationBound) {
    dom.favoritesList._delegationBound = true;
    dom.favoritesList.addEventListener('click', (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      if (target.classList.contains('fav-go')) {
        const surah = parseInt(target.dataset.surah, 10);
        const ayah = parseInt(target.dataset.ayah, 10);
        if (dom.surahSelect) dom.surahSelect.value = surah;
        loadSurah(surah, { startAyah: ayah });
        closeFavorites();
        return;
      }
      if (target.classList.contains('fav-copy')) {
        const text = target.dataset.text || '';
        if (text) { copyToClipboard(text); showToast('📋 تم نسخ الآية', 'success'); }
        return;
      }
      if (target.classList.contains('fav-share')) {
        const text = target.dataset.text || '';
        const surahName = target.dataset.surahname || '';
        const ayah = target.dataset.ayah || '';
        const shareText = `${text} — ${surahName} — آية ${ayah}`;
        if (navigator.share) {
          navigator.share({ title: 'القرآن الكريم', text: shareText }).catch(() => {});
        } else {
          copyToClipboard(shareText);
          showToast('📋 تم نسخ الآية للمشاركة', 'success');
        }
        return;
      }
      if (target.classList.contains('fav-remove')) {
        const key = target.dataset.key;
        const idx = state.favorites.findIndex(f => f.key === key);
        if (idx !== -1) {
          state.favorites.splice(idx, 1);
          saveFavorites();
          const item = dom.favoritesList?.querySelector(`.favorite-item[data-key="${CSS.escape(key)}"]`);
          if (item) item.remove();
          if (!state.favorites.length) dom.favoritesList.innerHTML = '<p class="favorites-empty">لا توجد آيات مفضلة بعد</p>';
          showToast('💔 تمت إزالة من المفضلة', '');
        }
        return;
      }
    });
  }
}

/** Open the favorites panel. */
export function openFavorites() { renderFavorites(); wireFavoritesExport(); dom.favoritesPanel?.classList.add('open'); }
/** Close the favorites panel. */
export function closeFavorites() { dom.favoritesPanel?.classList.remove('open'); }

/* ===================== EXPORT ===================== */

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportFavoritesText() {
  if (!state.favorites.length) { showToast('لا توجد آيات مفضلة للتصدير', 'error'); return; }
  let text = '';
  for (const f of state.favorites) {
    text += `﴿${f.text}﴾ — ${f.surahName || ''} — آية ${f.ayah}\n\n`;
  }
  downloadFile(text, 'quran-favorites.txt', 'text/plain;charset=utf-8');
  showToast('📄 تم تصدير المفضلة كنص', 'success');
}

function exportFavoritesJson() {
  if (!state.favorites.length) { showToast('لا توجد آيات مفضلة للتصدير', 'error'); return; }
  downloadFile(JSON.stringify(state.favorites, null, 2), 'quran-favorites.json', 'application/json');
  showToast('💾 تم تصدير المفضلة JSON', 'success');
}

export function wireFavoritesExport() {
  document.getElementById('favExportTextBtn')?.addEventListener('click', exportFavoritesText);
  document.getElementById('favExportJsonBtn')?.addEventListener('click', exportFavoritesJson);
}

/* ===================== BOOKMARK ===================== */

/** Save the current ayah as a bookmark. */
export function setBookmark() {
  hapticFeedback();
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
