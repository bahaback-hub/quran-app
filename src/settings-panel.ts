/**
 * Settings panel actions for Quran App.
 *
 * Import/export, reset (custom confirmation modal), location saving and the
 * import type-validators live here instead of settings.ts because they are
 * only reachable from settings-panel buttons and the panel file input; a
 * module-scope import kept their key lists and validator tables in the
 * first-paint graph. settings.ts keeps the apply and restore half that
 * boots every visit.
 */

import { state } from './state.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { showToast } from './ui.js';
import { __ } from './i18n.js';
import {
  SURAH_FONT_SIZES,
  MUSHAF_ZOOM_LEVELS,
  MIN_READER_SURFACE_TRANSPARENCY,
  MAX_READER_SURFACE_TRANSPARENCY,
} from './settings.js';

/** Save city/country/method and reload prayer times. */
export function saveLocationSettings(): void {
  const city = dom.cityInput?.value.trim();
  const country = dom.countryInput?.value.trim();
  if (!city || !country) {
    showToast(__('save_location_error'), 'error');
    return;
  }
  state.city = city;
  state.country = country;
  state.method = dom.methodSelect?.value || '4';
  storage.set('city', city);
  storage.set('country', country);
  storage.set('method', state.method);
  void import('./features/prayer/prayer.js').then(({ loadPrayerTimes }) => loadPrayerTimes());
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
    // N-13: derived from SETTING_STORAGE_KEYS so "reset all" can never leave
    // a preference behind (deep_night_mode used to survive the reset).
    SETTING_STORAGE_KEYS.forEach((k: string) => storage.remove(k));
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
  // N-13: derived from SETTING_STORAGE_KEYS so nothing is silently dropped
  // on backup (hifz_curtain_reveal, pitch_freq, tafsir_* layout keys and
  // friends used to be missing from this hand-maintained copy).
  const data: Record<string, unknown> = {};
  SETTING_STORAGE_KEYS.forEach((k: string) => {
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

/**
 * N-13: single source of truth for every persisted user setting.
 *
 * The reset, export, and import allowlists used to be three hand-maintained
 * lists that drifted apart: "reset all" left deep_night_mode active after
 * the reload, export/import silently dropped hifz_curtain_reveal,
 * auto_play_next, pitch_freq, tafsir_* layout keys, tv_mode and
 * pointer_mode, and the tv_mode validator was dead because the allowlist
 * never contained its key. All three lists now derive from this constant.
 *
 * Membership rule: user-facing preferences and reading position only.
 * Caches (cached_prayer_times, offline-pack indexes), one-time markers
 * (onboarding_seen, hint-seen flags) and hifz-room plan data stay out — reset
 * must not resurrect first-run hints, and export/import never carried them.
 * night_mode_set_by_user is retained for imports from older versions.
 */
const SETTING_STORAGE_KEYS: readonly string[] = [
  // Reader & fonts
  'font_size',
  'font_type',
  'line_spacing',
  'reader_surface_transparency',
  // Themes & navigation modes
  'night_mode',
  'deep_night_mode',
  'sepia_mode',
  'night_mode_set_by_user',
  'tv_mode',
  'pointer_mode',
  // Reading position & user data
  'last_position',
  'bookmark',
  'favorites',
  'search_history',
  'reading_stats',
  'surah_list',
  // Translation & tafsir
  'translation_enabled',
  'translation_edition',
  'tafsir_edition',
  'tafsir_curtain_reveal',
  'tafsir_sheet_height',
  'tafsir_text_size',
  // Mushaf mode
  'mushaf_mode',
  'mushaf_zoom',
  'current_page',
  // Audio
  'reciter',
  'playback_speed',
  'pitch_freq',
  'auto_play_next',
  'player_collapsed',
  'bar_collapsed',
  // Adhkar
  'adhkar_settings',
  // Prayer & location
  'city',
  'country',
  'method',
  'auto_location',
  'azan_enabled',
  'azan_fajr_enabled',
  // Tajweed
  'tajweed_enabled',
  // Presentation backgrounds
  'pres_bg_mode',
  'pres_bg_scene',
  'pres_bg_nature',
  'pres_bg_video',
  // Interface language & misc
  'lang',
  'auto_save',
  // Hifz-room layout
  'hifz_curtain_reveal',
];

/** Allowlist of valid setting keys for import validation. Exported for testing. */
export const ALLOWED_SETTINGS_KEYS: Set<string> = new Set(SETTING_STORAGE_KEYS);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidPersonalAdhkar(value: unknown): boolean {
  if (!isPlainRecord(value)) {
    return false;
  }
  const id = value['id'];
  const text = value['text'];
  const count = value['count'];
  const time = value['time'];
  const duration = value['duration'];
  return (
    typeof id === 'string' &&
    /^[A-Za-z0-9_-]{1,64}$/.test(id) &&
    typeof text === 'string' &&
    text.trim().length > 0 &&
    text.length <= 2000 &&
    typeof count === 'number' &&
    Number.isInteger(count) &&
    count >= 1 &&
    count <= 1000 &&
    (time === null || (typeof time === 'string' && time.length <= 120)) &&
    typeof duration === 'number' &&
    Number.isFinite(duration) &&
    duration >= 0 &&
    duration <= 1440
  );
}

function isValidAdhkarCategory(value: unknown): boolean {
  if (!isPlainRecord(value)) {
    return false;
  }
  const enabled = value['enabled'];
  const time = value['time'];
  const duration = value['duration'];
  return (
    typeof enabled === 'boolean' &&
    typeof time === 'string' &&
    /^$|^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) &&
    typeof duration === 'number' &&
    Number.isInteger(duration) &&
    duration >= 1 &&
    duration <= 60
  );
}

function isValidAdhkarSettings(value: unknown): boolean {
  if (!isPlainRecord(value)) {
    return false;
  }
  if ('adhkar_enabled' in value && typeof value['adhkar_enabled'] !== 'boolean') {
    return false;
  }
  if ('adhkar_sound' in value && typeof value['adhkar_sound'] !== 'boolean') {
    return false;
  }
  if ('_resetDate' in value && typeof value['_resetDate'] !== 'string') {
    return false;
  }
  const personal = value['personal_adhkar'];
  if (
    personal !== undefined &&
    (!Array.isArray(personal) || personal.length > 100 || !personal.every(isValidPersonalAdhkar))
  ) {
    return false;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (['adhkar_enabled', 'adhkar_sound', '_resetDate', 'personal_adhkar'].includes(key)) {
      continue;
    }
    if (key.startsWith('item_')) {
      if (typeof entry !== 'number' || !Number.isInteger(entry) || entry < 0 || entry > 10000) {
        return false;
      }
      continue;
    }
    if (!isValidAdhkarCategory(entry)) {
      return false;
    }
  }
  return true;
}

/** Type validators for setting keys — ensures imported values match expected types. Exported for testing. */
export const SETTING_TYPE_VALIDATORS: Record<string, (v: unknown) => boolean> = {
  font_size: (v) => typeof v === 'number' && Number.isFinite(v) && SURAH_FONT_SIZES.includes(v),
  mushaf_zoom: (v) => typeof v === 'number' && MUSHAF_ZOOM_LEVELS.includes(v),
  night_mode: (v) => typeof v === 'boolean',
  city: (v) => typeof v === 'string',
  country: (v) => typeof v === 'string',
  method: (v) => typeof v === 'string',
  azan_enabled: (v) => typeof v === 'boolean',
  azan_fajr_enabled: (v) => typeof v === 'boolean',
  auto_save: (v) => typeof v === 'boolean',
  tv_mode: (v) => typeof v === 'boolean',
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
  adhkar_settings: isValidAdhkarSettings,
  search_history: (v) => Array.isArray(v),
  font_type: (v) => typeof v === 'string',
  line_spacing: (v) => typeof v === 'string',
  reader_surface_transparency: (v) =>
    typeof v === 'number' &&
    Number.isFinite(v) &&
    v >= MIN_READER_SURFACE_TRANSPARENCY &&
    v <= MAX_READER_SURFACE_TRANSPARENCY,
  tajweed_enabled: (v) => typeof v === 'boolean',
  night_mode_set_by_user: (v) => typeof v === 'boolean',
  surah_list: (v) => Array.isArray(v),
  pres_bg_mode: (v) =>
    typeof v === 'string' && ['plain', 'nature', 'singleNature', 'auto', 'animated', 'scene', 'video'].includes(v),
  pres_bg_scene: (v) => typeof v === 'string' && ['stars', 'waves', 'aurora', 'particles', 'rain'].includes(v),
  pres_bg_nature: (v) => typeof v === 'string' && ['dawn', 'morning', 'afternoon', 'sunset', 'night'].includes(v),
  sepia_mode: (v) => typeof v === 'boolean',
  reading_stats: (v) => typeof v === 'object' && v !== null,
  // N-13: validators for the keys that were missing from the allowlist while
  // their SETTING_TYPE_VALIDATORS entry (tv_mode) or the persisted setting
  // itself existed. Every key in SETTING_STORAGE_KEYS now has one, and the
  // import path below refuses keys without a validator (defense in depth
  // against future list additions forgetting their validator).
  deep_night_mode: (v) => typeof v === 'boolean',
  auto_play_next: (v) => typeof v === 'boolean',
  auto_location: (v) => typeof v === 'boolean',
  pointer_mode: (v) => typeof v === 'boolean',
  // Range mirrors PITCH_MIN_FREQ/PITCH_MAX_FREQ in features/audio/audio-pitch.ts.
  pitch_freq: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 400 && v <= 600,
  pres_bg_video: (v) => typeof v === 'string' && v.length > 0 && v.length <= 500,
  tafsir_curtain_reveal: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0,
  tafsir_sheet_height: (v) => typeof v === 'number' && Number.isFinite(v) && v > 0,
  // Range mirrors textLimits in events/media-events.ts (tafsir sheet).
  tafsir_text_size: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 14 && v <= 28,
  hifz_curtain_reveal: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0,
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
        Object.entries(data).forEach(([k, v]: [string, unknown]) => {
          if (v !== null && v !== undefined && ALLOWED_SETTINGS_KEYS.has(k)) {
            const validator = SETTING_TYPE_VALIDATORS[k];
            // N-13: an allowlisted key without a validator is a bug in the
            // single-source list — refuse it instead of importing it raw.
            if (!validator || !validator(v)) {
              return;
            }
            storage.set(k, v);
            imported++;
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
