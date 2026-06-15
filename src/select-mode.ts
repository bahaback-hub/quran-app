/**
 * @module select-mode
 * @description Ayah multi-selection mode for the Quran app. Allows users to
 * toggle select mode, select/deselect individual ayahs, share all selected
 * ayahs at once (via native share or clipboard), and clear the selection.
 * Visual feedback is provided through CSS classes and a selection count bar.
 */

import { __ } from './i18n.js';
import { type SelectedAyah } from './state.js';
import {
  toggleSelectMode as toggleInternalSelectMode,
  getSelectMode,
  getSelectedAyahs,
  setSelectedAyahs,
  pushSelectedAyah,
  filterSelectedAyahs,
} from './internal-state.js';
import { showToast } from './ui.js';
import { copyToClipboard } from './utils.js';

/** Toggle multi-ayah select mode on/off. */
export function toggleSelectMode(): void {
  const isNowActive = toggleInternalSelectMode();
  const selectModeBtn = document.getElementById('selectModeBtn');
  const selectModeBar = document.getElementById('selectModeBar');
  selectModeBtn?.classList.toggle('active', isNowActive);
  selectModeBar?.classList.toggle('show', isNowActive);
  if (!isNowActive) {
    clearSelection();
  }
  updateSelectable();
}

/** Enter select mode programmatically. */
export function enterSelectMode(): void {
  if (!getSelectMode()) {
    toggleSelectMode();
  }
}

/** Exit select mode programmatically. */
export function exitSelectMode(): void {
  if (getSelectMode()) {
    toggleSelectMode();
  }
}

/** Clear all selected ayahs. */
export function clearSelection(): void {
  setSelectedAyahs([]);
  updateSelectCount();
  document.querySelectorAll('.ayah.selected').forEach((el: Element) => el.classList.remove('selected'));
}

/** Share all selected ayahs. */
export function shareSelected(): void {
  if (!getSelectedAyahs().length) {
    showToast(__('select_mode_none'), 'error');
    return;
  }
  const sorted = [...getSelectedAyahs()].sort((a: SelectedAyah, b: SelectedAyah) => a.index - b.index);
  let text = '';
  for (const item of sorted) {
    text += `﴿${item.text}﴾ — ${item.surahName} — ${__('ayah')} ${item.ayah}\n\n`;
  }
  text = text.trim();
  if (navigator.share) {
    navigator.share({ title: __('app_title'), text }).catch(() => { /* noop */ });
  } else {
    copyToClipboard(text);
    showToast(`${__('select_mode_copied', String(sorted.length))}`, 'success');
  }
}

function updateSelectable(): void {
  document.querySelectorAll('.ayah').forEach((el: Element) => {
    el.classList.toggle('selectable', getSelectMode());
    if (!getSelectMode()) {
      el.classList.remove('selected');
    }
  });
}

function updateSelectCount(): void {
  const count = getSelectedAyahs().length;
  const el = document.getElementById('selectCount');
  if (el) {
    el.textContent = String(count);
  }
  const selectModeBar = document.getElementById('selectModeBar');
  if (selectModeBar) {
    // Keep bar visible while select mode is active, even with 0 selections
    selectModeBar.classList.toggle('show', getSelectMode());
  }
}

/** Handle click on an ayah during select mode. */
export function handleAyahSelect(surah: number, ayah: number, text: string, surahName: string, index: number): void {
  if (!getSelectMode()) {
    return;
  }
  const el = document.querySelector(`.ayah[data-index="${index}"]`);
  if (!el) {
    return;
  }
  if (el.classList.contains('selected')) {
    el.classList.remove('selected');
    filterSelectedAyahs((a: SelectedAyah) => !(a.surah === surah && a.ayah === ayah));
  } else {
    el.classList.add('selected');
    pushSelectedAyah({ surah, ayah, text, surahName, index });
  }
  updateSelectCount();
}
