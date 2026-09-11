/**
 * Feedback HTML templates (error overlays, loading states, tafsir, banners, stats).
 *
 * Pure functions returning HTML strings. Re-exported from templates.js so
 * existing imports keep working unchanged.
 */

import { __ } from './i18n.js';
import { escapeHtml } from './templates/escape.js';

const APP_BASE_URL = import.meta.env.BASE_URL;

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
    `<button class="btn" onclick="location.href=${JSON.stringify(APP_BASE_URL)}">${__('home') || 'الرئيسية'}</button>` +
    `<button class="btn btn-sm" id="errorCopyBtn">${__('copy_error') || 'نسخ الخطأ'}</button>` +
    `</div></div></div>`
  );
}

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
    `<button class="btn" onclick="location.href=${JSON.stringify(APP_BASE_URL)}">${__('home') || 'الرئيسية'}</button>` +
    `<button class="btn btn-sm" id="errorCopyBtn">${__('copy_error') || 'نسخ الخطأ'}</button>` +
    `</div>` +
    `<details class="error-details"><summary>${__('error_details') || 'تفاصيل'}</summary>` +
    `<pre>${escapeHtml(errorDetails)}</pre></details>` +
    `</div>`
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
