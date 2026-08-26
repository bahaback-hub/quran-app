import { describe, expect, it } from 'vitest';
import ar from '../translations/ar.js';
import de from '../translations/de.js';
import en from '../translations/en.js';
import fr from '../translations/fr.js';
import id from '../translations/id.js';
import ms from '../translations/ms.js';
import ru from '../translations/ru.js';
import tr from '../translations/tr.js';

const bundles = { ar, de, en, fr, id, ms, ru, tr } as const;
const referenceKeys = Object.keys(en);
const pluralKeys = [
  'ayah_count',
  'favorite_count',
  'search_results_count',
  'bookmark_count',
  'minutes_remaining',
  'pages_count',
  'surah_count',
  'reciter_count',
  'listening_minutes',
  'reading_sessions',
  'day_streak',
];
const pluralForms = ['zero', 'one', 'two', 'few', 'many', 'other'];

describe('translation completeness', () => {
  it('keeps every supported language aligned with the English interface keys', () => {
    for (const [language, bundle] of Object.entries(bundles)) {
      for (const key of referenceKeys) {
        expect(bundle, `${language} is missing ${key}`).toHaveProperty(key);
      }
    }
  });

  it('keeps all count labels localized in every supported language', () => {
    for (const [language, bundle] of Object.entries(bundles)) {
      for (const key of pluralKeys) {
        const plural = bundle[key as keyof typeof bundle] as Record<string, string>;
        for (const form of pluralForms) {
          expect(plural, `${language}.${key}.${form} is missing`).toHaveProperty(form);
          expect(plural[form], `${language}.${key}.${form} must not be empty`).toBeTruthy();
          if (form === 'few' || form === 'many' || form === 'other') {
            expect(plural[form]).toContain('{count}');
          }
        }
      }
    }
  });
});
