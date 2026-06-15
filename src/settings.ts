import { state } from './state.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { showToast } from './ui.js';
import { stopAzan, loadPrayerTimes } from './prayer.js';
import { renderAdhkarSettingsList } from './adhkar.js';
import { __ } from './i18n.js';

/* ===================== FONT SIZE ===================== */

/** Apply a specific font size to the ayahs container and persist it. */
export function applyFontSize(size: number): void {
  state.fontSize = size;
  const container = document.querySelector('.ayahs-container') as HTMLElement | null;
  if (container) {
    container.style.fontSize = size + 'px';
  }
  storage.set('font_size', size);
  if (dom.fontSizeSelect) {
    dom.fontSizeSelect.value = String(size);
  }
}

/* ===================== NIGHT MODE ===================== */

/** Enable or disable night mode and persist the preference. */
export function applyNightMode(enabled: boolean): void {
  state.nightMode = enabled;
  if (enabled) {
    document.body.classList.add('night-mode');
    document.body.classList.remove('sepia-mode');
    state.sepiaMode = false;
  } else {
    document.body.classList.remove('night-mode');
  }
  storage.set('night_mode', enabled);
  if (enabled) {
    storage.set('sepia_mode', false);
  }
  updateThemeButtons();
  if (state.mushafMode && state.currentPage) {
    import('./mushaf.js').then(
      (m: { loadPage: (page: number, force?: boolean, isRefresh?: boolean) => Promise<void> }) =>
        m.loadPage(state.currentPage, true, true),
    );
  }
}

export function toggleNightMode(): void {
  applyNightMode(!state.nightMode);
}

/* ===================== SEPIA MODE ===================== */

/** Enable or disable sepia mode and persist the preference. */
export function applySepiaMode(enabled: boolean): void {
  state.sepiaMode = enabled;
  if (enabled) {
    document.body.classList.add('sepia-mode');
    document.body.classList.remove('night-mode');
    state.nightMode = false;
  } else {
    document.body.classList.remove('sepia-mode');
  }
  storage.set('sepia_mode', enabled);
  if (enabled) {
    storage.set('night_mode', false);
  }
  updateThemeButtons();
  if (state.mushafMode && state.currentPage) {
    import('./mushaf.js').then(
      (m: { loadPage: (page: number, force?: boolean, isRefresh?: boolean) => Promise<void> }) =>
        m.loadPage(state.currentPage, true, true),
    );
  }
}

/** Apply a specific theme by name: 'light', 'sepia', or 'night' */
export function applyTheme(theme: 'light' | 'sepia' | 'night'): void {
  if (theme === 'night') {
    applyNightMode(true);
  } else if (theme === 'sepia') {
    applySepiaMode(true);
  } else {
    applyNightMode(false);
    applySepiaMode(false);
  }
}

/** Update the active state of theme buttons in the header */
function updateThemeButtons(): void {
  const buttons = document.querySelectorAll('.theme-btn');
  buttons.forEach((btn) => {
    const btnTheme = (btn as HTMLElement).dataset['theme'] as string;
    let isActive = false;
    if (btnTheme === 'light' && !state.nightMode && !state.sepiaMode) {
      isActive = true;
    }
    if (btnTheme === 'sepia' && state.sepiaMode) {
      isActive = true;
    }
    if (btnTheme === 'night' && state.nightMode) {
      isActive = true;
    }
    btn.classList.toggle('active', isActive);
  });
}

/* ===================== SYSTEM THEME DETECTION ===================== */

/** Detect system color-scheme preference and apply it if user hasn't set a preference. */
export function initSystemThemeDetection(): void {
  // If user already has an explicit preference, don't override
  const hasExplicitPref = storage.get('night_mode') !== undefined && storage.get('night_mode') !== null;
  if (hasExplicitPref) {
    return;
  }

  const mql = window.matchMedia('(prefers-color-scheme: dark)');

  function applySystemTheme(e: MediaQueryListEvent | MediaQueryList): void {
    // Only apply if user hasn't set an explicit preference
    const stillNoPref = storage.get('night_mode') === undefined || storage.get('night_mode') === null;
    if (!stillNoPref) {
      return;
    }

    if (e.matches) {
      if (!document.body.classList.contains('night-mode')) {
        document.body.classList.add('night-mode');
        state.nightMode = true;
      }
    } else {
      if (document.body.classList.contains('night-mode')) {
        document.body.classList.remove('night-mode');
        state.nightMode = false;
      }
    }
    // Update the theme toggle icon
    const checkbox = dom.themeToggle?.querySelector('.theme-switch-check') as HTMLInputElement | null;
    if (checkbox) {
      checkbox.checked = e.matches;
    }
    if (dom.themeToggle) {
      dom.themeToggle.setAttribute('aria-checked', String(e.matches));
    }
  }

  // Apply initial system preference
  applySystemTheme(mql);

  // Listen for changes
  if (mql.addEventListener) {
    mql.addEventListener('change', applySystemTheme);
  } else if (mql.addListener) {
    // Deprecated but kept for older browsers
    mql.addListener(applySystemTheme as (ev: MediaQueryListEvent) => void);
  }
}

/* ===================== FONT TYPE ===================== */

/** Apply a specific font family to the ayahs container and persist it. */
export function applyFontType(type: string): void {
  state.fontType = type;
  const container = document.querySelector('.ayahs-container') as HTMLElement | null;
  if (container) {
    container.style.fontFamily = type;
  }
  storage.set('font_type', type);
  if (dom.fontTypeSelect) {
    dom.fontTypeSelect.value = type;
  }
}

/* ===================== LINE SPACING ===================== */

/** Apply a specific line-height to the ayahs container and persist it. */
export function applyLineSpacing(spacing: string): void {
  state.lineSpacing = spacing;
  const container = document.querySelector('.ayahs-container') as HTMLElement | null;
  if (container) {
    container.style.lineHeight = spacing;
  }
  storage.set('line_spacing', spacing);
  if (dom.lineSpacingSelect) {
    dom.lineSpacingSelect.value = spacing;
  }
}

/* ===================== PRESENTATION BACKGROUND ===================== */

/** Apply a presentation background mode and persist it. */
export function applyPresBgMode(mode: 'plain' | 'nature' | 'singleNature' | 'auto' | 'animated' | 'scene'): void {
  state.presBgMode = mode;
  storage.set('pres_bg_mode', mode);
  if (dom.presBgSelect) {
    dom.presBgSelect.value = mode;
  }
  // Show/hide sub-selectors
  if (dom.presBgSceneRow) {
    dom.presBgSceneRow.classList.toggle('hidden', mode !== 'scene');
  }
  if (dom.presBgNatureRow) {
    dom.presBgNatureRow.classList.toggle('hidden', mode !== 'singleNature');
  }
  // Update presentation display if active
  if (state.presentationMode) {
    import('./presentation.js').then((p: { syncPresentation: () => void }) => p.syncPresentation());
  }
}

/** Apply a specific animated scene and persist it. */
export function applyPresBgScene(scene: string): void {
  state.presBgScene = scene;
  storage.set('pres_bg_scene', scene);
  if (dom.presBgSceneSelect) {
    dom.presBgSceneSelect.value = scene;
  }
  // Update presentation display if currently in scene mode
  if (state.presentationMode && state.presBgMode === 'scene') {
    import('./presentation.js').then((p: { syncPresentation: () => void }) => p.syncPresentation());
  }
}

/** Apply a specific nature background and persist it. */
export function applyPresBgNature(nature: string): void {
  state.presBgNature = nature;
  storage.set('pres_bg_nature', nature);
  if (dom.presBgNatureSelect) {
    dom.presBgNatureSelect.value = nature;
  }
  // Update presentation display if currently in singleNature mode
  if (state.presentationMode && state.presBgMode === 'singleNature') {
    import('./presentation.js').then((p: { syncPresentation: () => void }) => p.syncPresentation());
  }
}

/* ===================== SETTINGS TABS ===================== */

/** Initialize settings tab switching. */
export function initSettingsTabs(): void {
  try {
    const tabsContainer = dom.settingsPanel?.querySelector('#settingsTabs') as HTMLElement | null;
    if (!tabsContainer) {
      return;
    }
    const tabs = tabsContainer.querySelectorAll('.settings-tab');
    tabs.forEach((tab: Element) => {
      tab.addEventListener('click', () => {
        const tabName = (tab as HTMLElement).dataset['tab'];
        tabs.forEach((t: Element) => t.classList.remove('active'));
        tab.classList.add('active');
        const contents = dom.settingsPanel?.querySelectorAll('.settings-tab-content');
        contents?.forEach((c: Element) => c.classList.remove('active'));
        const target = dom.settingsPanel?.querySelector(
          `.settings-tab-content[data-tab="${tabName}"]`,
        ) as HTMLElement | null;
        if (target) {
          target.classList.add('active');
        }
      });
    });
  } catch (e: unknown) {
    console.warn('initSettingsTabs error:', e);
  }
}

/* ===================== SETTINGS PANEL ===================== */

/** Open the settings panel and render adhkar settings list. */
export function openSettings(): void {
  if (!dom.settingsPanel) {
    console.warn('settingsPanel not found');
    return;
  }
  dom.settingsPanel.classList.add('open');
  renderAdhkarSettingsList();
}

/** Close the settings panel and stop azan if playing. */
export function closeSettings(): void {
  dom.settingsPanel?.classList.remove('open');
  if (state.azanPlaying) {
    stopAzan();
  }
}

/** Save city/country/method and reload prayer times. */
export function saveLocationSettings(): void {
  const city = dom.cityInput?.value.trim();
  const country = dom.countryInput?.value.trim();
  if (!city || !country) {
    showToast(__('save_location'), 'error');
    return;
  }
  state.city = city;
  state.country = country;
  state.method = dom.methodSelect?.value || '4';
  storage.set('city', city);
  storage.set('country', country);
  storage.set('method', state.method);
  loadPrayerTimes();
  showToast(__('save_location'), 'success');
}

/** Reset all settings to defaults and reload the page. */
export function resetSettings(): void {
  // Custom confirmation modal instead of browser confirm()
  const existing = document.getElementById('resetConfirmModal');
  if (existing) {
    existing.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'resetConfirmModal';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';

  const modal = document.createElement('div');
  modal.style.cssText =
    'background:var(--bg-primary,#fff);border-radius:16px;padding:24px;min-width:280px;max-width:90vw;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.3);';

  const title = document.createElement('h3');
  title.style.cssText = 'margin:0 0 12px;color:var(--text-primary);';
  title.textContent = __('reset_settings');

  const msg = document.createElement('p');
  msg.style.cssText = 'margin:0 0 20px;color:var(--text-secondary,#666);font-size:14px;';
  msg.textContent = __('confirm_reset');

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:center;';

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = __('reset_settings');
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
    const keys = [
      'font_size',
      'night_mode',
      'sepia_mode',
      'city',
      'country',
      'method',
      'azan_enabled',
      'azan_fajr_enabled',
      'auto_save',
      'reciter',
      'tafsir_edition',
      'bar_collapsed',
      'player_collapsed',
      'playback_speed',
      'lang',
      'surah_list',
      'translation_enabled',
      'translation_edition',
      'last_position',
      'bookmark',
      'favorites',
      'mushaf_mode',
      'current_page',
      'search_history',
      'adhkar_settings',
      'font_type',
      'line_spacing',
      'tajweed_enabled',
      'pres_bg_mode',
      'pres_bg_scene',
      'pres_bg_nature',
      'reading_stats',
    ];
    keys.forEach((k: string) => storage.remove(k));
    storage.remove('night_mode_set_by_user');
    showToast(__('reset_settings'), 'success');
    setTimeout(() => location.reload(), 1500);
  });

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e: MouseEvent) => {
    if (e.target === overlay) {
      close();
    }
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);
  modal.appendChild(title);
  modal.appendChild(msg);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  cancelBtn.focus();
}

/** Export all settings as a downloadable JSON file. */
export function exportSettings(): void {
  const keys = [
    'font_size',
    'night_mode',
    'sepia_mode',
    'city',
    'country',
    'method',
    'azan_enabled',
    'azan_fajr_enabled',
    'auto_save',
    'reciter',
    'tafsir_edition',
    'bar_collapsed',
    'player_collapsed',
    'playback_speed',
    'lang',
    'translation_enabled',
    'translation_edition',
    'favorites',
    'bookmark',
    'last_position',
    'mushaf_mode',
    'current_page',
    'adhkar_settings',
    'search_history',
    'font_type',
    'line_spacing',
    'tajweed_enabled',
    'pres_bg_mode',
    'pres_bg_scene',
    'pres_bg_nature',
    'reading_stats',
  ];
  const data: Record<string, unknown> = {};
  keys.forEach((k: string) => {
    data[k] = storage.get(k);
  });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'quran-app-settings.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast(__('success'), 'success');
}

/** Allowlist of valid setting keys for import validation. */
const ALLOWED_SETTINGS_KEYS: Set<string> = new Set([
  'font_size',
  'night_mode',
  'city',
  'country',
  'method',
  'azan_enabled',
  'azan_fajr_enabled',
  'auto_save',
  'reciter',
  'tafsir_edition',
  'bar_collapsed',
  'player_collapsed',
  'playback_speed',
  'lang',
  'translation_enabled',
  'translation_edition',
  'favorites',
  'bookmark',
  'last_position',
  'mushaf_mode',
  'current_page',
  'adhkar_settings',
  'search_history',
  'font_type',
  'line_spacing',
  'tajweed_enabled',
  'night_mode_set_by_user',
  'surah_list',
  'pres_bg_mode',
  'pres_bg_scene',
  'pres_bg_nature',
  'sepia_mode',
  'reading_stats',
]);

/** Type validators for setting keys — ensures imported values match expected types. */
const SETTING_TYPE_VALIDATORS: Record<string, (v: unknown) => boolean> = {
  font_size: (v) => typeof v === 'number',
  night_mode: (v) => typeof v === 'boolean',
  city: (v) => typeof v === 'string',
  country: (v) => typeof v === 'string',
  method: (v) => typeof v === 'string',
  azan_enabled: (v) => typeof v === 'boolean',
  azan_fajr_enabled: (v) => typeof v === 'boolean',
  auto_save: (v) => typeof v === 'boolean',
  reciter: (v) => typeof v === 'string',
  tafsir_edition: (v) => typeof v === 'string',
  bar_collapsed: (v) => typeof v === 'boolean',
  player_collapsed: (v) => typeof v === 'boolean',
  playback_speed: (v) => typeof v === 'string',
  lang: (v) => typeof v === 'string',
  translation_enabled: (v) => typeof v === 'boolean',
  translation_edition: (v) => typeof v === 'string',
  favorites: (v) => Array.isArray(v),
  bookmark: (v) => v === null || typeof v === 'object',
  last_position: (v) => typeof v === 'string' || typeof v === 'number',
  mushaf_mode: (v) => typeof v === 'boolean',
  current_page: (v) => typeof v === 'number',
  adhkar_settings: (v) => typeof v === 'object' && v !== null,
  search_history: (v) => Array.isArray(v),
  font_type: (v) => typeof v === 'string',
  line_spacing: (v) => typeof v === 'string',
  tajweed_enabled: (v) => typeof v === 'boolean',
  night_mode_set_by_user: (v) => typeof v === 'boolean',
  surah_list: (v) => Array.isArray(v),
  pres_bg_mode: (v) =>
    typeof v === 'string' && ['plain', 'nature', 'singleNature', 'auto', 'animated', 'scene'].includes(v),
  pres_bg_scene: (v) => typeof v === 'string' && ['stars', 'waves', 'aurora', 'particles', 'rain'].includes(v),
  pres_bg_nature: (v) => typeof v === 'string' && ['dawn', 'morning', 'afternoon', 'sunset', 'night'].includes(v),
  sepia_mode: (v) => typeof v === 'boolean',
  reading_stats: (v) => typeof v === 'object' && v !== null,
};

/** Import settings from a JSON file. */
export function importSettings(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev: ProgressEvent<FileReader>) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as Record<string, unknown>;
        let imported = 0;
        let _skipped = 0;
        Object.entries(data).forEach(([k, v]: [string, unknown]) => {
          if (v !== null && v !== undefined && ALLOWED_SETTINGS_KEYS.has(k)) {
            const validator = SETTING_TYPE_VALIDATORS[k];
            if (validator && !validator(v)) {
              _skipped++;
              return;
            }
            storage.set(k, v);
            imported++;
          } else {
            _skipped++;
          }
        });
        showToast(`${__('success')} ${__('settings_imported', String(imported))}`, 'success');
        setTimeout(() => location.reload(), 1500);
      } catch {
        showToast(__('error_invalid_data'), 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

/* ===================== RESTORE SETTINGS ===================== */

/** Restore all settings from localStorage into the state object and update UI. */
export function restoreSettings(): void {
  const fs = storage.get<number>('font_size');
  if (fs) {
    applyFontSize(fs);
  }
  const nm = storage.get<boolean>('night_mode');
  if (nm === true) {
    applyNightMode(true);
  }
  const sm = storage.get<boolean>('sepia_mode');
  if (sm === true) {
    applySepiaMode(true);
  }
  const city = storage.get<string>('city');
  if (city) {
    state.city = city;
  }
  const country = storage.get<string>('country');
  if (country) {
    state.country = country;
  }
  const method = storage.get<string>('method');
  if (method) {
    state.method = method;
  }
  const azan = storage.get<boolean>('azan_enabled');
  if (azan !== undefined && azan !== null) {
    state.azanEnabled = azan;
  }
  const azanFajr = storage.get<boolean>('azan_fajr_enabled');
  if (azanFajr !== undefined && azanFajr !== null) {
    state.azanFajrEnabled = azanFajr;
  }
  const as = storage.get<boolean>('auto_save');
  if (as === false) {
    state.autoSave = false;
  }
  const rec = storage.get<string>('reciter');
  if (rec) {
    state.currentReciter = rec;
  }
  const taf = storage.get<string>('tafsir_edition');
  if (taf) {
    state.currentTafsirEdition = taf;
  }
  const bar = storage.get<boolean>('bar_collapsed');
  if (bar === false) {
    state.barCollapsed = false;
  }
  const transEnabled = storage.get<boolean>('translation_enabled');
  if (transEnabled) {
    state.translationEnabled = true;
  }
  const transEdition = storage.get<string>('translation_edition');
  if (transEdition) {
    state.currentTranslation = transEdition;
  }

  if (dom.cityInput) {
    dom.cityInput.value = state.city;
  }
  if (dom.countryInput) {
    dom.countryInput.value = state.country;
  }
  if (dom.methodSelect) {
    dom.methodSelect.value = state.method;
  }
  if (dom.azanToggle) {
    dom.azanToggle.classList.toggle('on', state.azanEnabled);
  }
  if (dom.azanFajrToggle) {
    dom.azanFajrToggle.classList.toggle('on', state.azanFajrEnabled);
  }
  if (dom.autoSaveToggle) {
    dom.autoSaveToggle.classList.toggle('on', state.autoSave);
  }
  if (dom.reciterSelect) {
    dom.reciterSelect.value = state.currentReciter;
  }
  if (dom.tafsirSelect) {
    dom.tafsirSelect.value = state.currentTafsirEdition;
  }
  if (dom.translationSelect) {
    if (state.translationEnabled && state.currentTranslation) {
      dom.translationSelect.value = state.currentTranslation;
    } else {
      dom.translationSelect.value = '';
    }
  }
  if (dom.fontSizeSelect) {
    dom.fontSizeSelect.value = String(state.fontSize);
  }
  const ft = storage.get<string>('font_type');
  if (ft) {
    applyFontType(ft);
  }
  const ls = storage.get<string>('line_spacing');
  if (ls) {
    applyLineSpacing(ls);
  }
  const speed = storage.get<string>('playback_speed');
  if (speed && dom.speedSelect && dom.audioPlayer) {
    dom.speedSelect.value = speed;
    dom.audioPlayer.playbackRate = parseFloat(speed);
  }
  const tajweed = storage.get<boolean>('tajweed_enabled');
  if (tajweed === false) {
    state.tajweedEnabled = false;
    if (dom.tajweedToggle) {
      dom.tajweedToggle.classList.remove('on');
    }
  } else {
    state.tajweedEnabled = true;
    if (dom.tajweedToggle) {
      dom.tajweedToggle.classList.add('on');
    }
  }
  const presBg = storage.get<string>('pres_bg_mode');
  if (
    presBg === 'nature' ||
    presBg === 'singleNature' ||
    presBg === 'auto' ||
    presBg === 'animated' ||
    presBg === 'scene'
  ) {
    applyPresBgMode(presBg);
  }
  const presBgScene = storage.get<string>('pres_bg_scene');
  if (presBgScene && ['stars', 'waves', 'aurora', 'particles', 'rain'].includes(presBgScene)) {
    applyPresBgScene(presBgScene);
  }
  const presBgNature = storage.get<string>('pres_bg_nature');
  if (presBgNature && ['dawn', 'morning', 'afternoon', 'sunset', 'night'].includes(presBgNature)) {
    applyPresBgNature(presBgNature);
  }
  if (!state.barCollapsed && dom.prayerBar) {
    dom.prayerBar.classList.remove('collapsed');
    dom.prayerBar.classList.add('expanded');
  }
}
