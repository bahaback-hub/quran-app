/**
 * Header, settings, display and location event bindings (theme dropdown,
 * settings panel, mushaf data-pack panel, display controls, geolocation).
 *
 * Split from app-events.ts for maintainability; re-exported through its barrel.
 */
import { dom } from '../dom.js';
import { storage } from '../storage.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { __, AVAILABLE_LANGUAGES, getLang, setLang } from '../i18n.js';
import type { LangCode } from '../i18n.js';
import {
  applyFontSize,
  applyReaderSurfaceTransparency,
  changeReaderZoom,
  updateReaderZoomControl,
  applyTheme,
  updateThemeTriggerIcon,
  applyFontType,
  applyLineSpacing,
  applyPresBgMode,
  applyPresBgScene,
  applyPresBgNature,
  applyPresBgVideo,
  openSettings,
  closeSettings,
  saveLocationSettings,
  resetSettings,
  exportSettings,
  importSettings,
  initSettingsTabs,
} from '../settings.js';
import {
  deleteMushafDataPack,
  downloadMushafDataPack,
  formatMushafDataBytes,
  getMushafDataPackStatus,
  verifyMushafDataPack,
} from '../features/mushaf/mushaf-data-pack.js';
import { testAzan, stopAzan, scheduleNextAzanCheck } from '../features/prayer/prayer.js';
import { openHelp } from './help-events.js';
import { CHECK_UPDATES_EVENT } from '../app-updates.js';
import { setTvMode } from '../tv-nav.js';
import { setPointerMode } from '../pointer-nav.js';
import { loadTajweedAnnotationsForSurah } from '../tajweed-data.js';
import { loadSurah } from '../surah-loader.js';
import { warnRecoverable } from '../error-boundary.js';

/**
 * Bind theme and settings buttons.
 */
const READER_TOOLBAR_PIN_KEY = 'reader_toolbar_pinned';

/** Keep the reading toolbar visible while a long surah is being read when the user requests it. */
function applyReaderToolbarPin(pinned: boolean): void {
  const shell = document.getElementById('readerToolbarShell');
  const button = dom.readerToolbarPinBtn;
  if (!shell || !button) {
    return;
  }
  const label = pinned ? 'إلغاء تثبيت أدوات القراءة' : 'تثبيت أدوات القراءة';
  shell.classList.toggle('is-pinned', pinned);
  document.body.classList.toggle('reader-toolbar-pinned', pinned);
  button.classList.toggle('is-active', pinned);
  button.setAttribute('aria-pressed', String(pinned));
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);
  const icon = button.querySelector('[aria-hidden="true"]');
  if (icon) {
    icon.textContent = pinned ? '🔒' : '🔓';
  }
}

function initReaderToolbarPin(): void {
  const pinned = storage.get<boolean>(READER_TOOLBAR_PIN_KEY, false) === true;
  applyReaderToolbarPin(pinned);
  dom.readerToolbarPinBtn?.addEventListener('click', () => {
    const nextPinned = !document.getElementById('readerToolbarShell')?.classList.contains('is-pinned');
    storage.set(READER_TOOLBAR_PIN_KEY, nextPinned);
    applyReaderToolbarPin(nextPinned);
  });
}

/** Bind the compact reader-surface popover beside Settings. */
function initReaderSurfaceControl(): void {
  dom.readerSurfaceSlider?.addEventListener('input', () => {
    applyReaderSurfaceTransparency(Number(dom.readerSurfaceSlider!.value));
  });

  const control = dom.readerSurfaceControl;
  const trigger = dom.readerSurfaceToggle;
  const popover = dom.readerSurfacePopover;
  if (!control || !trigger || !popover) {
    return;
  }
  const close = () => {
    popover.classList.add('hidden');
    trigger.setAttribute('aria-expanded', 'false');
  };
  trigger.addEventListener('click', (event: MouseEvent) => {
    event.stopPropagation();
    const wasHidden = popover.classList.toggle('hidden');
    trigger.setAttribute('aria-expanded', String(!wasHidden));
  });
  document.addEventListener('click', (event: MouseEvent) => {
    if (!control.contains(event.target as Node)) {
      close();
    }
  });
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      close();
      trigger.focus();
    }
  });
}

export function bindHeaderAndSettingsEvents(): void {
  initReaderToolbarPin();
  initReaderSurfaceControl();

  // ── Theme dropdown ──────────────────────────────────────────────────────
  // Trigger button opens/closes the dropdown; clicking a theme-btn inside
  // applies the theme and closes the dropdown. Keyboard: Enter/Space on the
  // trigger toggles the menu; Escape closes it; ArrowUp/ArrowDown move focus
  // between the four theme options.
  dom.themeMenuBtn?.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    const expanded = dom.themeToggle?.classList.toggle('open') ?? false;
    dom.themeMenuBtn!.setAttribute('aria-expanded', String(expanded));
  });

  dom.themeMenuBtn?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      const expanded = dom.themeToggle?.classList.contains('open');
      if (expanded) {
        dom.themeToggle?.classList.remove('open');
        dom.themeMenuBtn!.setAttribute('aria-expanded', 'false');
      } else {
        dom.themeToggle?.classList.add('open');
        dom.themeMenuBtn!.setAttribute('aria-expanded', 'true');
        // Focus the first theme button inside the dropdown
        const firstBtn = dom.themeDropdownMenu?.querySelector<HTMLButtonElement>('.theme-btn');
        firstBtn?.focus();
      }
    }
  });

  dom.themeToggle?.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('.theme-btn') as HTMLElement | null;
    if (btn?.dataset['theme']) {
      e.preventDefault();
      e.stopPropagation();
      applyTheme(btn.dataset['theme'] as 'light' | 'sepia' | 'night' | 'deep-night');
      dom.themeToggle?.classList.remove('open');
      dom.themeMenuBtn?.setAttribute('aria-expanded', 'false');
      // Update the trigger icon to reflect the newly selected theme
      updateThemeTriggerIcon();
    }
  });

  dom.themeToggle?.addEventListener('keydown', (e: KeyboardEvent) => {
    // Escape closes the dropdown and returns focus to the trigger button
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      dom.themeToggle?.classList.remove('open');
      dom.themeMenuBtn?.setAttribute('aria-expanded', 'false');
      dom.themeMenuBtn?.focus();
      return;
    }
    // Arrow keys move focus between the four theme-btn options inside the menu
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      const buttons = Array.from(dom.themeDropdownMenu?.querySelectorAll<HTMLButtonElement>('.theme-btn') ?? []);
      if (buttons.length === 0) {
        return;
      }
      const currentFocused = buttons.findIndex((b) => b === document.activeElement);
      const nextIndex =
        e.key === 'ArrowDown' ? Math.min(currentFocused + 1, buttons.length - 1) : Math.max(currentFocused - 1, 0);
      const nextBtn = buttons[nextIndex];
      if (nextBtn) {
        nextBtn.focus();
      }
    }
  });

  // ── Settings button ─────────────────────────────────────────────────────
  dom.settingsToggleBtn?.addEventListener('click', () => {
    if (dom.settingsPanel?.classList.contains('open')) {
      closeSettings();
      return;
    }
    openSettings();
  });
  dom.settingsCloseBtn?.addEventListener('click', closeSettings);
  dom.saveLocationBtn?.addEventListener('click', saveLocationSettings);
  dom.useLocationBtn?.addEventListener('click', useMyLocation);
  dom.autoLocationToggle?.addEventListener('change', () => {
    state.autoLocation = dom.autoLocationToggle!.checked;
    storage.set('auto_location', state.autoLocation);
  });
  dom.testAzanBtn?.addEventListener('click', testAzan);
  dom.azanNotifStopBtn?.addEventListener('click', stopAzan);
  // welcome screen removed
  dom.resetSettingsBtn?.addEventListener('click', resetSettings);
  document.getElementById('exportSettingsBtn')?.addEventListener('click', () => exportSettings());
  document.getElementById('importSettingsBtn')?.addEventListener('click', () => importSettings());
  // App version label + manual update check (handled in main.ts via event).
  const versionLabel = document.getElementById('appVersionLabel');
  if (versionLabel) {
    try {
      versionLabel.textContent = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '';
    } catch {
      versionLabel.textContent = '';
    }
  }
  document.getElementById('checkUpdatesBtn')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent(CHECK_UPDATES_EVENT));
  });
  document.getElementById('helpFromSettingsBtn')?.addEventListener('click', () => {
    closeSettings();
    openHelp();
  });
  bindMushafDataPackEvents();
  initSettingsTabs();
}

function bindMushafDataPackEvents(): void {
  const status = document.getElementById('mushafDataPackStatus');
  const downloadButton = document.getElementById('downloadMushafDataPackBtn') as HTMLButtonElement | null;
  const verifyButton = document.getElementById('verifyMushafDataPackBtn') as HTMLButtonElement | null;
  const deleteButton = document.getElementById('deleteMushafDataPackBtn') as HTMLButtonElement | null;
  if (!status || !downloadButton || !verifyButton || !deleteButton) {
    return;
  }

  const setBusy = (busy: boolean) => {
    downloadButton.disabled = busy;
    verifyButton.disabled = busy;
    deleteButton.disabled = busy;
  };
  const refresh = async () => {
    const pack = await getMushafDataPackStatus();
    const completePack = pack.installed && pack.fontsIncluded;
    status.textContent = completePack
      ? `${__('mushaf_data_pack_installed')} (${formatMushafDataBytes(pack.totalBytes)})`
      : __('mushaf_data_pack_not_installed');
    verifyButton.disabled = !completePack;
    deleteButton.disabled = !pack.installed;
  };
  void refresh();

  downloadButton.addEventListener('click', async () => {
    setBusy(true);
    let failed = false;
    try {
      await downloadMushafDataPack((progress) => {
        status.textContent = `${__('mushaf_data_pack_downloading')} ${progress.completed}/${progress.total}`;
      });
      status.textContent = __('mushaf_data_pack_verified');
      showToast(__('mushaf_data_pack_verified'), 'success');
    } catch (err: unknown) {
      // Surface the reason. The download aborts on the first failed file (a
      // stale manifest digest, a CDN HTTP error, a per-file hash mismatch), and
      // without this the user only ever saw the button spring back with no clue.
      warnRecoverable('mushaf data pack download failed', err);
      failed = true;
      status.textContent = __('mushaf_data_pack_failed');
      showToast(__('mushaf_data_pack_failed'), 'error');
    } finally {
      setBusy(false);
      // refresh() rewrites the status from stored state, so only let it run on
      // success — otherwise it erases the failure message set just above.
      if (!failed) {
        await refresh();
      }
    }
  });

  verifyButton.addEventListener('click', async () => {
    setBusy(true);
    try {
      const valid = await verifyMushafDataPack((progress) => {
        status.textContent = `${__('mushaf_data_pack_verify')} ${progress.completed}/${progress.total}`;
      });
      status.textContent = valid ? __('mushaf_data_pack_verified') : __('mushaf_data_pack_failed');
      showToast(valid ? __('mushaf_data_pack_verified') : __('mushaf_data_pack_failed'), valid ? 'success' : 'error');
    } finally {
      setBusy(false);
      await refresh();
    }
  });

  deleteButton.addEventListener('click', async () => {
    setBusy(true);
    try {
      await deleteMushafDataPack();
      showToast(__('mushaf_data_pack_deleted'), 'success');
    } finally {
      setBusy(false);
      await refresh();
    }
  });
}

/**
 * Bind display settings: font size, type, spacing, sepia, tajweed, toggles.
 */
export function bindDisplaySettingsEvents(): void {
  dom.fontSizeSelect?.addEventListener('change', (e: Event) =>
    applyFontSize(parseInt((e.target as HTMLSelectElement).value, 10)),
  );
  dom.readerZoomOutBtn?.addEventListener('click', () => changeReaderZoom(-1));
  dom.readerZoomInBtn?.addEventListener('click', () => changeReaderZoom(1));
  updateReaderZoomControl();
  dom.fontTypeSelect?.addEventListener('change', (e: Event) => applyFontType((e.target as HTMLSelectElement).value));
  dom.lineSpacingSelect?.addEventListener('change', (e: Event) =>
    applyLineSpacing((e.target as HTMLSelectElement).value),
  );
  dom.presBgSelect?.addEventListener('change', (e: Event) =>
    applyPresBgMode(
      (e.target as HTMLSelectElement).value as
        'plain' | 'nature' | 'singleNature' | 'auto' | 'animated' | 'scene' | 'video',
    ),
  );
  dom.presBgSceneSelect?.addEventListener('change', (e: Event) =>
    applyPresBgScene((e.target as HTMLSelectElement).value),
  );
  dom.presBgNatureSelect?.addEventListener('change', (e: Event) =>
    applyPresBgNature((e.target as HTMLSelectElement).value),
  );
  dom.presBgVideoSelect?.addEventListener('change', (e: Event) =>
    applyPresBgVideo((e.target as HTMLSelectElement).value),
  );
  const applyTajweedEnabled = (enabled: boolean) => {
    state.tajweedEnabled = enabled;
    storage.set('tajweed_enabled', enabled);
    // Keep the settings-panel switch and the inline header button in sync.
    dom.tajweedToggle?.classList.toggle('on', enabled);
    dom.tajweedInlineBtn?.classList.toggle('tajweed-off', !enabled);
    dom.tajweedInlineBtn?.setAttribute('aria-pressed', String(enabled));
    if (state.mushafMode) {
      // In mushaf mode loadSurah() would overwrite the mushaf page with the
      // surah view — force-reload the current mushaf page instead. Annotations
      // must be loaded for the current surah before the page re-renders.
      const reloadPage = () =>
        import('../features/mushaf/mushaf.js')
          .then((m: { loadPage: (p: number, skipNav?: boolean, force?: boolean) => Promise<void> }) =>
            m.loadPage(state.currentPage, true, true),
          )
          .catch((err) => {
            warnRecoverable('mushaf page reload after tajweed toggle failed', err);
          });
      if (enabled && state.currentSurah) {
        loadTajweedAnnotationsForSurah(state.currentSurah).then(reloadPage);
      } else {
        void reloadPage();
      }
      return;
    }
    const reload = () => {
      if (state.currentSurah) {
        loadSurah(state.currentSurah);
      }
    };
    if (enabled) {
      loadTajweedAnnotationsForSurah(state.currentSurah).then(reload);
    } else {
      reload();
    }
  };

  dom.tajweedToggle?.addEventListener('click', () => {
    applyTajweedEnabled(!state.tajweedEnabled);
  });

  dom.tajweedInlineBtn?.addEventListener('click', () => {
    applyTajweedEnabled(!state.tajweedEnabled);
  });

  dom.azanToggle?.addEventListener('click', () => {
    state.azanEnabled = dom.azanToggle!.classList.toggle('on');
    storage.set('azan_enabled', state.azanEnabled);
    scheduleNextAzanCheck();
  });
  dom.azanFajrToggle?.addEventListener('click', () => {
    state.azanFajrEnabled = dom.azanFajrToggle!.classList.toggle('on');
    storage.set('azan_fajr_enabled', state.azanFajrEnabled);
    scheduleNextAzanCheck();
  });
  dom.autoSaveToggle?.addEventListener('click', () => {
    state.autoSave = dom.autoSaveToggle!.classList.toggle('on');
    storage.set('auto_save', state.autoSave);
  });
  dom.tvModeToggle?.addEventListener('click', () => {
    setTvMode(!state.tvMode);
    dom.tvModeToggle!.classList.toggle('on', state.tvMode);
  });
  dom.pointerModeToggle?.addEventListener('click', () => {
    setPointerMode(!state.pointerMode);
    dom.pointerModeToggle!.classList.toggle('on', state.pointerMode);
  });

  dom.langSelect?.addEventListener('change', () => {
    const newLang = dom.langSelect!.value;
    if (newLang !== getLang()) {
      setLang(newLang as LangCode).then(() => {
        showToast(
          __('language') + ': ' + (AVAILABLE_LANGUAGES.find((l) => l.code === newLang)?.nativeName || newLang),
          'success',
        );
      });
    }
  });

  dom.cityQuickSelect?.addEventListener('change', () => {
    const v = dom.cityQuickSelect!.value;
    if (v) {
      const [city, country] = v.split('|') as [string, string];
      if (dom.cityInput) {
        dom.cityInput.value = city;
      }
      if (dom.countryInput) {
        dom.countryInput.value = country;
      }
    }
  });
}

/**
 * Use the device's GPS to detect the nearest supported city and fill the
 * city input. Requires the user's permission (browser will prompt).
 */
async function useMyLocation(): Promise<void> {
  if (!navigator.geolocation) {
    showToast(__('location_not_supported'), 'error');
    return;
  }
  // Dynamically import prayer-local to avoid a hard dependency at module load.
  const { getCoordinates, nearestCityToCoords } = await import('../features/prayer/prayer-local.js');
  const coords = await getCoordinates();
  if (!coords) {
    showToast(__('location_denied'), 'error');
    return;
  }
  const city = nearestCityToCoords(coords.latitude, coords.longitude);
  if (city && dom.cityInput) {
    dom.cityInput.value = city;
    state.city = city;
    storage.set('city', city);
    showToast(__('location_detected', city), 'success');
  } else {
    showToast(__('location_no_city'), 'error');
  }
}
