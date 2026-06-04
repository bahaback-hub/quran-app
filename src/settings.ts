import { state, AppState, BackgroundEntry } from './state.js';
import { CONFIG } from './config.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { showToast } from './ui.js';
import { stopAzan, loadPrayerTimes } from './prayer.js';
import { renderAdhkarSettingsList } from './adhkar.js';

/* ===================== FONT SIZE ===================== */

/** Apply a specific font size to the ayahs container and persist it. */
export function applyFontSize(size: number): void {
  state.fontSize = size;
  const container = document.querySelector('.ayahs-container') as HTMLElement | null;
  if (container) container.style.fontSize = size + 'px';
  storage.set('font_size', size);
  if (dom.fontSizeSelect) dom.fontSizeSelect.value = String(size);
}

/* ===================== NIGHT MODE ===================== */

/** Enable or disable night mode and persist the preference. */
export function applyNightMode(enabled: boolean): void {
  state.nightMode = enabled;
  if (enabled) document.body.classList.add('night-mode');
  else document.body.classList.remove('night-mode');
  storage.set('night_mode', enabled);
  if (state.mushafMode && state.currentPage) {
    import('./mushaf.js').then((m: { loadPage: (page: number, force?: boolean, isRefresh?: boolean) => Promise<void> }) => m.loadPage(state.currentPage, true, true));
  }
}

export function toggleNightMode(): void { applyNightMode(!state.nightMode); }

/* ===================== SYSTEM THEME DETECTION ===================== */

/** Detect system color-scheme preference and apply it if user hasn't set a preference. */
export function initSystemThemeDetection(): void {
  // If user already has an explicit preference, don't override
  const hasExplicitPref = storage.get('night_mode') !== undefined && storage.get('night_mode') !== null;
  if (hasExplicitPref) return;

  const mql = window.matchMedia('(prefers-color-scheme: dark)');

  function applySystemTheme(e: MediaQueryListEvent | MediaQueryList): void {
    // Only apply if user hasn't set an explicit preference
    const stillNoPref = storage.get('night_mode') === undefined || storage.get('night_mode') === null;
    if (!stillNoPref) return;

    if (e.matches) {
      if (!document.body.classList.contains('night-mode')) {
        document.body.classList.add('night-mode');
        document.body.classList.remove('sepia-mode');
        state.nightMode = true;
      }
    } else {
      if (document.body.classList.contains('night-mode')) {
        document.body.classList.remove('night-mode');
        state.nightMode = false;
      }
    }
    // Update the toggle switch UI if it exists
    const toggle = document.getElementById('settingsThemeToggle') as HTMLElement | null;
    if (toggle) {
      if (e.matches) {
        toggle.classList.add('on');
      } else {
        toggle.classList.remove('on');
      }
      toggle.setAttribute('aria-checked', String(e.matches));
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

/* ===================== SEPIA MODE ===================== */

/** Enable or disable sepia mode and persist the preference. */
export function applySepiaMode(enabled: boolean): void {
  state.sepiaMode = enabled;
  document.body.classList.toggle('sepia-mode', !!enabled);
  storage.set('sepia_mode', enabled);
}

export function toggleSepiaMode(): void { applySepiaMode(!state.sepiaMode); }

/* ===================== FONT TYPE ===================== */

/** Apply a specific font family to the ayahs container and persist it. */
export function applyFontType(type: string): void {
  state.fontType = type;
  const container = document.querySelector('.ayahs-container') as HTMLElement | null;
  if (container) container.style.fontFamily = type;
  storage.set('font_type', type);
  if (dom.fontTypeSelect) dom.fontTypeSelect.value = type;
}

/* ===================== LINE SPACING ===================== */

/** Apply a specific line-height to the ayahs container and persist it. */
export function applyLineSpacing(spacing: string): void {
  state.lineSpacing = spacing;
  const container = document.querySelector('.ayahs-container') as HTMLElement | null;
  if (container) container.style.lineHeight = spacing;
  storage.set('line_spacing', spacing);
  if (dom.lineSpacingSelect) dom.lineSpacingSelect.value = spacing;
}

/* ===================== SETTINGS TABS ===================== */

/** Initialize settings tab switching. */
export function initSettingsTabs(): void {
  try {
    const tabsContainer = dom.settingsPanel?.querySelector('#settingsTabs') as HTMLElement | null;
    if (!tabsContainer) return;
    const tabs = tabsContainer.querySelectorAll('.settings-tab');
    tabs.forEach((tab: Element) => {
      tab.addEventListener('click', () => {
        const tabName = (tab as HTMLElement).dataset.tab;
        tabs.forEach((t: Element) => t.classList.remove('active'));
        tab.classList.add('active');
        const contents = dom.settingsPanel?.querySelectorAll('.settings-tab-content');
        contents?.forEach((c: Element) => c.classList.remove('active'));
        const target = dom.settingsPanel?.querySelector(`.settings-tab-content[data-tab="${tabName}"]`) as HTMLElement | null;
        if (target) target.classList.add('active');
      });
    });
  } catch (e: unknown) { console.warn('initSettingsTabs error:', e); }
}

/* ===================== SETTINGS PANEL ===================== */

/** Open the settings panel and render adhkar settings list. */
export function openSettings(): void {
  if (!dom.settingsPanel) { console.warn('settingsPanel not found'); return; }
  dom.settingsPanel.classList.add('open');
  renderAdhkarSettingsList();
}

/** Close the settings panel and stop azan if playing. */
export function closeSettings(): void {
  dom.settingsPanel?.classList.remove('open');
  if (state.azanPlaying) stopAzan();
}

/** Save city/country/method and reload prayer times. */
export function saveLocationSettings(): void {
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
export function resetSettings(): void {
  // Custom confirmation modal instead of browser confirm()
  const existing = document.getElementById('resetConfirmModal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'resetConfirmModal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:var(--bg-primary,#fff);border-radius:16px;padding:24px;min-width:280px;max-width:90vw;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.3);';

  const title = document.createElement('h3');
  title.style.cssText = 'margin:0 0 12px;color:var(--text-primary);';
  title.textContent = '⚠️ إعادة ضبط الإعدادات';

  const msg = document.createElement('p');
  msg.style.cssText = 'margin:0 0 20px;color:var(--text-secondary,#666);font-size:14px;';
  msg.textContent = 'هل تريد إعادة ضبط جميع الإعدادات إلى القيم الافتراضية؟ سيتم حذف جميع التفضيلات المحفوظة.';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:center;';

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = '🔄 إعادة ضبط';
  confirmBtn.style.cssText = 'flex:1;padding:10px 20px;border:none;border-radius:8px;background:#e74c3c;color:#fff;font-size:14px;cursor:pointer;font-family:inherit;';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '❌ إلغاء';
  cancelBtn.style.cssText = 'flex:1;padding:10px 20px;border:none;border-radius:8px;background:var(--border-soft,#eee);color:var(--text-primary);font-size:14px;cursor:pointer;font-family:inherit;';

  function close(): void { overlay.remove(); }

  confirmBtn.addEventListener('click', () => {
    const keys = ['font_size', 'night_mode', 'city', 'country', 'method', 'azan_enabled', 'azan_fajr_enabled', 'auto_save', 'reciter', 'tafsir_edition', 'bar_collapsed', 'player_collapsed', 'bg_id', 'playback_speed', 'lang', 'surah_list', 'translation_enabled', 'translation_edition', 'last_position', 'bookmark', 'favorites', 'mushaf_mode', 'current_page', 'search_history', 'adhkar_settings'];
    keys.forEach((k: string) => storage.remove(k));
    storage.remove('night_mode_set_by_user');
    showToast('✅ تم إعادة الضبط. جارٍ تحديث الصفحة...', 'success');
    setTimeout(() => location.reload(), 1500);
  });

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e: MouseEvent) => { if (e.target === overlay) close(); });

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
  const keys = ['font_size', 'night_mode', 'city', 'country', 'method', 'azan_enabled', 'azan_fajr_enabled', 'auto_save', 'reciter', 'tafsir_edition', 'bar_collapsed', 'player_collapsed', 'bg_id', 'playback_speed', 'lang', 'translation_enabled', 'translation_edition', 'favorites', 'bookmark', 'last_position', 'mushaf_mode', 'current_page', 'adhkar_settings', 'search_history'];
  const data: Record<string, unknown> = {};
  keys.forEach((k: string) => { data[k] = storage.get(k); });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'quran-app-settings.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ تم تصدير الإعدادات', 'success');
}

/** Allowlist of valid setting keys for import validation. */
const ALLOWED_SETTINGS_KEYS: Set<string> = new Set([
  'font_size', 'night_mode', 'city', 'country', 'method',
  'azan_enabled', 'azan_fajr_enabled', 'auto_save', 'reciter',
  'tafsir_edition', 'bar_collapsed', 'player_collapsed', 'bg_id',
  'playback_speed', 'lang', 'translation_enabled', 'translation_edition',
  'favorites', 'bookmark', 'last_position', 'mushaf_mode', 'current_page',
  'adhkar_settings', 'search_history', 'sepia_mode', 'font_type',
  'line_spacing', 'tajweed_enabled', 'night_mode_set_by_user', 'surah_list'
]);

/** Import settings from a JSON file. */
export function importSettings(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev: ProgressEvent<FileReader>) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as Record<string, unknown>;
        let imported = 0;
        let skipped = 0;
        Object.entries(data).forEach(([k, v]: [string, unknown]) => {
          if (v !== null && v !== undefined && ALLOWED_SETTINGS_KEYS.has(k)) {
            storage.set(k, v);
            imported++;
          } else {
            skipped++;
          }
        });
        showToast(`✅ تم استيراد ${imported} إعداد${skipped ? ` (${skipped} مُتجاهل)` : ''}. جارٍ التحديث...`, 'success');
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

/** Load the backgrounds list from a JSON file and populate the background select. */
export async function loadBackgrounds(): Promise<void> {
  try {
    const res = await fetch('data/backgrounds.json');
    state.backgroundsList = await res.json() as BackgroundEntry[];
    if (dom.bgSelect) {
      dom.bgSelect.innerHTML = '';
      state.backgroundsList.forEach((bg: BackgroundEntry) => {
        const opt = document.createElement('option');
        opt.value = bg.id;
        opt.textContent = bg.name;
        dom.bgSelect!.appendChild(opt);
      });
      const savedBg = storage.get<string>('bg_id');
      if (savedBg) applyBackground(savedBg);
    }
  } catch (e: unknown) { console.warn('فشل تحميل قائمة الخلفيات', e); }
}

function removeBgClasses(): void {
  document.body.className = document.body.className
    .split(/\s+/).filter((c: string) => !c.startsWith('bg-css')).join(' ').trim();
}

/** Apply a background by ID, or remove it if 'none'. */
export function applyBackground(bgId: string): void {
  if (!bgId || bgId === 'none') {
    document.body.style.backgroundImage = '';
    removeBgClasses();
    const style = document.getElementById('dynamic-bg-style');
    if (style) style.remove();
    storage.remove('bg_id');
    if (dom.bgSelect) dom.bgSelect.value = 'none';
    return;
  }
  const bg = state.backgroundsList?.find((b: BackgroundEntry) => b.id === bgId);
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
export function restoreSettings(): void {
  const fs = storage.get<number>('font_size'); if (fs) applyFontSize(fs);
  const nm = storage.get<boolean>('night_mode');
  if (nm === true) {
    applyNightMode(true);
  }
  const city = storage.get<string>('city'); if (city) state.city = city;
  const country = storage.get<string>('country'); if (country) state.country = country;
  const method = storage.get<string>('method'); if (method) state.method = method;
  const azan = storage.get<boolean>('azan_enabled'); if (azan === false) state.azanEnabled = false;
  const azanFajr = storage.get<boolean>('azan_fajr_enabled'); if (azanFajr === false) state.azanFajrEnabled = false;
  const as = storage.get<boolean>('auto_save'); if (as === false) state.autoSave = false;
  const rec = storage.get<string>('reciter'); if (rec) state.currentReciter = rec;
  const taf = storage.get<string>('tafsir_edition'); if (taf) state.currentTafsirEdition = taf;
  const bar = storage.get<boolean>('bar_collapsed'); if (bar === false) state.barCollapsed = false;
  const transEnabled = storage.get<boolean>('translation_enabled'); if (transEnabled) state.translationEnabled = true;
  const transEdition = storage.get<string>('translation_edition'); if (transEdition) state.currentTranslation = transEdition;

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
  if (dom.fontSizeSelect) dom.fontSizeSelect.value = String(state.fontSize);
  const sepia = storage.get<boolean>('sepia_mode'); if (sepia) applySepiaMode(true);
  const ft = storage.get<string>('font_type'); if (ft) applyFontType(ft);
  const ls = storage.get<string>('line_spacing'); if (ls) applyLineSpacing(ls);
  const speed = storage.get<string>('playback_speed');
  if (speed && dom.speedSelect && dom.audioPlayer) { dom.speedSelect.value = speed; dom.audioPlayer.playbackRate = parseFloat(speed); }
  const tajweed = storage.get<boolean>('tajweed_enabled');
  if (tajweed === false) { state.tajweedEnabled = false; if (dom.tajweedToggle) dom.tajweedToggle.classList.remove('on'); }
  else { state.tajweedEnabled = true; if (dom.tajweedToggle) dom.tajweedToggle.classList.add('on'); }
  if (!state.barCollapsed && dom.prayerBar) {
    dom.prayerBar.classList.remove('collapsed');
    dom.prayerBar.classList.add('expanded');
  }
}
