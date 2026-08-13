/**
 * HTML Escape Utility — XSS Prevention.
 *
 * Centralized HTML escaping function used by all template functions.
 * Extracted from `templates.ts` so other modules can import it without
 * pulling in the entire templates module.
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

/**
 * Escape text for use inside an HTML attribute value.
 * Same as escapeHtml but emphasizes the attribute context.
 *
 * @example
 *   `<input value="${escapeAttr(userValue)}">`
 */
export function escapeAttr(text: string | null | undefined): string {
  return escapeHtml(text);
}

export function escapeUriParam(text: string | null | undefined): string {
  if (text == null) {
    return '';
  }
  return encodeURIComponent(String(text));
}
