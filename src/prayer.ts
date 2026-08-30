import { state } from './state.js';
import { CONFIG, PRAYER_ORDER, PRAYER_DISPLAY_ORDER } from './config.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { showToast } from './ui.js';
import { pad2, formatTime12, timeStrToMinutes } from './utils.js';
import { prayerFetch } from './api-client.js';
import { __, getCityName, getPrayerName } from './i18n.js';
import { prayerTimesRows } from './templates.js';
import { updatePlayPauseBtn } from './audio.js';
import { calculatePrayerTimesLocally } from './prayer-local.js';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { startNativeQiblaCompass } from './qibla-compass.js';

/* ===================== LOCAL OFFLINE PRAYER TIMES (1448 H) ===================== */

/** Map English/Arabic city names to the keys in prayer-times-1448.json */
const LOCAL_CITY_MAP: Record<string, string> = {
  'makkah': 'مكة المكرمة', 'mecca': 'مكة المكرمة', 'مكة': 'مكة المكرمة', 'مكة المكرمة': 'مكة المكرمة',
  'madinah': 'المدينة المنورة', 'medina': 'المدينة المنورة', 'المدينة': 'المدينة المنورة', 'المدينة المنورة': 'المدينة المنورة',
  'riyadh': 'الرياض', 'الرياض': 'الرياض',
  'jeddah': 'جدة', 'جدة': 'جدة',
  'dammam': 'الدمام', 'الدمام': 'الدمام',
  'abha': 'أبها', 'أبها': 'أبها',
  'tabuk': 'تبوك', 'تبوك': 'تبوك',
  'buraydah': 'بريدة', 'buraidah': 'بريدة', 'بريدة': 'بريدة',
  'hail': 'حائل', 'حائل': 'حائل',
  'taif': 'الطائف', 'الطائف': 'الطائف',
};

/** Get today's Hijri date in YYYY-MM-DD format (Umm Al-Qura calendar) */
function getTodayHijriISO(): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    let day = '', month = '', year = '';
    for (const p of parts) {
      if (p.type === 'day') {
        day = p.value;
      } else if (p.type === 'month') {
        month = p.value;
      } else if (p.type === 'year') {
        year = p.value;
      }
    }
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  } catch {
    return '';
  }
}

/** Local prayer times JSON cache (loaded once per session) */
let _localPrayerJSON: Record<string, unknown> | null = null;

/**
 * Load prayer times from the local offline JSON file (prayer-times-1448.json).
 * Returns PrayerTimes if the city is found and today's date matches.
 * This is instant (no network) and works fully offline.
 */
async function loadPrayerTimesFromLocalJSON(city: string): Promise<Record<string, string> | null> {
  try {
    // Normalize city name to match JSON keys
    const norm = city.trim().toLowerCase();
    const jsonCity = LOCAL_CITY_MAP[norm] || LOCAL_CITY_MAP[city.trim()];
    if (!jsonCity) {
      return null;
    }

    // Load JSON file (cached after first load)
    if (!_localPrayerJSON) {
      const url = `${import.meta.env.BASE_URL}data/prayer-times-1448.json`;
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }
      _localPrayerJSON = await response.json() as Record<string, unknown>;
    }

    const cities = (_localPrayerJSON as Record<string, unknown>)['cities'] as Record<string, { days: Array<Record<string, string>> }>;
    if (!cities || !cities[jsonCity]) {
      return null;
    }

    // Get today's Hijri date
    const todayHijri = getTodayHijriISO();
    if (!todayHijri) {
      return null;
    }

    // Find today's entry by matching the Hijri date
    const days = cities[jsonCity].days;
    // The `date` field is in Hijri YYYY-MM-DD format
    let todayData = days.find((d: Record<string, string>) => d['date'] === todayHijri);

    // If exact match fails, try by month-day (in case year format differs slightly)
    if (!todayData) {
      const monthDay = todayHijri.substring(5); // "MM-DD"
      todayData = days.find((d: Record<string, string>) => {
        const dDate = d['date'];
        return typeof dDate === 'string' && dDate.endsWith(monthDay);
      });
    }

    if (!todayData) {
      return null;
    }

    // Return in the same format as Aladhan API timings
    return {
      Fajr: todayData['Fajr'] || '00:00',
      Sunrise: todayData['Sunrise'] || '00:00',
      Dhuhr: todayData['Dhuhr'] || '00:00',
      Asr: todayData['Asr'] || '00:00',
      Maghrib: todayData['Maghrib'] || '00:00',
      Isha: todayData['Isha'] || '00:00',
    };
  } catch {
    return null;
  }
}

/* ===================== INTERFACES ===================== */

/** Shape of cached prayer times stored in localStorage. */
interface CachedPrayerTimes {
  date: string;
  timings: import('./types.js').PrayerTimes;
  city: string;
  country: string;
  method: string;
}

/** Device-derived times are deliberately kept separate from an explicitly selected city. */
interface CachedLocalPrayerTimes {
  date: string;
  timings: import('./types.js').PrayerTimes;
  method: string;
  source: 'device-location';
}

const LOCAL_PRAYER_CACHE_KEY = 'cached_local_prayer_times';
const PRAYER_CACHE_MAX_AGE_DAYS = 3;

/** DeviceOrientationEvent with iOS-specific webkitCompassHeading. */
interface DeviceOrientationEventiOS extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
}

interface QiblaCoordinates {
  latitude: number;
  longitude: number;
  altitude?: number;
}

/* ===================== CLOCK ===================== */

let countdownInterval: ReturnType<typeof setInterval> | null = null;
let prayerTimesLastUpdatedAt: Date | null = null;

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
    if (dom.bigClockHijri) {
      dom.bigClockHijri.textContent = '📅 ' + hijri;
    }
  } catch (e) {
    console.warn('Date update failed:', e);
  }
  const greg = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
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
  updatePrayerCurtainContext(now);
  const collapsedClock = document.getElementById('collapsedClock');
  if (collapsedClock) {
    collapsedClock.textContent = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
  }
}

/** Keep the prayer curtain context in sync without coupling it to the settings panel. */
function updatePrayerCurtainContext(now: Date): void {
  const location = document.getElementById('prayerBarLocation');
  if (location) {
    const city = dom.cityInput?.value.trim() || state.city;
    const country = dom.countryInput?.value.trim() || state.country;
    const cityLabel = getCityName(city.toLowerCase());
    const countryLabel = country === 'SA' ? 'المملكة العربية السعودية' : country;
    location.textContent = ['📍', cityLabel, countryLabel].filter(Boolean).join(' ');
  }

  const hijri = document.getElementById('prayerBarHijri');
  if (hijri) {
    try {
      hijri.textContent = `📅 ${_hijriFormatter.format(now)}`;
    } catch {
      hijri.textContent = '';
    }
  }

  const gregorian = document.getElementById('prayerBarDate');
  if (gregorian) {
    gregorian.textContent = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  const updated = document.getElementById('prayerBarUpdated');
  if (updated) {
    const stamp = prayerTimesLastUpdatedAt || now;
    updated.textContent = `◷ تم التحديث ${pad2(stamp.getHours())}:${pad2(stamp.getMinutes())}`;
  }
}

/* ===================== PRAYER TIMES ===================== */

/* Official Umm Al-Qura (رئاسة الحرمين) times for major Saudi cities.
 * Loaded once from public/data/prayer-times-underwritten.json and used as the
 * HIGHEST-priority source so the app matches ummulqura.org.sa exactly, instead
 * of the approximate astronomical calculation returned by Aladhan. */
let underwrittenTable: Record<string, Record<string, string>> | null = null;
let underwrittenLoaded = false;

export async function loadUnderwrittenPrayerTable(): Promise<void> {
  if (underwrittenLoaded) {
    return;
  }
  underwrittenLoaded = true;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/prayer-times-underwritten.json`);
    if (res.ok) {
      const json = (await res.json()) as Record<string, Record<string, string>>;
      delete (json as Record<string, unknown>)['_comment'];
      underwrittenTable = json;
    }
  } catch {
    underwrittenTable = null;
  }
}

function getUnderwrittenPrayerTimes(city: string): Record<string, string> | null {
  if (!underwrittenTable) {
    return null;
  }
  const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, '');
  const c = norm(city);
  for (const [key, val] of Object.entries(underwrittenTable)) {
    if (norm(key) === c) {
      return val;
    }
    const label = val['label'];
    if (label && norm(label) === c) {
      return val;
    }
  }
  return null;
}

export async function loadPrayerTimes(): Promise<void> {
  const city = dom.cityInput?.value.trim() || state.city;
  const country = dom.countryInput?.value.trim() || state.country;
  const method = dom.methodSelect?.value || state.method;

  // ── Strategy 0: Official underwritten table (رئاسة الحرمين) for major Saudi cities ──
  // Highest priority: matches ummulqura.org.sa exactly, no network round-trip.
  const underwritten = getUnderwrittenPrayerTimes(city);
  if (underwritten) {
    state.prayerTimes = underwritten as import('./types.js').PrayerTimes;
    storage.set('cached_prayer_times', {
      date: new Date().toISOString(),
      timings: state.prayerTimes,
      city,
      country,
      method,
    });
    renderPrayerTimes();
    checkAzanTime();
    scheduleNextAzanCheck();
    return;
  }

  // ── Strategy 0.5: Local offline JSON (prayer-times-1448.json) for 10 Saudi cities ──
  // Instant (no network), works fully offline, uses Umm Al-Qura calendar (method=4).
  const localTimes = await loadPrayerTimesFromLocalJSON(city);
  if (localTimes) {
    state.prayerTimes = localTimes as import('./types.js').PrayerTimes;
    storage.set('cached_prayer_times', {
      date: new Date().toISOString(),
      timings: state.prayerTimes,
      city,
      country,
      method,
    });
    renderPrayerTimes();
    checkAzanTime();
    scheduleNextAzanCheck();
    return;
  }

  // ── Strategy 1: Selected-city source (the user's explicit setting is authoritative) ──
  const query = `?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${encodeURIComponent(method)}`;
  try {
    const data: import('./types.js').AladhanTimingsResponse = await prayerFetch(query, {
      errorMsg: __('failed_prayer'),
    });
    if (data?.data?.timings) {
      // Aladhan returns Record<string,string>; cast to PrayerTimes for type-safe state
      state.prayerTimes = data.data.timings as import('./types.js').PrayerTimes;
      storage.set('cached_prayer_times', {
        date: new Date().toISOString(),
        timings: state.prayerTimes,
        city,
        country,
        method,
      });
      renderPrayerTimes();
      checkAzanTime();
      scheduleNextAzanCheck();
      return;
    }
    throw new Error('Invalid response');
  } catch {
    // ── Strategy 2: LocalStorage cache for the same city and method ──
    const cached = storage.get<CachedPrayerTimes>('cached_prayer_times');
    if (cached && cached.city === city && cached.country === country && cached.method === method) {
      // Accept cache from today or up to 3 days ago (prayer times shift ~1 min/day)
      const cacheAge = (Date.now() - new Date(cached.date).getTime()) / (1000 * 60 * 60 * 24);
      if (cacheAge <= PRAYER_CACHE_MAX_AGE_DAYS) {
        state.prayerTimes = cached.timings;
        renderPrayerTimes();
        checkAzanTime();
        scheduleNextAzanCheck();
        showToast(cacheAge < 0.5 ? __('cached_prayer') : __('cached_prayer_stale'), 'info');
        return;
      }
    }

    // ── Strategy 3: Device-location cache ──
    // Never reuse this for the selected city: it represents the phone's physical location.
    const cachedLocal = storage.get<CachedLocalPrayerTimes>(LOCAL_PRAYER_CACHE_KEY);
    if (cachedLocal && cachedLocal.source === 'device-location' && cachedLocal.method === method) {
      const cacheAge = (Date.now() - new Date(cachedLocal.date).getTime()) / (1000 * 60 * 60 * 24);
      if (cacheAge <= PRAYER_CACHE_MAX_AGE_DAYS) {
        state.prayerTimes = cachedLocal.timings;
        renderPrayerTimes();
        checkAzanTime();
        scheduleNextAzanCheck();
        showToast(cacheAge < 0.5 ? __('cached_prayer') : __('cached_prayer_stale'), 'info');
        return;
      }
    }

    // ── Strategy 4: Device-location calculation (last resort when the selected city is unavailable) ──
    try {
      const localTimes = await calculatePrayerTimesLocally(method);
      if (localTimes) {
        state.prayerTimes = localTimes;
        storage.set(LOCAL_PRAYER_CACHE_KEY, {
          date: new Date().toISOString(),
          timings: localTimes,
          method,
          source: 'device-location',
        } satisfies CachedLocalPrayerTimes);
        renderPrayerTimes();
        checkAzanTime();
        scheduleNextAzanCheck();
        return;
      }
    } catch (e) {
      console.warn('[Prayer] Device-location fallback failed:', e);
    }

    showToast(__('failed_prayer'), 'error');
    renderPrayerLoadFailure();
  }
}

/** Replace the temporary loading message in every prayer-times view after all sources fail. */
function getPrayerTimesContainers(): HTMLElement[] {
  const containers = Array.from(document.querySelectorAll<HTMLElement>('#prayerTimesRows, #settingsPrayerTimesRows'));
  if (dom.prayerTimesRows && !containers.includes(dom.prayerTimesRows)) {
    containers.unshift(dom.prayerTimesRows);
  }
  return containers;
}

function renderPrayerLoadFailure(): void {
  getPrayerTimesContainers().forEach((container) => {
    const message = document.createElement('p');
    message.className = 'centered-muted prayer-times-error';
    message.textContent = `⚠️ ${__('failed_prayer')}`;
    container.replaceChildren(message);
  });
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
  prayerTimesLastUpdatedAt = new Date();
  const order: string[] = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const next = getNextPrayerKey();
  const times = order.map((key) => {
    const raw = state.prayerTimes![key] || '';
    const time24 = raw.split(' ')[0]!;
    return { name: getPrayerName(key), time: formatTime12(time24), isNext: key === next };
  });
  getPrayerTimesContainers().forEach((container) => {
    container.innerHTML = prayerTimesRows(times);
  });
  updatePrayerCurtainContext(prayerTimesLastUpdatedAt);
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
  const headerCountdownText = `${pad2(h)}:${pad2(m)}`;
  if (dom.countdownDisplay) {
    dom.countdownDisplay.textContent = countdownText;
  }
  if (dom.prayerCountdown) {
    dom.prayerCountdown.textContent = __('prayer_countdown_header', getPrayerName(nextKey), headerCountdownText);
  }
  const time24 = (state.prayerTimes[nextKey] || '').split(' ')[0]!;
  if (dom.nextPrayerName) {
    dom.nextPrayerName.textContent = getPrayerName(nextKey);
  }
  if (dom.nextPrayerTime) {
    dom.nextPrayerTime.textContent = time24;
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
      state.isPlaying = false;
      document.body.classList.remove('audio-playing');
      updatePlayPauseBtn();
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
        continue; // Skip already-fired prayer, check remaining ones
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
    document.body.classList.remove('prayer-curtain-active');
  } else {
    dom.prayerBar.classList.remove('collapsed');
    dom.prayerBar.classList.add('expanded');
    document.body.classList.add('prayer-curtain-active');
  }
  dom.expandBarBtn?.setAttribute('aria-expanded', String(!state.barCollapsed));
  storage.set('bar_collapsed', state.barCollapsed);
}

/* ===================== QIBLA COMPASS ===================== */

/** Stored reference to the deviceorientation handler so it can be removed. */
let _qiblaOrientationHandler: ((ev: DeviceOrientationEvent) => void) | null = null;
let _stopNativeQiblaCompass: (() => Promise<void>) | null = null;
const QIBLA_ORIENTATION_EVENTS = ['deviceorientationabsolute', 'deviceorientation'] as const;

/** Keep headings in the conventional 0°–359.999° clockwise-from-north range. */
export function normalizeQiblaAngle(angle: number): number {
  const normalized = angle % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

/** Return the smallest angular separation, preserving the 359° → 0° wraparound. */
export function circularQiblaDifference(first: number, second: number): number {
  const difference = Math.abs(normalizeQiblaAngle(first) - normalizeQiblaAngle(second));
  return difference > 180 ? 360 - difference : difference;
}

/**
 * Derive a usable web heading only from an explicit compass value or absolute
 * orientation. Android's raw alpha runs counter to conventional compass
 * heading, hence the 360 - alpha conversion used by mature web compasses.
 */
export function getWebQiblaHeading(event: DeviceOrientationEventiOS, isAbsoluteEvent: boolean = false): number | null {
  if (typeof event.webkitCompassHeading === 'number' && Number.isFinite(event.webkitCompassHeading)) {
    return normalizeQiblaAngle(event.webkitCompassHeading);
  }
  if ((event.absolute === true || isAbsoluteEvent) && typeof event.alpha === 'number' && Number.isFinite(event.alpha)) {
    const screenAngle = window.screen?.orientation?.angle ?? 0;
    return normalizeQiblaAngle(360 - event.alpha + screenAngle);
  }
  return null;
}

function removeQiblaSources(): void {
  if (_qiblaOrientationHandler) {
    for (const eventName of QIBLA_ORIENTATION_EVENTS) {
      window.removeEventListener(eventName, _qiblaOrientationHandler);
    }
    _qiblaOrientationHandler = null;
  }
  if (_stopNativeQiblaCompass) {
    void _stopNativeQiblaCompass().catch((error: unknown) =>
      console.warn('[Qibla] Native compass stop failed:', error),
    );
    _stopNativeQiblaCompass = null;
  }
}

/** Calculate Qibla direction from a given latitude/longitude. */
export function calculateQibla(lat: number, lng: number): number {
  const kaabaLat = (21.4225 * Math.PI) / 180;
  const kaabaLng = (39.8262 * Math.PI) / 180;
  const userLat = (lat * Math.PI) / 180;
  const userLng = (lng * Math.PI) / 180;
  const dLng = kaabaLng - userLng;
  const y = Math.sin(dLng);
  const x = Math.cos(userLat) * Math.tan(kaabaLat) - Math.sin(userLat) * Math.cos(dLng);
  return normalizeQiblaAngle((Math.atan2(y, x) * 180) / Math.PI);
}

/** Request coordinates through Capacitor's native Android permission flow. */
async function getNativeQiblaCoordinates(): Promise<QiblaCoordinates> {
  const permissions = await Geolocation.requestPermissions({ permissions: ['location'] });
  if (permissions.location !== 'granted') {
    throw new Error('Location permission was not granted');
  }
  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    enableLocationFallback: true,
    timeout: 20_000,
    maximumAge: 60_000,
  });
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    altitude: position.coords.altitude ?? 0,
  };
}

/** Show the Qibla compass overlay. */
export function showQiblaCompass(): void {
  const overlay = document.getElementById('qiblaOverlay');
  if (!overlay) {
    return;
  }
  overlay.classList.remove('hidden');
  overlay.style.display = 'flex';
  document.body.classList.add('qibla-curtain-active');

  const compass = document.getElementById('qiblaCompass');
  const needle = compass?.querySelector<HTMLElement>('.qibla-needle') || null;
  const direction = document.getElementById('qiblaDirection');
  const angleDisplay = document.getElementById('qiblaAngle');
  const status = document.getElementById('qiblaStatus');

  const applyCoordinates = ({ latitude, longitude, altitude = 0 }: QiblaCoordinates): void => {
    const qiblaAngle = calculateQibla(latitude, longitude);

    const setNeedle = (heading: number): void => {
      if (needle) {
        needle.style.transform = `translateX(-50%) rotate(${normalizeQiblaAngle(qiblaAngle - heading)}deg)`;
      }
    };
    const showStaticBearing = (message: string): void => {
      setNeedle(0);
      if (status) {
        status.textContent = message;
      }
    };

    // Keep the North/East/South/West dial fixed. Only rotate the needle so it
    // points to the Kaaba rather than making the full compass look northbound.
    if (compass) {
      compass.style.transform = '';
    }
    setNeedle(0);
    if (angleDisplay) {
      angleDisplay.textContent = `${Math.round(qiblaAngle)}°`;
    }

    removeQiblaSources();

    const handleOrientation = (e: DeviceOrientationEventiOS): void => {
      const heading = getWebQiblaHeading(e, e.type === 'deviceorientationabsolute');
      if (heading === null) {
        showStaticBearing(__('qibla_static_mode'));
        return;
      }
      setNeedle(heading);
      if (status) {
        const iOSAccuracy = e.webkitCompassAccuracy;
        status.textContent =
          typeof iOSAccuracy === 'number' && iOSAccuracy > 20
            ? __('qibla_calibration_required')
            : __('qibla_compass_active');
      }
    };

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

    if (Capacitor.getPlatform() === 'android') {
      if (status) {
        status.textContent = __('qibla_compass_starting');
      }
      void startNativeQiblaCompass(
        { latitude, longitude, altitude },
        {
          onHeading: ({ heading, isReliable }) => {
            setNeedle(heading);
            if (status) {
              status.textContent = isReliable ? __('qibla_compass_active') : __('qibla_calibration_required');
            }
          },
          onAccuracy: ({ isReliable }) => {
            if (status) {
              status.textContent = isReliable ? __('qibla_compass_active') : __('qibla_calibration_required');
            }
          },
        },
      )
        .then((stop) => {
          _stopNativeQiblaCompass = stop;
        })
        .catch((error: unknown) => {
          console.warn('[Qibla] Native compass could not start:', error);
          showStaticBearing(__('qibla_compass_unavailable'));
        });
      return;
    }

    if (!window.DeviceOrientationEvent) {
      showStaticBearing(__('qibla_static_mode'));
      return;
    }

    _qiblaOrientationHandler = handleOrientation as (ev: DeviceOrientationEvent) => void;
    const DOE = DeviceOrientationEvent as unknown as import('./types.js').WebkitDeviceOrientationEvent;
    if (typeof DOE.requestPermission === 'function') {
      void DOE.requestPermission()
        .then((permState: string) => {
          if (permState === 'granted') {
            for (const eventName of QIBLA_ORIENTATION_EVENTS) {
              window.addEventListener(eventName, _qiblaOrientationHandler!);
            }
            if (status) {
              status.textContent = __('qibla_compass_starting');
            }
          } else {
            showStaticBearing(__('qibla_compass_unavailable'));
          }
        })
        .catch(() => showStaticBearing(__('qibla_compass_unavailable')));
    } else {
      for (const eventName of QIBLA_ORIENTATION_EVENTS) {
        window.addEventListener(eventName, _qiblaOrientationHandler);
      }
      if (status) {
        status.textContent = __('qibla_compass_starting');
      }
    }
  };
  const showLocationFailure = (error: unknown): void => {
    console.warn('[Qibla] Unable to get location:', error);
    if (direction) {
      direction.textContent = __('qibla_location_failed');
    }
    if (status) {
      status.textContent = '';
    }
  };

  if (Capacitor.isNativePlatform()) {
    void getNativeQiblaCoordinates().then(applyCoordinates).catch(showLocationFailure);
    return;
  }
  if (!navigator.geolocation) {
    if (direction) {
      direction.textContent = __('location_not_supported');
    }
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) =>
      applyCoordinates({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        altitude: position.coords.altitude ?? 0,
      }),
    showLocationFailure,
    { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 },
  );
}

/** Hide the Qibla compass overlay and remove the orientation listener. */
export function hideQiblaCompass(): void {
  const overlay = document.getElementById('qiblaOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.style.display = 'none';
  }
  document.body.classList.remove('qibla-curtain-active');
  removeQiblaSources();
}
