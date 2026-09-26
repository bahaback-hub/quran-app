/**
 * Help/guide panel events — extracted from app-events.ts so the
 * application-wide binding module stays focused and this self-contained
 * feature keeps its own listeners, accordion wiring, and language refresh.
 */

import { dom } from '../dom.js';
import { storage } from '../storage.js';
import { helpPanelHTML } from '../templates.js';

/** Open the help/guide panel. */
export function openHelp(): void {
  if (dom.helpPanel) {
    dom.helpPanel.classList.add('open');
  }
}

/**
 * Close the help/guide panel.
 */
function closeHelp(): void {
  if (dom.helpPanel) {
    dom.helpPanel.classList.remove('open');
  }
}

function bindHelpPanelInteractions(panel: HTMLElement): void {
  panel.addEventListener('click', (e: MouseEvent) => {
    const toggle = (e.target as HTMLElement).closest('.help-section-toggle') as HTMLElement | null;
    if (!toggle) {
      return;
    }
    const section = toggle.dataset['section'];
    if (!section) {
      return;
    }
    const content = panel.querySelector(`.help-section-content[data-section="${section}"]`);
    if (content) {
      content.classList.toggle('open');
    }
    const icon = toggle.querySelector('.help-toggle-icon');
    if (icon) {
      icon.textContent = content?.classList.contains('open') ? '▲' : '▼';
    }
  });
}

function refreshHelpPanelForLanguage(): void {
  const previous = dom.helpPanel;
  if (!previous) {
    return;
  }
  const wasOpen = previous.classList.contains('open');
  const expanded = [...previous.querySelectorAll('.help-section-content.open')]
    .map((item) => item.getAttribute('data-section'))
    .filter((section): section is string => Boolean(section));
  const wrapper = document.createElement('div');
  wrapper.innerHTML = helpPanelHTML();
  const next = wrapper.firstElementChild as HTMLElement | null;
  if (!next) {
    return;
  }
  previous.replaceWith(next);
  dom.helpPanel = next;
  dom.helpCloseBtn = next.querySelector('#helpCloseBtn');
  if (wasOpen) {
    next.classList.add('open');
  }
  for (const section of expanded) {
    const content = next.querySelector(`.help-section-content[data-section="${section}"]`);
    const icon = next.querySelector(`.help-section-toggle[data-section="${section}"] .help-toggle-icon`);
    content?.classList.add('open');
    if (icon) {
      icon.textContent = '▲';
    }
  }
  dom.helpCloseBtn?.addEventListener('click', closeHelp);
  bindHelpPanelInteractions(next);
}

/**
 * Bind help panel events: open/close toggle, accordion sections, first-use auto-open.
 */
export function bindHelpEvents(): void {
  dom.helpToggleBtn?.addEventListener('click', () => {
    if (dom.helpPanel?.classList.contains('open')) {
      closeHelp();
      return;
    }
    openHelp();
  });
  dom.helpCloseBtn?.addEventListener('click', closeHelp);

  // Close help when clicking outside
  document.addEventListener('click', (e: MouseEvent) => {
    const helpTarget = e.target as HTMLElement;
    const isHelpTrigger =
      helpTarget === dom.helpToggleBtn ||
      helpTarget.closest?.('#helpToggleBtn') !== null ||
      helpTarget.closest?.('#helpFromSettingsBtn') !== null;
    if (dom.helpPanel?.classList.contains('open') && !dom.helpPanel.contains(e.target as Node) && !isHelpTrigger) {
      closeHelp();
    }
  });

  if (dom.helpPanel) {
    bindHelpPanelInteractions(dom.helpPanel);
  }
  window.addEventListener('app:langchange', refreshHelpPanelForLanguage);

  // Auto-open help on first use
  const seen = storage.get<boolean>('help_seen', false);
  if (!seen) {
    storage.set('help_seen', true);
    openHelp();
  }
}
