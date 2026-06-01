import { dom } from './dom.js';
import { showToast } from './ui.js';
import { stripTashkeel, copyToClipboard } from './utils.js';
import { state } from './state.js';

/** Build share text for the current ayah. */
export function buildShareText() {
  if (!state.surahData) return '';
  const a = state.surahData.ayahs[state.currentAyahIndex];
  if (!a) return '';
  return `${a.text} — ${state.surahData.name} — آية ${a.numberInSurah}`;
}

/** Toggle share menu visibility. */
export function toggleShareMenu() { dom.shareMenu?.classList.toggle('show'); }

/** Share using native Web Share API or fallback to clipboard. */
export function shareNative() {
  const text = buildShareText();
  if (!text) return;
  if (navigator.share) {
    navigator.share({ title: 'القرآن الكريم', text }).catch(() => { });
  } else {
    shareCopy();
  }
}

/** Copy current ayah text to clipboard. */
export function shareCopy() { copyToClipboard(buildShareText()); showToast('📋 تم نسخ الآية', 'success'); }
/** Copy current ayah text without diacritics. */
export function shareCopySimple() {
  if (!state.surahData) return;
  const a = state.surahData.ayahs[state.currentAyahIndex];
  if (!a) return;
  const text = `${stripTashkeel(a.text)} — ${state.surahData.name} — آية ${a.numberInSurah}`;
  copyToClipboard(text);
  showToast('📋 تم نسخ النص المبسط', 'success');
}
/** Share current ayah via WhatsApp. */
export function shareWhatsApp() {
  const text = buildShareText();
  if (!text) return;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}
/** Share current ayah via Telegram. */
export function shareTelegram() {
  const text = buildShareText();
  if (!text) return;
  window.open(`https://t.me/share/url?url=${encodeURIComponent(location.href)}&text=${encodeURIComponent(text)}`, '_blank');
}
