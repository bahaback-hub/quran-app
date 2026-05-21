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

export function normalizeExactText(str) {
  return String(str)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');
}

export function getArabicNumeral(digit) {
  const digits = '٠١٢٣٤٥٦٧٨٩';
  return digits[digit] || digit;
}
