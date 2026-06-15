/**
 * Adhkar Notifications — Notification scheduling, timer management, and
 * adhkar time checking.
 *
 * Extracted from adhkar.ts to separate notification concerns from
 * the main UI, settings, counter, and panel logic.
 */

import { state } from './state.js';
import { dom } from './dom.js';
import { showToast } from './ui.js';
import { copyToClipboard } from './utils.js';
import { ADHKAR_DATA } from './adhkar-data.js';
import { __ } from './i18n.js';
import { getAdhkarNotificationTimer, setAdhkarNotificationTimer } from './internal-state.js';
import type { AdhkarCategorySettings } from './types.js';

/* ===================== INTERFACES ===================== */

/** Notification context for showing an adhkar notification. */
export interface AdhkarNotifContext {
  id: string;
  _personalId?: string;
  icon: string;
  name: string;
  duration?: number;
}

/* ===================== NOTIFICATION SOUND ===================== */

let _adhkarAudioCtx: AudioContext | null = null;

function playNotificationSound(): void {
  try {
    if (!_adhkarAudioCtx) {
      _adhkarAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = _adhkarAudioCtx;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq: number, i: number) => {
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
  } catch (e: unknown) {
    console.warn('Notification sound failed:', e);
  }
}

/* ===================== SHOW / RENDER NOTIFICATION ===================== */

export function showAdhkarNotification(cat: AdhkarNotifContext, notifDuration?: number): void {
  if (!dom.adhkarNotification) {
    return;
  }
  if (dom.adhkarNotifIcon) {
    dom.adhkarNotifIcon.textContent = cat.icon || '🕌';
  }
  if (dom.adhkarNotifTitle) {
    dom.adhkarNotifTitle.textContent = `🕌 ${cat.name}`;
  }
  dom.adhkarNotification.dataset['category'] = cat.id || 'personal';
  dom.adhkarNotification.classList.remove('hidden');
  dom.adhkarNotification.style.display = 'flex';

  const settings = state.adhkarSettings!;
  if (settings.adhkar_sound) {
    playNotificationSound();
  }

  const duration = (notifDuration || cat.duration || 1) * 60 * 1000;
  const existingTimer = getAdhkarNotificationTimer();
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  setAdhkarNotificationTimer(
    setTimeout(() => {
      if (dom.adhkarNotification) {
        dom.adhkarNotification.classList.add('hidden');
        dom.adhkarNotification.style.display = 'none';
      }
    }, duration),
  );

  renderNotifAdhkarText(cat);

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('🕌 ' + cat.name, {
      body: cat.id === 'personal' ? cat.name || '' : __('adhkar_notification'),
      icon: '/icon-192.png',
      tag: 'adhkar-' + cat.id,
    });
  }
  // Note: We do NOT call Notification.requestPermission() here because
  // this function is called from setInterval (every 30s check) without a
  // user gesture. Modern browsers require a user gesture for requestPermission()
  // and will silently reject it otherwise. Permission should be requested only
  // from a user-initiated action (e.g., a button click in settings).
}

export function renderNotifAdhkarText(cat: AdhkarNotifContext): void {
  if (!dom.adhkarNotifText) {
    return;
  }

  if (cat.id === 'personal') {
    dom.adhkarNotifText.textContent = cat.name || '';
    if (dom.adhkarNotifProgress) {
      dom.adhkarNotifProgress.textContent = '';
    }
    if (dom.adhkarNotifShareBtn) {
      dom.adhkarNotifShareBtn.onclick = () => {
        copyToClipboard(cat.name || '');
        showToast(__('copied'), 'success');
      };
    }
    return;
  }

  const category = ADHKAR_DATA.categories.find((c: { id: string }) => c.id === cat.id);
  if (!category) {
    return;
  }

  let text = '';
  let count = 0;
  let total = 0;
  const settings = state.adhkarSettings!;
  for (const item of category.items) {
    total++;
    const key = `item_${item.id}`;
    const counter = (settings[key] as number) || 0;
    if (counter < item.count) {
      if (text) {
        text += '\n\n';
      }
      text += item.text;
      count++;
    }
  }

  if (!text) {
    dom.adhkarNotifText.textContent = __('adhkar_done');
    if (dom.adhkarNotifProgress) {
      dom.adhkarNotifProgress.textContent = '';
    }
    if (dom.adhkarNotifShareBtn) {
      dom.adhkarNotifShareBtn.style.display = 'none';
    }
  } else {
    dom.adhkarNotifText.textContent = text;
    if (dom.adhkarNotifProgress) {
      dom.adhkarNotifProgress.textContent = `📖 ${count}/${total}`;
    }
    if (dom.adhkarNotifShareBtn) {
      dom.adhkarNotifShareBtn.style.display = 'inline-block';
      dom.adhkarNotifShareBtn.onclick = () => {
        copyToClipboard(text);
        showToast(__('copied'), 'success');
      };
    }
  }
}

/* ===================== DISMISS NOTIFICATION ===================== */

export function dismissAdhkarNotification(): void {
  if (dom.adhkarNotification) {
    dom.adhkarNotification.classList.add('hidden');
    dom.adhkarNotification.style.display = 'none';
  }
  const timer = getAdhkarNotificationTimer();
  if (timer) {
    clearTimeout(timer);
    setAdhkarNotificationTimer(null);
  }
}

/* ===================== CHECK ADHKAR NOTIFICATIONS ===================== */

/** Check all adhkar categories and personal adhkar for pending notifications. */
export function checkAdhkarNotifications(): void {
  const settings = state.adhkarSettings;
  if (!settings?.adhkar_enabled) {
    return;
  }
  const now = new Date();
  const curMin = now.getHours() * 60 + now.getMinutes();
  const today = now.toDateString();

  for (const cat of ADHKAR_DATA.categories) {
    const catSettings = settings[cat.id] as Partial<AdhkarCategorySettings> | undefined;
    if (!catSettings?.enabled) {
      continue;
    }
    const notifTime = catSettings.time || cat.defaultTime;
    if (!notifTime) {
      continue;
    }
    const timeParts = notifTime.split(':').map(Number);
    const h = timeParts[0]!;
    const m = timeParts[1]!;
    const catMin = h * 60 + m;
    const fireKey = cat.id + '_' + today;
    if (curMin >= catMin && state.lastAdhkarFired !== fireKey) {
      state.lastAdhkarFired = fireKey;
      const notifDuration = catSettings.duration ?? cat.defaultDuration ?? 1;
      showAdhkarNotification({ id: cat.id, icon: cat.icon, name: cat.name }, notifDuration);
      return;
    }
  }

  for (const p of settings.personal_adhkar || []) {
    if (!p.time) {
      continue;
    }
    const timeParts = p.time.split(':').map(Number);
    const h = timeParts[0]!;
    const m = timeParts[1]!;
    const pMin = h * 60 + m;
    const fireKey = 'personal_' + p.id + '_' + today;
    if (curMin >= pMin && state.lastAdhkarFired !== fireKey) {
      state.lastAdhkarFired = fireKey;
      showAdhkarNotification({
        id: 'personal',
        _personalId: p.id,
        icon: '📝',
        name: p.text,
        duration: p.duration || 1,
      });
      return;
    }
  }
}

/* ===================== SCHEDULER ===================== */

/** Start a recurring timer to check adhkar notifications every 30 seconds. */
let _adhkarSchedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startAdhkarNotificationScheduler(): void {
  if (_adhkarSchedulerInterval) {
    clearInterval(_adhkarSchedulerInterval);
  }
  checkAdhkarNotifications();
  _adhkarSchedulerInterval = setInterval(checkAdhkarNotifications, 30_000);
}

/** Stop the adhkar notification scheduler. */
export function stopAdhkarNotificationScheduler(): void {
  if (_adhkarSchedulerInterval) {
    clearInterval(_adhkarSchedulerInterval);
    _adhkarSchedulerInterval = null;
  }
}
