/**
 * Mushaf HTML templates (loading states, headers, error fallback, secrets).
 *
 * Pure functions returning HTML strings. Re-exported from templates.js so
 * existing imports keep working unchanged.
 */

import { __ } from './i18n.js';
import { escapeHtml } from './templates/escape.js';

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
 */
export function surahSecretsBody(secret: string, authKeys?: string[]): string {
  let html = `<p>${escapeHtml(secret)}</p>`;
  if (authKeys && authKeys.length) {
    html += `<div class="secret-source">${__('mushaf_sources')} ${authKeys.map((k: string) => `<span>${escapeHtml(k)}</span>`).join(' ')}</div>`;
  }
  return html;
}
