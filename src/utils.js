export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

export function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function toArabicNumeral(num) {
  const digits = '٠١٢٣٤٥٦٧٨٩';
  return String(num).replace(/\d/g, d => digits[d]);
}

export function formatTime12(time24) {
  if (!time24) return '—';
  const [h, m] = time24.split(':');
  let hour = parseInt(h, 10);
  const period = hour >= 12 ? 'م' : 'ص';
  hour = hour % 12 || 12;
  return `${hour}:${m} ${period}`;
}

export function timeStrToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':');
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

/**
 * Canonical Arabic normalizer used by all three public functions.
 * Strips tashkeel/harakat and Quranic marks, normalizes alef/ya/ta-marbuta/hamza variants.
 * Does NOT handle dagger alif (U+0670) — callers decide whether to strip or convert it.
 */
function normalizeArabic(str) {
  return String(str)
    .replace(/[\u064B-\u065F\u0610-\u061A\u06D6-\u06ED\u08D0-\u08E3]/g, '')
    .replace(/[إأآٱٲٳٵ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '')
    .replace(/ۖ|ۗ|ۘ|ۙ|ۚ|ۛ|ۜ|۟|۠|ۡ|ۢ|ۣ|ۤ|ۥ|ۦ|ۧ|ۨ|۩|۪|۫|۬|ۭ/g, '');
}

export function stripTashkeel(str) {
  return normalizeArabic(str);
}

/** Normalize Arabic text for search comparison.
 *  Strips diacritics, unifies alef variants, normalizes Uthmani-specific patterns
 *  so that standard Arabic query matches Uthmani Quran text.
 */
export function normalizeExactText(str) {
  return normalizeArabic(str)
    .replace(/\u0670/g, '')
    .replace(/و(\S*ه(?!\S))/g, 'ا$1')
    .replace(/ت(?!\S)/g, 'ه');
}

/** More aggressive normalizer for fuzzy fallback when exact search yields 0 results.
 *  Converts dagger alif (U+0670) to ا instead of stripping it, keeping alifs
 *  for words like السماوات, الإنسان where the alif is written as dagger alif.
 */
export function normalizeRelaxed(str) {
  return String(str)
    .replace(/[\u064B-\u065F\u0610-\u061A\u06D6-\u06ED\u08D0-\u08E3]/g, '')
    .replace(/\u0670/g, 'ا')
    .replace(/[إأآٱٲٳٵ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '')
    .replace(/و(\S*ه(?!\S))/g, '$1')
    .replace(/ت(?!\S)/g, 'ه');
}

export function getArabicNumeral(digit) {
  const digits = '٠١٢٣٤٥٦٧٨٩';
  return digits[digit] || digit;
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (_) { }
  document.body.removeChild(ta);
}

export function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}
