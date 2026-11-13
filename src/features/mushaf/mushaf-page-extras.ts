/**
 * Mushaf page helpers: screen-reader text, juz lookup, and tajweed legend.
 * Extracted from `mushaf.ts`; behavior unchanged.
 */

import { JUZ_PAGES } from '../../config.js';
import { __ } from '../../i18n.js';
import { toArabicNumeral } from '../../utils.js';
import type { PageLayoutData } from './mushaf-layout-data.js';

/** Readable text extracted from a canvas-rendered mushaf page. */
export interface MushafTextBlock {
  /** `surah:ayah` for verse text, or `null` for text that belongs to no verse. */
  verseKey: string | null;
  text: string;
}

/**
 * Build a plain-text alternative for a canvas-rendered mushaf page.
 *
 * The canvas paints one glyph per word, so assistive technology would
 * otherwise see an empty bitmap. This reconstructs readable text from the
 * same layout data: words are concatenated with single spaces and grouped by
 * `verse_key`, merging verses that continue across lines. Verse-end markers
 * (`type: 'end'`, whose `text` is a glyph placeholder such as `"V1"`) and
 * surah headers are skipped because they carry no recitable text.
 */
export function buildMushafTextBlocks(layout: PageLayoutData | null): MushafTextBlock[] {
  if (!layout) {
    return [];
  }

  const blocks: MushafTextBlock[] = [];
  let current: MushafTextBlock | null = null;

  for (const line of layout.lines) {
    for (const word of line.words) {
      if (word.type === 'surah_header' || word.type === 'end') {
        continue;
      }
      const text = word.text?.trim();
      if (!text) {
        continue;
      }
      const verseKey = word.verse_key ?? null;
      if (current && verseKey !== null && current.verseKey === verseKey) {
        current.text += ` ${text}`;
        continue;
      }
      current = { verseKey, text };
      blocks.push(current);
    }
  }

  return blocks;
}

/** Render the screen-reader region: one paragraph per verse, with its ayah number. */
export function renderMushafTextAlternative(region: HTMLElement, layout: PageLayoutData | null): void {
  region.replaceChildren();
  for (const block of buildMushafTextBlocks(layout)) {
    const paragraph = document.createElement('p');
    paragraph.textContent = block.text;
    if (block.verseKey) {
      const ayah = Number(block.verseKey.split(':')[1]);
      if (Number.isFinite(ayah)) {
        const marker = document.createElement('span');
        marker.textContent = ` ﴿${toArabicNumeral(ayah)}﴾`;
        paragraph.appendChild(marker);
      }
    }
    region.appendChild(paragraph);
  }
}

/** Get the Juz number for a given page number (1-604). */
export function getJuzForPage(pageNum: number): number {
  let juz = 1;
  for (let i = JUZ_PAGES.length - 1; i >= 0; i--) {
    if (pageNum >= JUZ_PAGES[i]!) {
      juz = i + 1;
      break;
    }
  }
  return juz;
}

/** Build the tajweed color legend shown below mushaf pages. */
export function buildTajweedLegend(): HTMLElement {
  const legend = document.createElement('div');
  legend.className = 'mushaf-tajweed-legend';

  const title = document.createElement('div');
  title.className = 'mushaf-tajweed-legend-title';
  title.textContent = __('tajweed_legend_title');

  const grid = document.createElement('div');
  grid.className = 'mushaf-tajweed-legend-grid';

  const entries: { color: string; label: string }[] = [
    { color: '#ce9e00', label: __('tajweed_madd_2') },
    { color: '#ff7b00', label: __('tajweed_madd_separated') },
    { color: '#b50000', label: __('tajweed_madd_6') },
    { color: '#f40000', label: __('tajweed_madd_connected') },
    { color: '#09b000', label: __('tajweed_ghunnah') },
    { color: '#2fadff', label: __('tajweed_shamsiyyah') },
    { color: '#a5a5a5', label: __('tajweed_idgham') },
    { color: '#8e44ad', label: __('tajweed_sukoon') },
  ];

  for (const entry of entries) {
    const item = document.createElement('div');
    item.className = 'mushaf-tajweed-legend-item';
    const swatch = document.createElement('span');
    swatch.className = 'mushaf-tajweed-legend-swatch';
    swatch.style.backgroundColor = entry.color;
    const label = document.createElement('span');
    label.className = 'mushaf-tajweed-legend-label';
    label.textContent = entry.label;
    item.appendChild(swatch);
    item.appendChild(label);
    grid.appendChild(item);
  }

  legend.appendChild(title);
  legend.appendChild(grid);
  return legend;
}
