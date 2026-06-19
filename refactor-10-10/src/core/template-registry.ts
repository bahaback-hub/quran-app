/**
 * ================================================================
 * Template Registry — Solves Problem #3
 * ----------------------------------------------------------------
 * Replaces HTML strings inside JavaScript (overlays.ts) with
 * proper <template> tags declared in index.html.
 *
 * Benefits:
 *   1. Full HTML syntax highlighting in IDE
 *   2. HTML linting/validation
 *   3. Designers can edit HTML without touching JS
 *   4. No XSS risk from template literals
 *   5. Templates parsed once by browser, cloned many times
 *
 * Usage in index.html:
 *   <template id="tpl-ayah-modal">
 *     <div class="ayah-modal">...</div>
 *   </template>
 *
 * Usage in JS:
 *   const node = templates.instantiate('ayah-modal');
 *   document.body.appendChild(node);
 * ================================================================
 */

export class TemplateRegistry {
  private readonly cache = new Map<string, HTMLTemplateElement>();

  /**
   * Get a <template> element by ID (with caching).
   * Throws a descriptive error in dev mode if template is missing.
   */
  get(templateId: string): HTMLTemplateElement {
    if (this.cache.has(templateId)) {
      return this.cache.get(templateId)!;
    }

    const fullId = `tpl-${templateId}`;
    const tpl = document.getElementById(fullId) as HTMLTemplateElement | null;

    if (!tpl) {
      const msg = `[TemplateRegistry] Template "${fullId}" not found in DOM.`;
      if (import.meta.env?.DEV) {
        throw new Error(msg);
      }
      console.error(msg);
      // Return an empty template as fallback
      const empty = document.createElement('template');
      this.cache.set(templateId, empty);
      return empty;
    }

    if (!(tpl instanceof HTMLTemplateElement)) {
      console.error(`[TemplateRegistry] Element "${fullId}" is not a <template>.`);
      const empty = document.createElement('template');
      this.cache.set(templateId, empty);
      return empty;
    }

    this.cache.set(templateId, tpl);
    return tpl;
  }

  /**
   * Clone the template content as a DocumentFragment.
   * Caller is responsible for inserting into DOM.
   */
  clone(templateId: string): DocumentFragment {
    return this.get(templateId).content.cloneNode(true) as DocumentFragment;
  }

  /**
   * Clone the template and return the first element child
   * (convenient when the template wraps a single root element).
   */
  instantiate<T extends HTMLElement = HTMLElement>(templateId: string): T {
    const fragment = this.clone(templateId);
    const root = fragment.firstElementChild as T | null;
    if (!root) {
      console.error(`[TemplateRegistry] Template "${templateId}" has no root element.`);
      return document.createElement('div') as T;
    }
    return root;
  }

  /**
   * Inject multiple templates and append them to a parent.
   * Useful for bulk initialization.
   */
  injectAll(parent: HTMLElement, templateIds: string[]): void {
    const fragment = document.createDocumentFragment();
    for (const id of templateIds) {
      fragment.appendChild(this.clone(id));
    }
    parent.appendChild(fragment);
  }

  /** Clear cache (useful for tests). */
  clear(): void {
    this.cache.clear();
  }
}

/** Singleton instance for the whole app. */
export const templates = new TemplateRegistry();

/**
 * Helper: escape HTML for safe insertion into attributes/text.
 * Use for any dynamic content injected outside of <template> tags.
 */
export function escapeHtml(text: string | null | undefined): string {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
