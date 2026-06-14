import { state } from './state.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { showToast } from './ui.js';
import { escapeHtml } from './utils.js';
import { ADHKAR_DATA } from './adhkar-data.js';
import { __ } from './i18n.js';
import { checkAdhkarNotifications, dismissAdhkarNotification, startAdhkarNotificationScheduler, stopAdhkarNotificationScheduler } from './adhkar-notifications.js';
import type { AdhkarSettings, AdhkarCategorySettings, PersonalAdhkarEntry } from './types.js';

/* ===================== INIT ===================== */

/** Deep-clone adhkar settings to avoid shallow copy issues with nested objects
 *  (e.g., personal_adhkar array). Uses structuredClone when available,
 *  falls back to JSON round-trip. */
function cloneAdhkarSettings(settings: AdhkarSettings | null): AdhkarSettings {
  if (!settings) return getDefaultAdhkarSettings();
  if (typeof structuredClone === 'function') return structuredClone(settings);
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
      if (saved[key] === undefined) saved[key] = defaults[key];
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
      if (key.startsWith('item_')) state.adhkarSettings![key] = 0;
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
  if (state.adhkarPanelOpen) {
    renderAdhkarTabs();
    if (!state.adhkarActiveTab) state.adhkarActiveTab = ADHKAR_DATA.categories[0].id;
    switchAdhkarTab(state.adhkarActiveTab);
  }
}

/** Close the adhkar panel. */
export function closeAdhkarPanel(): void {
  state.adhkarPanelOpen = false;
  dom.adhkarPanel?.classList.remove('open');
}

function renderAdhkarTabs(): void {
  if (!dom.adhkarTabs) return;
  let html = '';
  for (const cat of ADHKAR_DATA.categories) {
    html += `<button class="adhkar-tab${state.adhkarActiveTab === cat.id ? ' active' : ''}" data-category="${cat.id}">${cat.icon} ${cat.name}</button>`;
  }
  html += `<button class="adhkar-tab${state.adhkarActiveTab === 'personal' ? ' active' : ''}" data-category="personal">${__('adhkar_personal')}</button>`;
  dom.adhkarTabs.innerHTML = html;
  dom.adhkarTabs.querySelectorAll('.adhkar-tab').forEach((btn: Element) => {
    btn.addEventListener('click', () => switchAdhkarTab((btn as HTMLElement).dataset.category as string));
  });
}

function switchAdhkarTab(categoryId: string): void {
  state.adhkarActiveTab = categoryId;
  document
    .querySelectorAll('.adhkar-tab')
    .forEach((t: Element) => t.classList.toggle('active', (t as HTMLElement).dataset.category === categoryId));
  renderAdhkarCategory(categoryId);
}

function renderAdhkarCategory(categoryId: string): void {
  if (!dom.adhkarContent) return;
  if (categoryId === 'personal') {
    renderPersonalAdhkar();
    return;
  }
  const cat = ADHKAR_DATA.categories.find((c: { id: string }) => c.id === categoryId);
  if (!cat) return;
  const settings = state.adhkarSettings!;
  const catSettings = (settings[cat.id] as Partial<AdhkarCategorySettings>) || {};
  const enabled = !!catSettings.enabled;
  const notifTime = catSettings.time || cat.defaultTime || '';
  const notifDur = catSettings.duration ?? cat.defaultDuration ?? 1;
  let html = `<div class="adhkar-category-title">${cat.icon} ${cat.name}</div>
    <div class="adhkar-category-options">
      <label class="adhkar-cat-label">
        <div class="adhkar-cat-toggle toggle-switch${enabled ? ' on' : ''}" data-category="${cat.id}" role="switch"></div>
        ${__('adhkar_time')}
      </label>
      <label class="adhkar-cat-label--time">
        ⏰ <input type="time" class="adhkar-cat-time adhkar-cat-time-input" data-category="${cat.id}" value="${notifTime}">
      </label>
      <label class="adhkar-cat-label--time">
        🔔 <input type="number" class="adhkar-cat-duration adhkar-cat-duration-input" data-category="${cat.id}" value="${notifDur}" min="1" max="60"> ${__('minutes')}
      </label>
      <span class="adhkar-cat-status">${enabled ? __('notification_active') : __('notification_paused')}</span>
    </div>`;
  for (const item of cat.items) {
    const counter = (settings[`item_${item.id}`] as number) || 0;
    const remaining = Math.max(0, item.count - counter);
    const completed = counter >= item.count;
    const pct = Math.min(100, (counter / item.count) * 100);
    html += `<div class="adhkar-item${completed ? ' completed' : ''}" data-item-id="${item.id}" data-category="${categoryId}">
      <div class="adhkar-item-text">${item.text}</div>
      <div class="adhkar-progress-bar"><div class="adhkar-progress-fill" style="width:${pct}%"></div></div>
      <div class="adhkar-item-meta">
        <span class="adhkar-item-count">🔄 ${item.count} ${__('adhkar_times')} — ${__('adhkar_remaining')} ${remaining}</span>
        <span class="adhkar-item-reference">📚 ${item.reference}</span>
        <div class="adhkar-counter">
          <button class="adhkar-counter-btn${completed ? ' completed' : ''}" data-action="increment" data-item-id="${item.id}" data-category="${categoryId}">✓</button>
          <span class="adhkar-counter-text">${counter}</span>
        </div>
      </div>
    </div>`;
  }
  html += `<button class="adhkar-add-btn" data-action="reset" data-category="${categoryId}">${__('adhkar_reset')}</button>`;
  dom.adhkarContent.innerHTML = html;

  const contentEl = dom.adhkarContent as HTMLElement & { _delegationBound?: boolean };
  if (!contentEl._delegationBound) {
    contentEl._delegationBound = true;
    contentEl.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const actionBtn = target.closest('[data-action]') as HTMLElement | null;
      if (actionBtn) {
        const action = actionBtn.dataset.action;
        if (action === 'increment') {
          handleAdhkarCounter(actionBtn.dataset.itemId as string, actionBtn.dataset.category as string);
          return;
        }
        if (action === 'reset') {
          resetAdhkarCounters(actionBtn.dataset.category as string);
          return;
        }
      }
      const toggle = target.closest('.adhkar-cat-toggle') as HTMLElement | null;
      if (toggle) {
        const catId = toggle.dataset.category as string;
        const newSettings = cloneAdhkarSettings(state.adhkarSettings);
        if (!newSettings[catId]) newSettings[catId] = {} as AdhkarCategorySettings;
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
        const catId = (target as HTMLElement).dataset.category as string;
        const newSettings = cloneAdhkarSettings(state.adhkarSettings);
        if (!newSettings[catId]) newSettings[catId] = {} as AdhkarCategorySettings;
        (newSettings[catId] as Partial<AdhkarCategorySettings>).time = (target as HTMLInputElement).value;
        state.adhkarSettings = newSettings;
        saveAdhkarSettings();
        return;
      }
      if (target.classList.contains('adhkar-cat-duration')) {
        const catId = (target as HTMLElement).dataset.category as string;
        const newSettings = cloneAdhkarSettings(state.adhkarSettings);
        if (!newSettings[catId]) newSettings[catId] = {} as AdhkarCategorySettings;
        (newSettings[catId] as Partial<AdhkarCategorySettings>).duration = parseInt((target as HTMLInputElement).value, 10) || 1;
        state.adhkarSettings = newSettings;
        saveAdhkarSettings();
      }
    });
  }
}

function updateAdhkarItemDOM(itemId: string, categoryId: string): void {
  const itemEl = dom.adhkarContent?.querySelector(`.adhkar-item[data-item-id="${itemId}"]`) as HTMLElement | null;
  if (!itemEl) return;
  const cat = ADHKAR_DATA.categories.find((c: { id: string }) => c.id === categoryId);
  if (!cat) return;
  const item = cat.items.find((i: { id: string }) => i.id === itemId);
  if (!item) return;
  const key = `item_${item.id}`;
  const settings = state.adhkarSettings!;
  const counter = (settings[key] as number) || 0;
  const remaining = Math.max(0, item.count - counter);
  const completed = counter >= item.count;
  const pct = Math.min(100, (counter / item.count) * 100);
  itemEl.classList.toggle('completed', completed);
  const fill = itemEl.querySelector('.adhkar-progress-fill') as HTMLElement | null;
  if (fill) fill.style.width = pct + '%';
  const countSpan = itemEl.querySelector('.adhkar-item-count') as HTMLElement | null;
  if (countSpan)
    countSpan.textContent = `🔄 ${item.count} ${__('adhkar_times')} — ${__('adhkar_remaining')} ${remaining}`;
  const counterText = itemEl.querySelector('.adhkar-counter-text') as HTMLElement | null;
  if (counterText) counterText.textContent = String(counter);
  const counterBtn = itemEl.querySelector('.adhkar-counter-btn') as HTMLElement | null;
  if (counterBtn) counterBtn.classList.toggle('completed', completed);
}

function handleAdhkarCounter(itemId: string, categoryId: string): void {
  const cat = ADHKAR_DATA.categories.find((c: { id: string }) => c.id === categoryId);
  if (!cat) return;
  const item = cat.items.find((i: { id: string }) => i.id === itemId);
  if (!item) return;
  const key = `item_${item.id}`;
  const current = (state.adhkarSettings![key] as number) || 0;
  // Create new object to trigger Proxy notification
  const newSettings = cloneAdhkarSettings(state.adhkarSettings);
  if (current >= item.count) {
    newSettings[key] = 0;
  } else {
    newSettings[key] = current + 1;
  }
  state.adhkarSettings = newSettings;
  saveAdhkarSettings();
  updateAdhkarItemDOM(itemId, categoryId);
}

function resetAdhkarCounters(categoryId: string): void {
  const cat = ADHKAR_DATA.categories.find((c: { id: string }) => c.id === categoryId);
  if (!cat) return;
  // Create new object to trigger Proxy notification
  const newSettings = cloneAdhkarSettings(state.adhkarSettings);
  for (const item of cat.items) {
    newSettings[`item_${item.id}`] = 0;
    updateAdhkarItemDOM(item.id, categoryId);
  }
  state.adhkarSettings = newSettings;
  saveAdhkarSettings();
  showToast(__('adhkar_reset'), 'success');
}

/* ===== Personal Adhkar ===== */

function renderPersonalAdhkar(): void {
  if (!dom.adhkarContent) return;
  const settings = state.adhkarSettings!;
  const personal = settings.personal_adhkar || [];
  let html = '<div class="adhkar-category-title">' + __('adhkar_personal') + '</div>';
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
          <span class="adhkar-item-reference">${p.time ? '⏰ ' + p.time : ''}</span>
          <div class="adhkar-personal-actions">
            <button class="adhkar-personal-btn edit" data-action="edit-personal" data-id="${p.id}">✏️</button>
            <button class="adhkar-personal-btn delete" data-action="delete-personal" data-id="${p.id}">🗑️</button>
          </div>
          <div class="adhkar-counter">
            <button class="adhkar-counter-btn${completed ? ' completed' : ''}" data-action="increment-personal" data-id="${p.id}">✓</button>
            <span class="adhkar-counter-text">${counter}</span>
          </div>
        </div>
      </div>`;
    }
  }
  dom.adhkarContent.innerHTML = html;

  document.getElementById('openAddAdhkarBtn')?.addEventListener('click', openAdhkarAddDialog);
  dom.adhkarContent.querySelectorAll('[data-action="increment-personal"]').forEach((btn: Element) => {
    btn.addEventListener('click', () => {
      const currentSettings = state.adhkarSettings!;
      const personalList = currentSettings.personal_adhkar || [];
      const p = personalList.find((x: PersonalAdhkarEntry) => x.id === (btn as HTMLElement).dataset.id);
      if (!p) return;
      const key = `item_personal_${p.id}`;
      const current = (state.adhkarSettings![key] as number) || 0;
      // Create new object to trigger Proxy notification
      const newSettings = cloneAdhkarSettings(state.adhkarSettings);
      if (current >= p.count) {
        newSettings[key] = 0;
      } else {
        newSettings[key] = current + 1;
      }
      state.adhkarSettings = newSettings;
      saveAdhkarSettings();
      const itemEl = dom.adhkarContent?.querySelector(
        `.adhkar-item[data-item-id="personal_${p.id}"]`
      ) as HTMLElement | null;
      if (itemEl) {
        const newCounter = (newSettings[key] as number) || 0;
        const newRemaining = Math.max(0, p.count - newCounter);
        const newCompleted = newCounter >= p.count;
        const newPct = Math.min(100, (newCounter / p.count) * 100);
        itemEl.classList.toggle('completed', newCompleted);
        const fill = itemEl.querySelector('.adhkar-progress-fill') as HTMLElement | null;
        if (fill) fill.style.width = newPct + '%';
        const countSpan = itemEl.querySelector('.adhkar-item-count') as HTMLElement | null;
        if (countSpan)
          countSpan.textContent = `🔄 ${p.count} ${__('adhkar_times')} — ${__('adhkar_remaining')} ${newRemaining}`;
        const counterText = itemEl.querySelector('.adhkar-counter-text') as HTMLElement | null;
        if (counterText) counterText.textContent = String(newCounter);
        const counterBtn = itemEl.querySelector('.adhkar-counter-btn') as HTMLElement | null;
        if (counterBtn) counterBtn.classList.toggle('completed', newCompleted);
      }
    });
  });
  dom.adhkarContent.querySelectorAll('[data-action="edit-personal"]').forEach((btn: Element) => {
    btn.addEventListener('click', () => editPersonalAdhkar((btn as HTMLElement).dataset.id as string));
  });
  dom.adhkarContent.querySelectorAll('[data-action="delete-personal"]').forEach((btn: Element) => {
    btn.addEventListener('click', () => deletePersonalAdhkar((btn as HTMLElement).dataset.id as string));
  });
}

function openAdhkarAddDialog(): void {
  if (!dom.adhkarAddOverlay) return;
  if (dom.adhkarAddText) dom.adhkarAddText.value = '';
  if (dom.adhkarAddCount) dom.adhkarAddCount.value = '1';
  if (dom.adhkarAddTime) dom.adhkarAddTime.value = '';
  if (dom.adhkarAddDuration) dom.adhkarAddDuration.value = '1';
  dom.adhkarAddOverlay.dataset.editId = '';
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
  const editId = dom.adhkarAddOverlay?.dataset.editId || '';
  const settings = state.adhkarSettings!;
  if (!settings.personal_adhkar) settings.personal_adhkar = [];

  if (editId) {
    const p = settings.personal_adhkar.find((x: PersonalAdhkarEntry) => x.id === editId);
    if (p) {
      p.text = text;
      p.count = count;
      p.time = time;
      p.duration = duration;
    }
  } else {
    const newItem: PersonalAdhkarEntry = { id: 'pa_' + Date.now(), text, count, time, duration };
    settings.personal_adhkar.push(newItem);
  }
  saveAdhkarSettings();
  closeAdhkarAddDialog();
  renderPersonalAdhkar();
  showToast(editId ? __('adhkar_edited') : __('adhkar_saved'), 'success');
}

function editPersonalAdhkar(id: string): void {
  const settings = state.adhkarSettings!;
  const p = settings.personal_adhkar?.find((x: PersonalAdhkarEntry) => x.id === id);
  if (!p) return;
  if (!dom.adhkarAddOverlay) return;
  dom.adhkarAddOverlay.classList.remove('hidden');
  dom.adhkarAddOverlay.style.display = 'flex';
  dom.adhkarAddOverlay.dataset.editId = id;
  if (dom.adhkarAddText) dom.adhkarAddText.value = p.text;
  if (dom.adhkarAddCount) dom.adhkarAddCount.value = String(p.count);
  if (dom.adhkarAddTime) dom.adhkarAddTime.value = p.time || '';
  if (dom.adhkarAddDuration) dom.adhkarAddDuration.value = String(p.duration || 1);
}

function deletePersonalAdhkar(id: string): void {
  // Custom confirmation modal instead of browser confirm()
  const existing = document.getElementById('adhkarDeleteModal');
  if (existing) existing.remove();

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
    if (e.target === overlay) close();
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
  if (!dom.adhkarSettingsList) return;
  const settings = state.adhkarSettings!;
  let html = '';
  for (const cat of ADHKAR_DATA.categories) {
    const s = (settings[cat.id] as Partial<AdhkarCategorySettings>) || {};
    html += `<div class="adhkar-setting-row">
      <div class="adhkar-setting-header">
        <span class="adhkar-setting-label">${cat.icon} ${cat.name}</span>
        <div class="adhkar-setting-toggle">
          <div class="toggle-switch${s.enabled ? ' on' : ''}" data-adhkar-toggle="${cat.id}" role="switch"></div>
        </div>
      </div>
      <div class="adhkar-setting-time">
        ⏰ <input type="time" data-adhkar-time="${cat.id}" value="${s.time || ''}">
        <span>🔔</span>
        <input type="number" data-adhkar-duration="${cat.id}" value="${s.duration ?? cat.defaultDuration ?? 1}" min="1" max="60" class="adhkar-setting-duration-input"> ${__('minutes')}
      </div>
    </div>`;
  }
  dom.adhkarSettingsList.innerHTML = html;

  dom.adhkarSettingsList.querySelectorAll('[data-adhkar-toggle]').forEach((el: Element) => {
    const htmlEl = el as HTMLElement;
    htmlEl.addEventListener('click', () => {
      const catId = htmlEl.dataset.adhkarToggle as string;
      const on = htmlEl.classList.toggle('on');
      const newSettings = cloneAdhkarSettings(state.adhkarSettings);
      if (!newSettings[catId]) newSettings[catId] = {} as AdhkarCategorySettings;
      (newSettings[catId] as Partial<AdhkarCategorySettings>).enabled = on;
      state.adhkarSettings = newSettings;
      saveAdhkarSettings();
    });
  });
  dom.adhkarSettingsList.querySelectorAll('[data-adhkar-time]').forEach((el: Element) => {
    const htmlEl = el as HTMLInputElement;
    htmlEl.addEventListener('change', () => {
      const catId = htmlEl.dataset.adhkarTime as string;
      const newSettings = cloneAdhkarSettings(state.adhkarSettings);
      if (!newSettings[catId]) newSettings[catId] = {} as AdhkarCategorySettings;
      (newSettings[catId] as Partial<AdhkarCategorySettings>).time = htmlEl.value;
      state.adhkarSettings = newSettings;
      saveAdhkarSettings();
    });
  });
  dom.adhkarSettingsList.querySelectorAll('[data-adhkar-duration]').forEach((el: Element) => {
    const htmlEl = el as HTMLInputElement;
    htmlEl.addEventListener('change', () => {
      const catId = htmlEl.dataset.adhkarDuration as string;
      const newSettings = cloneAdhkarSettings(state.adhkarSettings);
      if (!newSettings[catId]) newSettings[catId] = {} as AdhkarCategorySettings;
      (newSettings[catId] as Partial<AdhkarCategorySettings>).duration = parseInt(htmlEl.value, 10) || 1;
      state.adhkarSettings = newSettings;
      saveAdhkarSettings();
    });
  });
}

/* Wire up event listeners that need access to adhkar functions */
/** Bind all adhkar-related DOM event listeners. */

export { startAdhkarNotificationScheduler, stopAdhkarNotificationScheduler, checkAdhkarNotifications };

export function wireAdhkarEvents(): void {
  dom.adhkarBtn?.addEventListener('click', toggleAdhkarPanel);
  dom.adhkarCloseBtn?.addEventListener('click', closeAdhkarPanel);
  dom.adhkarNotifOpenBtn?.addEventListener('click', () => {
    dismissAdhkarNotification();
    if (!state.adhkarPanelOpen) toggleAdhkarPanel();
    const catId = dom.adhkarNotification?.dataset.category;
    if (catId) switchAdhkarTab(catId);
  });
  dom.adhkarNotifDismissBtn?.addEventListener('click', dismissAdhkarNotification);
  dom.adhkarAddCloseBtn?.addEventListener('click', closeAdhkarAddDialog);
  dom.adhkarAddSaveBtn?.addEventListener('click', savePersonalAdhkar);
  dom.adhkarAddOverlay?.addEventListener('click', (e: MouseEvent) => {
    if (e.target === dom.adhkarAddOverlay) closeAdhkarAddDialog();
  });
  dom.adhkarEnabledToggle?.addEventListener('click', () => {
    const on = dom.adhkarEnabledToggle!.classList.toggle('on');
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
    if (e.target === dom.adhkarPanel) closeAdhkarPanel();
  });
}
