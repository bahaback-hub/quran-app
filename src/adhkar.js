import { copyToClipboard } from './share.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { showToast } from './ui.js';
import { escapeHtml } from './utils.js';
import { ADHKAR_DATA } from './adhkar-data.js';

export function initAdhkarState(s) {
  state = s;
}

function getDefaultAdhkarSettings() {
  const settings = { adhkar_enabled: true, adhkar_sound: true, _resetDate: new Date().toDateString() };
  for (const cat of ADHKAR_DATA.categories) {
    settings[cat.id] = { enabled: true, time: cat.defaultTime || '', duration: cat.defaultDuration ?? 1 };
    for (const item of cat.items) {
      settings[`item_${item.id}`] = 0;
    }
  }
  settings.personal_adhkar = [];
  return settings;
}

/* ===================== LOAD / SAVE ===================== */

export function loadAdhkarSettings() {
  const saved = storage.get('adhkar_settings');
  const defaults = getDefaultAdhkarSettings();
  if (saved) {
    for (const key of Object.keys(defaults)) {
      if (saved[key] === undefined) saved[key] = defaults[key];
    }
    state.adhkarSettings = saved;
  } else {
    state.adhkarSettings = defaults;
  }
  const today = new Date().toDateString();
  if (state.adhkarSettings._resetDate !== today) {
    for (const key of Object.keys(state.adhkarSettings)) {
      if (key.startsWith('item_')) state.adhkarSettings[key] = 0;
    }
    state.adhkarSettings._resetDate = today;
    saveAdhkarSettings();
  }
}

function saveAdhkarSettings() {
  storage.set('adhkar_settings', state.adhkarSettings);
}

/* ===================== PANEL ===================== */

export function toggleAdhkarPanel() {
  state.adhkarPanelOpen = !state.adhkarPanelOpen;
  dom.adhkarPanel?.classList.toggle('open', state.adhkarPanelOpen);
  if (state.adhkarPanelOpen) {
    renderAdhkarTabs();
    if (!state.adhkarActiveTab) state.adhkarActiveTab = ADHKAR_DATA.categories[0].id;
    switchAdhkarTab(state.adhkarActiveTab);
  }
}

export function closeAdhkarPanel() {
  state.adhkarPanelOpen = false;
  dom.adhkarPanel?.classList.remove('open');
}

function renderAdhkarTabs() {
  if (!dom.adhkarTabs) return;
  let html = '';
  for (const cat of ADHKAR_DATA.categories) {
    html += `<button class="adhkar-tab${state.adhkarActiveTab === cat.id ? ' active' : ''}" data-category="${cat.id}">${cat.icon} ${cat.name}</button>`;
  }
  html += `<button class="adhkar-tab${state.adhkarActiveTab === 'personal' ? ' active' : ''}" data-category="personal">📝 أذكاري</button>`;
  dom.adhkarTabs.innerHTML = html;
  dom.adhkarTabs.querySelectorAll('.adhkar-tab').forEach(btn => {
    btn.addEventListener('click', () => switchAdhkarTab(btn.dataset.category));
  });
}

function switchAdhkarTab(categoryId) {
  state.adhkarActiveTab = categoryId;
  document.querySelectorAll('.adhkar-tab').forEach(t => t.classList.toggle('active', t.dataset.category === categoryId));
  renderAdhkarCategory(categoryId);
}

function renderAdhkarCategory(categoryId) {
  if (!dom.adhkarContent) return;
  if (categoryId === 'personal') {
    renderPersonalAdhkar();
    return;
  }
  const cat = ADHKAR_DATA.categories.find(c => c.id === categoryId);
  if (!cat) return;
  const settings = state.adhkarSettings;
  const catSettings = settings[cat.id] || {};
  const enabled = !!catSettings.enabled;
  const notifTime = catSettings.time || cat.defaultTime || '';
  const notifDur = catSettings.duration ?? cat.defaultDuration ?? 1;
  let html = `<div class="adhkar-category-title">${cat.icon} ${cat.name}</div>
    <div class="adhkar-category-options" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px;padding:8px 12px;background:var(--controls-bg);border-radius:8px;">
      <label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;">
        <div class="adhkar-cat-toggle toggle-switch${enabled ? ' on' : ''}" data-category="${cat.id}" role="switch" style="transform:scale(0.85);"></div>
        تذكير
      </label>
      <label style="display:flex;align-items:center;gap:4px;font-size:13px;">
        ⏰ <input type="time" class="adhkar-cat-time" data-category="${cat.id}" value="${notifTime}" style="border:1px solid var(--border-soft);border-radius:6px;padding:2px 6px;font-size:12px;font-family:inherit;background:var(--select-bg);color:var(--text-primary);width:80px;">
      </label>
      <label style="display:flex;align-items:center;gap:4px;font-size:13px;">
        🔔 <input type="number" class="adhkar-cat-duration" data-category="${cat.id}" value="${notifDur}" min="1" max="60" style="border:1px solid var(--border-soft);border-radius:6px;padding:2px 6px;font-size:12px;font-family:inherit;background:var(--select-bg);color:var(--text-primary);width:50px;"> دقيقة
      </label>
      <span style="font-size:11px;color:var(--text-muted);">${enabled ? '✅ التنبيه مفعّل' : '⏸ التنبيه متوقف'}</span>
    </div>`;
  for (const item of cat.items) {
    const counter = settings[`item_${item.id}`] || 0;
    const remaining = Math.max(0, item.count - counter);
    const completed = counter >= item.count;
    const pct = Math.min(100, (counter / item.count) * 100);
    html += `<div class="adhkar-item${completed ? ' completed' : ''}" data-item-id="${item.id}" data-category="${categoryId}">
      <div class="adhkar-item-text">${item.text}</div>
      <div class="adhkar-progress-bar"><div class="adhkar-progress-fill" style="width:${pct}%"></div></div>
      <div class="adhkar-item-meta">
        <span class="adhkar-item-count">🔄 ${item.count} مرة — متبقي ${remaining}</span>
        <span class="adhkar-item-reference">📚 ${item.reference}</span>
        <div class="adhkar-counter">
          <button class="adhkar-counter-btn${completed ? ' completed' : ''}" data-action="increment" data-item-id="${item.id}" data-category="${categoryId}">✓</button>
          <span class="adhkar-counter-text">${counter}</span>
        </div>
      </div>
    </div>`;
  }
  html += `<button class="adhkar-add-btn" data-action="reset" data-category="${categoryId}">🔄 إعادة تعيين الكل</button>`;
  dom.adhkarContent.innerHTML = html;

  dom.adhkarContent.querySelectorAll('[data-action="increment"]').forEach(btn => {
    btn.addEventListener('click', () => handleAdhkarCounter(btn.dataset.itemId, btn.dataset.category));
  });
  dom.adhkarContent.querySelectorAll('[data-action="reset"]').forEach(btn => {
    btn.addEventListener('click', () => resetAdhkarCounters(btn.dataset.category));
  });

  dom.adhkarContent.querySelectorAll('.adhkar-cat-toggle').forEach(el => {
    el.addEventListener('click', () => {
      const catId = el.dataset.category;
      if (!state.adhkarSettings[catId]) state.adhkarSettings[catId] = {};
      state.adhkarSettings[catId].enabled = el.classList.toggle('on');
      saveAdhkarSettings();
      renderAdhkarCategory(catId);
    });
  });
  dom.adhkarContent.querySelectorAll('.adhkar-cat-time').forEach(el => {
    el.addEventListener('change', () => {
      const catId = el.dataset.category;
      if (!state.adhkarSettings[catId]) state.adhkarSettings[catId] = {};
      state.adhkarSettings[catId].time = el.value;
      saveAdhkarSettings();
    });
  });
  dom.adhkarContent.querySelectorAll('.adhkar-cat-duration').forEach(el => {
    el.addEventListener('change', () => {
      const catId = el.dataset.category;
      if (!state.adhkarSettings[catId]) state.adhkarSettings[catId] = {};
      state.adhkarSettings[catId].duration = parseInt(el.value, 10) || 1;
      saveAdhkarSettings();
    });
  });
}

function handleAdhkarCounter(itemId, categoryId) {
  const cat = ADHKAR_DATA.categories.find(c => c.id === categoryId);
  if (!cat) return;
  const item = cat.items.find(i => i.id === itemId);
  if (!item) return;
  const key = `item_${item.id}`;
  const current = state.adhkarSettings[key] || 0;
  if (current >= item.count) {
    state.adhkarSettings[key] = 0;
  } else {
    state.adhkarSettings[key] = current + 1;
  }
  saveAdhkarSettings();
  renderAdhkarCategory(categoryId);
}

function resetAdhkarCounters(categoryId) {
  const cat = ADHKAR_DATA.categories.find(c => c.id === categoryId);
  if (!cat) return;
  for (const item of cat.items) {
    state.adhkarSettings[`item_${item.id}`] = 0;
  }
  saveAdhkarSettings();
  renderAdhkarCategory(categoryId);
  showToast('🔄 تم إعادة تعيين الأذكار', 'success');
}

/* ===== Personal Adhkar ===== */

function renderPersonalAdhkar() {
  if (!dom.adhkarContent) return;
  const personal = state.adhkarSettings.personal_adhkar || [];
  let html = '<div class="adhkar-category-title">📝 أذكاري</div>';
  html += '<button class="adhkar-add-btn" id="openAddAdhkarBtn">➕ إضافة ذكر جديد</button>';
  if (!personal.length) {
    html += '<p style="text-align:center;color:#888;padding:20px;">📝 لم تضف أي ذكر شخصي بعد</p>';
  } else {
    for (const p of personal) {
      const counter = state.adhkarSettings[`item_personal_${p.id}`] || 0;
      const remaining = Math.max(0, p.count - counter);
      const completed = counter >= p.count;
      const pct = Math.min(100, (counter / p.count) * 100);
      html += `<div class="adhkar-item${completed ? ' completed' : ''}" data-item-id="personal_${p.id}">
        <div class="adhkar-item-text">${escapeHtml(p.text)}</div>
        <div class="adhkar-progress-bar"><div class="adhkar-progress-fill" style="width:${pct}%"></div></div>
        <div class="adhkar-item-meta">
          <span class="adhkar-item-count">🔄 ${p.count} مرة — متبقي ${remaining}</span>
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
  dom.adhkarContent.querySelectorAll('[data-action="increment-personal"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const personal = state.adhkarSettings.personal_adhkar || [];
      const p = personal.find(x => x.id === btn.dataset.id);
      if (!p) return;
      const key = `item_personal_${p.id}`;
      const current = state.adhkarSettings[key] || 0;
      if (current >= p.count) {
        state.adhkarSettings[key] = 0;
      } else {
        state.adhkarSettings[key] = current + 1;
      }
      saveAdhkarSettings();
      renderPersonalAdhkar();
    });
  });
  dom.adhkarContent.querySelectorAll('[data-action="edit-personal"]').forEach(btn => {
    btn.addEventListener('click', () => editPersonalAdhkar(btn.dataset.id));
  });
  dom.adhkarContent.querySelectorAll('[data-action="delete-personal"]').forEach(btn => {
    btn.addEventListener('click', () => deletePersonalAdhkar(btn.dataset.id));
  });
}

function openAdhkarAddDialog() {
  if (!dom.adhkarAddOverlay) return;
  dom.adhkarAddText.value = '';
  dom.adhkarAddCount.value = 1;
  dom.adhkarAddTime.value = '';
  dom.adhkarAddDuration.value = 1;
  dom.adhkarAddOverlay.dataset.editId = '';
  dom.adhkarAddOverlay.style.display = 'flex';
}

function closeAdhkarAddDialog() {
  if (dom.adhkarAddOverlay) dom.adhkarAddOverlay.style.display = 'none';
}

function savePersonalAdhkar() {
  const text = dom.adhkarAddText?.value.trim();
  if (!text) { showToast('📝 أدخل نص الذكر', 'error'); return; }
  const count = parseInt(dom.adhkarAddCount?.value, 10) || 1;
  const time = dom.adhkarAddTime?.value || null;
  const duration = parseInt(dom.adhkarAddDuration?.value, 10) || 1;
  const editId = dom.adhkarAddOverlay?.dataset.editId || '';
  if (!state.adhkarSettings.personal_adhkar) state.adhkarSettings.personal_adhkar = [];

  if (editId) {
    const p = state.adhkarSettings.personal_adhkar.find(x => x.id === editId);
    if (p) {
      p.text = text;
      p.count = count;
      p.time = time;
      p.duration = duration;
    }
  } else {
    const newItem = { id: 'pa_' + Date.now(), text, count, time, duration };
    state.adhkarSettings.personal_adhkar.push(newItem);
  }
  saveAdhkarSettings();
  closeAdhkarAddDialog();
  renderPersonalAdhkar();
  showToast(editId ? '✏️ تم تعديل الذكر' : '✅ تم إضافة الذكر', 'success');
}

function editPersonalAdhkar(id) {
  const p = state.adhkarSettings.personal_adhkar?.find(x => x.id === id);
  if (!p) return;
  if (!dom.adhkarAddOverlay) return;
  dom.adhkarAddOverlay.style.display = 'flex';
  dom.adhkarAddOverlay.dataset.editId = id;
  dom.adhkarAddText.value = p.text;
  dom.adhkarAddCount.value = p.count;
  dom.adhkarAddTime.value = p.time || '';
  dom.adhkarAddDuration.value = p.duration || 1;
}

function deletePersonalAdhkar(id) {
  if (!confirm('🗑️ هل تريد حذف هذا الذكر؟')) return;
  state.adhkarSettings.personal_adhkar = (state.adhkarSettings.personal_adhkar || []).filter(x => x.id !== id);
  delete state.adhkarSettings[`item_personal_${id}`];
  saveAdhkarSettings();
  renderPersonalAdhkar();
  showToast('🗑️ تم حذف الذكر', '');
}

/* ===== Notifications ===== */

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.4);
    });
  } catch (e) {}
}

function showAdhkarNotification(cat, notifDuration) {
  if (!dom.adhkarNotification) return;
  dom.adhkarNotifIcon.textContent = cat.icon || '🕌';
  dom.adhkarNotifTitle.textContent = `🕌 ${cat.name}`;
  dom.adhkarNotification.dataset.category = cat.id || 'personal';
  dom.adhkarNotification.style.display = 'flex';

  if (state.adhkarSettings.adhkar_sound) playNotificationSound();

  const duration = (notifDuration || cat.duration || 1) * 60 * 1000;
  if (state.adhkarNotificationTimer) clearTimeout(state.adhkarNotificationTimer);
  state.adhkarNotificationTimer = setTimeout(() => {
    dom.adhkarNotification.style.display = 'none';
  }, duration);

  renderNotifAdhkarText(cat);
}

function renderNotifAdhkarText(cat) {
  if (!dom.adhkarNotifText) return;

  if (cat.id === 'personal') {
    dom.adhkarNotifText.textContent = cat.name || '';
    dom.adhkarNotifProgress.textContent = '';
    if (dom.adhkarNotifShareBtn) dom.adhkarNotifShareBtn.onclick = () => {
      copyToClipboard(cat.name || '');
      showToast('📋 تم نسخ الذكر', 'success');
    };
    return;
  }

  const category = ADHKAR_DATA.categories.find(c => c.id === cat.id);
  if (!category) return;

  let text = '';
  let count = 0;
  let total = 0;
  for (const item of category.items) {
    total++;
    const key = `item_${item.id}`;
    const counter = state.adhkarSettings[key] || 0;
    if (counter < item.count) {
      if (text) text += '\n\n';
      text += item.text;
      count++;
    }
  }

  if (!text) {
    dom.adhkarNotifText.textContent = '✅ تم إكمال جميع الأذكار لهذا الوقت';
    dom.adhkarNotifProgress.textContent = '';
    if (dom.adhkarNotifShareBtn) dom.adhkarNotifShareBtn.style.display = 'none';
  } else {
    dom.adhkarNotifText.textContent = text;
    dom.adhkarNotifProgress.textContent = `📖 ${count} ذكر من ${total}`;
    if (dom.adhkarNotifShareBtn) {
      dom.adhkarNotifShareBtn.style.display = 'inline-block';
      dom.adhkarNotifShareBtn.onclick = () => {
        copyToClipboard(text);
        showToast('📋 تم نسخ الأذكار', 'success');
      };
    }
  }
}

function dismissAdhkarNotification() {
  if (dom.adhkarNotification) dom.adhkarNotification.style.display = 'none';
  if (state.adhkarNotificationTimer) {
    clearTimeout(state.adhkarNotificationTimer);
    state.adhkarNotificationTimer = null;
  }
}

export function checkAdhkarNotifications() {
  if (!state.adhkarSettings?.adhkar_enabled) return;
  const now = new Date();
  const curMin = now.getHours() * 60 + now.getMinutes();
  const today = now.toDateString();

  for (const cat of ADHKAR_DATA.categories) {
    const catSettings = state.adhkarSettings[cat.id];
    if (!catSettings?.enabled) continue;
    const notifTime = catSettings.time || cat.defaultTime;
    if (!notifTime) continue;
    const [h, m] = notifTime.split(':').map(Number);
    const catMin = h * 60 + m;
    const fireKey = cat.id + '_' + today;
    if (curMin >= catMin && state.lastAdhkarFired !== fireKey) {
      state.lastAdhkarFired = fireKey;
      const notifDuration = catSettings.duration ?? cat.defaultDuration ?? 1;
      showAdhkarNotification(cat, notifDuration);
      return;
    }
  }

  for (const p of (state.adhkarSettings.personal_adhkar || [])) {
    if (!p.time) continue;
    const [h, m] = p.time.split(':').map(Number);
    const pMin = h * 60 + m;
    const fireKey = 'personal_' + p.id + '_' + today;
    if (curMin >= pMin && state.lastAdhkarFired !== fireKey) {
      state.lastAdhkarFired = fireKey;
      showAdhkarNotification({ id: 'personal', _personalId: p.id, icon: '📝', name: p.text, duration: p.duration || 1 });
      return;
    }
  }
}

function openAdhkarPanelFromNotif() {
  const catId = dom.adhkarNotification?.dataset.category;
  if (!state.adhkarPanelOpen) toggleAdhkarPanel();
  if (catId) switchAdhkarTab(catId);
}

/* ===== Settings list in settings panel ===== */

export function renderAdhkarSettingsList() {
  if (!dom.adhkarSettingsList) return;
  let html = '';
  for (const cat of ADHKAR_DATA.categories) {
    const s = state.adhkarSettings[cat.id] || {};
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
        <input type="number" data-adhkar-duration="${cat.id}" value="${s.duration ?? cat.defaultDuration ?? 1}" min="1" max="60" style="width:50px;"> دقيقة
      </div>
    </div>`;
  }
  dom.adhkarSettingsList.innerHTML = html;

  dom.adhkarSettingsList.querySelectorAll('[data-adhkar-toggle]').forEach(el => {
    el.addEventListener('click', () => {
      const catId = el.dataset.adhkarToggle;
      const on = el.classList.toggle('on');
      if (!state.adhkarSettings[catId]) state.adhkarSettings[catId] = {};
      state.adhkarSettings[catId].enabled = on;
      saveAdhkarSettings();
    });
  });
  dom.adhkarSettingsList.querySelectorAll('[data-adhkar-time]').forEach(el => {
    el.addEventListener('change', () => {
      const catId = el.dataset.adhkarTime;
      if (!state.adhkarSettings[catId]) state.adhkarSettings[catId] = {};
      state.adhkarSettings[catId].time = el.value;
      saveAdhkarSettings();
    });
  });
  dom.adhkarSettingsList.querySelectorAll('[data-adhkar-duration]').forEach(el => {
    el.addEventListener('change', () => {
      const catId = el.dataset.adhkarDuration;
      if (!state.adhkarSettings[catId]) state.adhkarSettings[catId] = {};
      state.adhkarSettings[catId].duration = parseInt(el.value, 10) || 1;
      saveAdhkarSettings();
    });
  });
}

/* Wire up event listeners that need access to adhkar functions */
export function wireAdhkarEvents() {
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
  dom.adhkarAddOverlay?.addEventListener('click', (e) => {
    if (e.target === dom.adhkarAddOverlay) closeAdhkarAddDialog();
  });
  dom.adhkarEnabledToggle?.addEventListener('click', () => {
    const on = dom.adhkarEnabledToggle.classList.toggle('on');
    state.adhkarSettings.adhkar_enabled = on;
    saveAdhkarSettings();
  });
  dom.adhkarSoundToggle?.addEventListener('click', () => {
    const on = dom.adhkarSoundToggle.classList.toggle('on');
    state.adhkarSettings.adhkar_sound = on;
    saveAdhkarSettings();
  });
  dom.adhkarPanel?.addEventListener('click', (e) => {
    if (e.target === dom.adhkarPanel) closeAdhkarPanel();
  });
}
