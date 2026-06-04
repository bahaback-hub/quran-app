import { __ } from './i18n.js';
import { state, immutablePush, SelectedAyah } from './state.js';
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
    showToast(__('select_mode_none'), 'error');
    return;
  }
  const sorted = [...state._selectedAyahs].sort((a: SelectedAyah, b: SelectedAyah) => a.index - b.index);
  let text = '';
  for (const item of sorted) {
    text += `﴿${item.text}﴾ — ${item.surahName} — ${__('ayah')} ${item.ayah}\n\n`;
  }
  text = text.trim();
  if (navigator.share) {
    navigator.share({ title: __('app_title'), text }).catch(() => {});
  } else {
    copyToClipboard(text);
    showToast(`${__('select_mode_copied', String(sorted.length))}`, 'success');
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
    immutablePush(state, '_selectedAyahs', { surah, ayah, text, surahName, index });
  }
  updateSelectCount();
}
