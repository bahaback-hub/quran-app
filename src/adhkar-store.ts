/**
 * Shared adhkar settings store — deliberately tiny so both adhkar.ts (panel)
 * and adhkar-personal.ts (personal adhkar) can import it without cycles.
 */
import { state } from './state.js';
import { storage } from './storage.js';
import { ADHKAR_DATA } from './adhkar-data.js';
import type { AdhkarSettings } from './types.js';

export function getDefaultAdhkarSettings(): AdhkarSettings {
  const settings: AdhkarSettings = {
    adhkar_enabled: false,
    adhkar_sound: false,
    _resetDate: new Date().toDateString(),
    personal_adhkar: [],
  };
  for (const cat of ADHKAR_DATA.categories) {
    settings[cat.id] = {
      enabled: true,
      time: cat.defaultTime || '',
      duration: cat.defaultDuration ?? 1,
    };
    for (const item of cat.items) {
      settings[`item_${item.id}`] = 0;
    }
  }
  settings.personal_adhkar = [];
  return settings;
}

export function cloneAdhkarSettings(settings: AdhkarSettings | null): AdhkarSettings {
  if (!settings) {
    return getDefaultAdhkarSettings();
  }
  if (typeof structuredClone === 'function') {
    return structuredClone(settings);
  }
  return JSON.parse(JSON.stringify(settings));
}

export function saveAdhkarSettings(): void {
  storage.set('adhkar_settings', state.adhkarSettings);
}
