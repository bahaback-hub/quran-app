import { state } from './state.js';
import { CONFIG, PRAYER_NAMES_AR, PRAYER_ORDER, ARABIC_WEEKDAYS } from './config.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { showToast } from './ui.js';
import { pad2, formatTime12, timeStrToMinutes } from './utils.js';

let countdownInterval = null;

/* ===================== CLOCK ===================== */

export function startClock() {
  updateDates();
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    updateDates();
    if (state.prayerTimes) updateCountdowns();
  }, 1000);
}

export function stopClock() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function updateDates() {
  const now = new Date();
  try {
    const hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
    if (dom.hijriDateDisplay) dom.hijriDateDisplay.textContent = hijri;
    if (dom.bigClockHijri) dom.bigClockHijri.textContent = '📅 ' + hijri;
  } catch (e) { }
  if (dom.weekdayDisplay) dom.weekdayDisplay.textContent = ARABIC_WEEKDAYS[now.getDay()];
  const greg = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  if (dom.gregorianDateDisplay) dom.gregorianDateDisplay.textContent = greg;
  if (dom.bigClockDate) dom.bigClockDate.textContent = greg;
  const timeStr = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());
  if (dom.bigClockTime) dom.bigClockTime.textContent = timeStr;
  const collapsedClock = document.getElementById('collapsedClock');
  if (collapsedClock) collapsedClock.textContent = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
}

/* ===================== PRAYER TIMES ===================== */

export async function loadPrayerTimes() {
  const city = dom.cityInput?.value.trim() || state.city;
  const country = dom.countryInput?.value.trim() || state.country;
  const method = dom.methodSelect?.value || state.method;
  const url = `${CONFIG.PRAYER_API}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${encodeURIComponent(method)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data?.data?.timings) {
      state.prayerTimes = data.data.timings;
      storage.set('cached_prayer_times', { date: new Date().toDateString(), timings: state.prayerTimes, city, country });
      renderPrayerTimes();
      checkAzanTime();
      scheduleNextAzanCheck();
      return;
    }
    throw new Error('Invalid response');
  } catch {
    const cached = storage.get('cached_prayer_times');
    if (cached && cached.date === new Date().toDateString() && cached.city === city && cached.country === country) {
      state.prayerTimes = cached.timings;
      renderPrayerTimes();
      checkAzanTime();
      scheduleNextAzanCheck();
      showToast('عرض المواقيت من الكاش المحلي', 'success');
    } else {
      showToast('تعذّر تحميل مواقيت الصلاة', 'error');
    }
  }
}

function getNextPrayerKey() {
  if (!state.prayerTimes) return null;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (const key of PRAYER_ORDER) {
    const raw = state.prayerTimes[key];
    if (!raw) continue;
    if (timeStrToMinutes(raw.split(' ')[0]) > nowMin) return key;
  }
  return 'Fajr';
}

function renderPrayerTimes() {
  if (!state.prayerTimes) return;
  const order = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const next = getNextPrayerKey();
  let html = '';
  for (const key of order) {
    const raw = state.prayerTimes[key] || '';
    const time24 = raw.split(' ')[0];
    const isNext = (key === next);
    html += `<div class="prayer-row ${isNext ? 'next-prayer' : ''}">
      <span class="prayer-name">${PRAYER_NAMES_AR[key] || key}</span>
      <span class="prayer-time">${formatTime12(time24)}</span>
    </div>`;
  }
  if (dom.prayerTimesRows) dom.prayerTimesRows.innerHTML = html;
  updateCountdowns();
}

function updateCountdowns() {
  if (!state.prayerTimes) return;
  const nextKey = getNextPrayerKey();
  if (!nextKey) return;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const raw = state.prayerTimes[nextKey] || '';
  let nextMin = timeStrToMinutes(raw.split(' ')[0]);
  if (nextMin <= nowMin) nextMin += 24 * 60;
  const diff = nextMin - nowMin;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  const s = (60 - now.getSeconds()) % 60;
  const countdownText = `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  if (dom.countdownDisplay) dom.countdownDisplay.textContent = countdownText;
  if (dom.prayerCountdown) dom.prayerCountdown.textContent = `${PRAYER_NAMES_AR[nextKey]} — بعد ${countdownText}`;
  const time24 = (state.prayerTimes[nextKey] || '').split(' ')[0];
  if (dom.nextPrayerName) dom.nextPrayerName.textContent = PRAYER_NAMES_AR[nextKey];
  if (dom.nextPrayerTime) dom.nextPrayerTime.textContent = formatTime12(time24);
}

/* ===================== AZAN ===================== */

function hideAzanNotification() {
  if (dom.azanNotification) dom.azanNotification.style.display = 'none';
}

export function stopAzan() {
  if (!dom.azanPlayer) return;
  dom.azanPlayer.pause();
  dom.azanPlayer.currentTime = 0;
  dom.azanPlayer.removeAttribute('src');
  dom.azanPlayer.load();
  state.azanPlaying = false;
  if (dom.testAzanBtn) dom.testAzanBtn.textContent = '▶️ اختبار الأذان';
  hideAzanNotification();
}

export function testAzan() {
  if (!dom.azanPlayer) return;
  if (state.azanPlaying) {
    stopAzan();
    showToast('تم إيقاف الأذان', '');
  } else {
    dom.azanPlayer.src = CONFIG.AZAN_FILE;
    dom.azanPlayer.load();
    dom.azanPlayer.play()
      .then(() => {
        state.azanPlaying = true;
        if (dom.testAzanBtn) dom.testAzanBtn.textContent = '⏹️ إيقاف الأذان';
        if (dom.azanNotification && dom.azanNotifPrayer) {
          dom.azanNotifPrayer.textContent = '🕋 اختبار الأذان';
          dom.azanNotification.style.display = 'flex';
        }
      })
      .catch(() => showToast('تعذّر تشغيل الأذان', 'error'));
  }
}

function showAzanNotification(prayerKey) {
  if (!dom.azanNotification || !dom.azanNotifPrayer) return;
  dom.azanNotifPrayer.textContent = `🕋 صلاة ${PRAYER_NAMES_AR[prayerKey]}`;
  dom.azanNotification.style.display = 'flex';
}

export function checkAzanTime() {
  if (!state.prayerTimes || !state.azanEnabled) return;
  const now = new Date();
  const cur = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
  for (const key of PRAYER_ORDER) {
    if (key === 'Fajr' && !state.azanFajrEnabled) continue;
    const raw = (state.prayerTimes[key] || '').split(' ')[0];
    if (raw === cur) {
      const stamp = key + '_' + now.toDateString() + '_' + cur;
      if (state.lastAzanFired === stamp) return;
      state.lastAzanFired = stamp;
      if (dom.azanPlayer) {
        dom.azanPlayer.src = CONFIG.AZAN_FILE;
        dom.azanPlayer.currentTime = 0;
        dom.azanPlayer.play()
          .then(() => {
            state.azanPlaying = true;
            if (dom.testAzanBtn) dom.testAzanBtn.textContent = '⏹️ إيقاف الأذان';
            showAzanNotification(key);
          })
          .catch(e => console.warn(e));
      }
      return;
    }
  }
}

let azanTimer = null;

export function scheduleNextAzanCheck() {
  if (azanTimer) clearTimeout(azanTimer);
  if (!state.prayerTimes || !state.azanEnabled) {
    azanTimer = setTimeout(scheduleNextAzanCheck, 60000);
    return;
  }
  const now = new Date();
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  let nextSec = null;
  for (const key of PRAYER_ORDER) {
    if (key === 'Fajr' && !state.azanFajrEnabled) continue;
    const raw = (state.prayerTimes[key] || '').split(' ')[0];
    if (!raw) continue;
    const [h, m] = raw.split(':');
    const prayerSec = parseInt(h, 10) * 3600 + parseInt(m, 10) * 60;
    if (prayerSec > nowSec) { nextSec = prayerSec; break; }
  }
  if (nextSec === null) return;
  const delayMs = (nextSec - nowSec) * 1000;
  azanTimer = setTimeout(() => { checkAzanTime(); scheduleNextAzanCheck(); }, delayMs);
}

/* ===================== PRAYER BAR TOGGLE ===================== */

export function togglePrayerBar() {
  if (!dom.prayerBar) return;
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
