import { dom } from './dom.js';
import { showToast } from './ui.js';
import { stripTashkeel, copyToClipboard } from './utils.js';
import { state } from './state.js';

/* ===================== INTERFACES ===================== */

/** Ayah data shape from surahData.ayahs[] */
interface AyahData {
  numberInSurah: number;
  text: string;
  number?: number;
  audio?: string;
}

/** Surah data shape from state.surahData */
interface SurahData {
  name: string;
  ayahs: AyahData[];
  number?: number;
}

/** Build share text for the current ayah. */
export function buildShareText(): string {
  if (!state.surahData) return '';
  const surahData = state.surahData as unknown as SurahData;
  const a = surahData.ayahs[state.currentAyahIndex];
  if (!a) return '';
  return `${a.text} — ${surahData.name} — آية ${a.numberInSurah}`;
}

/** Toggle share menu visibility. */
export function toggleShareMenu(): void { dom.shareMenu?.classList.toggle('show'); }

/** Share using native Web Share API or fallback to clipboard. */
export function shareNative(): void {
  const text = buildShareText();
  if (!text) return;
  if (navigator.share) {
    navigator.share({ title: 'القرآن الكريم', text }).catch(() => { });
  } else {
    shareCopy();
  }
}

/** Copy current ayah text to clipboard. */
export function shareCopy(): void { copyToClipboard(buildShareText()); showToast('📋 تم نسخ الآية', 'success'); }

/** Copy current ayah text without diacritics. */
export function shareCopySimple(): void {
  if (!state.surahData) return;
  const surahData = state.surahData as unknown as SurahData;
  const a = surahData.ayahs[state.currentAyahIndex];
  if (!a) return;
  const text = `${stripTashkeel(a.text)} — ${surahData.name} — آية ${a.numberInSurah}`;
  copyToClipboard(text);
  showToast('📋 تم نسخ النص المبسط', 'success');
}

/** Share current ayah via WhatsApp. */
export function shareWhatsApp(): void {
  const text = buildShareText();
  if (!text) return;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

/** Share current ayah via Telegram. */
export function shareTelegram(): void {
  const text = buildShareText();
  if (!text) return;
  window.open(`https://t.me/share/url?url=${encodeURIComponent(location.href)}&text=${encodeURIComponent(text)}`, '_blank');
}
