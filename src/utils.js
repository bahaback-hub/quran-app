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

/** Normalize Arabic text for search comparison.
 *  Strips diacritics, unifies alef variants, normalizes Uthmani-specific patterns
 *  so that standard Arabic query matches Uthmani Quran text.
 */
export function normalizeExactText(str) {
  let s = String(str);
  // 1. Remove all tashkeel (harakat), dagger alif, and Uthmani marks
  s = s.replace(/[\u064B-\u065F\u0670\u0610-\u061A\u06D6-\u06ED\u08D0-\u08E3]/g, '');
  // 2. Normalize alef variants
  s = s.replace(/[إأآٱٲٳٵ]/g, 'ا');
  // 3. Alif maqsura → ya
  s = s.replace(/ى/g, 'ي');
  // 4. Ta marbuta → ha (standard Arabic ↔ Uthmani bridge)
  s = s.replace(/ة/g, 'ه');
  // 5. Hamza on waw → waw, hamza on ya → ya
  s = s.replace(/ؤ/g, 'و');
  s = s.replace(/ئ/g, 'ي');
  s = s.replace(/ء/g, '');
  // 6. Uthmani: و before word-final ه → ا (الصلاة ← الصلواة)
  s = s.replace(/و(\S*ه(?!\S))/g, 'ا$1');
  // 7. Final ت → ه (رحمت ← رحمة pattern in Uthmani)
  s = s.replace(/ت(?!\S)/g, 'ه');
  return s;
}

/** More aggressive normalizer for fuzzy fallback when exact search yields 0 results.
 *  Converts dagger alif (U+0670) to ا instead of removing it, keeping alifs
 *  for words like السماوات, الإنسان where the alif is written as dagger alif.
 */
export function normalizeRelaxed(str) {
  let s = normalizeExactText(str);
  // Additional: convert any remaining dagger alif → ا (some Uthmani words keep alifs this way)
  // Since step 1 in normalizeExactText removes U+0670, the "relaxed" version is different:
  // we re-process from scratch with a different strategy
  s = String(str)
    .replace(/[\u064B-\u065F\u0610-\u061A\u06D6-\u06ED\u08D0-\u08E3]/g, '')  // remove tashkeel but KEEP U+0670
    .replace(/\u0670/g, 'ا')  // convert dagger alif to regular alif
    .replace(/[إأآٱٲٳٵ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '')
    .replace(/و(\S*ه(?!\S))/g, '$1')
    .replace(/ت(?!\S)/g, 'ه');
  return s;
}

export function stripTashkeel(str) {
  return String(str)
    .replace(/[\u064B-\u065F\u0610-\u061A\u06D6-\u06ED\u08D0-\u08E3]/g, '')
    .replace(/\u0670/g, 'ا')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ۖ|ۗ|ۘ|ۙ|ۚ|ۛ|ۜ|۟|۠|ۡ|ۢ|ۣ|ۤ|ۥ|ۦ|ۧ|ۨ|۩|۪|۫|۬|ۭ/g, '');
}

export function getArabicNumeral(digit) {
  const digits = '٠١٢٣٤٥٦٧٨٩';
  return digits[digit] || digit;
}
