/**
 * Uthmani display policy — how the standard Quran text is presented.
 *
 * The bundled text (public/data/quran-uthmani.json) is the standard Uthmani
 * encoding of the Madani mushaf (Tanzil extended — the same data as
 * quran.com / AlQuran Cloud). Some of its notation is a *font convention*
 * rather than a printed mark, and the bundled reading fonts draw it
 * literally, which reads as a tashkeel difference against the printed
 * King Fahd Complex mushaf.
 */

/**
 * Hide the sequential-tanween meem (U+06ED) for the plain reading display,
 * so the tashkeel matches the printed King Fahd Complex (Madani) mushaf.
 *
 * In this encoding a tanween that undergoes ikhfa or idgham is followed by a
 * small meem, e.g. 86:13 لَقَوْلٌۭ فَصْلٌۭ. The printed Madani mushaf draws
 * those tanweens as sequential dammas above the letter and nothing below it;
 * the small meem is only a font-trigger convention that me_quran-style fonts
 * translate into that printed form. The bundled reading fonts (Amiri, Mushaf
 * Naskh, …) draw U+06ED literally as a small meem below the word, which
 * readers compare against the mushaf read as a tashkeel difference.
 * Verified: U+06ED appears 4807 times in quran-uthmani.json and is always
 * preceded by a tanween (ً ٌ ٍ), so removing it never touches any other
 * mark — the small waw ۥ, waqf signs, silent-letter zeroes and every other
 * Uthmani notation are preserved.
 *
 * Display-only: the stored text, search matching, copies and the integrity
 * manifest keep the standard encoding untouched.
 *
 * @param str Quran display text in Uthmani script
 * @returns The same text without U+06ED, ready for the plain reading view
 *
 * @example
 *   hideSequentialTanweenMeem('لَقَوْلٌۭ فَصْلٌۭ') // → 'لَقَوْلٌ فَصْلٌ'
 *   hideSequentialTanweenMeem('إِنَّهُۥ') // → 'إِنَّهُۥ' (small waw kept)
 */
export function hideSequentialTanweenMeem(str: string): string {
  return String(str).replace(/\u06ED/g, '');
}
