/**
 * @module share
 * @description Share and copy functionality for the Quran app. Provides functions
 * to build share text from the current ayah, toggle the share menu, share via the
 * native Web Share API, copy to clipboard (with and without diacritics), and share
 * through WhatsApp and Telegram.
 */

import { dom } from './dom.js';
import { showToast } from './ui.js';
import { stripTashkeel, copyToClipboard } from './utils.js';
import { state } from './state.js';
import { __ } from './i18n.js';

/* ===================== INTERFACES ===================== */

/** Build share text for the current ayah. */
export function buildShareText(): string {
  if (!state.surahData) {
    return '';
  }
  const surahData = state.surahData;
  const a = surahData.ayahs[state.currentAyahIndex];
  if (!a) {
    return '';
  }
  return `${a.text} — ${surahData.name} — ${__('ayah')} ${a.numberInSurah}`;
}

/** Toggle share menu visibility. */
export function toggleShareMenu(): void {
  dom.shareMenu?.classList.toggle('show');
}

/** Share using native Web Share API or fallback to clipboard. */
export function shareNative(): void {
  const text = buildShareText();
  if (!text) {
    return;
  }
  if (navigator.share) {
    navigator.share({ title: __('app_title'), text }).catch(() => { /* noop */ });
  } else {
    shareCopy();
  }
}

/** Copy current ayah text to clipboard. */
export function shareCopy(): void {
  copyToClipboard(buildShareText());
  showToast(__('copied'), 'success');
}

/** Copy current ayah text without diacritics. */
export function shareCopySimple(): void {
  if (!state.surahData) {
    return;
  }
  const surahData = state.surahData;
  const a = surahData.ayahs[state.currentAyahIndex];
  if (!a) {
    return;
  }
  const text = `${stripTashkeel(a.text)} — ${surahData.name} — ${__('ayah')} ${a.numberInSurah}`;
  copyToClipboard(text);
  showToast(__('share_copied_simple'), 'success');
}

/** Share current ayah via WhatsApp. */
export function shareWhatsApp(): void {
  const text = buildShareText();
  if (!text) {
    return;
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

/** Share current ayah via Telegram. */
export function shareTelegram(): void {
  const text = buildShareText();
  if (!text) {
    return;
  }
  window.open(
    `https://t.me/share/url?url=${encodeURIComponent(location.href)}&text=${encodeURIComponent(text)}`,
    '_blank',
  );
}
