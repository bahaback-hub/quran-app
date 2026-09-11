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
