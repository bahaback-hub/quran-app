/**
 * Utility functions for Quran App.
 *
 * Provides HTML escaping, Arabic text normalization, clipboard operations,
 * number formatting, and time conversion helpers used across modules.
 */

const _escapeDiv: HTMLDivElement = document.createElement('div');

/**
 * Escape HTML special characters using DOM-based escaping (safe against XSS).
 * Uses textContent/innerHTML round-trip for robust escaping.
 *
 * @param str The string to escape (null/undefined treated as empty string)
 * @returns Escaped HTML string safe for innerHTML assignment
 *
 * @example
 *   escapeHtml('<script>alert("xss")</script>')
 *   // → '&lt;script&gt;alert("xss")&lt;/script&gt;'
 */
export function escapeHtml(str: string | null | undefined): string {
  _escapeDiv.textContent = str == null ? '' : String(str);
  return _escapeDiv.innerHTML;
}

/**
 * Escape special characters in a string for use in a RegExp.
 *
 * @param str The raw string to escape
 * @returns Escaped string safe for use inside `new RegExp()`
 *
 * @example
 *   escapeRegExp('hello.world')
 *   // → 'hello\\.world'
 */
export function escapeRegExp(str: string): string {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Pad a number with a leading zero to create a 2-digit string.
 *
 * @param n The number to pad (0-99)
 * @returns 2-digit string with leading zero if needed
 *
 * @example
 *   pad2(5)  // → '05'
 *   pad2(12) // → '12'
 */
export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Convert Western Arabic numerals (0-9) to Eastern Arabic numerals.
 *
 * @param num A number or numeric string to convert
 * @returns String with Eastern Arabic digits (٠-٩)
 *
 * @example
 *   toArabicNumeral(42)  // → '٤٢'
 *   toArabicNumeral('2024') // → '٢٠٢٤'
 */
export function toArabicNumeral(num: number | string): string {
  const digits = '٠١٢٣٤٥٦٧٨٩';
  return String(num).replace(/\d/g, (d) => digits[parseInt(d, 10)]);
}

/**
 * Convert 24-hour time format (HH:MM) to 12-hour format with Arabic AM/PM.
 *
 * @param time24 Time string in HH:MM format
 * @returns Formatted time string with ص/م suffix, or '—' if input is empty
 *
 * @example
 *   formatTime12('14:30') // → '2:30 م'
 *   formatTime12('08:00') // → '8:00 ص'
 */
export function formatTime12(time24: string): string {
  if (!time24) return '—';
  const [h, m] = time24.split(':');
  let hour = parseInt(h, 10);
  const period = hour >= 12 ? 'م' : 'ص';
  hour = hour % 12 || 12;
  return `${hour}:${m} ${period}`;
}

/**
 * Convert a time string (HH:MM) to total minutes since midnight.
 *
 * @param t Time string in HH:MM format
 * @returns Total minutes (0 for empty/invalid input)
 *
 * @example
 *   timeStrToMinutes('02:30') // → 150
 *   timeStrToMinutes('14:00') // → 840
 */
export function timeStrToMinutes(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(':');
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

/**
 * Strip only tashkeel/harakat (diacritical marks) and Quranic annotation symbols.
 * Preserves hamzat, alef variants, ya, ta-marbuta, and all letter forms.
 *
 * @param str Arabic text that may contain diacritical marks
 * @returns Text with tashkeel removed but letters intact
 *
 * @example
 *   stripTashkeel('بِسْمِ اللَّهِ') // → 'بسم الله'
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
 *
 * @param str Arabic text potentially containing Uthmani patterns
 * @returns Text with وٰة patterns converted to اة
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
 *
 * @param str Raw Arabic text to normalize
 * @returns Normalized text suitable for search comparison
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

/**
 * Normalize Arabic text for exact search comparison.
 * Strips diacritics, unifies alef variants, normalizes Uthmani-specific patterns
 * so that standard Arabic query matches Uthmani Quran text.
 *
 * @param str Raw Arabic text to normalize
 * @returns Normalized text with dagger alif (U+0670) removed
 *
 * @example
 *   normalizeExactText('الصِّرَٰطَ') // → 'الصرط'
 */
export function normalizeExactText(str: string): string {
  return normalizeArabic(str)
    .replace(/\u0670/g, '');
}

/**
 * More aggressive normalizer for fuzzy fallback when exact search yields 0 results.
 * Converts dagger alif (U+0670) to ا instead of stripping it, keeping alifs
 * for words like الكتاب, السماوات, الإنسان where the alif is written as dagger alif.
 * Also applies Uthmani وٰة→اة fix for words like الصلاة, الزكاة.
 *
 * @param str Raw Arabic text to normalize
 * @returns Aggressively normalized text suitable for fuzzy matching
 *
 * @example
 *   normalizeRelaxed('دَعَوٰا') // → 'دعوا'
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

/**
 * Get the Eastern Arabic numeral for a single digit.
 *
 * @param digit A single digit (0-9) as number or string
 * @returns Eastern Arabic numeral character, or the original digit if out of range
 *
 * @example
 *   getArabicNumeral(5)   // → '٥'
 *   getArabicNumeral('0') // → '٠'
 */
export function getArabicNumeral(digit: string | number): string {
  const digits = '٠١٢٣٤٥٦٧٨٩';
  const index = typeof digit === 'number' ? digit : parseInt(digit, 10);
  return digits[index] || String(digit);
}

/**
 * Fallback clipboard copy using a temporary textarea element.
 * Used when navigator.clipboard API is not available.
 *
 * @param text The text to copy to clipboard
 */
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

/**
 * Copy text to the system clipboard.
 * Uses the Clipboard API with a fallback to execCommand for older browsers.
 *
 * @param text The text to copy
 *
 * @example
 *   copyToClipboard('بسم الله الرحمن الرحيم')
 */
export function copyToClipboard(text: string): void {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

/**
 * Trigger haptic (vibration) feedback if the browser supports it.
 * Commonly used on button presses for tactile feedback on mobile.
 *
 * @param pattern Vibration pattern in milliseconds (default: 10ms short buzz)
 *
 * @example
 *   hapticFeedback()       // Short 10ms buzz
 *   hapticFeedback(50)     // Longer 50ms buzz
 */
export function hapticFeedback(pattern: number = 10): void {
  if (navigator.vibrate) navigator.vibrate(pattern);
}
