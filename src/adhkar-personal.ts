/**
 * Personal (user-authored) adhkar — add/edit/delete and per-item counters.
 * Extracted from adhkar.ts; the shared confirmation dialog also lives here and
 * is imported by the panel item dialogs for delete/reset.
 */
import { state } from './state.js';
import { dom } from './dom.js';
import { showToast, hydrateProgressFills } from './ui.js';
import { adhkarCategoryTitle, escapeHtml } from './templates.js';
import { __ } from './i18n.js';
import { initDialogAccessibility } from './a11y.js';
import { cloneAdhkarSettings, saveAdhkarSettings } from './adhkar-store.js';
import type { PersonalAdhkarEntry } from './types.js';

export function renderPersonalAdhkar(): void {
  if (!dom.adhkarContent) {
    return;
  }
  const settings = state.adhkarSettings!;
  const personal = settings.personal_adhkar || [];
  let html = adhkarCategoryTitle(__('adhkar_personal'), '');
  html += '<button class="adhkar-add-btn" id="openAddAdhkarBtn">' + __('adhkar_add') + '</button>';
  if (!personal.length) {
    html += '<p class="adhkar-no-personal">' + __('adhkar_no_personal') + '</p>';
  } else {
    for (const p of personal) {
      const counter = (settings[`item_personal_${p.id}`] as number) || 0;
      const remaining = Math.max(0, p.count - counter);
      const completed = counter >= p.count;
      const pct = Math.min(100, (counter / p.count) * 100);
      html += `<div class="adhkar-item${completed ? ' completed' : ''}" data-item-id="personal_${p.id}">
        <div class="adhkar-item-text">${escapeHtml(p.text)}</div>
        <div class="adhkar-progress-bar"><div class="adhkar-progress-fill" data-progress="${pct}"></div></div>
        <div class="adhkar-item-meta">
          <span class="adhkar-item-count">🔄 ${p.count} ${__('adhkar_times')} — ${__('adhkar_remaining')} ${remaining}</span>
          <span class="adhkar-item-reference">${p.time ? '⏰ ' + escapeHtml(p.time) : ''}</span>
          <div class="adhkar-personal-actions">
            <button class="adhkar-personal-btn edit" data-action="edit-personal" data-id="${escapeHtml(p.id)}">✏️</button>
            <button class="adhkar-personal-btn delete" data-action="delete-personal" data-id="${escapeHtml(p.id)}">🗑️</button>
          </div>
          <div class="adhkar-counter">
            <button class="adhkar-counter-btn${completed ? ' completed' : ''}" data-action="increment-personal" data-id="${escapeHtml(p.id)}">✓</button>
            <span class="adhkar-counter-text">${counter}</span>
          </div>
        </div>
      </div>`;
    }
  }
  dom.adhkarContent.innerHTML = html;
  // CSP-safe: apply progress widths through the CSSOM (no inline style attributes).
  hydrateProgressFills(dom.adhkarContent);

  document.getElementById('openAddAdhkarBtn')?.addEventListener('click', openAdhkarAddDialog);

  // FIX #7: Use event delegation (consistent with category adhkar) instead of
  // attaching direct listeners to every button — avoids re-binding on every render
  // and keeps the codebase uniform.
  const personalContentEl = dom.adhkarContent as HTMLElement & { _personalDelegationBound?: boolean };
  if (!personalContentEl._personalDelegationBound) {
    personalContentEl._personalDelegationBound = true;
    personalContentEl.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const actionBtn = target.closest('[data-action]') as HTMLElement | null;
      if (!actionBtn) {
        return;
      }
      const action = actionBtn.dataset['action'];
      const id = actionBtn.dataset['id'];
      if (!id) {
        return;
      }
      if (action === 'increment-personal') {
        handlePersonalAdhkarCounter(id);
        return;
      }
      if (action === 'edit-personal') {
        editPersonalAdhkar(id);
        return;
      }
      if (action === 'delete-personal') {
        deletePersonalAdhkar(id);
        return;
      }
    });
  }
}

/** FIX #6 + #7: Handle personal adhkar counter increment with proper confirmation
 *  toasts on completion (matching the category adhkar behavior). */
function handlePersonalAdhkarCounter(id: string): void {
  const settings = state.adhkarSettings!;
  const personalList = settings.personal_adhkar || [];
  const p = personalList.find((x: PersonalAdhkarEntry) => x.id === id);
  if (!p) {
    return;
  }
  const key = `item_personal_${p.id}`;
  const current = (settings[key] as number) || 0;
  const newSettings = cloneAdhkarSettings(state.adhkarSettings);
  if (current >= p.count) {
    // Already completed — restart with toast
    newSettings[key] = 0;
    state.adhkarSettings = newSettings;
    saveAdhkarSettings();
    updatePersonalAdhkarItemDOM(p, newSettings[key] as number);
    showToast(__('adhkar_repeat_complete'), 'success');
    return;
  }
  const next = current + 1;
  newSettings[key] = next;
  state.adhkarSettings = newSettings;
  saveAdhkarSettings();
  updatePersonalAdhkarItemDOM(p, next);
  if (next === p.count) {
    showToast(__('adhkar_completed'), 'success');
  }
}

/** Update a personal adhkar item's DOM without re-rendering the whole list. */
function updatePersonalAdhkarItemDOM(p: PersonalAdhkarEntry, counter: number): void {
  const itemEl = dom.adhkarContent?.querySelector(
    `.adhkar-item[data-item-id="personal_${p.id}"]`,
  ) as HTMLElement | null;
  if (!itemEl) {
    return;
  }
  const remaining = Math.max(0, p.count - counter);
  const completed = counter >= p.count;
  const pct = Math.min(100, (counter / p.count) * 100);
  itemEl.classList.toggle('completed', completed);
  const fill = itemEl.querySelector('.adhkar-progress-fill') as HTMLElement | null;
  if (fill) {
    fill.style.width = pct + '%';
  }
  const countSpan = itemEl.querySelector('.adhkar-item-count') as HTMLElement | null;
  if (countSpan) {
    countSpan.textContent = `🔄 ${p.count} ${__('adhkar_times')} — ${__('adhkar_remaining')} ${remaining}`;
  }
  const counterText = itemEl.querySelector('.adhkar-counter-text') as HTMLElement | null;
  if (counterText) {
    counterText.textContent = String(counter);
  }
  const counterBtn = itemEl.querySelector('.adhkar-counter-btn') as HTMLElement | null;
  if (counterBtn) {
    counterBtn.classList.toggle('completed', completed);
  }
}

function openAdhkarAddDialog(): void {
  if (!dom.adhkarAddOverlay) {
    return;
  }
  if (dom.adhkarAddText) {
    dom.adhkarAddText.value = '';
  }
  if (dom.adhkarAddCount) {
    dom.adhkarAddCount.value = '1';
  }
  if (dom.adhkarAddTime) {
    dom.adhkarAddTime.value = '';
  }
  if (dom.adhkarAddDuration) {
    dom.adhkarAddDuration.value = '1';
  }
  dom.adhkarAddOverlay.dataset['editId'] = '';
  dom.adhkarAddOverlay.classList.remove('hidden');
  dom.adhkarAddOverlay.style.display = 'flex';
}

export function closeAdhkarAddDialog(): void {
  if (dom.adhkarAddOverlay) {
    dom.adhkarAddOverlay.classList.add('hidden');
    dom.adhkarAddOverlay.style.display = 'none';
  }
}

export function savePersonalAdhkar(): void {
  const text = dom.adhkarAddText?.value.trim();
  if (!text) {
    showToast(__('adhkar_enter_text'), 'error');
    return;
  }
  const count = parseInt(dom.adhkarAddCount?.value ?? '1', 10) || 1;
  const time = dom.adhkarAddTime?.value || null;
  const duration = parseInt(dom.adhkarAddDuration?.value ?? '1', 10) || 1;
  const editId = dom.adhkarAddOverlay?.dataset['editId'] || '';

  // Clone settings to trigger Proxy notification (consistent with rest of codebase)
  const newSettings = cloneAdhkarSettings(state.adhkarSettings);
  if (!newSettings.personal_adhkar) {
    newSettings.personal_adhkar = [];
  }

  if (editId) {
    const p = newSettings.personal_adhkar.find((x: PersonalAdhkarEntry) => x.id === editId);
    if (p) {
      p.text = text;
      p.count = count;
      p.time = time;
      p.duration = duration;
    }
  } else {
    const newItem: PersonalAdhkarEntry = { id: 'pa_' + Date.now(), text, count, time, duration };
    newSettings.personal_adhkar.push(newItem);
  }
  state.adhkarSettings = newSettings;

  saveAdhkarSettings();
  closeAdhkarAddDialog();
  renderPersonalAdhkar();
  showToast(editId ? __('adhkar_edited') : __('adhkar_saved'), 'success');
}

function editPersonalAdhkar(id: string): void {
  const settings = state.adhkarSettings!;
  const p = settings.personal_adhkar?.find((x: PersonalAdhkarEntry) => x.id === id);
  if (!p) {
    return;
  }
  if (!dom.adhkarAddOverlay) {
    return;
  }
  dom.adhkarAddOverlay.classList.remove('hidden');
  dom.adhkarAddOverlay.style.display = 'flex';
  dom.adhkarAddOverlay.dataset['editId'] = id;
  if (dom.adhkarAddText) {
    dom.adhkarAddText.value = p.text;
  }
  if (dom.adhkarAddCount) {
    dom.adhkarAddCount.value = String(p.count);
  }
  if (dom.adhkarAddTime) {
    dom.adhkarAddTime.value = p.time || '';
  }
  if (dom.adhkarAddDuration) {
    dom.adhkarAddDuration.value = String(p.duration || 1);
  }
}

/**
 * Single builder for every adhkar confirmation dialog (QUA-03).
 *
 * Three near-identical builders used to live here; they drifted (one forgot
 * direction:rtl, toast types disagreed) and every accessibility improvement
 * would have needed applying three times. This one also wires
 * initDialogAccessibility (UXS-05): focus trap + Escape + aria-modal, which
 * the hand-rolled versions never had.
 */
export interface ConfirmDialogOptions {
  id: string;
  messageKey: string;
  titleKey?: string;
  confirmKey: string;
  /** Delete-style red vs settings-style accent confirm button. */
  tone: 'danger' | 'accent';
  minWidth: number;
  onConfirm: () => void;
}

export function confirmAdhkarDialog(opts: ConfirmDialogOptions): void {
  document.getElementById(opts.id)?.remove();
  const overlay = document.createElement('div');
  overlay.id = opts.id;
  overlay.setAttribute('role', 'dialog');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;' +
    'background:rgba(0,0,0,0.5);';

  const modal = document.createElement('div');
  modal.style.cssText =
    `background:var(--bg-primary,#fff);border-radius:16px;padding:24px;min-width:${opts.minWidth}px;` +
    'max-width:90vw;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.3);direction:rtl;';

  if (opts.titleKey) {
    const title = document.createElement('h3');
    title.textContent = __(opts.titleKey);
    title.style.cssText = 'margin:0 0 12px;color:var(--text-primary,#000);font-size:16px;';
    modal.append(title);
  }

  const msg = document.createElement('p');
  msg.textContent = __(opts.messageKey);
  msg.style.cssText = 'margin:0 0 20px;color:var(--text-secondary,#666);font-size:14px;';
  modal.append(msg);

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:center;';

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = __(opts.confirmKey);
  confirmBtn.style.cssText =
    'flex:1;padding:10px 20px;border:none;border-radius:8px;' +
    (opts.tone === 'danger'
      ? 'background:#e74c3c;color:#fff;font-size:14px;font-weight:bold;cursor:pointer;font-family:inherit;'
      : 'background:var(--accent,#d97706);color:#fff;font-size:14px;font-weight:bold;cursor:pointer;font-family:inherit;');

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = __('close');
  cancelBtn.style.cssText =
    'flex:1;padding:10px 20px;border:none;border-radius:8px;background:var(--border-soft,#eee);' +
    'color:var(--text-primary,#000);font-size:14px;cursor:pointer;font-family:inherit;';

  // Accessibility (UXS-05): focus trap + Escape dismiss. The cleanup must run
  // on every close path or listeners leak onto document forever.
  const cleanupA11y = initDialogAccessibility(overlay, () => close());
  function close(): void {
    cleanupA11y();
    overlay.remove();
  }

  confirmBtn.addEventListener('click', () => {
    opts.onConfirm();
    close();
  });

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e: MouseEvent) => {
    if (e.target === overlay) {
      close();
    }
  });

  btnRow.append(cancelBtn, confirmBtn);
  modal.append(btnRow);
  overlay.append(modal);
  document.body.appendChild(overlay);
  cancelBtn.focus();
}

function deletePersonalAdhkar(id: string): void {
  // Custom confirmation modal instead of browser confirm()
  confirmAdhkarDialog({
    id: 'adhkarDeleteModal',
    messageKey: 'adhkar_confirm_delete',
    confirmKey: 'delete',
    tone: 'danger',
    minWidth: 280,
    onConfirm: () => {
      const settings = state.adhkarSettings!;
      settings.personal_adhkar = (settings.personal_adhkar || []).filter((x: PersonalAdhkarEntry) => x.id !== id);
      const newSettings = cloneAdhkarSettings(state.adhkarSettings);
      delete newSettings[`item_personal_${id}`];
      state.adhkarSettings = newSettings;
      saveAdhkarSettings();
      renderPersonalAdhkar();
      showToast(__('adhkar_deleted'), '');
    },
  });
}
