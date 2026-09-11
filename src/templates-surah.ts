/**
 * Surah and ayah HTML templates (selector options, ayah elements, loader states).
 *
 * Pure functions returning HTML strings. Re-exported from templates.js so
 * existing imports keep working unchanged.
 */

import type { SurahInfo } from './state.js';
import { __ } from './i18n.js';
import { escapeHtml } from './templates/escape.js';

/* ===================== SURAH TEMPLATES ===================== */

/**
 * Generate an `<option>` element for a surah in the surah selector.
 *
 * @param surah Surah metadata entry
 * @param selected Whether this option should be selected
 * @returns HTML string for the option element
 */
export function surahOption(surah: SurahInfo, selected: boolean = false): string {
  const sel = selected ? ' selected' : '';
  return `<option value="${surah.number}"${sel}>${surah.number}. ${escapeHtml(surah.name)}</option>`;
}

/**
 * Generate the full surah list options HTML for the surah selector.
 *
 * @param surahList Array of surah metadata
 * @param currentSurah Currently selected surah number
 * @returns HTML string for all option elements
 */
export function surahListOptions(surahList: SurahInfo[], currentSurah: number): string {
  return surahList.map((s) => surahOption(s, s.number === currentSurah)).join('');
}

/**
 * Generate a surah list item for the mushaf surah overlay.
 *
 * @param surah Surah metadata entry
 * @returns HTML string for the list item
 */
export function mushafSurahItem(surah: SurahInfo): string {
  return (
    `<button class="mushaf-surah-item" data-surah="${surah.number}">` +
    `<span class="mushaf-surah-num">${surah.number}</span>` +
    `<span class="mushaf-surah-name">${escapeHtml(surah.name)}</span>` +
    `<span class="mushaf-surah-count">${surah.numberOfAyahs} ${__('ayah') || 'آية'}</span>` +
    `</button>`
  );
}

/* ===================== AYAH TEMPLATES ===================== */

/**
 * Generate an ayah element with optional tajweed coloring and word-by-word spans.
 *
 * @param ayah The ayah data object
 * @param index The ayah's index in the surah
 * @param options Rendering options (tajweed, hifdh, word spans)
 * @returns HTML string for the ayah element
 */
export function ayahElement(
  ayah: { numberInSurah: number; text: string },
  index: number,
  options: {
    tajweedEnabled?: boolean;
    hifdhMode?: boolean;
    includeWordSpans?: boolean;
  } = {},
): string {
  const { tajweedEnabled = false, hifdhMode = false, includeWordSpans = true } = options;
  const hifdhClass = hifdhMode ? ' hifdh-mode' : '';
  const ayahNum = `﴿${ayah.numberInSurah}﴾`;

  let textContent: string;
  if (includeWordSpans && !tajweedEnabled) {
    // Split text into word spans for word-by-word tracking
    textContent = splitIntoWordSpans(ayah.text);
  } else {
    textContent = escapeHtml(ayah.text);
  }

  return (
    `<div class="ayah${hifdhClass}" data-index="${index}" data-ayah="${ayah.numberInSurah}">` +
    `<span class="ayah-text">${textContent}</span>` +
    `<span class="ayah-number">${ayahNum}</span>` +
    `</div>`
  );
}

/**
 * Split Arabic text into word spans for word-by-word highlight tracking.
 * Handles tajweed markup by preserving <tajweed> tags.
 *
 * @param text The ayah text (may contain tajweed markup)
 * @returns HTML string with each word wrapped in a span.word
 */
function splitIntoWordSpans(text: string): string {
  // For tajweed text, we need to handle <tajweed> tags specially
  if (text.includes('<tajweed')) {
    return text;
  }
  const words = text.split(/\s+/);
  return words.map((w) => `<span class="word">${escapeHtml(w)}</span>`).join(' ');
}

/* ===================== SURAH LOADER TEMPLATES ===================== */

/**
 * Generate a loading placeholder for the surah select dropdown.
 */
export function surahSelectLoading(): string {
  return `<option value="">${__('loading_surah_list') || 'جاري التحميل...'}</option>`;
}

/**
 * Generate an error placeholder for the surah select dropdown.
 */
export function surahSelectError(): string {
  return `<option value="">${__('error_unexpected') || 'حدث خطأ'}</option>`;
}

/**
 * Generate the default "select surah" placeholder option.
 */
export function surahSelectDefault(): string {
  return `<option value="">${__('select_surah') || 'اختر السورة'}</option>`;
}

/**
 * Generate reciter select options HTML.
 */
export function reciterOptions(reciters: Array<{ id: string; name: string }>, selectedId: string): string {
  return reciters
    .map(
      (r) =>
        `<option value="${escapeHtml(r.id)}"${r.id === selectedId ? ' selected' : ''}>${escapeHtml(r.name)}</option>`,
    )
    .join('');
}

/**
 * Generate a skeleton loading state for surah content.
 */
export function skeletonLoading(): string {
  return '<div class="skeleton-loading">' + '<div class="skeleton-line"></div>'.repeat(5) + '</div>';
}

/**
 * Generate a surah load error message.
 */
export function surahLoadError(): string {
  return `<p class="error-msg">\u26A0\uFE0F ${__('failed_load_surah') || 'فشل تحميل السورة'}</p>`;
}

/**
 * Generate the surah content shell (title + bismillah + ayahs container).
 */
export function surahContentShell(surahName: string, bismillah: string): string {
  return (
    `<h2 class="surah-title">${escapeHtml(surahName)}</h2>` +
    `<div class="bismillah">${escapeHtml(bismillah)}</div>` +
    `<div class="ayahs-container"></div>`
  );
}

/**
 * Generate collapsed player info.
 */
export function collapsedPlayerInfo(surahName: string, ayahInfo = ''): string {
  const ayah = ayahInfo ? `<span>${escapeHtml(ayahInfo)}</span>` : '';
  return `<span class="fi-surah">${escapeHtml(surahName)}</span>${ayah}`;
}
