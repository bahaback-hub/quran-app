/**
 * Mushaf page layout types shared by the state module and the mushaf renderer.
 * Kept in its own module to avoid a state → mushaf-renderer import cycle.
 */

/** A single word in a mushaf page line. */
export interface PageWord {
  char: string;
  font?: string;
  type?: string;
  verse_key?: string;
  location?: string;
  word?: string;
  text?: string;
}

/** A single line in a mushaf page layout. */
export interface PageLine {
  words: PageWord[];
}

/** Full layout data for a mushaf page (from QCF4 JSON). */
export interface PageLayoutData {
  font?: string;
  lines: PageLine[];
}
