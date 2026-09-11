/**
 * Adhkar HTML templates (items, tabs, cards, settings rows).
 *
 * Pure functions returning HTML strings. Re-exported from templates.js so
 * existing imports keep working unchanged.
 */

import { escapeHtml } from './templates/escape.js';

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
