import { state, SelectedAyah } from './state.js';
import { dom } from './dom.js';
import { showToast } from './ui.js';
import { copyToClipboard } from './utils.js';

/** Toggle multi-ayah select mode on/off. */
export function toggleSelectMode(): void {
  state._selectMode = !state._selectMode;
  const selectModeBtn = document.getElementById('selectModeBtn');
  const selectModeBar = document.getElementById('selectModeBar');
  selectModeBtn?.classList.toggle('active', state._selectMode);
  selectModeBar?.classList.toggle('show', state._selectMode);
  if (!state._selectMode) clearSelection();
  updateSelectable();
}

/** Enter select mode programmatically. */
export function enterSelectMode(): void {
  if (!state._selectMode) toggleSelectMode();
}

/** Exit select mode programmatically. */
export function exitSelectMode(): void {
  if (state._selectMode) toggleSelectMode();
}

/** Clear all selected ayahs. */
export function clearSelection(): void {
  state._selectedAyahs = [];
  updateSelectCount();
  document.querySelectorAll('.ayah.selected').forEach((el: Element) => el.classList.remove('selected'));
}

/** Share all selected ayahs. */
export function shareSelected(): void {
  if (!state._selectedAyahs?.length) {
    showToast('لم تختر أي آيات', 'error');
    return;
  }
  const sorted = [...state._selectedAyahs].sort((a: SelectedAyah, b: SelectedAyah) => a.index - b.index);
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

function updateSelectable(): void {
  document.querySelectorAll('.ayah').forEach((el: Element) => {
    el.classList.toggle('selectable', !!state._selectMode);
    if (!state._selectMode) el.classList.remove('selected');
  });
}

function updateSelectCount(): void {
  const count = state._selectedAyahs?.length || 0;
  const el = document.getElementById('selectCount');
  if (el) el.textContent = String(count);
  const selectModeBar = document.getElementById('selectModeBar');
  if (selectModeBar) {
    selectModeBar.classList.toggle('show', count > 0);
  }
}

/** Handle click on an ayah during select mode. */
export function handleAyahSelect(surah: number, ayah: number, text: string, surahName: string, index: number): void {
  if (!state._selectMode) return;
  const el = document.querySelector(`.ayah[data-index="${index}"]`);
  if (!el) return;
  if (el.classList.contains('selected')) {
    el.classList.remove('selected');
    state._selectedAyahs = state._selectedAyahs.filter((a: SelectedAyah) => !(a.surah === surah && a.ayah === ayah));
  } else {
    el.classList.add('selected');
    if (!state._selectedAyahs) state._selectedAyahs = [];
    state._selectedAyahs.push({ surah, ayah, text, surahName, index });
  }
  updateSelectCount();
}
