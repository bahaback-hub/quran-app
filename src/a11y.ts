/**
 * Accessibility utilities for the Quran app.
 *
 * Provides focus management, screen-reader announcements, keyboard
 * dismiss helpers, and toggle-switch accessibility.
 *
 * @module a11y
 */

/* ------------------------------------------------------------------ */
/*  Live-region pool (re-uses a small set of ARIA live regions)       */
/* ------------------------------------------------------------------ */

const _liveRegions: HTMLDivElement[] = [];

type AriaPoliteness = 'polite' | 'assertive';

/**
 * Return (or create) a live-region `<div>` for screen-reader announcements.
 */
function getLiveRegion(politeness: AriaPoliteness): HTMLDivElement {
  for (const region of _liveRegions) {
    if (region.getAttribute('aria-live') === politeness && !region.dataset['busy']) {
      return region;
    }
  }
  // Cap pool size at 4 — reuse oldest region if limit reached
  if (_liveRegions.length >= 4) {
    const oldest = _liveRegions[0]!;
    delete oldest.dataset['busy'];
    return oldest;
  }
  const el = document.createElement('div');
  el.setAttribute('aria-live', politeness);
  el.setAttribute('aria-atomic', 'true');
  el.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status');
  el.className = 'sr-only';
  el.style.cssText =
    'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;' +
    'clip:rect(0,0,0,0);white-space:nowrap;border:0;';
  document.body.appendChild(el);
  _liveRegions.push(el);
  return el;
}

/* ================================================================== */
/*  1. trapFocus                                                       */
/* ================================================================== */

const FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),' +
  'select:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';

/**
 * Trap keyboard focus inside `container` (for modals, drawers, panels).
 * @returns Cleanup function.
 */
export function trapFocus(container: HTMLElement): () => void {
  if (!container) {
    return () => {};
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key !== 'Tab') {
      return;
    }
    const focusable = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
      (el: Element) => (el as HTMLElement).offsetParent !== null && !el.hasAttribute('disabled'),
    ) as HTMLElement[];
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !container.contains(active)) {
        e.preventDefault();
        last!.focus();
      }
    } else {
      if (active === last || !container.contains(active)) {
        e.preventDefault();
        first!.focus();
      }
    }
  }

  container.addEventListener('keydown', onKeyDown);
  const initial = container.querySelector(FOCUSABLE_SELECTOR) as HTMLElement | null;
  if (initial) {
    requestAnimationFrame(() => initial.focus());
  }
  return () => container.removeEventListener('keydown', onKeyDown);
}

/* ================================================================== */
/*  2. announceToScreenReader                                          */
/* ================================================================== */

/**
 * Announce a message to screen readers via an ARIA live region.
 */
export function announceToScreenReader(message: string, politeness: AriaPoliteness = 'polite'): void {
  if (!message) {
    return;
  }
  const region = getLiveRegion(politeness);
  region.textContent = '';
  region.dataset['busy'] = '1';
  requestAnimationFrame(() => {
    region.textContent = message;
    setTimeout(() => {
      delete region.dataset['busy'];
    }, 600);
  });
}

/* ================================================================== */
/*  3. manageFocusOnPanelOpen                                          */
/* ================================================================== */

let _a11yIdCounter = 0;

/**
 * Move focus into a panel/drawer when it opens.
 */
export function manageFocusOnPanelOpen(panelEl: HTMLElement, triggerEl?: HTMLElement): void {
  if (!panelEl) {
    return;
  }
  if (triggerEl) {
    if (!triggerEl.id) {
      triggerEl.id = '_a11y_trigger_' + Date.now() + '_' + ++_a11yIdCounter;
    }
    panelEl.dataset['a11yTriggerId'] = triggerEl.id;
  }
  if (!panelEl.hasAttribute('tabindex')) {
    panelEl.setAttribute('tabindex', '-1');
  }
  const first = panelEl.querySelector(FOCUSABLE_SELECTOR) as HTMLElement | null;
  requestAnimationFrame(() => {
    if (first) {
      first.focus();
    } else {
      panelEl.focus();
    }
  });
  const label = panelEl.getAttribute('aria-label') || panelEl.getAttribute('aria-labelledby') || 'Panel';
  announceToScreenReader(`${label} opened`);
}

/* ================================================================== */
/*  4. restoreFocusOnPanelClose                                        */
/* ================================================================== */

/**
 * Return focus to the trigger element after a panel closes.
 */
export function restoreFocusOnPanelClose(triggerEl?: HTMLElement | null, panelEl?: HTMLElement | null): void {
  let target: HTMLElement | null | undefined = triggerEl;
  if (!target && panelEl) {
    const id = panelEl.dataset['a11yTriggerId'];
    if (id) {
      target = document.getElementById(id);
    }
  }
  if (target && typeof target.focus === 'function') {
    requestAnimationFrame(() => target.focus());
  }
  if (panelEl) {
    announceToScreenReader((panelEl.getAttribute('aria-label') || 'Panel') + ' closed');
  }
}

/* ================================================================== */
/*  5. addKeyboardDismiss                                              */
/* ================================================================== */

/**
 * Call `callback` when Escape is pressed while `element` has focus.
 * @returns Cleanup function.
 */
export function addKeyboardDismiss(element: HTMLElement, callback: () => void): () => void {
  if (!element || typeof callback !== 'function') {
    return () => {};
  }
  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation();
      callback();
    }
  }
  element.addEventListener('keydown', onKeyDown);
  return () => element.removeEventListener('keydown', onKeyDown);
}

/* ================================================================== */
/*  6. initToggleSwitchAccessibility                                   */
/* ================================================================== */

/**
 * Enhance all toggle-switch elements with keyboard support (Enter/Space)
 * and keep their aria-checked attribute in sync.
 */
export function initToggleSwitchAccessibility(): void {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    const toggle = (e.target as Element)?.closest('.toggle-switch') as HTMLElement | null;
    if (!toggle) {
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle.click();
    }
  });

  for (const toggle of document.querySelectorAll('.toggle-switch')) {
    if (!toggle.hasAttribute('tabindex')) {
      toggle.setAttribute('tabindex', '0');
    }
    toggle.setAttribute('aria-checked', String(toggle.classList.contains('on')));
  }

  const observer = new MutationObserver((mutations: MutationRecord[]) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'class') {
        const el = m.target as Element;
        if (el.classList.contains('toggle-switch')) {
          el.setAttribute('aria-checked', String(el.classList.contains('on')));
        }
      }
    }
  });
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  // Disconnect observer after initial setup period to avoid performance overhead
  // Toggle switches after this point will be handled by click event + keydown handler
  setTimeout(() => observer.disconnect(), 10000);
}
