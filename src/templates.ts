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
import { __, __n, toArabicDigits } from './i18n.js';

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
  // IMPORTANT: No inline onclick — CSP blocks inline event handlers.
  // The click handler is attached via addEventListener in createUpdateBanner().
  return `<span>${__('update_available')}</span><button type="button" class="update-banner-btn">${__('update_now')}</button>`;
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
export function collapsedPlayerInfo(surahName: string, ayahInfo = ''): string {
  const ayah = ayahInfo ? `<span>${escapeHtml(ayahInfo)}</span>` : '';
  return `<span class="fi-surah">${escapeHtml(surahName)}</span>${ayah}`;
}

/* ===================== FAVORITES TEMPLATES ===================== */

/**
 * Generate empty favorites message.
 */
export function favoritesEmptyMessage(): string {
  return `<p class="favorites-empty">${__('no_favorites') || 'لا توجد آيات مفضلة بعد'}</p>`;
}

/**
 * Generate a localized favorites count message using plural forms.
 * Uses __n() to select the correct Arabic plural form (zero/one/two/few/many/other).
 * The count is also wrapped in a <span> for styling.
 *
 * @example
 *   favoritesCountMessage(0)   // → "<span class='favorites-count'>لا توجد مفضلات</span>"
 *   favoritesCountMessage(1)   // → "<span class='favorites-count'>مفضلة واحدة</span>"
 *   favoritesCountMessage(5)   // → "<span class='favorites-count'>٥ مفضلات</span>"
 *   favoritesCountMessage(100) // → "<span class='favorites-count'>١٠٠ مفضلة</span>"
 */
export function favoritesCountMessage(count: number): string {
  return `<span class="favorites-count">${__n('favorite_count', count)}</span>`;
}

/**
 * Generate favorite item metadata line.
 * Uses toArabicDigits() to display the ayah number in Arabic-Indic digits (٠-٩)
 * when the active language is Arabic.
 */
export function favoriteMeta(surahName: string, ayah: number | string): string {
  const ayahDisplay = typeof ayah === 'number' ? toArabicDigits(ayah) : escapeHtml(String(ayah));
  return `<strong>${escapeHtml(surahName)}</strong> — ${__('ayah') || 'آية'} ${ayahDisplay}`;
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

/* ===================== RE-EXPORTS FROM templates-panels.ts ===================== */

// The four large panel templates (settingsPanelHTML, floatingPlayerHTML,
// arabicKeyboardHTML, helpPanelHTML) were extracted to templates-panels.ts
// to reduce this file's size from 1262 to ~688 lines.
// They are re-exported here so existing imports from './templates.js'
// continue to work unchanged.
export { settingsPanelHTML, floatingPlayerHTML, arabicKeyboardHTML, helpPanelHTML } from './templates-panels.js';
