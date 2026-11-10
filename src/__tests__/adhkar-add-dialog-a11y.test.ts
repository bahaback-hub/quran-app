/**
 * UXS-05 regression — the personal-adhkar add/edit overlay shipped
 * aria-modal="true" with no focus trap and no Escape handling of its own,
 * while the global Escape list (keyboard.ts) closed every other surface but
 * this one. Opening the dialog must now install the full dialog treatment
 * (trap + Escape + aria-modal), and every close path must release it.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { state } from '../state.js';
import { dom } from '../dom.js';

vi.mock('../ui.js', () => ({
  showToast: vi.fn(),
  hydrateProgressFills: vi.fn(),
}));

vi.mock('../i18n.js', () => ({
  __: (key: string) => key,
}));

vi.mock('../templates.js', () => ({
  adhkarCategoryTitle: vi.fn(() => ''),
  escapeHtml: (s: string) => s,
}));

vi.mock('../adhkar-store.js', () => ({
  cloneAdhkarSettings: vi.fn((s: unknown) => JSON.parse(JSON.stringify(s))),
  saveAdhkarSettings: vi.fn(),
}));

import { closeAdhkarAddDialog } from '../adhkar-personal.js';

/** The overlay markup mirrors src/overlays.ts (adhkarAddOverlayHTML). */
function mountOverlay(): void {
  document.body.innerHTML = `
    <div id="adhkarContent">
      <button id="openAddAdhkarBtn">add</button>
    </div>
    <div class="adhkar-add-overlay hidden" id="adhkarAddOverlay" aria-modal="true">
      <div class="adhkar-add-inner">
        <div class="adhkar-add-header">
          <h3>title</h3>
          <button id="adhkarAddCloseBtn">close</button>
        </div>
        <textarea id="adhkarAddText" rows="3"></textarea>
        <input type="number" id="adhkarAddCount" value="1" />
        <input type="time" id="adhkarAddTime" />
        <input type="number" id="adhkarAddDuration" value="1" />
        <button id="adhkarAddSaveBtn">save</button>
      </div>
    </div>`;
  dom.adhkarContent = document.getElementById('adhkarContent');
  dom.adhkarAddOverlay = document.getElementById('adhkarAddOverlay');
  dom.adhkarAddCloseBtn = document.getElementById('adhkarAddCloseBtn');
  dom.adhkarAddText = document.getElementById('adhkarAddText') as HTMLInputElement;
  dom.adhkarAddCount = document.getElementById('adhkarAddCount') as HTMLInputElement;
  dom.adhkarAddTime = document.getElementById('adhkarAddTime') as HTMLInputElement;
  dom.adhkarAddDuration = document.getElementById('adhkarAddDuration') as HTMLInputElement;
  dom.adhkarAddSaveBtn = document.getElementById('adhkarAddSaveBtn');
}

describe('personal-adhkar add dialog accessibility (UXS-05)', () => {
  beforeEach(() => {
    mountOverlay();
    state.adhkarSettings = {
      adhkar_enabled: false,
      adhkar_sound: false,
      personal_adhkar: [],
    } as unknown as typeof state.adhkarSettings;
  });

  it('installs a focus trap and Escape dismiss when opened via the add button', async () => {
    const { renderPersonalAdhkar } = await import('../adhkar-personal.js');
    renderPersonalAdhkar();

    document.getElementById('openAddAdhkarBtn')!.click();
    const overlay = document.getElementById('adhkarAddOverlay')!;
    expect(overlay.classList.contains('hidden')).toBe(false);

    // trapFocus moves the initial focus inside on the next animation frame.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    // Focus starts inside the dialog…
    expect(overlay.contains(document.activeElement)).toBe(true);

    // …Tab from the last focusable element wraps back inside…
    const saveBtn = document.getElementById('adhkarAddSaveBtn')!;
    saveBtn.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    saveBtn.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(overlay.contains(document.activeElement)).toBe(true);

    // …and Escape now closes the dialog itself (it used to be the one
    // surface the global Escape list missed).
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.activeElement!.dispatchEvent(escape);
    expect(overlay.classList.contains('hidden')).toBe(true);
  });

  it('releases the trap on every close path', async () => {
    const { renderPersonalAdhkar } = await import('../adhkar-personal.js');
    renderPersonalAdhkar();
    document.getElementById('openAddAdhkarBtn')!.click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const overlay = document.getElementById('adhkarAddOverlay')!;

    closeAdhkarAddDialog();
    expect(overlay.classList.contains('hidden')).toBe(true);

    // After cleanup the sheet's Tab interception is gone: an outside element
    // can Tab freely and is not pulled back into the (hidden) overlay.
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    outside.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
  });
});
