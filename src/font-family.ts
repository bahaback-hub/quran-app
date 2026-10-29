/**
 * Bundled Arabic font families.
 *
 * The Quran-text face shipped in `public/fonts/` is a *subset* of SIL's
 * Scheherazade New. The SIL Open Font License reserves the names
 * "Scheherazade" and "SIL" for unmodified copies, so the subset was renamed to
 * `Mushaf Naskh` (the glyphs and the internal copyright notice are unchanged).
 *
 * Readers who picked the old family keep working: their saved `font_type`
 * value is rewritten on load and persisted again.
 */

/** Family name the subset used before it was renamed. */
export const LEGACY_QURAN_FONT_FAMILY = 'Scheherazade New';

/** Family name declared by the bundled `@font-face` rules. */
export const QURAN_FONT_FAMILY = 'Mushaf Naskh';

/** CSS stack used by the font picker for the Quran-text face. */
export const QURAN_FONT_STACK = `'${QURAN_FONT_FAMILY}','Traditional Arabic',serif`;

/** Matches the legacy family name with or without quotes (any case). */
const LEGACY_FAMILY_PATTERN = /(['"])Scheherazade(?:\s+New)?\1|Scheherazade(?:\s+New)?/gi;

/**
 * Rewrite a stored CSS `font-family` value that still references the legacy
 * family name. Any other value (Amiri, Traditional Arabic, …) is returned
 * untouched, so this is safe to call on every load and every import.
 */
export function migrateFontFamily(value: string): string {
  if (!value) {
    return value;
  }
  return value.replace(LEGACY_FAMILY_PATTERN, `'${QURAN_FONT_FAMILY}'`);
}
