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
export function escapeHtml(text: string | null | undefined): string {
  if (text == null) {
    return '';
  }
  return String(text)
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

/* ===================== FAVORITE TEMPLATES ===================== */

/**
 * Generate a favorite ayah list item.
 *
 * @param entry Favorite entry data
 * @returns HTML string for the favorite item
 */
export function favoriteItem(entry: FavoriteEntry): string {
  return (
    `<div class="fav-item" data-key="${escapeHtml(entry.key)}">` +
    `<div class="fav-text">${escapeHtml(entry.text)}</div>` +
    `<div class="fav-meta">${escapeHtml(entry.surahName)} - ${__('ayah') || 'آية'} ${entry.ayah}</div>` +
    `<div class="fav-actions">` +
    `<button class="btn btn-sm fav-goto-btn" data-surah="${entry.surah}" data-ayah="${entry.ayah}">📖</button>` +
    `<button class="btn btn-sm fav-remove-btn" data-key="${escapeHtml(entry.key)}">🗑️</button>` +
    `</div></div>`
  );
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
  return (
    `<div class="search-result" data-surah="${result.surah}" data-ayah="${result.ayah}">` +
    `<div class="search-result-text">${displayText}</div>` +
    `<div class="search-result-meta">${escapeHtml(result.surahName)} - ${__('ayah') || 'آية'} ${result.ayah}</div>` +
    `</div>`
  );
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
  return (
    `<div class="prayer-row${highlightClass}">` +
    `<span class="prayer-name">${escapeHtml(name)}</span>` +
    `<span class="prayer-time">${escapeHtml(time)}</span>` +
    `</div>`
  );
}

/* ===================== ERROR BOUNDARY TEMPLATE ===================== */

/**
 * Generate the error recovery overlay HTML.
 *
 * @param errorMessage The error message to display
 * @returns HTML string for the error overlay
 */
export function errorOverlay(errorMessage: string): string {
  return (
    `<div class="error-overlay" id="errorOverlay">` +
    `<div class="error-overlay-inner">` +
    `<h2>⚠️ ${__('error_title') || 'حدث خطأ'}</h2>` +
    `<p class="error-message">${escapeHtml(errorMessage)}</p>` +
    `<div class="error-actions">` +
    `<button class="btn btn-gold" onclick="location.reload()">${__('reload') || 'إعادة تحميل'}</button>` +
    `<button class="btn" onclick="location.href='/'">${__('home') || 'الرئيسية'}</button>` +
    `<button class="btn btn-sm" id="errorCopyBtn">${__('copy_error') || 'نسخ الخطأ'}</button>` +
    `</div></div></div>`
  );
}

/* ===================== LOADING TEMPLATES ===================== */

/**
 * Generate a loading skeleton placeholder for ayah content.
 *
 * @param count Number of skeleton lines to generate
 * @returns HTML string with skeleton elements
 */
export function loadingSkeleton(count: number = 5): string {
  const lines = Array.from({ length: count }, () => `<div class="skeleton-line"></div>`).join('');
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

  return (
    `<div class="adhkar-item${completedClass}" data-count="${count}" data-target="${target}">` +
    `<div class="adhkar-text">${escapeHtml(text)}</div>` +
    `<div class="adhkar-progress-bar">` +
    `<div class="adhkar-progress-fill" style="width:${progress}%"></div>` +
    `</div>` +
    `<div class="adhkar-counter">${count} / ${target}</div>` +
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

/* ===================== QARI / TAFSIR TEMPLATES ===================== */

/**
 * Generate a `<option>` element for a reciter (qari) in the select dropdown.
 *
 * @param id Reciter identifier
 * @param displayName Display name for the reciter
 * @returns HTML string for the option element
 */
export function qariOption(id: string, displayName: string): string {
  return `<option value="${escapeHtml(id)}">${escapeHtml(displayName)}</option>`;
}

/**
 * Generate the tafsir loading placeholder.
 *
 * @returns HTML string for the loading state
 */
export function tafsirLoading(): string {
  return `<p class="tafsir-loading">${__('tafsir_loading')}</p>`;
}

/**
 * Generate the tafsir content display.
 *
 * @param text Tafsir text (will be escaped)
 * @returns HTML string for the tafsir content
 */
export function tafsirContent(text: string): string {
  return `<p class="tafsir-text">${escapeHtml(text)}</p>`;
}

/**
 * Generate a tafsir error message.
 *
 * @param message Error message to display (will be escaped)
 * @returns HTML string for the error message
 */
export function tafsirErrorMessage(message: string = __('no_tafsir_available') || 'التفسير غير متاح'): string {
  return `<p class="tafsir-error">${escapeHtml(message)}</p>`;
}

/* ===================== MUSHAF TEMPLATES ===================== */

/**
 * Generate the mushaf loading state overlay.
 *
 * @returns HTML string for the loading state
 */
export function mushafLoadingState(): string {
  return `<div class="mushaf-loading-state">
          <div class="mushaf-loading-icon">📄</div>
          <div class="mushaf-loading-text">${__('mushaf_loading_title')}</div>
          <div class="mushaf-loading-subtext">${__('mushaf_loading_subtitle')}</div>
        </div>`;
}

/**
 * Generate the surah loading message.
 *
 * @returns HTML string for the loading message
 */
export function surahLoadingMessage(): string {
  return `<p class="loading">${__('loading_surah')}...</p>`;
}

/**
 * Generate the mushaf page header row with surah names and juz info.
 *
 * @param juzLabel Pre-formatted juz label (e.g. "الجزء ١")
 * @returns HTML string for the header row
 */
export function mushafHeaderRow(juzLabel: string): string {
  return `<div class="mushaf-header-row">
      <div class="mushaf-surah-names" id="mushafSurahNames"></div>
      <div class="mushaf-juz">${juzLabel}</div>
    </div>`;
}

/**
 * Generate the mushaf error fallback content.
 *
 * @returns HTML string for the error fallback
 */
export function mushafErrorFallback(): string {
  return `<p class="mushaf-error-title">⚠️ ${__('mushaf_load_failed')}</p>
        <p class="mushaf-error-subtitle">${__('mushaf_check_connection')}</p>
        <button onclick="location.reload()" class="mushaf-error-retry-btn">${__('mushaf_retry_reload')}</button>`;
}

/**
 * Generate a surah name span for the mushaf header.
 *
 * @param name Surah name
 * @returns HTML string for the surah name span
 */
export function mushafSurahNameSpan(name: string): string {
  return `<span class="mushaf-surah-name">${escapeHtml(name)}</span>`;
}

/**
 * Generate the surah secrets body content.
 *
 * @param secret The secret text
 * @param authKeys Optional array of source/auth key strings
 * @returns HTML string for the secrets body
 */
export function surahSecretsBody(secret: string, authKeys?: string[]): string {
  let html = `<p>${escapeHtml(secret)}</p>`;
  if (authKeys && authKeys.length) {
    html += `<div class="secret-source">${__('mushaf_sources')} ${authKeys.map((k: string) => `<span>${escapeHtml(k)}</span>`).join(' ')}</div>`;
  }
  return html;
}

/* ===================== UPDATE BANNER TEMPLATE ===================== */

/**
 * Generate the PWA update banner inner HTML.
 *
 * @returns HTML string for the update banner content
 */
export function updateBanner(): string {
  return `<span>${__('update_available')}</span><button onclick="location.reload()" class="update-banner-btn">${__('update_now')}</button>`;
}

/* ===================== ADHKAR TEMPLATES ===================== */

/**
 * Generate an adhkar category tab button.
 */
export function adhkarTab(id: string, name: string, active: boolean = false): string {
  return `<button class="adhkar-tab${active ? ' active' : ''}" data-tab="${escapeHtml(id)}">${escapeHtml(name)}</button>`;
}

/**
 * Generate adhkar category title.
 */
export function adhkarCategoryTitle(name: string, icon: string): string {
  return `<div class="adhkar-category-title">${icon} ${escapeHtml(name)}</div>`;
}

/**
 * Generate adhkar item with progress bar and counter.
 */
export function adhkarItemCard(text: string, count: number, target: number, reference?: string): string {
  const progress = target > 0 ? Math.min(100, (count / target) * 100) : 0;
  const completed = count >= target;
  const completedClass = completed ? ' adhkar-completed' : '';
  return (
    `<div class="adhkar-item${completedClass}">` +
    `<div class="adhkar-text">${escapeHtml(text)}</div>` +
    (reference ? `<div class="adhkar-ref">${escapeHtml(reference)}</div>` : '') +
    `<div class="adhkar-progress-bar"><div class="adhkar-progress-fill" style="width:${progress}%"></div></div>` +
    `<div class="adhkar-counter">${count} / ${target}</div></div>`
  );
}

/**
 * Generate adhkar settings row with toggle and time inputs.
 */
export function adhkarSettingRow(
  id: string,
  label: string,
  enabled: boolean,
  time?: string,
  duration?: number,
): string {
  return (
    `<div class="adhkar-setting-row" data-id="${escapeHtml(id)}">` +
    `<label class="adhkar-setting-toggle"><input type="checkbox" ${enabled ? 'checked' : ''} data-setting="${escapeHtml(id)}_enabled" /> ${escapeHtml(label)}</label>` +
    (time !== undefined
      ? `<input type="time" class="adhkar-setting-time" value="${escapeHtml(time)}" data-setting="${escapeHtml(id)}_time" />`
      : '') +
    (duration !== undefined
      ? `<input type="number" class="adhkar-setting-duration" value="${duration}" min="1" max="60" data-setting="${escapeHtml(id)}_duration" />`
      : '') +
    `</div>`
  );
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
export function collapsedPlayerInfo(surahName: string, ayahInfo: string): string {
  return `<span class="fi-surah">${escapeHtml(surahName)}</span><span>${escapeHtml(ayahInfo)}</span>`;
}

/* ===================== FAVORITES TEMPLATES ===================== */

/**
 * Generate empty favorites message.
 */
export function favoritesEmptyMessage(): string {
  return `<p class="favorites-empty">${__('no_favorites') || 'لا توجد آيات مفضلة بعد'}</p>`;
}

/**
 * Generate favorite item metadata line.
 */
export function favoriteMeta(surahName: string, ayah: number | string): string {
  return `<strong>${escapeHtml(surahName)}</strong> — ${__('ayah') || 'آية'} ${escapeHtml(String(ayah))}`;
}

/* ===================== PRAYER TEMPLATES ===================== */

/**
 * Generate prayer times rows HTML.
 */
export function prayerTimesRows(times: Array<{ name: string; time: string; isNext: boolean }>): string {
  return times.map((t) => prayerTimeRow(t.name, t.time, t.isNext)).join('');
}

/* ===================== ERROR BOUNDARY TEMPLATE ===================== */

/**
 * Generate the error recovery overlay with backdrop.
 */
export function errorRecoveryOverlay(errorMessage: string, errorDetails: string): string {
  return (
    `<div class="error-overlay-backdrop"></div>` +
    `<div class="error-overlay-card">` +
    `<div class="error-overlay-icon">\u26A0\uFE0F</div>` +
    `<h3>${__('error_title') || 'حدث خطأ'}</h3>` +
    `<p class="error-overlay-desc">${escapeHtml(errorMessage)}</p>` +
    `<div class="error-overlay-actions">` +
    `<button class="btn btn-gold" onclick="location.reload()">${__('reload') || 'إعادة تحميل'}</button>` +
    `<button class="btn" onclick="location.href='/'">${__('home') || 'الرئيسية'}</button>` +
    `<button class="btn btn-sm" id="errorCopyBtn">${__('copy_error') || 'نسخ الخطأ'}</button>` +
    `</div>` +
    `<details class="error-details"><summary>${__('error_details') || 'تفاصيل'}</summary>` +
    `<pre>${escapeHtml(errorDetails)}</pre></details>` +
    `</div>`
  );
}

/* ===================== READING STATS TEMPLATE ===================== */

/**
 * Generate the reading stats grid with stat cards.
 */
export function readingStatsGrid(stats: Array<{ icon: string; label: string; value: string | number }>): string {
  const cards = stats
    .map(
      (s) =>
        `<div class="stat-card">` +
        `<div class="stat-icon">${s.icon}</div>` +
        `<div class="stat-value">${escapeHtml(String(s.value))}</div>` +
        `<div class="stat-label">${escapeHtml(s.label)}</div>` +
        `</div>`,
    )
    .join('');
  return `<div class="reading-stats-grid">${cards}</div>`;
}

/* ===================== SETTINGS PANEL TEMPLATE ===================== */

/**
 * Generate the settings panel aside HTML with all tabs and form controls.
 *
 * This is a large static HTML section extracted from index.html to reduce
 * the initial HTML payload and centralize UI template generation.
 * The panel contains six tabs: prayer times, display, azan, adhkar,
 * language, and tools — each with their own form controls.
 *
 * All element IDs and class names are preserved exactly as they appear
 * in the original index.html to maintain compatibility with dom.ts caching.
 *
 * @returns HTML string for the complete settings panel aside element
 */
export function settingsPanelHTML(): string {
  return `<aside class="settings-panel" id="settingsPanel" aria-label="لوحة الإعدادات">
      <div class="settings-header">
        <h2 data-i18n="settings">⚙️ الإعدادات</h2>
        <button class="settings-close" id="settingsCloseBtn" aria-label="إغلاق الإعدادات">✖</button>
      </div>

      <div class="big-clock">
        <div class="big-clock-time" id="bigClockTime2">--:--:--</div>
        <div id="bigClockDate">---</div>
        <div id="bigClockHijri">---</div>
      </div>

      <div class="settings-tabs" id="settingsTabs">
        <button class="settings-tab active" data-tab="prayer">🕌 المواقيت</button>
        <button class="settings-tab" data-tab="display">🎨 العرض</button>
        <button class="settings-tab" data-tab="azan">🔔 الأذان</button>
        <button class="settings-tab" data-tab="adhkar">🕌 الأذكار</button>
        <button class="settings-tab" data-tab="language">🌐 اللغة</button>
        <button class="settings-tab" data-tab="tools">⚙️ أدوات</button>
      </div>

      <div class="settings-tab-content active" data-tab="prayer">
        <div class="settings-section">
          <div class="prayer-times-list" id="prayerTimesRows">
            <p class="centered-muted">⏳ جاري تحميل المواقيت...</p>
          </div>
        </div>
        <div class="settings-section">
          <div class="settings-section-title">📍 الموقع وطريقة الحساب</div>
          <div class="settings-row">
            <label for="cityInput" data-i18n="city">المدينة:</label>
            <input type="text" id="cityInput" placeholder="مكة" />
          </div>
          <div class="settings-row">
            <label for="countryInput" data-i18n="country">الدولة:</label>
            <input type="text" id="countryInput" placeholder="SA" />
          </div>
          <div class="settings-row">
            <label for="cityQuickSelect" data-i18n="quick_select">اختيار سريع:</label>
            <select id="cityQuickSelect">
              <option value="">— اختر —</option>
              <option value="مكة|SA">مكة المكرمة</option>
              <option value="المدينة|SA">المدينة المنورة</option>
              <option value="الرياض|SA">الرياض</option>
              <option value="القاهرة|EG">القاهرة</option>
              <option value="دمشق|SY">دمشق</option>
              <option value="عمان|JO">عمّان</option>
              <option value="بغداد|IQ">بغداد</option>
              <option value="الدوحة|QA">الدوحة</option>
              <option value="الكويت|KW">الكويت</option>
              <option value="دبي|AE">دبي</option>
              <option value="بيروت|LB">بيروت</option>
              <option value="الجزائر|DZ">الجزائر</option>
              <option value="الرباط|MA">الرباط</option>
              <option value="تونس|TN">تونس</option>
              <option value="الخرطوم|SD">الخرطوم</option>
              <option value="صنعاء|YE">صنعاء</option>
              <option value="إسطنبول|TR">إسطنبول</option>
            </select>
          </div>
          <div class="settings-row">
            <label for="methodSelect" data-i18n="calculation_method">طريقة الحساب:</label>
            <select id="methodSelect">
              <option value="4">أم القرى — مكة</option>
              <option value="5">الهيئة المصرية</option>
              <option value="3">رابطة العالم الإسلامي</option>
              <option value="2">ISNA — أمريكا الشمالية</option>
              <option value="1">جامعة العلوم — كراتشي</option>
              <option value="8">الديوان الكويتي</option>
              <option value="9">قطر</option>
              <option value="10">سنغافورة</option>
              <option value="12">اتحاد علماء أوروبا</option>
              <option value="13">ديانت — تركيا</option>
            </select>
          </div>
          <div class="settings-row">
            <button class="btn btn-gold" id="saveLocationBtn" data-i18n="save_location">
              💾 حفظ الموقع وتحديث المواقيت
            </button>
          </div>
        </div>
      </div>

      <div class="settings-tab-content" data-tab="display">
        <div class="settings-section">
          <div class="settings-section-title">🎨 العرض</div>
          <div class="settings-row">
            <label for="fontSizeSelect">حجم الخط:</label>
            <select id="fontSizeSelect">
              <option value="20">20</option>
              <option value="24">24</option>
              <option value="28" selected>28</option>
              <option value="32">32</option>
              <option value="36">36</option>
              <option value="40">40</option>
              <option value="44">44</option>
            </select>
          </div>
          <div class="settings-row">
            <label for="fontTypeSelect">نوع الخط:</label>
            <select id="fontTypeSelect">
              <option value="'Amiri','Traditional Arabic',serif" selected>أميري</option>
              <option value="'Scheherazade New','Traditional Arabic',serif">شهرزاد</option>
              <option value="'Traditional Arabic',serif">عربي تقليدي</option>
              <option value="'Uthmanic Hafs','Traditional Arabic',serif">عثماني</option>
              <option value="'Al Qalam','Traditional Arabic',serif">القلم</option>
            </select>
          </div>
          <div class="settings-row">
            <label for="lineSpacingSelect">تباعد الأسطر:</label>
            <select id="lineSpacingSelect">
              <option value="1.4">ضيق</option>
              <option value="1.8" selected>عادي</option>
              <option value="2.2">واسع</option>
              <option value="2.6">واسع جداً</option>
            </select>
          </div>
          <div class="settings-row">
            <label>ألوان التجويد (المصحف المجود):</label>
            <div class="toggle-switch on" id="tajweedToggle" role="switch" aria-label="ألوان التجويد"></div>
          </div>
          <div class="settings-row">
            <label for="presBgSelect">خلفية وضع العرض:</label>
            <select id="presBgSelect" aria-label="خلفية وضع العرض">
              <option value="plain">صامتة</option>
              <option value="nature">مناظر طبيعية</option>
              <option value="singleNature">منظر طبيعي واحد</option>
              <option value="animated">مناظر متحركة</option>
              <option value="scene">منظر واحد متحرك</option>
              <option value="auto">تلقائي (حسب الوقت)</option>
            </select>
          </div>
          <div class="settings-row hidden" id="presBgNatureRow">
            <label for="presBgNatureSelect">اختر المنظر الطبيعي:</label>
            <select id="presBgNatureSelect" aria-label="اختر المنظر الطبيعي">
              <option value="dawn">🌅 فجر</option>
              <option value="morning">☁️ صباح</option>
              <option value="afternoon">⛰️ ظهر</option>
              <option value="sunset">🌇 غروب</option>
              <option value="night">🌙 ليل</option>
            </select>
          </div>
          <div class="settings-row hidden" id="presBgSceneRow">
            <label for="presBgSceneSelect">اختر المنظر:</label>
            <select id="presBgSceneSelect" aria-label="اختر المنظر المتحرك">
              <option value="stars">سماء نجوم ✨</option>
              <option value="waves">أمواج البحر 🌊</option>
              <option value="aurora">شفق قطبي 🌌</option>
              <option value="particles">جسيمات ذهبية ✦</option>
              <option value="rain">مطر 🌧️</option>
            </select>
          </div>
          <div class="settings-row">
            <label>حفظ آخر موضع تلقائياً:</label>
            <div class="toggle-switch on" id="autoSaveToggle" role="switch" aria-label="حفظ آخر موضع"></div>
          </div>
          <div class="settings-row">
            <label for="translationSelect">الترجمة:</label>
            <select id="translationSelect" aria-label="اختيار الترجمة">
              <option value="">— بدون ترجمة —</option>
              <option value="en.sahih">Sahih International</option>
              <option value="en.pickthall">Pickthall</option>
              <option value="en.yusufali">Yusuf Ali</option>
              <option value="fr.hamidullah">Hamidullah (Français)</option>
              <option value="ur.jalandhry">Jalandhry (اردو)</option>
            </select>
          </div>
        </div>
      </div>

      <div class="settings-tab-content" data-tab="azan">
        <div class="settings-section">
          <div class="settings-section-title" data-i18n="azan">🔔 الأذان</div>
          <div class="settings-row">
            <label data-i18n="azan_enable">تنبيه الأذان:</label>
            <div class="toggle-switch" id="azanToggle" role="switch" aria-label="تفعيل الأذان"></div>
          </div>
          <div class="settings-row">
            <label data-i18n="azan_fajr">أذان الفجر:</label>
            <div class="toggle-switch" id="azanFajrToggle" role="switch" aria-label="تفعيل أذان الفجر"></div>
          </div>
          <div class="settings-row">
            <button class="btn" id="testAzanBtn" data-i18n="test_azan">▶️ اختبار الأذان</button>
          </div>
          <p class="azan-note">🎙️ الأذان بصوت الشيخ ناصر القطامي</p>
        </div>
      </div>

      <div class="settings-tab-content" data-tab="adhkar">
        <div class="settings-section">
          <div class="settings-section-title">🕌 الأذكار</div>
          <div class="settings-row">
            <label>تفعيل التذكير العام:</label>
            <div class="toggle-switch" id="adhkarEnabledToggle" role="switch" aria-label="تفعيل التذكير"></div>
          </div>
          <div class="settings-row">
            <label>🔔 صوت التنبيه:</label>
            <div class="toggle-switch" id="adhkarSoundToggle" role="switch" aria-label="صوت التنبيه"></div>
          </div>
          <div id="adhkarSettingsList"></div>
        </div>
      </div>

      <div class="settings-tab-content" data-tab="language">
        <div class="settings-section">
          <div class="settings-section-title">🌐 Language / اللغة</div>
          <div class="settings-row">
            <label for="langSelect">اللغة / Language:</label>
            <select id="langSelect">
              <option value="ar">العربية</option>
              <option value="en">English</option>
              <option value="tr">Türkçe</option>
              <option value="ms">Bahasa Melayu</option>
              <option value="id">Bahasa Indonesia</option>
            </select>
          </div>
        </div>
      </div>

      <div class="settings-tab-content" data-tab="tools">
        <div class="settings-section">
          <div class="settings-section-title">⚙️ أدوات</div>
          <div class="settings-row">
            <button class="btn btn-gold" id="exportSettingsBtn">📤 تصدير الإعدادات</button>
          </div>
          <div class="settings-row">
            <button class="btn" id="importSettingsBtn">📥 استيراد الإعدادات</button>
          </div>
          <div class="settings-row">
            <button class="btn btn-danger" id="resetSettingsBtn" data-i18n="reset_settings">
              🔄 إعادة ضبط الإعدادات
            </button>
          </div>
        </div>
      </div>
    </aside>`;
}

/* ===================== FLOATING PLAYER TEMPLATE ===================== */

/**
 * Generate the floating audio player HTML with controls, repeat, share, and more.
 *
 * This large HTML section is extracted from index.html to reduce the initial
 * HTML payload. The player includes collapsed/expanded views, audio controls,
 * playback speed, hifdh/repeat/select modes, bookmark, favorite, share menu,
 * and repeat controls.
 *
 * All element IDs and class names are preserved exactly for dom.ts compatibility.
 *
 * @returns HTML string for the floating player div element
 */
export function floatingPlayerHTML(): string {
  return `<div class="player collapsed" id="player" role="region" aria-label="مشغل التلاوة">
      <div class="collapsed-content" id="collapsedContent">
        <button class="floating-play-btn" id="collapsedPlayBtn" aria-label="تشغيل/إيقاف">
          <svg class="icon icon-play" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>
        <div class="floating-info" id="collapsedInfo">—</div>
      </div>

      <div class="expanded-content">
        <div class="expanded-header">
          <span id="playerReciterName">—</span>
          <span id="playerSurahName">—</span>
          <button class="collapse-btn" id="collapsePlayerBtn" aria-label="إغلاق المشغل">✖</button>
        </div>
        <div class="current-ayah" id="playerCurrentAyah">—</div>
        <span id="sleepTimerDisplay" style="display:none;font-size:11px;color:var(--accent);margin:0 8px;"></span>
        <canvas class="audio-visualizer" id="audioVisualizer" width="300" height="40" aria-hidden="true"></canvas>
        <div class="player-row">
          <audio id="audioPlayer" controls preload="metadata"></audio>
        </div>
        <div class="player-buttons">
          <button class="btn" id="prevSurahBtn" aria-label="السورة السابقة" title="السورة السابقة">⏮</button>
          <button class="btn" id="prevAyahBtn" aria-label="الآية السابقة" title="الآية السابقة">◀</button>
          <button class="btn btn-gold" id="playPauseBtn" aria-label="تشغيل/إيقاف">⏯</button>
          <button class="btn" id="nextAyahBtn" aria-label="الآية التالية" title="الآية التالية">▶</button>
          <button class="btn" id="nextSurahBtn" aria-label="السورة التالية" title="السورة التالية">⏭</button>
          <button class="btn btn-more" id="playerMoreBtn" aria-label="المزيد" title="المزيد">⁝</button>
        </div>
        <div class="player-more-row hidden" id="playerMoreRow">
          <button class="btn btn-hifdh" id="hifdhBtn" aria-label="وضع الحفظ">🕋 حفظ</button>
          <button class="btn btn-repeat" id="repeatBtn" aria-label="التكرار">🔁 تكرار</button>
          <button class="btn btn-select" id="selectModeBtn" aria-label="تحديد متعدد">☑️ تحديد</button>
          <button
            class="btn btn-bookmark"
            id="bookmarkBtn"
            aria-label="إشارة مرجعية"
            title="نقرة: حفظ — نقرتان: انتقال"
          >
            🔖 علامة
          </button>
          <button class="btn btn-favorite" id="favoriteBtn" aria-label="إضافة للمفضلة">❤️ مفضلة</button>
          <button class="btn btn-gold" id="shareBtn" aria-label="مشاركة الآية">📤 مشاركة</button>
          <span class="speed-control speed-control-span">
            <span>⏩</span>
            <select id="speedSelect" aria-label="سرعة التلاوة" class="speed-select">
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1" selected>1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>
          </span>
          <button class="btn btn-sleep" id="sleepTimerBtn" aria-label="مؤقت النوم" title="مؤقت النوم">😴 نوم</button>
        </div>
        <div class="select-mode-bar hidden" id="selectModeBar">
          <span id="selectCount">0</span> آية محددة
          <button class="btn btn-gold" id="selectShareBtn">📤 مشاركة المحدد</button>
          <button class="btn" id="selectClearBtn">✖ إلغاء</button>
        </div>
        <div class="repeat-controls hidden" id="repeatControls">
          <label
            >من:
            <select id="repeatFrom"></select
          ></label>
          <label
            >إلى:
            <select id="repeatTo"></select
          ></label>
          <label
            >عدد المرات:
            <select id="repeatTimes">
              <option value="2">2</option>
              <option value="3" selected>3</option>
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
            </select>
          </label>
        </div>
        <div class="share-menu" id="shareMenu" role="menu">
          <button data-share="native">📲 مشاركة عامة</button>
          <button data-share="copy">📋 نسخ النص</button>
          <button data-share="copy-simple">📋 نسخ مبسط (بدون تشكيل)</button>
          <button data-share="whatsapp">💬 واتساب</button>
          <button data-share="telegram">✈️ تيليجرام</button>
        </div>
      </div>
    </div>`;
}

/* ===================== ARABIC KEYBOARD TEMPLATE ===================== */

/**
 * Generate the Arabic on-screen keyboard HTML for search input.
 *
 * Extracted from index.html to reduce inline HTML size. The keyboard
 * includes four rows: number row, letter rows, and a modifier row
 * with shift, space, backspace, and clear keys.
 *
 * All element IDs and class names are preserved for keyboard.ts compatibility.
 *
 * @returns HTML string for the Arabic keyboard div element
 */
export function arabicKeyboardHTML(): string {
  return `<div class="arabic-keyboard" id="arabicKeyboard" dir="ltr">
                <div class="kbd-row">
                  <button class="kbd-key" data-key="ذ">ذ</button>
                  <button class="kbd-key" data-key="١">١</button>
                  <button class="kbd-key" data-key="٢">٢</button>
                  <button class="kbd-key" data-key="٣">٣</button>
                  <button class="kbd-key" data-key="٤">٤</button>
                  <button class="kbd-key" data-key="٥">٥</button>
                  <button class="kbd-key" data-key="٦">٦</button>
                  <button class="kbd-key" data-key="٧">٧</button>
                  <button class="kbd-key" data-key="٨">٨</button>
                  <button class="kbd-key" data-key="٩">٩</button>
                  <button class="kbd-key" data-key="٠">٠</button>
                  <button class="kbd-key" data-key="-">-</button>
                  <button class="kbd-key" data-key="=">=</button>
                </div>
                <div class="kbd-row">
                  <button class="kbd-key" data-key="ض">ض</button>
                  <button class="kbd-key" data-key="ص">ص</button>
                  <button class="kbd-key" data-key="ث">ث</button>
                  <button class="kbd-key" data-key="ق">ق</button>
                  <button class="kbd-key" data-key="ف">ف</button>
                  <button class="kbd-key" data-key="غ">غ</button>
                  <button class="kbd-key" data-key="ع">ع</button>
                  <button class="kbd-key" data-key="ه">ه</button>
                  <button class="kbd-key" data-key="خ">خ</button>
                  <button class="kbd-key" data-key="ح">ح</button>
                  <button class="kbd-key" data-key="ج">ج</button>
                  <button class="kbd-key" data-key="د">د</button>
                </div>
                <div class="kbd-row">
                  <button class="kbd-key" data-key="ش">ش</button>
                  <button class="kbd-key" data-key="س">س</button>
                  <button class="kbd-key" data-key="ي">ي</button>
                  <button class="kbd-key" data-key="ب">ب</button>
                  <button class="kbd-key" data-key="ل">ل</button>
                  <button class="kbd-key" data-key="ا">ا</button>
                  <button class="kbd-key" data-key="ت">ت</button>
                  <button class="kbd-key" data-key="ن">ن</button>
                  <button class="kbd-key" data-key="م">م</button>
                  <button class="kbd-key" data-key="ك">ك</button>
                  <button class="kbd-key" data-key="ط">ط</button>
                </div>
                <div class="kbd-row">
                  <button class="kbd-key kbd-key-shift kbd-key-fixed" data-key="shift">⇧</button>
                  <button class="kbd-key kbd-key-fixed" data-key="space">⎵</button>
                  <button class="kbd-key kbd-key-backspace" data-key="backspace">⌫</button>
                  <button class="kbd-key kbd-key-clear" data-key="clear">مسح</button>
                </div>
              </div>`;
}
