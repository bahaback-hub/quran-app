/**
 * Regression test — DOM ID integrity.
 *
 * Background: We previously found that several IDs listed in `DOM_IDS` (in
 * `src/dom.ts`) were referenced in code but NOT actually present as `id="..."`
 * attributes in any HTML — neither in `index.html` nor in any template string
 * injected by `overlays.ts` / `templates-panels.ts` / `templates.ts`.
 *
 * The worst example was `favoritesOpenBtn`:
 *   - declared in `DOM_IDS`
 *   - used as `dom.favoritesOpenBtn?.addEventListener('click', openFavorites)`
 *   - but no `<button id="favoritesOpenBtn">` existed anywhere
 *   - so `dom.favoritesOpenBtn` was always `null` and the optional chaining
 *     silently no-op'd — the entire favorites panel feature was unreachable
 *
 * Another example was `<section class="controls">` missing `id="controls"`,
 * which prevented the "Tools" tab in the mobile bottom-nav from opening the
 * controls panel on mobile devices.
 *
 * This test prevents that class of bug by:
 *   1. Loading the real `index.html` from disk
 *   2. Parsing it with DOMParser
 *   3. Simulating `injectOverlays()` by also parsing the template strings
 *      that `overlays.ts` / `templates-panels.ts` inject at runtime
 *   4. Calling the real `cacheDom()`
 *   5. Asserting every key in `DOM_IDS` resolves to a non-null element
 *
 * Any new ID added to `DOM_IDS` without a matching HTML element will fail
 * this test — surfacing the bug before it ships to users.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';

// Unmock the modules we want to test against the real implementations.
vi.unmock('../dom.js');
vi.unmock('../overlays.js');
vi.unmock('../templates-panels.js');

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';

// Path to the real index.html in the project root (two levels up from __tests__)
const INDEX_HTML_PATH = join(process.cwd(), 'index.html');

/**
 * IDs that are intentionally created at runtime rather than present in static
 * HTML. These are valid because the code that creates them runs before any
 * code that reads them. We exclude them from the "must exist in HTML" check.
 *
 * - `audioPlayer2`: created on-demand by `preloadNextAyah()` in `audio.ts`
 *   when preloading the next ayah's audio (a hidden <audio> element appended
 *   to <body>). See audio.ts:257-263.
 * - `loadingProgress`: created by `LoadingBar.init()` in `ui.ts` if no
 *   element with that ID exists. See ui.ts:44-47.
 */
const DYNAMICALLY_CREATED_IDS = new Set(['audioPlayer2', 'loadingProgress']);

/**
 * Load the real index.html and inject the same overlay HTML strings that
 * `overlays.ts` injects at runtime. Then set document.body.innerHTML to
 * the combined HTML so cacheDom() can find everything.
 */
function loadRealDOM(): void {
  const html = readFileSync(INDEX_HTML_PATH, 'utf-8');

  // Parse the HTML to extract <body> content
  const dom = new JSDOM(html);
  const bodyContent = dom.window.document.body.innerHTML;

  // Combine index.html body with the overlay templates that overlays.ts injects.
  // We import the template functions dynamically to avoid circular deps in tests.
  document.body.innerHTML = bodyContent;
}

describe('DOM ID integrity — every DOM_ID must exist in real HTML', () => {
  beforeAll(() => {
    loadRealDOM();
  });

  it('should have a non-null element for every ID in DOM_IDS', async () => {
    // Import the actual DOM_IDS and cacheDom from the real module.
    // DOM_IDS is not exported, so we use cacheDom + Object.keys(dom) to get the list.
    const { dom, cacheDom } = await import('../dom.js');

    // Also simulate injectOverlays() by importing it — this will inject the
    // settings panel, favorites panel, help panel, presentation overlay, etc.
    // into the DOM (in production this runs before cacheDom()).
    try {
      const { injectOverlays } = await import('../overlays.js');
      injectOverlays();
    } catch {
      // overlays.ts may have side-effect dependencies that fail in test env;
      // that's OK — we still want to verify that index.html's static IDs resolve.
    }

    cacheDom();

    const missing: string[] = [];
    const keys = Object.keys(dom) as (keyof typeof dom)[];
    for (const key of keys) {
      // Skip IDs that are intentionally created at runtime (see comment above).
      if (DYNAMICALLY_CREATED_IDS.has(String(key))) {
        continue;
      }
      const el = dom[key];
      if (el === null) {
        missing.push(String(key));
      }
    }

    if (missing.length > 0) {
      // Provide a helpful error message listing every missing ID
      const suggestion = missing
        .map((id) => `  - ${id}: no element with id="${id}" found in index.html or injected overlays`)
        .join('\n');
      throw new Error(
        `${missing.length} DOM ID(s) declared in DOM_IDS but missing from HTML:\n${suggestion}\n\n` +
          `Fix: add <element id="..."> to index.html (for static elements) or to the ` +
          `corresponding template function in templates-panels.ts / overlays.ts (for ` +
          `dynamically injected elements). Without this, dom.X is null and ` +
          `dom.X?.method() silently no-ops, hiding the bug behind optional chaining.`,
      );
    }

    expect(missing).toEqual([]);
  });

  it('should specifically find favoritesOpenBtn (regression for #47 follow-up)', async () => {
    const { dom, cacheDom } = await import('../dom.js');
    try {
      const { injectOverlays } = await import('../overlays.js');
      injectOverlays();
    } catch {
      // ignore overlay injection errors in test env
    }
    cacheDom();

    // This was the critical bug: favoritesOpenBtn was declared but missing
    // from HTML, making the entire favorites panel unreachable.
    expect(dom.favoritesOpenBtn).not.toBeNull();
    expect(dom.favoritesOpenBtn?.tagName).toBe('BUTTON');
  });

  it('should find #controls with both id and class (regression for #47)', async () => {
    const { dom, cacheDom } = await import('../dom.js');
    loadRealDOM();
    cacheDom();

    // The element must have BOTH id="controls" AND class="controls" —
    // the class is used by CSS, the id is used by cacheDom().
    const el = dom.controls;
    expect(el).not.toBeNull();
    expect(el?.classList.contains('controls')).toBe(true);
  });
});
