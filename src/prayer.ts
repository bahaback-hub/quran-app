import { state } from './state.js';
import { CONFIG, PRAYER_ORDER, PRAYER_DISPLAY_ORDER } from './config.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { showToast } from './ui.js';
import { pad2, formatTime12, timeStrToMinutes } from './utils.js';
import { prayerFetch } from './api-client.js';
import { __, getPrayerName, getWeekday } from './i18n.js';
import { prayerTimesRows } from './templates.js';
import { updatePlayPauseBtn } from './audio.js';
import { calculatePrayerTimesLocally } from './prayer-local.js';

/* ===================== INTERFACES ===================== */

/** Shape of cached prayer times stored in localStorage. */
interface CachedPrayerTimes {
  date: string;
  timings: import('./types.js').PrayerTimes;
  city: string;
  country: string;
}

/** DeviceOrientationEvent with iOS-specific webkitCompassHeading. */
interface DeviceOrientationEventiOS extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

/* ===================== CLOCK ===================== */

let countdownInterval: ReturnType<typeof setInterval> | null = null;

export function startClock(): void {
  updateDates();
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  countdownInterval = setInterval(() => {
    updateDates();
    if (state.prayerTimes) {
      updateCountdowns();
    }
  }, 1000);
}

export function stopClock(): void {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

const _hijriFormatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function updateDates(): void {
  const now = new Date();
  try {
    const hijri = _hijriFormatter.format(now);
    if (dom.hijriDateDisplay) {
      dom.hijriDateDisplay.textContent = hijri;
    }
    if (dom.bigClockHijri) {
      dom.bigClockHijri.textContent = '📅 ' + hijri;
    }
  } catch (e) {
    console.warn('Date update failed:', e);
  }
  if (dom.weekdayDisplay) {
    dom.weekdayDisplay.textContent = getWeekday(now.getDay());
  }
  const greg = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  if (dom.gregorianDateDisplay) {
    dom.gregorianDateDisplay.textContent = greg;
  }
  if (dom.bigClockDate) {
    dom.bigClockDate.textContent = greg;
  }
  const timeStr = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());
  if (dom.bigClockTime) {
    dom.bigClockTime.textContent = timeStr;
  }
  if (dom.bigClockTime2) {
    dom.bigClockTime2.textContent = timeStr;
  }
  const collapsedClock = document.getElementById('collapsedClock');
  if (collapsedClock) {
    collapsedClock.textContent = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
  }
}

/* ===================== PRAYER TIMES ===================== */

export async function loadPrayerTimes(): Promise<void> {
  const city = dom.cityInput?.value.trim() || state.city;
  const country = dom.countryInput?.value.trim() || state.country;
  const method = dom.methodSelect?.value || state.method;

  // ── Strategy 1: Local calculation (offline-capable, no API needed) ──
  try {
    const localTimes = await calculatePrayerTimesLocally(method);
    if (localTimes) {
      state.prayerTimes = localTimes;
      storage.set('cached_prayer_times', {
        date: new Date().toDateString(),
        timings: localTimes,
        city,
        country,
      });
      renderPrayerTimes();
      checkAzanTime();
      scheduleNextAzanCheck();
      return;
    }
  } catch (e) {
    console.warn('[Prayer] Local calculation failed, falling back to API:', e);
  }

  // ── Strategy 2: Remote API (requires internet) ──
  const query = `?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${encodeURIComponent(method)}`;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await prayerFetch(query, { errorMsg: __('failed_prayer') });
    if (data?.data?.timings) {
      state.prayerTimes = data.data.timings;
      storage.set('cached_prayer_times', {
        date: new Date().toDateString(),
        timings: state.prayerTimes,
        city,
        country,
      });
      renderPrayerTimes();
      checkAzanTime();
      scheduleNextAzanCheck();
      return;
    }
    throw new Error('Invalid response');
  } catch {
    // ── Strategy 3: LocalStorage cache (offline fallback) ──
    const cached = storage.get<CachedPrayerTimes>('cached_prayer_times');
    if (cached && cached.city === city && cached.country === country) {
      // Accept cache from today or up to 3 days ago (prayer times shift ~1 min/day)
      const cacheAge = (Date.now() - new Date(cached.date).getTime()) / (1000 * 60 * 60 * 24);
      if (cacheAge <= 3) {
        state.prayerTimes = cached.timings;
        renderPrayerTimes();
        checkAzanTime();
        scheduleNextAzanCheck();
        showToast(cacheAge < 0.5 ? __('cached_prayer') : __('cached_prayer_stale'), 'info');
        return;
      }
    }
    showToast(__('failed_prayer'), 'error');
  }
}

/** Get the next prayer key based on current time (includes Sunrise for countdown). */
export function getNextPrayerKey(): string | null {
  if (!state.prayerTimes) {
    return null;
  }
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  // Use PRAYER_DISPLAY_ORDER which includes Sunrise for countdown display
  for (const key of PRAYER_DISPLAY_ORDER) {
    const raw = state.prayerTimes[key];
    if (!raw) {
      continue;
    }
    if (timeStrToMinutes(raw.split(' ')[0]!) > nowMin) {
      return key;
    }
  }
  return 'Fajr';
}

function renderPrayerTimes(): void {
  if (!state.prayerTimes) {
    return;
  }
  const order: string[] = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const next = getNextPrayerKey();
  const times = order.map((key) => {
    const raw = state.prayerTimes![key] || '';
    const time24 = raw.split(' ')[0]!;
    return { name: getPrayerName(key), time: formatTime12(time24), isNext: key === next };
  });
  if (dom.prayerTimesRows) {
    dom.prayerTimesRows.innerHTML = prayerTimesRows(times);
  }
  updateCountdowns();
}

function updateCountdowns(): void {
  if (!state.prayerTimes) {
    return;
  }
  const nextKey = getNextPrayerKey();
  if (!nextKey) {
    return;
  }
  const now = new Date();
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const raw = state.prayerTimes[nextKey] || '';
  const [hStr, mStr] = raw.split(' ')[0]!.split(':') as [string, string];
  let nextSec = parseInt(hStr, 10) * 3600 + parseInt(mStr, 10) * 60;
  if (nextSec <= nowSec) {
    nextSec += 86400;
  }
  const diffSec = nextSec - nowSec;
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  const s = diffSec % 60;
  const countdownText = `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  if (dom.countdownDisplay) {
    dom.countdownDisplay.textContent = countdownText;
  }
  if (dom.prayerCountdown) {
    dom.prayerCountdown.textContent = `${__('prayer_countdown', getPrayerName(nextKey), countdownText)}`;
  }
  const time24 = (state.prayerTimes[nextKey] || '').split(' ')[0]!;
  if (dom.nextPrayerName) {
    dom.nextPrayerName.textContent = getPrayerName(nextKey);
  }
  if (dom.nextPrayerTime) {
    dom.nextPrayerTime.textContent = formatTime12(time24);
  }
}

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
      state.isPlaying = false;
      document.body.classList.remove('audio-playing');
      updatePlayPauseBtn();
    }
    dom.azanPlayer.src = CONFIG.AZAN_FILE;
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
      icon: '/icon-192.png',
      tag: 'azan-' + prayerKey,
    });
  } else if ('Notification' in window && Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}

export function checkAzanTime(): void {
  if (!state.prayerTimes || !state.azanEnabled) {
    return;
  }
  const now = new Date();
  const cur = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
  for (const key of PRAYER_ORDER) {
    if (key === 'Fajr' && !state.azanFajrEnabled) {
      continue;
    }
    const raw = (state.prayerTimes[key] || '').split(' ')[0];
    if (raw === cur) {
      const stamp = key + '_' + now.toDateString() + '_' + cur;
      if (state.lastAzanFired === stamp) {
        return;
      }
      state.lastAzanFired = stamp;
      if (dom.azanPlayer) {
        // Pause Quran audio before playing azan
        if (dom.audioPlayer && !dom.audioPlayer.paused) {
          dom.audioPlayer.pause();
          state.isPlaying = false;
          document.body.classList.remove('audio-playing');
          updatePlayPauseBtn();
        }
        dom.azanPlayer.src = CONFIG.AZAN_FILE;
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

export function scheduleNextAzanCheck(): void {
  if (azanTimer) {
    clearTimeout(azanTimer);
  }
  if (!state.prayerTimes || !state.azanEnabled) {
    azanTimer = setTimeout(scheduleNextAzanCheck, 60000);
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

/* ===================== PRAYER BAR TOGGLE ===================== */

export function togglePrayerBar(): void {
  if (!dom.prayerBar) {
    return;
  }
  state.barCollapsed = !state.barCollapsed;
  if (state.barCollapsed) {
    dom.prayerBar.classList.add('collapsed');
    dom.prayerBar.classList.remove('expanded');
  } else {
    dom.prayerBar.classList.remove('collapsed');
    dom.prayerBar.classList.add('expanded');
  }
  storage.set('bar_collapsed', state.barCollapsed);
}

/* ===================== QIBLA COMPASS ===================== */

/** Stored reference to the deviceorientation handler so it can be removed. */
let _qiblaOrientationHandler: ((ev: DeviceOrientationEvent) => void) | null = null;

/** Calculate Qibla direction from a given latitude/longitude. */
export function calculateQibla(lat: number, lng: number): number {
  const kaabaLat = (21.4225 * Math.PI) / 180;
  const kaabaLng = (39.8262 * Math.PI) / 180;
  const userLat = (lat * Math.PI) / 180;
  const userLng = (lng * Math.PI) / 180;
  const dLng = kaabaLng - userLng;
  const y = Math.sin(dLng);
  const x = Math.cos(userLat) * Math.tan(kaabaLat) - Math.sin(userLat) * Math.cos(dLng);
  let qibla = (Math.atan2(y, x) * 180) / Math.PI;
  if (qibla < 0) {
    qibla += 360;
  }
  return qibla;
}

/** Show the Qibla compass overlay. */
export function showQiblaCompass(): void {
  const overlay = document.getElementById('qiblaOverlay');
  if (!overlay) {
    return;
  }
  overlay.classList.remove('hidden');
  overlay.style.display = 'flex';

  const compass = document.getElementById('qiblaCompass');
  const direction = document.getElementById('qiblaDirection');
  const angleDisplay = document.getElementById('qiblaAngle');

  if (!navigator.geolocation) {
    if (direction) {
      direction.textContent = __('location_not_supported');
    }
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      const qiblaAngle = calculateQibla(latitude, longitude);

      if (compass) {
        compass.style.transform = `rotate(${-qiblaAngle}deg)`;
      }
      if (angleDisplay) {
        angleDisplay.textContent = `${Math.round(qiblaAngle)}°`;
      }

      // Remove any previous handler to prevent memory leaks
      if (_qiblaOrientationHandler) {
        window.removeEventListener('deviceorientation', _qiblaOrientationHandler);
        _qiblaOrientationHandler = null;
      }

      const handleOrientation = (e: DeviceOrientationEventiOS): void => {
        let heading = e.alpha || 0;
        if (e.webkitCompassHeading) {
          heading = e.webkitCompassHeading;
        }
        const adjusted = qiblaAngle - heading;
        if (compass) {
          compass.style.transform = `rotate(${adjusted}deg)`;
        }
      };

      // Store reference so we can remove it later
      _qiblaOrientationHandler = handleOrientation as (ev: DeviceOrientationEvent) => void;

      if (window.DeviceOrientationEvent) {
        const DOE = DeviceOrientationEvent as unknown as import('./types.js').WebkitDeviceOrientationEvent;
        if (typeof DOE.requestPermission === 'function') {
          DOE.requestPermission()
            .then((permState: string) => {
              if (permState === 'granted') {
                window.addEventListener('deviceorientation', _qiblaOrientationHandler!);
              }
            })
            .catch(() => { /* noop */ });
        } else {
          window.addEventListener('deviceorientation', _qiblaOrientationHandler);
        }
      }

      if (direction) {
        const dirs = [
          __('prayer_dirs'),
          __('prayer_dirs_ne'),
          __('prayer_dirs_e'),
          __('prayer_dirs_se'),
          __('prayer_dirs_s'),
          __('prayer_dirs_sw'),
          __('prayer_dirs_w'),
          __('prayer_dirs_nw'),
        ];
        const idx = Math.round(qiblaAngle / 45) % 8;
        direction.textContent = `${__('qibla_direction', dirs[idx]!, String(Math.round(qiblaAngle)))}`;
      }
    },
    () => {
      if (direction) {
        direction.textContent = __('qibla_location_failed');
      }
    },
    { enableHighAccuracy: true },
  );
}

/** Hide the Qibla compass overlay and remove the orientation listener. */
export function hideQiblaCompass(): void {
  const overlay = document.getElementById('qiblaOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.style.display = 'none';
  }
  // Remove orientation handler to prevent memory leak
  if (_qiblaOrientationHandler) {
    window.removeEventListener('deviceorientation', _qiblaOrientationHandler);
    _qiblaOrientationHandler = null;
  }
}
