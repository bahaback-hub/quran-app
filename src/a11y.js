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

/** @type {HTMLDivElement[]} */
const _liveRegions = [];

/**
 * Return (or create) a live-region `<div>` for screen-reader announcements.
 * @param {'polite'|'assertive'} politeness
 * @returns {HTMLDivElement}
 */
function getLiveRegion(politeness) {
  for (const region of _liveRegions) {
    if (region.getAttribute('aria-live') === politeness && !region.dataset.busy) {
      return region;
    }
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

/**
 * Trap keyboard focus inside `container` (for modals, drawers, panels).
 * @param {HTMLElement} container
 * @returns {() => void} Cleanup function.
 */
export function trapFocus(container) {
  if (!container) return () => {};
  const FOCUSABLE =
    'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),' +
    'select:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';

  function onKeyDown(e) {
    if (e.key !== 'Tab') return;
    const focusable = Array.from(container.querySelectorAll(FOCUSABLE))
      .filter(el => el.offsetParent !== null && !el.hasAttribute('disabled'));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !container.contains(active)) { e.preventDefault(); last.focus(); }
    } else {
      if (active === last || !container.contains(active)) { e.preventDefault(); first.focus(); }
    }
  }

  container.addEventListener('keydown', onKeyDown);
  const initial = container.querySelector(FOCUSABLE);
  if (initial) requestAnimationFrame(() => initial.focus());
  return () => container.removeEventListener('keydown', onKeyDown);
}

/* ================================================================== */
/*  2. announceToScreenReader                                          */
/* ================================================================== */

/**
 * Announce a message to screen readers via an ARIA live region.
 * @param {string} message
 * @param {'polite'|'assertive'} [politeness='polite']
 */
export function announceToScreenReader(message, politeness = 'polite') {
  if (!message) return;
  const region = getLiveRegion(politeness);
  region.textContent = '';
  region.dataset.busy = '1';
  requestAnimationFrame(() => {
    region.textContent = message;
    setTimeout(() => { delete region.dataset.busy; }, 600);
  });
}

/* ================================================================== */
/*  3. manageFocusOnPanelOpen                                          */
/* ================================================================== */

/**
 * Move focus into a panel/drawer when it opens.
 * @param {HTMLElement} panelEl
 * @param {HTMLElement} [triggerEl]
 */
export function manageFocusOnPanelOpen(panelEl, triggerEl) {
  if (!panelEl) return;
  if (triggerEl) {
    if (!triggerEl.id) triggerEl.id = '_a11y_trigger_' + Date.now();
    panelEl.dataset.a11yTriggerId = triggerEl.id;
  }
  if (!panelEl.hasAttribute('tabindex')) panelEl.setAttribute('tabindex', '-1');
  const FOCUSABLE =
    'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),' +
    'select:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';
  const first = panelEl.querySelector(FOCUSABLE);
  requestAnimationFrame(() => { first ? first.focus() : panelEl.focus(); });
  const label = panelEl.getAttribute('aria-label') || panelEl.getAttribute('aria-labelledby') || 'Panel';
  announceToScreenReader(`${label} opened`);
}

/* ================================================================== */
/*  4. restoreFocusOnPanelClose                                        */
/* ================================================================== */

/**
 * Return focus to the trigger element after a panel closes.
 * @param {HTMLElement} triggerEl
 * @param {HTMLElement} [panelEl]
 */
export function restoreFocusOnPanelClose(triggerEl, panelEl) {
  let target = triggerEl;
  if (!target && panelEl) {
    const id = panelEl.dataset.a11yTriggerId;
    if (id) target = document.getElementById(id);
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
 * @param {HTMLElement} element
 * @param {() => void} callback
 * @returns {() => void} Cleanup function.
 */
export function addKeyboardDismiss(element, callback) {
  if (!element || typeof callback !== 'function') return () => {};
  function onKeyDown(e) {
    if (e.key === 'Escape') { e.stopPropagation(); callback(); }
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
export function initToggleSwitchAccessibility() {
  document.addEventListener('keydown', (e) => {
    const toggle = e.target.closest('.toggle-switch');
    if (!toggle) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle.click(); }
  });

  for (const toggle of document.querySelectorAll('.toggle-switch')) {
    if (!toggle.hasAttribute('tabindex')) toggle.setAttribute('tabindex', '0');
    toggle.setAttribute('aria-checked', String(toggle.classList.contains('on')));
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'class') {
        const el = m.target;
        if (el.classList.contains('toggle-switch')) {
          el.setAttribute('aria-checked', String(el.classList.contains('on')));
        }
      }
    }
  });
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
}
