/**
 * In-app azan: the test button, the notification banner, the minute watcher and
 * the next-prayer timer that mirrors the schedule into native notifications.
 *
 * `prayer.ts` re-exports the public entry points for existing import sites.
 */
import { CONFIG, PRAYER_ORDER } from '../../config.js';
import { state } from '../../state.js';
import { dom } from '../../dom.js';
import { showToast } from '../../ui.js';
import { pad2 } from '../../utils.js';
import { __, getPrayerName } from '../../i18n.js';
import { setStoppedState } from '../audio/audio.js';
import { cancelAzanNotifications, notifyAzanNow, scheduleAzanNotifications } from './azan-notifications.js';

/**
 * Maximum delay (seconds) past a prayer minute within which the azan still
 * fires. Mobile WebView timers are throttled in background tabs; without this
 * grace a single deferred tick would permanently skip that day's adhan.
 */
const AZAN_GRACE_SECONDS = 300;

/* ===================== AZAN ===================== */

export function hideAzanNotification(): void {
  if (dom.azanNotification) {
    dom.azanNotification.classList.add('hidden');
    dom.azanNotification.style.display = 'none';
  }
}

export function stopAzan(): void {
  if (!dom.azanPlayer) {
    return;
  }
  dom.azanPlayer.pause();
  dom.azanPlayer.currentTime = 0;
  dom.azanPlayer.removeAttribute('src');
  dom.azanPlayer.load();
  state.azanPlaying = false;
  if (dom.testAzanBtn) {
    dom.testAzanBtn.textContent = __('test_azan');
  }
  hideAzanNotification();
}

function getAzanSource(): string {
  const supportsOpus = dom.azanPlayer?.canPlayType('audio/ogg; codecs="opus"');
  return supportsOpus ? `${import.meta.env.BASE_URL}azan.opus` : CONFIG.AZAN_FILE;
}

export function testAzan(): void {
  if (!dom.azanPlayer) {
    return;
  }
  if (state.azanPlaying) {
    stopAzan();
    showToast(__('azan_stopped'), '');
  } else {
    // Pause Quran audio before playing azan
    if (dom.audioPlayer && !dom.audioPlayer.paused) {
      dom.audioPlayer.pause();
      setStoppedState();
    }
    dom.azanPlayer.src = getAzanSource();
    dom.azanPlayer.load();
    dom.azanPlayer
      .play()
      .then(() => {
        state.azanPlaying = true;
        if (dom.testAzanBtn) {
          dom.testAzanBtn.textContent = __('stop_azan');
        }
        if (dom.azanNotification && dom.azanNotifPrayer) {
          dom.azanNotifPrayer.textContent = __('test_azan');
          dom.azanNotification.classList.remove('hidden');
          dom.azanNotification.style.display = 'flex';
        }
      })
      .catch(() => showToast(__('azan_failed'), 'error'));
  }
}

function showAzanNotification(prayerKey: string): void {
  if (!dom.azanNotification || !dom.azanNotifPrayer) {
    return;
  }
  dom.azanNotifPrayer.textContent = `🕋 ${__('prayer')} ${getPrayerName(prayerKey)}`;
  dom.azanNotification.classList.remove('hidden');
  dom.azanNotification.style.display = 'flex';

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(__('prayer_time_come'), {
      body: `${__('prayer')} ${getPrayerName(prayerKey)}`,
      icon: `${import.meta.env.BASE_URL}icon-192.png`,
      tag: 'azan-' + prayerKey,
    });
  }
  // UXS-04: no requestPermission() here. Azan time arrives from a timer, not a
  // user gesture — browsers block or silently drop the ask, and the project's
  // own policy (adhkar-notifications.ts) reserves it for the toggle click,
  // which routes through ensureAzanNotificationPermission(). Without the grant
  // the in-page banner above still fires.
  // The Web Notification API is unavailable inside an Android WebView, so the
  // phone relies on a real scheduled notification instead.
  void notifyAzanNow(__('prayer_time_come'), `${__('prayer')} ${getPrayerName(prayerKey)}`);
}

export function checkAzanTime(): void {
  if (!state.prayerTimes || !state.azanEnabled) {
    return;
  }
  const now = new Date();
  const cur = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const todayStamp = now.toDateString();
  for (const key of PRAYER_ORDER) {
    if (key === 'Fajr' && !state.azanFajrEnabled) {
      continue;
    }
    const raw = (state.prayerTimes[key] || '').split(' ')[0];
    if (!raw) {
      continue;
    }
    const [h, m] = raw.split(':') as [string, string];
    const prayerSec = parseInt(h, 10) * 3600 + parseInt(m, 10) * 60;
    // Fire when the current minute matches the prayer OR when the scheduler
    // delivered this tick late (throttled background-tab timer) but still within
    // the grace window. Without the grace, any deferral past the minute boundary
    // silently dropped that day's adhan.
    const withinGrace = prayerSec <= nowSec && nowSec - prayerSec <= AZAN_GRACE_SECONDS;
    if (raw === cur || withinGrace) {
      const stamp = key + '_' + todayStamp + '_' + cur;
      if (state.lastAzanFired?.startsWith(key + '_' + todayStamp)) {
        continue; // Skip already-fired prayer today, check remaining ones
      }
      state.lastAzanFired = stamp;
      if (dom.azanPlayer) {
        // Pause Quran audio before playing azan
        if (dom.audioPlayer && !dom.audioPlayer.paused) {
          dom.audioPlayer.pause();
          setStoppedState();
        }
        dom.azanPlayer.src = getAzanSource();
        dom.azanPlayer.currentTime = 0;
        dom.azanPlayer
          .play()
          .then(() => {
            state.azanPlaying = true;
            if (dom.testAzanBtn) {
              dom.testAzanBtn.textContent = __('stop_azan');
            }
            showAzanNotification(key);
          })
          .catch((e: unknown) => console.warn(e));
      }
      return;
    }
  }
}

let azanTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Mirror the in-app azan schedule into the Android notification shade.
 *
 * The in-page timer below only runs while the app is alive, so on a phone the
 * alert was invisible whenever the app was closed. Native notifications are
 * scheduled by the OS instead, which fires regardless.
 */
function syncAzanNotifications(): void {
  if (!state.azanEnabled || !state.prayerTimes) {
    void cancelAzanNotifications();
    return;
  }
  void scheduleAzanNotifications({
    times: state.prayerTimes as unknown as Record<string, string | undefined>,
    label: (key) => getPrayerName(key),
    title: __('prayer_time_come'),
    includeFajr: state.azanFajrEnabled,
  });
}

export function scheduleNextAzanCheck(): void {
  syncAzanNotifications();
  if (azanTimer) {
    clearTimeout(azanTimer);
  }
  if (!state.prayerTimes || !state.azanEnabled) {
    // Nothing to schedule. Do NOT re-poll forever: the toggle handlers call
    // scheduleNextAzanCheck() again the moment azan is re-enabled or prayer
    // times finish loading, so there is no need for a background wake-up loop.
    azanTimer = null;
    return;
  }
  const now = new Date();
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  let nextSec: number | null = null;
  for (const key of PRAYER_ORDER) {
    if (key === 'Fajr' && !state.azanFajrEnabled) {
      continue;
    }
    const raw = (state.prayerTimes[key] || '').split(' ')[0];
    if (!raw) {
      continue;
    }
    const [h, m] = raw.split(':') as [string, string];
    const prayerSec = parseInt(h, 10) * 3600 + parseInt(m, 10) * 60;
    if (prayerSec > nowSec) {
      nextSec = prayerSec;
      break;
    }
  }
  // If all prayers have passed today, schedule for tomorrow's Fajr
  if (nextSec === null) {
    const fajrRaw = (state.prayerTimes['Fajr'] || '').split(' ')[0];
    if (fajrRaw) {
      const [fh, fm] = fajrRaw.split(':') as [string, string];
      const fajrSec = parseInt(fh, 10) * 3600 + parseInt(fm, 10) * 60;
      nextSec = fajrSec + 86400; // Tomorrow's Fajr
    } else {
      nextSec = nowSec + 10 * 60; // Fallback: check again in 10 minutes
    }
  }
  const delayMs = (nextSec - nowSec) * 1000;
  azanTimer = setTimeout(() => {
    try {
      checkAzanTime();
    } catch (e) {
      console.warn('[Azan] checkAzanTime error:', e);
    }
    scheduleNextAzanCheck();
  }, delayMs);
}
