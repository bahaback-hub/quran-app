const _escapeDiv: HTMLDivElement = document.createElement('div');

export function escapeHtml(str: string | null | undefined): string {
  _escapeDiv.textContent = str == null ? '' : String(str);
  return _escapeDiv.innerHTML;
}

export function escapeRegExp(str: string): string {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toArabicNumeral(num: number | string): string {
  const digits = '٠١٢٣٤٥٦٧٨٩';
  return String(num).replace(/\d/g, (d) => digits[parseInt(d, 10)]);
}

export function formatTime12(time24: string): string {
  if (!time24) return '—';
  const [h, m] = time24.split(':');
  let hour = parseInt(h, 10);
  const period = hour >= 12 ? 'م' : 'ص';
  hour = hour % 12 || 12;
  return `${hour}:${m} ${period}`;
}

export function timeStrToMinutes(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(':');
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

/**
 * Strip only tashkeel/harakat (diacritical marks) and Quranic annotation symbols.
 * Preserves hamzat, alef variants, ya, ta-marbuta, and all letter forms.
 */
export function stripTashkeel(str: string): string {
  return String(str)
    .replace(/[\u064B-\u065F\u0610-\u061A\u06D6-\u06ED\u08D0-\u08E3]/g, '')
    .replace(/ۖ|ۗ|ۘ|ۙ|ۚ|ۛ|ۜ|۟|۠|ۡ|ۢ|ۣ|ۤ|ۥ|ۦ|ۧ|ۨ|۩|۪|۫|۬|ۭ/g, '');
}

/**
 * Convert Uthmani وٰة (waw + dagger alif + ta marbuta) → اة before tashkeel removal.
 * This handles words like الصلوة → الصلاة, الزكوة → الزكاة, الحيوة → الحياة
 * where Uthmani uses وٰة but modern Arabic uses اة.
 * Must run BEFORE tashkeel stripping because ٰ (U+0670) is otherwise removed.
 */
function uthmaniWawAlefFix(str: string): string {
  return String(str)
    // وٰة (waw + optional diacritics + dagger alif + optional diacritics + ta marbuta)
    .replace(/و[\u064B-\u065F]*\u0670[\u064B-\u065F]*ة/g, 'اة');
}

/**
 * Canonical Arabic normalizer used by search functions.
 * Strips tashkeel/harakat and Quranic marks, normalizes alef/ya/ta-marbuta/hamza variants.
 * Applies Uthmani وٰة→اة fix BEFORE tashkeel removal for accurate matching.
 */
function normalizeArabic(str: string): string {
  return uthmaniWawAlefFix(String(str))
    .replace(/[\u064B-\u065F\u0610-\u061A\u06D6-\u06ED\u08D0-\u08E3]/g, '')
    .replace(/[إأآٱٲٳٵ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '')
    .replace(/ۖ|ۗ|ۘ|ۙ|ۚ|ۛ|ۜ|۟|۠|ۡ|ۢ|ۣ|ۤ|ۥ|ۦ|ۧ|ۨ|۩|۪|۫|۬|ۭ/g, '');
}

/** Normalize Arabic text for search comparison.
 *  Strips diacritics, unifies alef variants, normalizes Uthmani-specific patterns
 *  so that standard Arabic query matches Uthmani Quran text.
 */
export function normalizeExactText(str: string): string {
  return normalizeArabic(str)
    .replace(/\u0670/g, '');
}

/** More aggressive normalizer for fuzzy fallback when exact search yields 0 results.
 *  Converts dagger alif (U+0670) to ا instead of stripping it, keeping alifs
 *  for words like الكتاب, السماوات, الإنسان where the alif is written as dagger alif.
 *  Also applies Uthmani وٰة→اة fix for words like الصلاة, الزكاة.
 */
export function normalizeRelaxed(str: string): string {
  return uthmaniWawAlefFix(String(str))
    .replace(/[\u064B-\u065F\u0610-\u061A\u06D6-\u06ED\u08D0-\u08E3]/g, '')
    .replace(/\u0670/g, 'ا')
    .replace(/[إأآٱٲٳٵ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '');
}

export function getArabicNumeral(digit: string | number): string {
  const digits = '٠١٢٣٤٥٦٧٨٩';
  const index = typeof digit === 'number' ? digit : parseInt(digit, 10);
  return digits[index] || String(digit);
}

function fallbackCopy(text: string): void {
  const ta: HTMLTextAreaElement = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } catch (_e) {
    /* noop */
  }
  document.body.removeChild(ta);
}

export function copyToClipboard(text: string): void {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

/** Trigger haptic (vibration) feedback if supported. */
export function hapticFeedback(pattern: number = 10): void {
  if (navigator.vibrate) navigator.vibrate(pattern);
}
