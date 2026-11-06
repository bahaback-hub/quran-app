/**
 * Theme pipeline — night/sepia/deep-night visual surfaces, theme background
 * preloading, and system color-scheme detection. Extracted from settings.ts;
 * settings.ts re-exports the public names so existing import sites keep working.
 */
import { state } from './state.js';
import { dom } from './dom.js';
import { storage } from './storage.js';

/** Mushaf page reload hook on theme change — registered by
 * features/mushaf/mushaf.ts via settings.registerMushafPageReload to avoid a
 * settings → mushaf import cycle. Theme writes go through setMushafPageReload. */
let _reloadMushafPage: (() => void) | null = null;

export function setMushafPageReload(fn: () => void): void {
  _reloadMushafPage = fn;
}

/* ===================== THEME BACKGROUND PRELOAD ===================== */
/**
 * The themed page background is theme-specific: light -> mosque, sepia ->
 * mosque-sepia, night/deep-night -> mosque-night.
 * Preload the image for whatever theme is actually active so the themed
 * background paints early, without making every visitor fetch a background
 * they will never see. (CSP note: this is not blocked — preloads are governed
 * by img-src 'self', which mirrors the CSS url() paths.)
 *
 * The two mosque backgrounds have a WebP twin that is roughly half the size and
 * is what the stylesheet actually paints wherever the browser supports it (see
 * glass-daytime.css / glass-night.css). Preloading the JPEG instead would fetch
 * a file nothing displays, so the modern variant is preferred and the JPEG is
 * only preloaded when WebP is not supported — mirroring the CSS @supports.
 */
const THEME_BACKGROUND_FILE: Readonly<Record<string, string>> = {
  light: 'mosque.webp',
  sepia: 'mosque-sepia.jpg',
  night: 'mosque-night.webp',
  'deep-night': 'mosque-night.webp',
};

/** JPEG twin for the WebP backgrounds, for browsers without WebP support. */
const THEME_BACKGROUND_FALLBACK: Readonly<Record<string, string>> = {
  light: 'mosque.jpg',
  night: 'mosque-night.jpg',
  'deep-night': 'mosque-night.jpg',
};

function supportsWebp(): boolean {
  try {
    return CSS.supports(
      'background-image',
      'url("data:image/webp;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")',
    );
  } catch {
    return false;
  }
}

const _preloadedThemeBackgrounds = new Set<string>();

export function ensureActiveThemeBackgroundPreload(): void {
  const theme: string = document.body.classList.contains('deep-night-mode')
    ? 'deep-night'
    : document.body.classList.contains('night-mode')
      ? 'night'
      : document.body.classList.contains('sepia-mode')
        ? 'sepia'
        : 'light';
  const file = THEME_BACKGROUND_FILE[theme];
  if (!file || _preloadedThemeBackgrounds.has(file)) {
    return;
  }
  _preloadedThemeBackgrounds.add(file);
  const preload = (href: string): void => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = `${import.meta.env.BASE_URL}backgrounds/${href}`;
    document.head.appendChild(link);
  };
  preload(file);
  if (file.endsWith('.webp') && !supportsWebp()) {
    const fallback = THEME_BACKGROUND_FALLBACK[theme];
    if (fallback) {
      preload(fallback);
    }
  }
}

/* ===================== NIGHT MODE ===================== */

/** Enable or disable night mode and persist the preference. */
export function applyNightMode(enabled: boolean): void {
  state.nightMode = enabled;
  if (enabled) {
    document.body.classList.add('night-mode');
    document.body.classList.remove('sepia-mode');
    document.body.classList.remove('deep-night-mode');
    state.sepiaMode = false;
  } else {
    document.body.classList.remove('night-mode');
    document.body.classList.remove('deep-night-mode');
  }
  storage.set('night_mode', enabled);
  storage.set('deep_night_mode', false);
  if (enabled) {
    storage.set('sepia_mode', false);
  }
  updateThemeButtons();
  updateThemeTriggerIcon();
  _reloadMushafPage?.();
  ensureActiveThemeBackgroundPreload();
}

export function toggleNightMode(): void {
  applyNightMode(!state.nightMode);
  updateThemeTriggerIcon();
}

/* ===================== SEPIA MODE ===================== */

/** Enable or disable sepia mode and persist the preference. */
export function applySepiaMode(enabled: boolean): void {
  state.sepiaMode = enabled;
  if (enabled) {
    document.body.classList.add('sepia-mode');
    document.body.classList.remove('night-mode');
    document.body.classList.remove('deep-night-mode');
    state.nightMode = false;
  } else {
    document.body.classList.remove('sepia-mode');
  }
  storage.set('sepia_mode', enabled);
  if (enabled) {
    storage.set('night_mode', false);
    storage.set('deep_night_mode', false);
  }
  updateThemeButtons();
  updateThemeTriggerIcon();
  _reloadMushafPage?.();
  ensureActiveThemeBackgroundPreload();
}

/** Enable or disable the darkest reading theme while keeping night-mode compatibility. */
export function applyDeepNightMode(enabled: boolean): void {
  state.nightMode = enabled;
  if (enabled) {
    document.body.classList.add('night-mode', 'deep-night-mode');
    document.body.classList.remove('sepia-mode');
    state.sepiaMode = false;
  } else {
    document.body.classList.remove('night-mode', 'deep-night-mode');
  }
  storage.set('deep_night_mode', enabled);
  storage.set('night_mode', enabled);
  if (enabled) {
    storage.set('sepia_mode', false);
  }
  updateThemeButtons();
  updateThemeTriggerIcon();
  _reloadMushafPage?.();
  ensureActiveThemeBackgroundPreload();
}

/** Apply a specific theme by name: 'light', 'sepia', 'night', or 'deep-night'. */
export function applyTheme(theme: 'light' | 'sepia' | 'night' | 'deep-night'): void {
  if (theme === 'night') {
    applyNightMode(true);
  } else if (theme === 'deep-night') {
    applyDeepNightMode(true);
  } else if (theme === 'sepia') {
    applySepiaMode(true);
  } else {
    applyNightMode(false);
    applySepiaMode(false);
  }
}

/**
 * Map of theme name to the emoji icon shown on the trigger button.
 */
const themeIconMap: Readonly<Record<string, string>> = {
  light: '\u2600\uFE0F',
  sepia: '\uD83D\uDCC3',
  night: '\uD83C\uDF19',
  'deep-night': '\uD83C\uDF11',
};

/**
 * Update the emoji icon on the theme trigger button to reflect the currently
 * active theme. Called after applyTheme() and after settings restore.
 */
export function updateThemeTriggerIcon(): void {
  const iconEl = dom.themeIcon;
  if (!iconEl) {
    return;
  }
  let active = 'light';
  if (state.nightMode && !document.body.classList.contains('deep-night-mode')) {
    active = 'night';
  } else if (document.body.classList.contains('deep-night-mode')) {
    active = 'deep-night';
  } else if (state.sepiaMode) {
    active = 'sepia';
  }
  iconEl.textContent = themeIconMap[active] ?? '\u2600\uFE0F';
}

/** Update the active state of theme buttons in the header */
function updateThemeButtons(): void {
  const buttons = document.querySelectorAll('.theme-btn');
  buttons.forEach((btn) => {
    const btnTheme = (btn as HTMLElement).dataset['theme'] as string;
    let isActive = false;
    if (btnTheme === 'light' && !state.nightMode && !state.sepiaMode) {
      isActive = true;
    }
    if (btnTheme === 'sepia' && state.sepiaMode) {
      isActive = true;
    }
    if (btnTheme === 'night' && state.nightMode && !document.body.classList.contains('deep-night-mode')) {
      isActive = true;
    }
    if (btnTheme === 'deep-night' && document.body.classList.contains('deep-night-mode')) {
      isActive = true;
    }
    btn.classList.toggle('active', isActive);
  });
}

/* ===================== SYSTEM THEME DETECTION ===================== */

/** Detect system color-scheme preference and apply it if user hasn't set a preference. */
export function initSystemThemeDetection(): void {
  // If user already has an explicit preference, don't override
  const hasExplicitPref = storage.get('night_mode') !== undefined && storage.get('night_mode') !== null;
  if (hasExplicitPref) {
    return;
  }

  const mql = window.matchMedia('(prefers-color-scheme: dark)');

  function applySystemTheme(e: MediaQueryListEvent | MediaQueryList): void {
    // Only apply if user hasn't set an explicit preference
    const stillNoPref = storage.get('night_mode') === undefined || storage.get('night_mode') === null;
    if (!stillNoPref) {
      return;
    }

    if (e.matches) {
      if (!document.body.classList.contains('night-mode')) {
        document.body.classList.add('night-mode');
        state.nightMode = true;
      }
    } else {
      if (document.body.classList.contains('night-mode')) {
        document.body.classList.remove('night-mode');
        state.nightMode = false;
      }
    }
    // Update the theme toggle icon
    const checkbox = dom.themeToggle?.querySelector('.theme-switch-check') as HTMLInputElement | null;
    if (checkbox) {
      checkbox.checked = e.matches;
    }
    // Note: do NOT set aria-checked on #themeToggle — it has role="group"
    // which does not allow aria-checked. The individual theme-btn buttons
    // use aria-pressed which is the correct attribute for toggle buttons.
  }

  // Apply initial system preference
  applySystemTheme(mql);

  // Listen for changes
  if (mql.addEventListener) {
    mql.addEventListener('change', applySystemTheme);
  } else if (mql.addListener) {
    // Deprecated but kept for older browsers
    mql.addListener(applySystemTheme as (ev: MediaQueryListEvent) => void);
  }
}
