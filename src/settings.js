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
  if (state.mushafMode && state.currentPage) {
    import('./mushaf.js').then(m => m.loadPage(state.currentPage, true, true));
  }
}

export function toggleNightMode() { applyNightMode(!state.nightMode); }

/* ===================== SEPIA MODE ===================== */

export function applySepiaMode(enabled) {
  state.sepiaMode = enabled;
  document.body.classList.toggle('sepia-mode', !!enabled);
  storage.set('sepia_mode', enabled);
}

export function toggleSepiaMode() { applySepiaMode(!state.sepiaMode); }

/* ===================== FONT TYPE ===================== */

export function applyFontType(type) {
  state.fontType = type;
  const container = document.querySelector('.ayahs-container');
  if (container) container.style.fontFamily = type;
  storage.set('font_type', type);
  if (dom.fontTypeSelect) dom.fontTypeSelect.value = type;
}

/* ===================== LINE SPACING ===================== */

export function applyLineSpacing(spacing) {
  state.lineSpacing = spacing;
  const container = document.querySelector('.ayahs-container');
  if (container) container.style.lineHeight = spacing;
  storage.set('line_spacing', spacing);
  if (dom.lineSpacingSelect) dom.lineSpacingSelect.value = spacing;
}

/* ===================== SETTINGS TABS ===================== */

/** Initialize settings tab switching. */
export function initSettingsTabs() {
  try {
    const tabsContainer = dom.settingsPanel?.querySelector('#settingsTabs');
    if (!tabsContainer) return;
    const tabs = tabsContainer.querySelectorAll('.settings-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const contents = dom.settingsPanel?.querySelectorAll('.settings-tab-content');
        contents?.forEach(c => c.classList.remove('active'));
        const target = dom.settingsPanel?.querySelector(`.settings-tab-content[data-tab="${tabName}"]`);
        if (target) target.classList.add('active');
      });
    });
  } catch (e) { console.warn('initSettingsTabs error:', e); }
}

/* ===================== SETTINGS PANEL ===================== */

/** Open the settings panel and render adhkar settings list. */
export function openSettings() {
  if (!dom.settingsPanel) { console.warn('settingsPanel not found'); return; }
  dom.settingsPanel.classList.add('open');
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
  const keys = ['font_size', 'night_mode', 'city', 'country', 'method', 'azan_enabled', 'azan_fajr_enabled', 'auto_save', 'reciter', 'tafsir_edition', 'bar_collapsed', 'player_collapsed', 'bg_id', 'playback_speed', 'lang', 'surah_list', 'translation_enabled', 'translation_edition', 'last_position', 'bookmark', 'favorites', 'mushaf_mode', 'current_page', 'search_history', 'adhkar_settings'];
  keys.forEach(k => storage.remove(k));
  showToast('✅ تم إعادة الضبط. جارٍ تحديث الصفحة...', 'success');
  setTimeout(() => location.reload(), 1500);
}

/** Export all settings as a downloadable JSON file. */
export function exportSettings() {
  const keys = ['font_size', 'night_mode', 'city', 'country', 'method', 'azan_enabled', 'azan_fajr_enabled', 'auto_save', 'reciter', 'tafsir_edition', 'bar_collapsed', 'player_collapsed', 'bg_id', 'playback_speed', 'lang', 'translation_enabled', 'translation_edition', 'favorites', 'bookmark', 'last_position', 'mushaf_mode', 'current_page', 'adhkar_settings', 'search_history'];
  const data = {};
  keys.forEach(k => { data[k] = storage.get(k); });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'quran-app-settings.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ تم تصدير الإعدادات', 'success');
}

/** Import settings from a JSON file. */
export function importSettings() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = /** @type {HTMLInputElement} */ (e.target).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(/** @type {string} */ (/** @type {unknown} */ (ev.target?.result)));
        Object.entries(data).forEach(([k, v]) => {
          if (v !== null && v !== undefined) storage.set(k, v);
        });
        showToast('✅ تم استيراد الإعدادات. جارٍ تحديث الصفحة...', 'success');
        setTimeout(() => location.reload(), 1500);
      } catch {
        showToast('❌ ملف غير صالح', 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
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

function removeBgClasses() {
  document.body.className = document.body.className
    .split(/\s+/).filter(c => !c.startsWith('bg-css')).join(' ').trim();
}

/** @param {string} bgId */
export function applyBackground(bgId) {
  if (!bgId || bgId === 'none') {
    document.body.style.backgroundImage = '';
    removeBgClasses();
    const style = document.getElementById('dynamic-bg-style');
    if (style) style.remove();
    storage.remove('bg_id');
    if (dom.bgSelect) dom.bgSelect.value = 'none';
    return;
  }
  const bg = state.backgroundsList?.find(b => b.id === bgId);
  if (!bg) return;
  if (bg.type === 'css' && (bg.cssBlock || bg.css)) {
    document.body.style.backgroundImage = '';
    removeBgClasses();
    const existing = document.getElementById('dynamic-bg-style');
    if (existing) existing.remove();
    if (bg.cssBlock) {
      const style = document.createElement('style');
      style.id = 'dynamic-bg-style';
      style.textContent = bg.cssBlock;
      document.head.appendChild(style);
      document.body.classList.add('bg-css-arabic');
    } else {
      document.body.classList.add('bg-css');
      document.body.setAttribute('data-bg-css', bg.css + '');
      const style = document.createElement('style');
      style.id = 'dynamic-bg-style';
      style.textContent = `body[data-bg-css] { --bg-css-value: ${bg.css} !important; }`;
      document.head.appendChild(style);
    }
  }
  storage.set('bg_id', bgId);
  if (dom.bgSelect) dom.bgSelect.value = bgId;
}

/* ===================== RESTORE SETTINGS ===================== */

/** Restore all settings from localStorage into the state object and update UI. */
export function restoreSettings() {
  const fs = storage.get('font_size'); if (fs) applyFontSize(fs);
  const nm = storage.get('night_mode');
  if (nm === true) {
    applyNightMode(true);
  } else if (nm === null || nm === undefined) {
    // Auto night mode based on system preference (only if user never set preference)
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    if (prefersDark.matches) applyNightMode(true);
    // Listen for system theme changes and apply only if user hasn't explicitly set a preference
    prefersDark.addEventListener('change', (e) => {
      if (storage.get('night_mode') === null || storage.get('night_mode') === undefined) {
        applyNightMode(e.matches);
      }
    });
  }
  const city = storage.get('city'); if (city) state.city = city;
  const country = storage.get('country'); if (country) state.country = country;
  const method = storage.get('method'); if (method) state.method = method;
  const azan = storage.get('azan_enabled'); if (azan === false) state.azanEnabled = false;
  const azanFajr = storage.get('azan_fajr_enabled'); if (azanFajr === false) state.azanFajrEnabled = false;
  const as = storage.get('auto_save'); if (as === false) state.autoSave = false;
  const rec = storage.get('reciter'); if (rec) state.currentReciter = rec;
  const taf = storage.get('tafsir_edition'); if (taf) state.currentTafsirEdition = taf;
  const bar = storage.get('bar_collapsed'); if (bar === false) state.barCollapsed = false;
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
  if (dom.translationSelect) {
    if (state.translationEnabled && state.currentTranslation) dom.translationSelect.value = state.currentTranslation;
    else dom.translationSelect.value = '';
  }
  if (dom.settingsThemeToggle) dom.settingsThemeToggle.classList.toggle('on', state.nightMode);
  if (dom.fontSizeSelect) dom.fontSizeSelect.value = state.fontSize;
  const sepia = storage.get('sepia_mode'); if (sepia) applySepiaMode(true);
  const ft = storage.get('font_type'); if (ft) applyFontType(ft);
  const ls = storage.get('line_spacing'); if (ls) applyLineSpacing(ls);
  const speed = storage.get('playback_speed');
  if (speed && dom.speedSelect && dom.audioPlayer) { dom.speedSelect.value = speed; dom.audioPlayer.playbackRate = parseFloat(speed); }
  const tajweed = storage.get('tajweed_enabled');
  if (tajweed === false) { state.tajweedEnabled = false; if (dom.tajweedToggle) dom.tajweedToggle.classList.remove('on'); }
  else { state.tajweedEnabled = true; if (dom.tajweedToggle) dom.tajweedToggle.classList.add('on'); }
  if (!state.barCollapsed && dom.prayerBar) {
    dom.prayerBar.classList.remove('collapsed');
    dom.prayerBar.classList.add('expanded');
  }
}
