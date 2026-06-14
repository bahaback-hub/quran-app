/**
 * Centralized HTML Template Functions for Quran App.
 *
 * This module provides type-safe, documented template functions for all
 * dynamically generated HTML content. Instead of scattering innerHTML
 * strings across modules, each template is a pure function that returns
 * an HTML string, making it easy to:
 *
 *   1. Audit and review all generated HTML in one place
 *   2. Test templates independently (pure functions, no side effects)
 *   3. Ensure consistent escaping and formatting
 *   4. Reduce code duplication across modules
 *
 * Usage:
 *   import { surahOption, ayahElement, favoriteItem } from './templates.js';
 *   surahSelect.innerHTML = surahList.map(s => surahOption(s)).join('');
 *
 * Security note: All template functions MUST escape user-provided text
 * using the `escapeHtml` utility to prevent XSS.
 */

import type { SurahInfo, FavoriteEntry } from './state.js';
import type { SurahData } from './types.js';
import { __ } from './i18n.js';

/* ===================== ESCAPE UTILITY ===================== */

/**
 * Escape HTML special characters to prevent XSS injection.
 * MUST be used for all user-provided or API-provided text in templates.
 *
 * @param text Raw text that may contain HTML characters
 * @returns Escaped text safe for innerHTML assignment
 *
 * @example
 *   escapeHtml('<script>alert("xss")</script>')
 *   // → '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
  return surahList.map(s => surahOption(s, s.number === currentSurah)).join('');
}

/**
 * Generate a surah list item for the mushaf surah overlay.
 *
 * @param surah Surah metadata entry
 * @returns HTML string for the list item
 */
export function mushafSurahItem(surah: SurahInfo): string {
  return `<button class="mushaf-surah-item" data-surah="${surah.number}">` +
    `<span class="mushaf-surah-num">${surah.number}</span>` +
    `<span class="mushaf-surah-name">${escapeHtml(surah.name)}</span>` +
    `<span class="mushaf-surah-count">${surah.numberOfAyahs} ${__('ayah') || 'آية'}</span>` +
    `</button>`;
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
  } = {}
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

  return `<div class="ayah${hifdhClass}" data-index="${index}" data-ayah="${ayah.numberInSurah}">` +
    `<span class="ayah-text">${textContent}</span>` +
    `<span class="ayah-number">${ayahNum}</span>` +
    `</div>`;
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
  return words.map(w => `<span class="word">${escapeHtml(w)}</span>`).join(' ');
}

/* ===================== FAVORITE TEMPLATES ===================== */

/**
 * Generate a favorite ayah list item.
 *
 * @param entry Favorite entry data
 * @returns HTML string for the favorite item
 */
export function favoriteItem(entry: FavoriteEntry): string {
  return `<div class="fav-item" data-key="${escapeHtml(entry.key)}">` +
    `<div class="fav-text">${escapeHtml(entry.text)}</div>` +
    `<div class="fav-meta">${escapeHtml(entry.surahName)} - ${__('ayah') || 'آية'} ${entry.ayah}</div>` +
    `<div class="fav-actions">` +
    `<button class="btn btn-sm fav-goto-btn" data-surah="${entry.surah}" data-ayah="${entry.ayah}">📖</button>` +
    `<button class="btn btn-sm fav-remove-btn" data-key="${escapeHtml(entry.key)}">🗑️</button>` +
    `</div></div>`;
}

/**
 * Generate the empty favorites list message.
 *
 * @returns HTML string for the empty state message
 */
export function emptyFavoritesMessage(): string {
  return `<p class="centered-muted">${__('no_favorites') || 'لا توجد آيات مفضلة بعد'}</p>`;
}

/* ===================== SEARCH TEMPLATES ===================== */

/**
 * Generate a search result item for an ayah match.
 *
 * @param result Search result with surah info and highlighted text
 * @returns HTML string for the search result item
 */
export function searchResultItem(result: {
  surah: number;
  surahName: string;
  ayah: number;
  text: string;
  highlight?: string;
}): string {
  const displayText = result.highlight || escapeHtml(result.text);
  return `<div class="search-result" data-surah="${result.surah}" data-ayah="${result.ayah}">` +
    `<div class="search-result-text">${displayText}</div>` +
    `<div class="search-result-meta">${escapeHtml(result.surahName)} - ${__('ayah') || 'آية'} ${result.ayah}</div>` +
    `</div>`;
}

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
  return `<div class="prayer-row${highlightClass}">` +
    `<span class="prayer-name">${escapeHtml(name)}</span>` +
    `<span class="prayer-time">${escapeHtml(time)}</span>` +
    `</div>`;
}

/* ===================== ERROR BOUNDARY TEMPLATE ===================== */

/**
 * Generate the error recovery overlay HTML.
 *
 * @param errorMessage The error message to display
 * @returns HTML string for the error overlay
 */
export function errorOverlay(errorMessage: string): string {
  return `<div class="error-overlay" id="errorOverlay">` +
    `<div class="error-overlay-inner">` +
    `<h2>⚠️ ${__('error_title') || 'حدث خطأ'}</h2>` +
    `<p class="error-message">${escapeHtml(errorMessage)}</p>` +
    `<div class="error-actions">` +
    `<button class="btn btn-gold" onclick="location.reload()">${__('reload') || 'إعادة تحميل'}</button>` +
    `<button class="btn" onclick="location.href='/'">${__('home') || 'الرئيسية'}</button>` +
    `<button class="btn btn-sm" id="errorCopyBtn">${__('copy_error') || 'نسخ الخطأ'}</button>` +
    `</div></div></div>`;
}

/* ===================== LOADING TEMPLATES ===================== */

/**
 * Generate a loading skeleton placeholder for ayah content.
 *
 * @param count Number of skeleton lines to generate
 * @returns HTML string with skeleton elements
 */
export function loadingSkeleton(count: number = 5): string {
  const lines = Array.from({ length: count }, () =>
    `<div class="skeleton-line"></div>`
  ).join('');
  return `<div class="loading-skeleton">${lines}</div>`;
}

/* ===================== ADHKAR TEMPLATES ===================== */

/**
 * Generate an adhkar item for the adhkar list.
 *
 * @param text Adhkar text
 * @param count Current count
 * @param target Target count
 * @returns HTML string for the adhkar item
 */
export function adhkarItem(text: string, count: number, target: number): string {
  const progress = target > 0 ? Math.min(100, (count / target) * 100) : 0;
  const completed = count >= target;
  const completedClass = completed ? ' adhkar-completed' : '';

  return `<div class="adhkar-item${completedClass}" data-count="${count}" data-target="${target}">` +
    `<div class="adhkar-text">${escapeHtml(text)}</div>` +
    `<div class="adhkar-progress-bar">` +
    `<div class="adhkar-progress-fill" style="width:${progress}%"></div>` +
    `</div>` +
    `<div class="adhkar-counter">${count} / ${target}</div>` +
    `</div>`;
}
