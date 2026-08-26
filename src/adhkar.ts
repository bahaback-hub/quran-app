import { state } from './state.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { showToast } from './ui.js';
import { adhkarTab, adhkarCategoryTitle, escapeHtml } from './templates.js';
import {
  ADHKAR_DATA,
  getCategoryItems,
  addCustomAdhkarItem,
  editAdhkarItem,
  deleteAdhkarItem,
  resetAdhkarCustomizations,
} from './adhkar-data.js';
import { __ } from './i18n.js';
import {
  checkAdhkarNotifications,
  dismissAdhkarNotification,
  startAdhkarNotificationScheduler,
  stopAdhkarNotificationScheduler,
} from './adhkar-notifications.js';
import type { AdhkarSettings, AdhkarCategorySettings, PersonalAdhkarEntry } from './types.js';

/* ===================== INIT ===================== */

/** Deep-clone adhkar settings to avoid shallow copy issues with nested objects
 *  (e.g., personal_adhkar array). Uses structuredClone when available,
 *  falls back to JSON round-trip. */
function cloneAdhkarSettings(settings: AdhkarSettings | null): AdhkarSettings {
  if (!settings) {
    return getDefaultAdhkarSettings();
  }
  if (typeof structuredClone === 'function') {
    return structuredClone(settings);
  }
  return JSON.parse(JSON.stringify(settings));
}

/** Initialize adhkar state — load settings from storage into state. */
export function initAdhkarState(): void {
  const saved = storage.get<AdhkarSettings>('adhkar_settings');
  if (saved) {
    state.adhkarSettings = saved;
  } else {
    state.adhkarSettings = getDefaultAdhkarSettings();
  }
}

function getDefaultAdhkarSettings(): AdhkarSettings {
  const settings: AdhkarSettings = {
    adhkar_enabled: false,
    adhkar_sound: false,
    _resetDate: new Date().toDateString(),
    personal_adhkar: [],
  };
  for (const cat of ADHKAR_DATA.categories) {
    settings[cat.id] = {
      enabled: true,
      time: cat.defaultTime || '',
      duration: cat.defaultDuration ?? 1,
    };
    for (const item of cat.items) {
      settings[`item_${item.id}`] = 0;
    }
  }
  settings.personal_adhkar = [];
  return settings;
}

/* ===================== LOAD / SAVE ===================== */

/** Load adhkar settings from storage or set defaults; reset daily counters. */
export function loadAdhkarSettings(): void {
  const saved = storage.get<AdhkarSettings>('adhkar_settings');
  const defaults = getDefaultAdhkarSettings();
  if (saved) {
    for (const key of Object.keys(defaults)) {
      if (saved[key] === undefined) {
        saved[key] = defaults[key];
      }
    }
    state.adhkarSettings = saved;
  } else {
    state.adhkarSettings = defaults;
  }
  // Sync toggle UI with loaded state
  if (dom.adhkarEnabledToggle) {
    dom.adhkarEnabledToggle.classList.toggle('on', !!state.adhkarSettings!.adhkar_enabled);
  }
  if (dom.adhkarSoundToggle) {
    dom.adhkarSoundToggle.classList.toggle('on', !!state.adhkarSettings!.adhkar_sound);
  }

  const today = new Date().toDateString();
  if (state.adhkarSettings!._resetDate !== today) {
    for (const key of Object.keys(state.adhkarSettings!)) {
      if (key.startsWith('item_')) {
        state.adhkarSettings![key] = 0;
      }
    }
    state.adhkarSettings!._resetDate = today;
    saveAdhkarSettings();
  }
}

function saveAdhkarSettings(): void {
  storage.set('adhkar_settings', state.adhkarSettings);
}

/* ===================== PANEL ===================== */

/** Toggle the adhkar panel open/closed. */
export function toggleAdhkarPanel(): void {
  state.adhkarPanelOpen = !state.adhkarPanelOpen;
  dom.adhkarPanel?.classList.toggle('open', state.adhkarPanelOpen);
  document.body.classList.toggle('adhkar-curtain-active', state.adhkarPanelOpen);
  if (state.adhkarPanelOpen) {
    renderAdhkarTabs();
    if (!state.adhkarActiveTab) {
      state.adhkarActiveTab = ADHKAR_DATA.categories[0]!.id;
    }
    switchAdhkarTab(state.adhkarActiveTab);
  }
}

/** Close the adhkar panel. */
export function closeAdhkarPanel(): void {
  state.adhkarPanelOpen = false;
  dom.adhkarPanel?.classList.remove('open');
  document.body.classList.remove('adhkar-curtain-active');
}

function renderAdhkarTabs(): void {
  if (!dom.adhkarTabs) {
    return;
  }
  let html = '';
  for (const cat of ADHKAR_DATA.categories) {
    html += adhkarTab(cat.id, cat.icon + ' ' + cat.name, state.adhkarActiveTab === cat.id);
  }
  html += adhkarTab('personal', __('adhkar_personal'), state.adhkarActiveTab === 'personal');
  dom.adhkarTabs.innerHTML = html;
  dom.adhkarTabs.querySelectorAll('.adhkar-tab').forEach((btn: Element) => {
    btn.addEventListener('click', () => switchAdhkarTab((btn as HTMLElement).dataset['tab'] as string));
  });
}

function switchAdhkarTab(categoryId: string): void {
  state.adhkarActiveTab = categoryId;
  document
    .querySelectorAll('.adhkar-tab')
    .forEach((t: Element) => t.classList.toggle('active', (t as HTMLElement).dataset['tab'] === categoryId));
  renderAdhkarCategory(categoryId);
}

function renderAdhkarCategory(categoryId: string): void {
  if (!dom.adhkarContent) {
    return;
  }
  if (categoryId === 'personal') {
    renderPersonalAdhkar();
    return;
  }
  const cat = ADHKAR_DATA.categories.find((c: { id: string }) => c.id === categoryId);
  if (!cat) {
    return;
  }
  const settings = state.adhkarSettings!;
  const catSettings = (settings[cat.id] as Partial<AdhkarCategorySettings>) || {};
  const enabled = !!catSettings.enabled;
  const notifTime = typeof catSettings.time === 'string' ? catSettings.time : cat.defaultTime || '';
  const notifDur =
    typeof catSettings.duration === 'number' && Number.isFinite(catSettings.duration)
      ? catSettings.duration
      : (cat.defaultDuration ?? 1);
  let html =
    adhkarCategoryTitle(cat.name, cat.icon) +
    `
    <div class="adhkar-category-options">
      <label class="adhkar-cat-label">
        <div class="adhkar-cat-toggle toggle-switch${enabled ? ' on' : ''}" data-category="${cat.id}" role="switch"></div>
        ${__('adhkar_enable_notification')}
      </label>
      <label class="adhkar-cat-label--time">
        ⏰ <input type="time" class="adhkar-cat-time adhkar-cat-time-input" data-category="${cat.id}" value="${escapeHtml(notifTime)}">
      </label>
      <label class="adhkar-cat-label--time">
        🔔 <input type="number" class="adhkar-cat-duration adhkar-cat-duration-input" data-category="${cat.id}" value="${notifDur}" min="1" max="60"> ${__('minutes')}
      </label>
      <span class="adhkar-cat-status">${enabled ? __('notification_active') : __('notification_paused')}</span>
    </div>`;

  // FIX #1: Always show adhkar item text (not hidden until notification time).
  // Use effective items (default + user customizations + overrides).
  const effectiveItems = getCategoryItems(categoryId);
  for (const item of effectiveItems) {
    const counter = (settings[`item_${item.id}`] as number) || 0;
    const remaining = Math.max(0, item.count - counter);
    const completed = counter >= item.count;
    const pct = item.count > 0 ? Math.min(100, (counter / item.count) * 100) : 0;
    const isCustom = item.id.startsWith('custom_');
    html += `<div class="adhkar-item${completed ? ' completed' : ''}${isCustom ? ' custom-item' : ''}" data-item-id="${item.id}" data-category="${categoryId}">
      <div class="adhkar-item-header">
        <div class="adhkar-item-actions">
          <button class="adhkar-item-action-btn" data-action="edit-item" data-item-id="${item.id}" data-category="${categoryId}" title="${__('adhkar_edit_item')}" aria-label="${__('adhkar_edit_item')}">✏️</button>
          <button class="adhkar-item-action-btn" data-action="delete-item" data-item-id="${item.id}" data-category="${categoryId}" title="${__('adhkar_delete_item')}" aria-label="${__('adhkar_delete_item')}">🗑️</button>
          <button class="adhkar-item-action-btn" data-action="copy-item" data-item-id="${item.id}" data-category="${categoryId}" title="${__('adhkar_copy_item')}" aria-label="${__('adhkar_copy_item')}">📋</button>
        </div>
      </div>
      <div class="adhkar-item-text">${escapeHtml(item.text)}</div>
      <div class="adhkar-progress-bar"><div class="adhkar-progress-fill" style="width:${pct}%"></div></div>
      <div class="adhkar-item-meta">
        <span class="adhkar-item-count">🔄 ${item.count} ${__('adhkar_times')} — ${__('adhkar_remaining')} ${remaining}</span>
        <span class="adhkar-item-reference">📚 ${escapeHtml(item.reference)}</span>
        <div class="adhkar-counter">
          <button class="adhkar-counter-btn${completed ? ' completed' : ''}" data-action="increment" data-item-id="${item.id}" data-category="${categoryId}">✓</button>
          <span class="adhkar-counter-text">${counter}</span>
        </div>
      </div>
    </div>`;
  }

  // Action buttons: Add new + Reset counters + Reset to defaults
  html += `<div class="adhkar-actions-row">
    <button class="adhkar-add-btn" data-action="add-item" data-category="${categoryId}">➕ ${__('adhkar_add_item')}</button>
    <button class="adhkar-reset-btn" data-action="reset" data-category="${categoryId}">${__('adhkar_reset')}</button>
    <button class="adhkar-restore-btn" data-action="reset-custom" data-category="${categoryId}" title="${__('adhkar_reset_defaults_desc')}">🔄 ${__('adhkar_reset_defaults')}</button>
  </div>`;
  dom.adhkarContent.innerHTML = html;

  const contentEl = dom.adhkarContent as HTMLElement & { _delegationBound?: boolean };
  if (!contentEl._delegationBound) {
    contentEl._delegationBound = true;
    contentEl.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const actionBtn = target.closest('[data-action]') as HTMLElement | null;
      if (actionBtn) {
        const action = actionBtn.dataset['action'];
        const itemId = actionBtn.dataset['itemId'];
        const catId = actionBtn.dataset['category'] as string;
        if (action === 'increment') {
          handleAdhkarCounter(itemId as string, catId);
          return;
        }
        if (action === 'reset') {
          resetAdhkarCounters(catId);
          return;
        }
        if (action === 'edit-item') {
          openEditItemDialog(itemId as string, catId);
          return;
        }
        if (action === 'delete-item') {
          confirmDeleteItem(itemId as string, catId);
          return;
        }
        if (action === 'copy-item') {
          copyAdhkarItemText(itemId as string, catId);
          return;
        }
        if (action === 'add-item') {
          openAddItemDialog(catId);
          return;
        }
        if (action === 'reset-custom') {
          confirmResetCustomizations(catId);
          return;
        }
      }
      const toggle = target.closest('.adhkar-cat-toggle') as HTMLElement | null;
      if (toggle) {
        const catId = toggle.dataset['category'] as string;
        const newSettings = cloneAdhkarSettings(state.adhkarSettings);
        if (!newSettings[catId]) {
          newSettings[catId] = {} as AdhkarCategorySettings;
        }
        (newSettings[catId] as Partial<AdhkarCategorySettings>).enabled = toggle.classList.toggle('on');
        state.adhkarSettings = newSettings;
        saveAdhkarSettings();
        renderAdhkarCategory(catId);
        return;
      }
    });
    contentEl.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('adhkar-cat-time')) {
        const catId = (target as HTMLElement).dataset['category'] as string;
        const newSettings = cloneAdhkarSettings(state.adhkarSettings);
        if (!newSettings[catId]) {
          newSettings[catId] = {} as AdhkarCategorySettings;
        }
        (newSettings[catId] as Partial<AdhkarCategorySettings>).time = (target as HTMLInputElement).value;
        state.adhkarSettings = newSettings;
        saveAdhkarSettings();
        return;
      }
      if (target.classList.contains('adhkar-cat-duration')) {
        const catId = (target as HTMLElement).dataset['category'] as string;
        const newSettings = cloneAdhkarSettings(state.adhkarSettings);
        if (!newSettings[catId]) {
          newSettings[catId] = {} as AdhkarCategorySettings;
        }
        (newSettings[catId] as Partial<AdhkarCategorySettings>).duration =
          parseInt((target as HTMLInputElement).value, 10) || 1;
        state.adhkarSettings = newSettings;
        saveAdhkarSettings();
      }
    });
  }
}

function updateAdhkarItemDOM(itemId: string, categoryId: string): void {
  const itemEl = dom.adhkarContent?.querySelector(`.adhkar-item[data-item-id="${itemId}"]`) as HTMLElement | null;
  if (!itemEl) {
    return;
  }
  // Use effective items (includes user customizations + overrides)
  const items = getCategoryItems(categoryId);
  const item = items.find((i) => i.id === itemId);
  if (!item) {
    return;
  }
  const key = `item_${item.id}`;
  const settings = state.adhkarSettings!;
  const counter = (settings[key] as number) || 0;
  const remaining = Math.max(0, item.count - counter);
  const completed = counter >= item.count;
  const pct = item.count > 0 ? Math.min(100, (counter / item.count) * 100) : 0;
  itemEl.classList.toggle('completed', completed);
  const fill = itemEl.querySelector('.adhkar-progress-fill') as HTMLElement | null;
  if (fill) {
    fill.style.width = pct + '%';
  }
  const countSpan = itemEl.querySelector('.adhkar-item-count') as HTMLElement | null;
  if (countSpan) {
    countSpan.textContent = `🔄 ${item.count} ${__('adhkar_times')} — ${__('adhkar_remaining')} ${remaining}`;
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

function handleAdhkarCounter(itemId: string, categoryId: string): void {
  // Use effective items (includes user customizations + overrides)
  const items = getCategoryItems(categoryId);
  const item = items.find((i) => i.id === itemId);
  if (!item) {
    return;
  }
  const key = `item_${item.id}`;
  const current = (state.adhkarSettings![key] as number) || 0;
  // Create new object to trigger Proxy notification
  const newSettings = cloneAdhkarSettings(state.adhkarSettings);
  if (current >= item.count) {
    // FIX #6: User tapped after completing the count — restart with confirmation toast
    newSettings[key] = 0;
    state.adhkarSettings = newSettings;
    saveAdhkarSettings();
    updateAdhkarItemDOM(itemId, categoryId);
    showToast(__('adhkar_repeat_complete'), 'success');
    return;
  }
  const next = current + 1;
  newSettings[key] = next;
  state.adhkarSettings = newSettings;
  saveAdhkarSettings();
  updateAdhkarItemDOM(itemId, categoryId);
  // When user just completed the count, show a confirmation toast
  if (next === item.count) {
    showToast(__('adhkar_completed'), 'success');
  }
}

function resetAdhkarCounters(categoryId: string): void {
  // Use effective items (includes user customizations + overrides)
  const items = getCategoryItems(categoryId);
  if (items.length === 0) {
    return;
  }
  // Create new object to trigger Proxy notification
  const newSettings = cloneAdhkarSettings(state.adhkarSettings);
  for (const item of items) {
    newSettings[`item_${item.id}`] = 0;
  }
  // Update state FIRST so updateAdhkarItemDOM reads the reset values
  state.adhkarSettings = newSettings;
  for (const item of items) {
    updateAdhkarItemDOM(item.id, categoryId);
  }
  saveAdhkarSettings();
  showToast(__('adhkar_reset'), 'success');
}

/* ===== Personal Adhkar ===== */

function renderPersonalAdhkar(): void {
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
        <div class="adhkar-progress-bar"><div class="adhkar-progress-fill" style="width:${pct}%"></div></div>
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

function closeAdhkarAddDialog(): void {
  if (dom.adhkarAddOverlay) {
    dom.adhkarAddOverlay.classList.add('hidden');
    dom.adhkarAddOverlay.style.display = 'none';
  }
}

function savePersonalAdhkar(): void {
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

function deletePersonalAdhkar(id: string): void {
  // Custom confirmation modal instead of browser confirm()
  const existing = document.getElementById('adhkarDeleteModal');
  if (existing) {
    existing.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'adhkarDeleteModal';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';

  const modal = document.createElement('div');
  modal.style.cssText =
    'background:var(--bg-primary,#fff);border-radius:16px;padding:24px;min-width:280px;max-width:90vw;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.3);';

  const msg = document.createElement('p');
  msg.style.cssText = 'margin:0 0 20px;color:var(--text-secondary,#666);font-size:14px;';
  msg.textContent = __('adhkar_confirm_delete');

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:center;';

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = __('delete');
  confirmBtn.style.cssText =
    'flex:1;padding:10px 20px;border:none;border-radius:8px;background:#e74c3c;color:#fff;font-size:14px;cursor:pointer;font-family:inherit;';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = __('close');
  cancelBtn.style.cssText =
    'flex:1;padding:10px 20px;border:none;border-radius:8px;background:var(--border-soft,#eee);color:var(--text-primary);font-size:14px;cursor:pointer;font-family:inherit;';

  function close(): void {
    overlay.remove();
  }

  confirmBtn.addEventListener('click', () => {
    const settings = state.adhkarSettings!;
    settings.personal_adhkar = (settings.personal_adhkar || []).filter((x: PersonalAdhkarEntry) => x.id !== id);
    const newSettings = cloneAdhkarSettings(state.adhkarSettings);
    delete newSettings[`item_personal_${id}`];
    state.adhkarSettings = newSettings;
    saveAdhkarSettings();
    renderPersonalAdhkar();
    showToast(__('adhkar_deleted'), '');
    close();
  });

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e: MouseEvent) => {
    if (e.target === overlay) {
      close();
    }
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);
  modal.appendChild(msg);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  cancelBtn.focus();
}

/* ===== Settings list in settings panel ===== */

/** Render adhkar toggle/time/duration rows inside the settings panel. */
export function renderAdhkarSettingsList(): void {
  if (!dom.adhkarSettingsList) {
    return;
  }
  const settings = state.adhkarSettings!;
  let html = '';
  for (const cat of ADHKAR_DATA.categories) {
    const s = (settings[cat.id] as Partial<AdhkarCategorySettings>) || {};
    const time = typeof s.time === 'string' ? s.time : '';
    const duration =
      typeof s.duration === 'number' && Number.isFinite(s.duration) ? s.duration : (cat.defaultDuration ?? 1);
    html += `<div class="adhkar-setting-row">
      <div class="adhkar-setting-header">
        <span class="adhkar-setting-label">${cat.icon} ${cat.name}</span>
        <div class="adhkar-setting-toggle">
          <div class="toggle-switch${s.enabled ? ' on' : ''}" data-adhkar-toggle="${cat.id}" role="switch"></div>
        </div>
      </div>
      <div class="adhkar-setting-time">
        ⏰ <input type="time" data-adhkar-time="${cat.id}" value="${escapeHtml(time)}">
        <span>🔔</span>
        <input type="number" data-adhkar-duration="${cat.id}" value="${duration}" min="1" max="60" class="adhkar-setting-duration-input"> ${__('minutes')}
      </div>
    </div>`;
  }
  dom.adhkarSettingsList.innerHTML = html;

  dom.adhkarSettingsList.querySelectorAll('[data-adhkar-toggle]').forEach((el: Element) => {
    const htmlEl = el as HTMLElement;
    htmlEl.addEventListener('click', () => {
      const catId = htmlEl.dataset['adhkarToggle'] as string;
      const on = htmlEl.classList.toggle('on');
      const newSettings = cloneAdhkarSettings(state.adhkarSettings);
      if (!newSettings[catId]) {
        newSettings[catId] = {} as AdhkarCategorySettings;
      }
      (newSettings[catId] as Partial<AdhkarCategorySettings>).enabled = on;
      state.adhkarSettings = newSettings;
      saveAdhkarSettings();
    });
  });
  dom.adhkarSettingsList.querySelectorAll('[data-adhkar-time]').forEach((el: Element) => {
    const htmlEl = el as HTMLInputElement;
    htmlEl.addEventListener('change', () => {
      const catId = htmlEl.dataset['adhkarTime'] as string;
      const newSettings = cloneAdhkarSettings(state.adhkarSettings);
      if (!newSettings[catId]) {
        newSettings[catId] = {} as AdhkarCategorySettings;
      }
      (newSettings[catId] as Partial<AdhkarCategorySettings>).time = htmlEl.value;
      state.adhkarSettings = newSettings;
      saveAdhkarSettings();
    });
  });
  dom.adhkarSettingsList.querySelectorAll('[data-adhkar-duration]').forEach((el: Element) => {
    const htmlEl = el as HTMLInputElement;
    htmlEl.addEventListener('change', () => {
      const catId = htmlEl.dataset['adhkarDuration'] as string;
      const newSettings = cloneAdhkarSettings(state.adhkarSettings);
      if (!newSettings[catId]) {
        newSettings[catId] = {} as AdhkarCategorySettings;
      }
      (newSettings[catId] as Partial<AdhkarCategorySettings>).duration = parseInt(htmlEl.value, 10) || 1;
      state.adhkarSettings = newSettings;
      saveAdhkarSettings();
    });
  });
}

/* ===================== ITEM CUSTOMIZATION DIALOGS ===================== */

/**
 * Generic dialog for adding/editing an adhkar item.
 * Used by both "add new" and "edit existing" flows.
 */
function openItemDialog(opts: {
  categoryId: string;
  itemId?: string;
  initialText?: string;
  initialCount?: number;
  initialReference?: string;
  title: string;
  onSave: (text: string, count: number, reference: string) => void;
}): void {
  // Remove any existing dialog
  document.getElementById('adhkarItemDialog')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'adhkarItemDialog';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;' +
    'background:rgba(0,0,0,0.5);padding:16px;';

  const modal = document.createElement('div');
  modal.style.cssText =
    'background:var(--bg-primary,#fff);border-radius:16px;padding:24px;min-width:320px;' +
    'max-width:90vw;max-height:90vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.3);' +
    'direction:rtl;';

  const titleEl = document.createElement('h3');
  titleEl.textContent = opts.title;
  titleEl.style.cssText =
    'margin:0 0 20px;color:var(--text-primary,#000);font-size:18px;font-weight:bold;text-align:center;';

  const textLabel = document.createElement('label');
  textLabel.textContent = __('adhkar_enter_text');
  textLabel.style.cssText = 'display:block;margin-bottom:6px;color:var(--text-secondary,#666);font-size:13px;';

  const textInput = document.createElement('textarea');
  textInput.rows = 4;
  textInput.value = opts.initialText || '';
  textInput.style.cssText =
    'width:100%;margin-bottom:16px;padding:10px;border:2px solid var(--border-soft,#ddd);' +
    'border-radius:8px;font-family:inherit;font-size:14px;resize:vertical;box-sizing:border-box;';

  const countLabel = document.createElement('label');
  countLabel.textContent = __('adhkar_count_label');
  countLabel.style.cssText = 'display:block;margin-bottom:6px;color:var(--text-secondary,#666);font-size:13px;';

  const countInput = document.createElement('input');
  countInput.type = 'number';
  countInput.min = '1';
  countInput.max = '999';
  countInput.value = String(opts.initialCount || 1);
  countInput.style.cssText =
    'width:100%;margin-bottom:16px;padding:10px;border:2px solid var(--border-soft,#ddd);' +
    'border-radius:8px;font-family:inherit;font-size:14px;box-sizing:border-box;';

  const refLabel = document.createElement('label');
  refLabel.textContent = __('adhkar_reference_label');
  refLabel.style.cssText = 'display:block;margin-bottom:6px;color:var(--text-secondary,#666);font-size:13px;';

  const refInput = document.createElement('input');
  refInput.type = 'text';
  refInput.value = opts.initialReference || '';
  refInput.style.cssText =
    'width:100%;margin-bottom:20px;padding:10px;border:2px solid var(--border-soft,#ddd);' +
    'border-radius:8px;font-family:inherit;font-size:14px;box-sizing:border-box;';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:center;';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = __('save');
  saveBtn.style.cssText =
    'flex:1;padding:10px 20px;border:none;border-radius:8px;background:var(--accent,#d97706);' +
    'color:#fff;font-size:14px;font-weight:bold;cursor:pointer;font-family:inherit;';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = __('close');
  cancelBtn.style.cssText =
    'flex:1;padding:10px 20px;border:none;border-radius:8px;background:var(--border-soft,#eee);' +
    'color:var(--text-primary,#000);font-size:14px;cursor:pointer;font-family:inherit;';

  function close(): void {
    overlay.remove();
  }

  saveBtn.addEventListener('click', () => {
    const text = textInput.value.trim();
    const count = parseInt(countInput.value, 10) || 1;
    const reference = refInput.value.trim();
    if (!text) {
      showToast(__('adhkar_enter_text'), 'error');
      return;
    }
    opts.onSave(text, count, reference);
    close();
  });

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e: MouseEvent) => {
    if (e.target === overlay) {
      close();
    }
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);
  modal.appendChild(titleEl);
  modal.appendChild(textLabel);
  modal.appendChild(textInput);
  modal.appendChild(countLabel);
  modal.appendChild(countInput);
  modal.appendChild(refLabel);
  modal.appendChild(refInput);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  textInput.focus();
}

/** Open the dialog to add a new item to a category. */
function openAddItemDialog(categoryId: string): void {
  openItemDialog({
    categoryId,
    title: __('adhkar_add_item'),
    onSave: (text, count, reference) => {
      const newItem = addCustomAdhkarItem(categoryId, text, count, reference);
      if (newItem) {
        // Initialize counter for new item
        const newSettings = cloneAdhkarSettings(state.adhkarSettings);
        newSettings[`item_${newItem.id}`] = 0;
        state.adhkarSettings = newSettings;
        saveAdhkarSettings();
        renderAdhkarCategory(categoryId);
        showToast(__('adhkar_saved'), 'success');
      } else {
        showToast(__('adhkar_enter_text'), 'error');
      }
    },
  });
}

/** Open the dialog to edit an existing item. */
function openEditItemDialog(itemId: string, categoryId: string): void {
  const items = getCategoryItems(categoryId);
  const item = items.find((i) => i.id === itemId);
  if (!item) {
    return;
  }
  openItemDialog({
    categoryId,
    itemId,
    title: __('adhkar_edit_item'),
    initialText: item.text,
    initialCount: item.count,
    initialReference: item.reference,
    onSave: (text, count, reference) => {
      editAdhkarItem(itemId, categoryId, { text, count, reference });
      renderAdhkarCategory(categoryId);
      showToast(__('adhkar_edited'), 'success');
    },
  });
}

/** Copy an adhkar item's text to clipboard. */
function copyAdhkarItemText(itemId: string, categoryId: string): void {
  const items = getCategoryItems(categoryId);
  const item = items.find((i) => i.id === itemId);
  if (!item) {
    return;
  }
  try {
    navigator.clipboard?.writeText(item.text).then(
      () => showToast(__('copied'), 'success'),
      () => {
        // Fallback: use execCommand
        const ta = document.createElement('textarea');
        ta.value = item.text;
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          showToast(__('copied'), 'success');
        } catch {
          showToast(__('copy_error'), 'error');
        }
        ta.remove();
      },
    );
  } catch {
    showToast(__('copy_error'), 'error');
  }
}

/** Confirm deletion of an item with a custom modal (no browser confirm()). */
function confirmDeleteItem(itemId: string, categoryId: string): void {
  document.getElementById('adhkarDeleteItemModal')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'adhkarDeleteItemModal';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;' +
    'background:rgba(0,0,0,0.5);';

  const modal = document.createElement('div');
  modal.style.cssText =
    'background:var(--bg-primary,#fff);border-radius:16px;padding:24px;min-width:280px;' +
    'max-width:90vw;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.3);direction:rtl;';

  const msg = document.createElement('p');
  msg.textContent = __('adhkar_confirm_delete_item');
  msg.style.cssText = 'margin:0 0 20px;color:var(--text-secondary,#666);font-size:14px;';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:center;';

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = __('delete');
  confirmBtn.style.cssText =
    'flex:1;padding:10px 20px;border:none;border-radius:8px;background:#e74c3c;color:#fff;' +
    'font-size:14px;font-weight:bold;cursor:pointer;font-family:inherit;';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = __('close');
  cancelBtn.style.cssText =
    'flex:1;padding:10px 20px;border:none;border-radius:8px;background:var(--border-soft,#eee);' +
    'color:var(--text-primary,#000);font-size:14px;cursor:pointer;font-family:inherit;';

  function close(): void {
    overlay.remove();
  }

  confirmBtn.addEventListener('click', () => {
    deleteAdhkarItem(itemId, categoryId);
    renderAdhkarCategory(categoryId);
    showToast(__('adhkar_deleted'), '');
    close();
  });

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e: MouseEvent) => {
    if (e.target === overlay) {
      close();
    }
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);
  modal.appendChild(msg);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  cancelBtn.focus();
}

/** Confirm reset of all customizations for a category. */
function confirmResetCustomizations(categoryId: string): void {
  document.getElementById('adhkarResetModal')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'adhkarResetModal';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;' +
    'background:rgba(0,0,0,0.5);';

  const modal = document.createElement('div');
  modal.style.cssText =
    'background:var(--bg-primary,#fff);border-radius:16px;padding:24px;min-width:320px;' +
    'max-width:90vw;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.3);direction:rtl;';

  const title = document.createElement('h3');
  title.textContent = __('adhkar_reset_defaults');
  title.style.cssText = 'margin:0 0 12px;color:var(--text-primary,#000);font-size:16px;';

  const msg = document.createElement('p');
  msg.textContent = __('adhkar_reset_defaults_desc');
  msg.style.cssText = 'margin:0 0 20px;color:var(--text-secondary,#666);font-size:14px;';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:center;';

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = __('adhkar_reset_defaults');
  confirmBtn.style.cssText =
    'flex:1;padding:10px 20px;border:none;border-radius:8px;background:var(--accent,#d97706);' +
    'color:#fff;font-size:14px;font-weight:bold;cursor:pointer;font-family:inherit;';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = __('close');
  cancelBtn.style.cssText =
    'flex:1;padding:10px 20px;border:none;border-radius:8px;background:var(--border-soft,#eee);' +
    'color:var(--text-primary,#000);font-size:14px;cursor:pointer;font-family:inherit;';

  function close(): void {
    overlay.remove();
  }

  confirmBtn.addEventListener('click', () => {
    // Reset all customizations (affects all categories, but that's the user's choice)
    resetAdhkarCustomizations();
    renderAdhkarCategory(categoryId);
    showToast(__('adhkar_reset'), 'success');
    close();
  });

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e: MouseEvent) => {
    if (e.target === overlay) {
      close();
    }
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);
  modal.appendChild(title);
  modal.appendChild(msg);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  cancelBtn.focus();
}

/* Wire up event listeners that need access to adhkar functions */
/** Bind all adhkar-related DOM event listeners. */

export { startAdhkarNotificationScheduler, stopAdhkarNotificationScheduler, checkAdhkarNotifications };

export function wireAdhkarEvents(): void {
  dom.adhkarBtn?.addEventListener('click', toggleAdhkarPanel);
  dom.adhkarCloseBtn?.addEventListener('click', closeAdhkarPanel);
  dom.adhkarNotifOpenBtn?.addEventListener('click', () => {
    dismissAdhkarNotification();
    if (!state.adhkarPanelOpen) {
      toggleAdhkarPanel();
    }
    const catId = dom.adhkarNotification?.dataset['category'];
    if (catId) {
      switchAdhkarTab(catId);
    }
  });
  dom.adhkarNotifDismissBtn?.addEventListener('click', dismissAdhkarNotification);
  dom.adhkarAddCloseBtn?.addEventListener('click', closeAdhkarAddDialog);
  dom.adhkarAddSaveBtn?.addEventListener('click', savePersonalAdhkar);
  dom.adhkarAddOverlay?.addEventListener('click', (e: MouseEvent) => {
    if (e.target === dom.adhkarAddOverlay) {
      closeAdhkarAddDialog();
    }
  });
  dom.adhkarEnabledToggle?.addEventListener('click', async () => {
    const on = dom.adhkarEnabledToggle!.classList.toggle('on');
    // FIX #5: Request Notification permission when user enables adhkar (this is a user gesture).
    // Without this, system notifications never fire because permission is never requested.
    if (on && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try {
        const result = await Notification.requestPermission();
        if (result === 'granted') {
          showToast(__('notification_active'), 'success');
        } else if (result === 'denied') {
          showToast(__('notification_paused'), 'warning');
        }
      } catch {
        // Some browsers throw if requestPermission is called twice — ignore.
      }
    }
    const newSettings = cloneAdhkarSettings(state.adhkarSettings);
    newSettings.adhkar_enabled = on;
    state.adhkarSettings = newSettings;
    saveAdhkarSettings();
  });
  dom.adhkarSoundToggle?.addEventListener('click', () => {
    const on = dom.adhkarSoundToggle!.classList.toggle('on');
    const newSettings = cloneAdhkarSettings(state.adhkarSettings);
    newSettings.adhkar_sound = on;
    state.adhkarSettings = newSettings;
    saveAdhkarSettings();
  });
  dom.adhkarPanel?.addEventListener('click', (e: MouseEvent) => {
    if (e.target === dom.adhkarPanel) {
      closeAdhkarPanel();
    }
  });
}
