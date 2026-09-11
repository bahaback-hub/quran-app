/**
 * Favorites HTML templates (items, empty states, counts, metadata).
 *
 * Pure functions returning HTML strings. Re-exported from templates.js so
 * existing imports keep working unchanged.
 */

import type { FavoriteEntry } from './state.js';
import { __, __n, toArabicDigits } from './i18n.js';
import { escapeHtml } from './templates/escape.js';

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
