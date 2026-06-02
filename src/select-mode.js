import { state } from './state.js';
import { dom } from './dom.js';
import { showToast } from './ui.js';
import { copyToClipboard } from './share.js';

/** Toggle multi-ayah select mode on/off. */
export function toggleSelectMode() {
  state._selectMode = !state._selectMode;
  dom.selectModeBtn?.classList.toggle('active', state._selectMode);
  dom.selectModeBar?.classList.toggle('show', state._selectMode);
  if (!state._selectMode) clearSelection();
  updateSelectable();
}

/** Enter select mode programmatically. */
export function enterSelectMode() {
  if (!state._selectMode) toggleSelectMode();
}

/** Exit select mode programmatically. */
export function exitSelectMode() {
  if (state._selectMode) toggleSelectMode();
}

/** Clear all selected ayahs. */
export function clearSelection() {
  state._selectedAyahs = [];
  updateSelectCount();
  document.querySelectorAll('.ayah.selected').forEach(el => el.classList.remove('selected'));
}

/** Share all selected ayahs. */
export function shareSelected() {
  if (!state._selectedAyahs?.length) {
    showToast('لم تختر أي آيات', 'error');
    return;
  }
  const sorted = [...state._selectedAyahs].sort((a, b) => a.index - b.index);
  let text = '';
  for (const item of sorted) {
    text += `﴿${item.text}﴾ — ${item.surahName} — آية ${item.ayah}\n\n`;
  }
  text = text.trim();
  if (navigator.share) {
    navigator.share({ title: 'القرآن الكريم', text }).catch(() => {});
  } else {
    copyToClipboard(text);
    showToast(`📋 تم نسخ ${sorted.length} آيات`, 'success');
  }
}

function updateSelectable() {
  document.querySelectorAll('.ayah').forEach(el => {
    el.classList.toggle('selectable', !!state._selectMode);
    if (!state._selectMode) el.classList.remove('selected');
  });
}

function updateSelectCount() {
  const count = state._selectedAyahs?.length || 0;
  const el = document.getElementById('selectCount');
  if (el) el.textContent = String(count);
  if (dom.selectModeBar) {
    dom.selectModeBar.classList.toggle('show', count > 0);
  }
}

/** Handle click on an ayah during select mode. */
export function handleAyahSelect(surah, ayah, text, surahName, index) {
  if (!state._selectMode) return;
  const el = document.querySelector(`.ayah[data-index="${index}"]`);
  if (!el) return;
  if (el.classList.contains('selected')) {
    el.classList.remove('selected');
    state._selectedAyahs = state._selectedAyahs.filter(a => !(a.surah === surah && a.ayah === ayah));
  } else {
    el.classList.add('selected');
    if (!state._selectedAyahs) state._selectedAyahs = [];
    state._selectedAyahs.push({ surah, ayah, text, surahName, index });
  }
  updateSelectCount();
}
