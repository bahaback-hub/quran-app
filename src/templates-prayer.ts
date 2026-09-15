/**
 * Prayer HTML templates (time rows, countdown container).
 *
 * Pure functions returning HTML strings. Re-exported from templates.js so
 * existing imports keep working unchanged.
 */

import { escapeHtml } from './templates/escape.js';

/* ===================== PRAYER TEMPLATES ===================== */

/**
 * Generate a prayer time row for the prayer times table.
 *
 * @param name Prayer name (already localized)
 * @param time Prayer time string (HH:MM format)
 * @param isNext Whether this is the next upcoming prayer
 * @returns HTML string for the table row
 */
export function prayerTimeRow(name: string, time: string, isNext: boolean = false): string {
  const highlightClass = isNext ? ' prayer-next' : '';
  return (
    `<div class="prayer-row${highlightClass}">` +
    `<span class="prayer-name">${escapeHtml(name)}</span>` +
    `<span class="prayer-time">${escapeHtml(time)}</span>` +
    `</div>`
  );
}

/**
 * Country → cities for the prayer-bar quick location picker.
 * City names stay Arabic (proper nouns, same as the settings quick select);
 * the `CC` code travels with each value so duplicate city names
 * (e.g. طرابلس in LB/LY) stay unambiguous: value is "city|CC".
 */
export interface PrayerBarLocationGroup {
  code: string;
  label: string;
  cities: string[];
}

export const PRAYER_BAR_LOCATIONS: PrayerBarLocationGroup[] = [
  {
    code: 'SA',
    label: 'السعودية',
    cities: ['مكة المكرمة', 'المدينة المنورة', 'الرياض', 'جدة', 'الدمام', 'أبها', 'تبوك', 'بريدة', 'حائل', 'الطائف'],
  },
  { code: 'EG', label: 'مصر', cities: ['القاهرة', 'الإسكندرية', 'الجيزة', 'أسوان'] },
  { code: 'JO', label: 'الأردن', cities: ['عمّان', 'الزرقاء', 'إربد'] },
  { code: 'PS', label: 'فلسطين', cities: ['القدس', 'غزة', 'الخليل'] },
  { code: 'SY', label: 'سوريا', cities: ['دمشق', 'حلب', 'حمص'] },
  { code: 'LB', label: 'لبنان', cities: ['بيروت', 'طرابلس'] },
  { code: 'IQ', label: 'العراق', cities: ['بغداد', 'البصرة', 'الموصل', 'أربيل'] },
  { code: 'KW', label: 'الكويت', cities: ['الكويت', 'حولي'] },
  { code: 'BH', label: 'البحرين', cities: ['المنامة'] },
  { code: 'QA', label: 'قطر', cities: ['الدوحة', 'الريان'] },
  { code: 'AE', label: 'الإمارات', cities: ['دبي', 'أبوظبي', 'الشارقة'] },
  { code: 'OM', label: 'عُمان', cities: ['مسقط'] },
  { code: 'YE', label: 'اليمن', cities: ['صنعاء', 'عدن'] },
  { code: 'DZ', label: 'الجزائر', cities: ['الجزائر', 'وهران', 'قسنطينة'] },
  { code: 'MA', label: 'المغرب', cities: ['الرباط', 'الدار البيضاء', 'فاس'] },
  { code: 'TN', label: 'تونس', cities: ['تونس', 'صفاقس'] },
  { code: 'LY', label: 'ليبيا', cities: ['طرابلس', 'بنغازي'] },
  { code: 'SD', label: 'السودان', cities: ['الخرطوم', 'أم درمان'] },
  { code: 'MR', label: 'موريتانيا', cities: ['نواكشوط'] },
  { code: 'TR', label: 'تركيا', cities: ['إسطنبول', 'أنقرة'] },
];

/** `<option>` list for the country select. */
export function barCountryOptions(): string {
  return PRAYER_BAR_LOCATIONS.map((g) => `<option value="${escapeHtml(g.code)}">${escapeHtml(g.label)}</option>`).join(
    '',
  );
}

/** `<option>` list for the city select of one country code. */
export function barCityOptions(countryCode: string): string {
  const group = PRAYER_BAR_LOCATIONS.find((g) => g.code === countryCode) ?? PRAYER_BAR_LOCATIONS[0]!;
  return group.cities
    .map((c) => `<option value="${escapeHtml(c)}|${escapeHtml(group.code)}">${escapeHtml(c)}</option>`)
    .join('');
}
/**
 * Generate prayer times rows HTML.
 * Includes a live "time until next prayer" banner at the top of the container
 * (filled by updateCountdowns() in prayer.ts).
 */
export function prayerTimesRows(times: Array<{ name: string; time: string; isNext: boolean }>): string {
  if (times.length === 0) {
    return '';
  }
  const banner = `<div id="prayerNextCountdown" class="prayer-next-countdown"></div>`;
  return banner + times.map((t) => prayerTimeRow(t.name, t.time, t.isNext)).join('');
}
