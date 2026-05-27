import { state } from './state.js';
import { CONFIG } from './config.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { showToast } from './ui.js';
import { stopAzan, loadPrayerTimes } from './prayer.js';
import { renderAdhkarSettingsList } from './adhkar.js';

/* ===================== FONT SIZE ===================== */

/** @param {number} size */
export function applyFontSize(size) {
  state.fontSize = size;
  const container = document.querySelector('.ayahs-container');
  if (container) container.style.fontSize = size + 'px';
  storage.set('font_size', size);
  if (dom.fontSizeSelect) dom.fontSizeSelect.value = size;
}

/* ===================== NIGHT MODE ===================== */

/** @param {boolean} enabled */
export function applyNightMode(enabled) {
  state.nightMode = enabled;
  if (enabled) document.body.classList.add('night-mode');
  else document.body.classList.remove('night-mode');
  storage.set('night_mode', enabled);
}

export function toggleNightMode() { applyNightMode(!state.nightMode); }

/* ===================== SETTINGS PANEL ===================== */

/** Open the settings panel and render adhkar settings list. */
export function openSettings() {
  dom.settingsPanel?.classList.add('open');
  renderAdhkarSettingsList();
}

/** Close the settings panel and stop azan if playing. */
export function closeSettings() {
  dom.settingsPanel?.classList.remove('open');
  if (state.azanPlaying) stopAzan();
}

/** Save city/country/method and reload prayer times. */
export function saveLocationSettings() {
  const city = dom.cityInput?.value.trim();
  const country = dom.countryInput?.value.trim();
  if (!city || !country) { showToast('أدخل المدينة والدولة', 'error'); return; }
  state.city = city;
  state.country = country;
  state.method = dom.methodSelect?.value || '4';
  storage.set('city', city);
  storage.set('country', country);
  storage.set('method', state.method);
  loadPrayerTimes();
  showToast('✅ تم حفظ الموقع وتحديث المواقيت', 'success');
}

/** Reset all settings to defaults and reload the page. */
export function resetSettings() {
  if (!confirm('هل تريد إعادة ضبط جميع الإعدادات؟')) return;
  const keys = ['font_size', 'night_mode', 'city', 'country', 'method', 'azan_enabled', 'azan_fajr_enabled', 'auto_save', 'reciter', 'tafsir_edition', 'bar_collapsed', 'player_collapsed', 'bg_id', 'playback_speed'];
  keys.forEach(k => storage.remove(k));
  location.reload();
}

/* ===================== BACKGROUNDS ===================== */

/** @returns {Promise<void>} */
export async function loadBackgrounds() {
  try {
    const res = await fetch('data/backgrounds.json');
    state.backgroundsList = await res.json();
    if (dom.bgSelect) {
      dom.bgSelect.innerHTML = '';
      state.backgroundsList.forEach(bg => {
        const opt = document.createElement('option');
        opt.value = bg.id;
        opt.textContent = bg.name;
        dom.bgSelect.appendChild(opt);
      });
      const savedBg = storage.get('bg_id');
      if (savedBg) applyBackground(savedBg);
    }
  } catch (e) { console.warn('فشل تحميل قائمة الخلفيات', e); }
}

/** @param {string} bgId */
export function applyBackground(bgId) {
  if (!bgId || bgId === 'none') {
    document.body.style.backgroundImage = '';
    document.body.classList.remove('bg-css');
    const style = document.getElementById('dynamic-bg-style');
    if (style) style.remove();
    storage.remove('bg_id');
    if (dom.bgSelect) dom.bgSelect.value = 'none';
    return;
  }
  const bg = state.backgroundsList?.find(b => b.id === bgId);
  if (!bg) return;
  if (bg.type === 'css' && bg.css) {
    document.body.style.backgroundImage = '';
    document.body.classList.add('bg-css');
    document.body.setAttribute('data-bg-css', bg.css);
    const style = document.createElement('style');
    style.id = 'dynamic-bg-style';
    style.textContent = `body[data-bg-css] { --bg-css-value: ${bg.css} !important; }`;
    const existing = document.getElementById('dynamic-bg-style');
    if (existing) existing.remove();
    document.head.appendChild(style);
  }
  storage.set('bg_id', bgId);
  if (dom.bgSelect) dom.bgSelect.value = bgId;
}

/* ===================== RESTORE SETTINGS ===================== */

/** Restore all settings from localStorage into the state object and update UI. */
export function restoreSettings() {
  const fs = storage.get('font_size'); if (fs) applyFontSize(fs);
  const nm = storage.get('night_mode'); if (nm === true) applyNightMode(true);
  const city = storage.get('city'); if (city) state.city = city;
  const country = storage.get('country'); if (country) state.country = country;
  const method = storage.get('method'); if (method) state.method = method;
  const azan = storage.get('azan_enabled'); if (azan === false) state.azanEnabled = false;
  const azanFajr = storage.get('azan_fajr_enabled'); if (azanFajr === false) state.azanFajrEnabled = false;
  const as = storage.get('auto_save'); if (as === false) state.autoSave = false;
  const rec = storage.get('reciter'); if (rec) state.currentReciter = rec;
  const taf = storage.get('tafsir_edition'); if (taf) state.currentTafsirEdition = taf;
  const bar = storage.get('bar_collapsed'); if (bar === true) state.barCollapsed = true;
  const transEnabled = storage.get('translation_enabled'); if (transEnabled) state.translationEnabled = true;
  const transEdition = storage.get('translation_edition'); if (transEdition) state.currentTranslation = transEdition;

  if (dom.cityInput) dom.cityInput.value = state.city;
  if (dom.countryInput) dom.countryInput.value = state.country;
  if (dom.methodSelect) dom.methodSelect.value = state.method;
  if (dom.azanToggle) dom.azanToggle.classList.toggle('on', state.azanEnabled);
  if (dom.azanFajrToggle) dom.azanFajrToggle.classList.toggle('on', state.azanFajrEnabled);
  if (dom.autoSaveToggle) dom.autoSaveToggle.classList.toggle('on', state.autoSave);
  if (dom.reciterSelect) dom.reciterSelect.value = state.currentReciter;
  if (dom.tafsirSelect) dom.tafsirSelect.value = state.currentTafsirEdition;
  if (dom.translationToggle) dom.translationToggle.classList.toggle('on', state.translationEnabled);
  if (dom.translationSelect) {
    dom.translationSelect.style.display = state.translationEnabled ? '' : 'none';
    if (state.currentTranslation) dom.translationSelect.value = state.currentTranslation;
  }
  if (dom.fontSizeSelect) dom.fontSizeSelect.value = state.fontSize;
  const speed = storage.get('playback_speed');
  if (speed && dom.speedSelect && dom.audioPlayer) { dom.speedSelect.value = speed; dom.audioPlayer.playbackRate = parseFloat(speed); }
  if (state.barCollapsed && dom.prayerBar) {
    dom.prayerBar.classList.add('collapsed');
    dom.prayerBar.classList.remove('expanded');
  }
}
