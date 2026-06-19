/**
 * ================================================================
 * DOM Cache — Solves Problem #4
 * ----------------------------------------------------------------
 * Replaces scattered `dom.prevAyahBtn?.addEventListener` with
 * a fail-fast pattern that asserts element existence at startup.
 *
 * In DEV mode:
 *   - Missing elements throw a clear error with the variable name
 *   - No silent null swallowing
 *   - Easier to spot HTML/JS drift
 *
 * In PROD mode:
 *   - Missing elements are logged but don't crash the app
 *   - Graceful degradation
 * ================================================================
 */

const DEV = import.meta.env?.DEV ?? false;

/**
 * Configuration: which DOM elements are required vs optional.
 * Required elements will cause a startup error if missing.
 */
export interface DomElementSpec {
  /** CSS selector used to find the element. */
  selector: string;
  /** Whether the element MUST exist (default: true). */
  required?: boolean;
  /** Human-readable description for error messages. */
  description?: string;
}

/** The full registry of elements cached by the app. */
export const DOM_SPEC = {
  // Layout
  container: { selector: '.container', description: 'Main app container' },
  header: { selector: '.header', description: 'App header' },
  surahContent: { selector: '#surahContent', description: 'Main surah content area' },
  controls: { selector: '.controls', description: 'Controls bar' },

  // Prayer bar
  prayerBar: { selector: '#prayerBar', description: 'Prayer times bar' },
  collapseBarBtn: { selector: '#collapseBarBtn', description: 'Prayer bar collapse button' },
  expandBarBtn: { selector: '#expandBarBtn', description: 'Prayer bar expand button' },
  bigClockTime: { selector: '#bigClockTime', description: 'Main clock display' },
  nextPrayerName: { selector: '#nextPrayerName', description: 'Next prayer name' },
  nextPrayerTime: { selector: '#nextPrayerTime', description: 'Next prayer time' },
  countdownDisplay: { selector: '#countdownDisplay', description: 'Prayer countdown' },

  // Controls
  surahSelect: { selector: '#surahSelect', description: 'Surah selector dropdown' },
  reciterSelect: { selector: '#reciterSelect', description: 'Reciter selector dropdown' },
  searchInput: { selector: '#searchInput', description: 'Search input field' },
  searchBtn: { selector: '#searchBtn', description: 'Search button' },
  searchToggleBtn: { selector: '#searchToggleBtn', description: 'Search toggle button' },
  searchInputGroup: { selector: '#searchInputGroup', description: 'Search input group' },
  searchResults: { selector: '#searchResults', description: 'Search results container' },

  // View mode
  viewSurahBtn: { selector: '#viewSurahBtn', description: 'View mode: surah' },
  viewMushafBtn: { selector: '#viewMushafBtn', description: 'View mode: mushaf' },
  viewPresBtn: { selector: '#viewPresBtn', description: 'View mode: presentation' },

  // Theme
  themeToggle: { selector: '#themeToggle', description: 'Theme switcher container' },

  // Bottom nav
  bottomNav: { selector: '#bottomNav', description: 'Bottom navigation bar' },

  // Toast
  toast: { selector: '#toast', description: 'Toast notification' },

  // Reading progress
  readingProgress: { selector: '#readingProgress', description: 'Reading progress bar' },

  // Optional elements (e.g., injected overlays) — explicitly marked
  player: { selector: '#player', required: false, description: 'Floating player (injected)' },
  settingsPanel: { selector: '#settingsPanel', required: false, description: 'Settings panel (injected)' },
  tafsirCurtain: { selector: '#tafsirCurtain', required: false, description: 'Tafsir curtain' },
  favoritesPanel: { selector: '#favoritesPanel', required: false, description: 'Favorites panel' },
  adhkarPanel: { selector: '#adhkarPanel', required: false, description: 'Adhkar panel' },

  prevAyahBtn: { selector: '#prevAyahBtn', required: false, description: 'Previous ayah button (in player)' },
  nextAyahBtn: { selector: '#nextAyahBtn', required: false, description: 'Next ayah button (in player)' },
  playPauseBtn: { selector: '#playPauseBtn', required: false, description: 'Play/Pause button' },
  audioPlayer: { selector: '#audioPlayer', required: false, description: 'Audio element' },
} as const satisfies Record<string, DomElementSpec>;

export type DomKey = keyof typeof DOM_SPEC;

/** Cached elements: typed as HTMLElement (not null) for required, HTMLElement | null for optional. */
export type DomCache = {
  [K in DomKey]: typeof DOM_SPEC[K]['required'] extends false
    ? HTMLElement | null
    : HTMLElement;
};

/** Singleton cache. */
export const dom = {} as DomCache;

/** Track which keys were successfully cached (for diagnostics). */
const cachedKeys = new Set<DomKey>();

/**
 * Cache all DOM elements declared in DOM_SPEC.
 * Call ONCE after all static + injected HTML is in the DOM.
 *
 * Behavior:
 *   - In DEV: throws on first missing REQUIRED element (fail-fast)
 *   - In PROD: logs missing elements, continues with nulls
 *
 * @returns Object with diagnostic info: { found, missing, total }
 */
export function cacheDom(): { found: number; missing: number; total: number } {
  const missing: DomKey[] = [];
  let found = 0;

  (Object.keys(DOM_SPEC) as DomKey[]).forEach((key) => {
    const spec = DOM_SPEC[key];
    const el = document.querySelector<HTMLElement>(spec.selector);
    const isRequired = spec.required !== false; // default true

    if (el) {
      (dom as Record<DomKey, HTMLElement | null>)[key] = el;
      cachedKeys.add(key);
      found++;
    } else {
      if (isRequired && DEV) {
        // Fail-fast in dev mode
        throw new Error(
          `[DOM] Required element "${key}" not found. ` +
            `Selector: "${spec.selector}". ` +
            `Description: ${spec.description ?? 'N/A'}. ` +
            `Check that the element exists in index.html or that overlay injection ran before cacheDom().`,
        );
      }
      // In prod or for optional elements, just log
      if (isRequired) {
        console.warn(`[DOM] Missing required element "${key}" (selector: "${spec.selector}")`);
      }
      (dom as Record<DomKey, HTMLElement | null>)[key] = null;
      missing.push(key);
    }
  });

  if (DEV) {
    console.info(
      `[DOM] Cached ${found}/${found + missing.length} elements. ` +
        (missing.length ? `Missing: ${missing.join(', ')}` : 'All required elements present.'),
    );
  }

  return { found, missing: missing.length, total: found + missing.length };
}

/**
 * Verify that a specific element was cached before using it.
 * Use this as a runtime guard in modules that touch optional elements.
 *
 * @example
 *   if (!assertDom('player', 'toggle play')) return;
 *   dom.player.classList.toggle('collapsed');
 */
export function assertDom(key: DomKey, action?: string): boolean {
  const el = (dom as Record<DomKey, HTMLElement | null>)[key];
  if (!el) {
    const actionText = action ? ` while trying to "${action}"` : '';
    console.warn(`[DOM] Element "${key}" is null${actionText}. Skipping action.`);
    return false;
  }
  return true;
}

/**
 * Get a cached element with a runtime type assertion.
 * Useful when you need a specific HTMLElement subtype (HTMLInputElement, etc).
 *
 * @example
 *   const input = getDomAs<HTMLInputElement>('searchInput');
 *   input.value = '';
 */
export function getDomAs<T extends HTMLElement>(key: DomKey): T {
  const el = (dom as Record<DomKey, HTMLElement | null>)[key];
  if (!el) {
    throw new Error(`[DOM] Element "${key}" is null. Use assertDom() first.`);
  }
  return el as T;
}

/**
 * Re-cache a single element (e.g., after it's re-injected).
 * Useful for overlays that may be removed and re-added.
 */
export function refreshDom(key: DomKey): HTMLElement | null {
  const spec = DOM_SPEC[key];
  const el = document.querySelector<HTMLElement>(spec.selector);
  (dom as Record<DomKey, HTMLElement | null>)[key] = el;
  if (el) cachedKeys.add(key);
  return el;
}
