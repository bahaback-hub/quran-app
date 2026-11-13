/**
 * Prayer times orchestration, the clock/date surfaces and the prayer-bar UI.
 *
 * The offline tables live in `prayer-times-local.ts` and the azan pipeline in
 * `prayer-azan.ts`; both are re-exported here so import sites do not change.
 */
import { state } from '../../state.js';
import { PRAYER_DISPLAY_ORDER } from '../../config.js';
import { dom } from '../../dom.js';
import { storage } from '../../storage.js';
import { showToast } from '../../ui.js';
import { pad2, formatTime12, timeStrToMinutes } from '../../utils.js';
import { prayerFetch } from '../../api-client.js';
import { __, getCityName, getPrayerName, getLang } from '../../i18n.js';
import { prayerTimesRows, PRAYER_BAR_LOCATIONS, barCountryOptions, barCityOptions } from '../../templates.js';
import { trapFocus, manageFocusOnPanelOpen, restoreFocusOnPanelClose } from '../../a11y.js';
import { calculatePrayerTimesLocally } from './prayer-local.js';
import { setTrustedHtml } from '../../safe-html.js';
import {
  getUnderwrittenPrayerTimes,
  isSaudiCity,
  loadPrayerTimesFromLocalJSON,
  LOCAL_PRAYER_CACHE_KEY,
  PRAYER_CACHE_MAX_AGE_DAYS,
  type CachedLocalPrayerTimes,
  type CachedPrayerTimes,
} from './prayer-times-local.js';
import { checkAzanTime, scheduleNextAzanCheck } from './prayer-azan.js';

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

/** BCP-47 locale per interface language for the prayer-bar Gregorian date. */
function dateLocaleFor(lang: string): string {
  switch (lang) {
    case 'en':
      return 'en-US';
    case 'fr':
      return 'fr-FR';
    case 'de':
      return 'de-DE';
    case 'tr':
      return 'tr-TR';
    case 'ms':
      return 'ms-MY';
    case 'id':
      return 'id-ID';
    case 'ru':
      return 'ru-RU';
    case 'ur':
      return 'ur-PK';
    case 'ar':
    default:
      return 'ar-EG';
  }
}

/** Keep the prayer curtain context in sync without coupling it to the settings panel. */
function updatePrayerCurtainContext(now: Date): void {
  const location = document.getElementById('prayerBarLocation');
  if (location) {
    const city = dom.cityInput?.value.trim() || state.city;
    const country = dom.countryInput?.value.trim() || state.country;
    const cityLabel = getCityName(city.toLowerCase());
    const countryLabel = country === 'SA' ? __('country_sa') : country;
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
    gregorian.textContent = now.toLocaleDateString(dateLocaleFor(getLang()), {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  const updated = document.getElementById('prayerBarUpdated');
  if (updated) {
    const stamp = prayerTimesLastUpdatedAt || now;
    updated.textContent = __('prayer_updated', `${pad2(stamp.getHours())}:${pad2(stamp.getMinutes())}`);
  }
}

/* ===================== PRAYER TIMES ===================== */

export async function loadPrayerTimes(): Promise<void> {
  const city = dom.cityInput?.value.trim() || state.city;
  const country = dom.countryInput?.value.trim() || state.country;
  const method = dom.methodSelect?.value || state.method;

  // ── Strategy 0: Local offline JSON (prayer-times-1448.json) for 10 Saudi cities ──
  // PRIMARY source: instant, fully offline, per-date Umm Al-Qura calendar (method=4),
  // synced daily. Because each entry carries a Gregorian date, today's row is a true
  // seasonal match — never a fixed year-round snapshot.
  const localTimes = await loadPrayerTimesFromLocalJSON(city);
  if (localTimes) {
    state.prayerTimes = localTimes as import('../../types.js').PrayerTimes;
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

  // ── Strategy 0.5: Official underwritten table (رئاسة الحرمين) — last-resort fallback ──
  // A single date-less snapshot. It used to be the FIRST source, overriding the
  // date-aware 1448 table and skewing winter days by up to ~104 minutes (Dammam 2026-11-27).
  // Safe to use only when the date-aware table has no entry for today.
  const underwritten = getUnderwrittenPrayerTimes(city);
  if (underwritten) {
    state.prayerTimes = underwritten as import('../../types.js').PrayerTimes;
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
  // IMPORTANT: Saudi cities covered by the official offline tables (Strategy 0/0.5,
  // sourced from the KACST/ummulqura.org.sa API) must NEVER fall back to Aladhan,
  // whose method=4 times diverge from the official calendar by ~1 min. Only consult
  // Aladhan for cities NOT present in the official Saudi table.
  if (!isSaudiCity(city)) {
    const query = `?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${encodeURIComponent(method)}`;
    try {
      const data: import('../../types.js').AladhanTimingsResponse = await prayerFetch(query, {
        errorMsg: __('failed_prayer'),
      });
      if (data?.data?.timings) {
        // Aladhan returns Record<string,string>; cast to PrayerTimes for type-safe state
        state.prayerTimes = data.data.timings as import('../../types.js').PrayerTimes;
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
      // fall through to cache below
    }
  }
  // Saudi cities never reach Aladhan; if both offline tables failed they fall through to cache.
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
    setTrustedHtml(container, prayerTimesRows(times));
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
  // Live countdown shown INSIDE the prayer-times container (replaces the old
  // top-of-screen countdown that was removed at the user's request).
  const bannerText = __('prayer_countdown_header', getPrayerName(nextKey), countdownText);
  // Update every banner inside a prayer-times container (production path).
  getPrayerTimesContainers().forEach((container) => {
    const banner = container.querySelector<HTMLElement>('#prayerNextCountdown');
    if (banner) {
      banner.textContent = bannerText;
    }
  });
  // Fallback: also update a directly-rendered banner (e.g. outside containers).
  const directBanner = document.getElementById('prayerNextCountdown');
  if (directBanner && !directBanner.textContent) {
    directBanner.textContent = bannerText;
  }
  const time24 = (state.prayerTimes[nextKey] || '').split(' ')[0]!;
  if (dom.nextPrayerName) {
    dom.nextPrayerName.textContent = getPrayerName(nextKey);
  }
  if (dom.nextPrayerTime) {
    dom.nextPrayerTime.textContent = time24;
  }
}

/* ===================== PRAYER BAR TOGGLE ===================== */

/** Cleanup for the focus trap installed while the prayer bar is expanded. */
let _prayerBarTrapCleanup: (() => void) | null = null;

export function togglePrayerBar(): void {
  if (!dom.prayerBar) {
    return;
  }
  state.barCollapsed = !state.barCollapsed;
  if (state.barCollapsed) {
    _prayerBarTrapCleanup?.();
    _prayerBarTrapCleanup = null;
    restoreFocusOnPanelClose(undefined, dom.prayerBar);
    dom.prayerBar.classList.add('collapsed');
    dom.prayerBar.classList.remove('expanded');
    document.body.classList.remove('prayer-curtain-active');
  } else {
    dom.prayerBar.classList.remove('collapsed');
    dom.prayerBar.classList.add('expanded');
    document.body.classList.add('prayer-curtain-active');
    // Confine Tab + TV-remote focus inside the bar so it can't leak to the
    // parent #readerSideTools siblings (same pattern as the settings panel).
    // Capture the trigger BEFORE trapFocus moves focus into the bar.
    const trigger = document.activeElement as HTMLElement | undefined;
    _prayerBarTrapCleanup?.();
    _prayerBarTrapCleanup = trapFocus(dom.prayerBar);
    manageFocusOnPanelOpen(dom.prayerBar, trigger);
    syncPrayerBarQuickSelect();
  }
  dom.expandBarBtn?.setAttribute('aria-expanded', String(!state.barCollapsed));
  storage.set('bar_collapsed', state.barCollapsed);
}

/* ===================== PRAYER BAR QUICK LOCATION ===================== */

/**
 * Populate the country → city quick selects inside the prayer-bar details
 * and wire immediate apply (no save button): picking a city persists the
 * location and reloads the times at once.
 */
export function initPrayerBarQuickSelect(): void {
  const countrySel = dom.barCountrySelect;
  const citySel = dom.barCitySelect;
  if (!countrySel || !citySel) {
    return;
  }
  if (countrySel.options.length === 0) {
    setTrustedHtml(countrySel, barCountryOptions());
  }
  syncPrayerBarQuickSelect();
  countrySel.addEventListener('change', () => {
    setTrustedHtml(citySel, barCityOptions(countrySel.value));
    applyPrayerBarQuickSelect();
  });
  citySel.addEventListener('change', applyPrayerBarQuickSelect);
}

/** Preselect the current country/city without triggering a reload. */
function syncPrayerBarQuickSelect(): void {
  const countrySel = dom.barCountrySelect;
  const citySel = dom.barCitySelect;
  if (!countrySel || !citySel) {
    return;
  }
  const country = (dom.countryInput?.value.trim() || state.country || 'SA').toUpperCase();
  countrySel.value = PRAYER_BAR_LOCATIONS.some((g) => g.code === country) ? country : 'SA';
  setTrustedHtml(citySel, barCityOptions(countrySel.value));
  const city = dom.cityInput?.value.trim() || state.city;
  const match = Array.from(citySel.options).find((o) => o.value.split('|')[0] === city);
  citySel.value = match ? match.value : (citySel.options[0]?.value ?? '');
}

/** Apply the bar quick selection immediately: persist + reload times. */
function applyPrayerBarQuickSelect(): void {
  const v = dom.barCitySelect?.value;
  if (!v) {
    return;
  }
  const [city, country] = v.split('|') as [string, string];
  if (!city || !country) {
    return;
  }
  state.city = city;
  state.country = country;
  storage.set('city', city);
  storage.set('country', country);
  if (dom.cityInput) {
    dom.cityInput.value = city;
  }
  if (dom.countryInput) {
    dom.countryInput.value = country;
  }
  void loadPrayerTimes();
}

/* Offline tables and azan moved to sibling modules — re-export so existing
   import sites (app, events, tests) keep working unchanged. */
export { loadPrayerTimesFromLocalJSON, loadUnderwrittenPrayerTable } from './prayer-times-local.js';
export { checkAzanTime, hideAzanNotification, scheduleNextAzanCheck, stopAzan, testAzan } from './prayer-azan.js';

/* Qibla compass moved to ./qibla.js — re-export so existing import sites
   (events, hifz-room, tests) keep working unchanged. */
export {
  normalizeQiblaAngle,
  circularQiblaDifference,
  getWebQiblaHeading,
  calculateQibla,
  showQiblaCompass,
  hideQiblaCompass,
} from './qibla.js';
