/**
 * Search HTML templates (result items, cards, history, autocomplete).
 *
 * Pure functions returning HTML strings. Re-exported from templates.js so
 * existing imports keep working unchanged.
 */

import { __ } from './i18n.js';
import { escapeHtml } from './templates/escape.js';

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
  return (
    `<div class="search-result" data-surah="${result.surah}" data-ayah="${result.ayah}">` +
    `<div class="search-result-text">${displayText}</div>` +
    `<div class="search-result-meta">${escapeHtml(result.surahName)} - ${__('ayah') || 'آية'} ${result.ayah}</div>` +
    `</div>`
  );
}

/* ===================== SEARCH UI TEMPLATES ===================== */

/**
 * Generate the empty search results message.
 *
 * @returns HTML string for the no-results message
 */
export function searchEmptyResults(): string {
  return `<div class="search-empty">❌ ${__('no_results')}</div>`;
}

/**
 * Generate the search results header with count and close button.
 *
 * @param totalResults Total number of search results found
 * @returns HTML string for the results header
 */
export function searchResultsHeader(totalResults: number): string {
  return `<div class="search-results-header">
    <span>✅ ${__('results_count')}: ${totalResults}</span>
    <button class="search-results-close" id="closeSearchResultsBtn" aria-label="${__('close')}">✖</button>
  </div>`;
}

/**
 * Generate a search result card with highlighted text and action buttons.
 *
 * @param result Search result data with pre-computed highlight
 * @returns HTML string for the search result card
 */
export function searchResultCard(result: {
  surah: number;
  ayah: number;
  surahName: string;
  fulltextIndex: number;
  highlighted: string;
}): string {
  return `<div class="search-result-item" data-surah="${result.surah}" data-ayah="${result.ayah}" data-surahname="${escapeHtml(result.surahName || '')}" data-fulltext-index="${result.fulltextIndex}">
      <div class="search-result-title">${escapeHtml(result.surahName || '')} — ${__('ayah')} ${result.ayah}</div>
      <div class="search-result-text">${result.highlighted}</div>
      <div class="search-result-actions">
        <button class="search-play" data-surah="${result.surah}" data-ayah="${result.ayah}">${__('search_play')}</button>
        <button class="search-copy" data-surah="${result.surah}" data-ayah="${result.ayah}">${__('search_copy')}</button>
        <button class="search-share" data-surah="${result.surah}" data-ayah="${result.ayah}">${__('search_share')}</button>
        <button class="search-goto" data-surah="${result.surah}" data-ayah="${result.ayah}">${__('search_goto')}</button>
      </div>
    </div>`;
}

/**
 * Generate the "load more" button for paginated search results.
 *
 * @param remaining Number of additional results that can be loaded
 * @returns HTML string for the load more button
 */
export function searchLoadMoreButton(remaining: number): string {
  return `<div class="search-load-more">
      <button class="btn btn-gold" id="loadMoreSearchBtn">${__('load_more', String(remaining))}</button>
    </div>`;
}

/**
 * Generate a search history dropdown item with remove button.
 *
 * @param text The search history entry text
 * @param index The index of the entry in the history list
 * @returns HTML string for the history item
 */
export function searchHistoryItem(text: string, index: number): string {
  return (
    `<div class="search-autocomplete-item search-history-item" data-index="${index}">` +
    `<span>${escapeHtml(text)}</span>` +
    `<span class="count search-history-remove">✕</span>` +
    `</div>`
  );
}

/**
 * Generate a search autocomplete suggestion item.
 *
 * @param word The suggestion word
 * @param count Number of occurrences
 * @param index The index of the suggestion in the list
 * @returns HTML string for the autocomplete item
 */
export function searchAutocompleteItem(word: string, count: number, index: number): string {
  return (
    `<div class="search-autocomplete-item" data-index="${index}">` +
    `<span>${escapeHtml(word)}</span>` +
    `<span class="count">${count}</span>` +
    `</div>`
  );
}
