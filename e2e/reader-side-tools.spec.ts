/**
 * E2E Tests — Reader Side Rail Layout.
 *
 * The rail holds six rows (tafsir, adhkar, prayer bar, hifz room, qibla,
 * favourites). When it is taller than the viewport, the tail of the rail falls
 * off the bottom with no way to scroll to it — verified on a real 1080x2392
 * phone in landscape, where qibla/favourites/hifz reported zero-size boxes.
 *
 * The first attempt fixed this with a `max-height: 700px` media query, which
 * passed in every desktop browser and still did nothing on the device: the
 * WebView reports a CSS viewport much taller than its pixel count suggests, so
 * the query never matched. Hence the range below — the rail has to fit at any
 * height, not just the ones a browser happens to report.
 *
 * Nothing else guards this: the CSS is static, so only a rendered layout
 * assertion catches a rail that no longer fits.
 */

import { test, expect } from './fixtures/mock-network';

/** Upright phone. */
const PORTRAIT_PHONE = { width: 393, height: 851 };
/** Sideways phone, at the several CSS heights a WebView might report. */
const LANDSCAPE_HEIGHTS = [393, 560, 750, 900] as const;

const RAIL_TOOLS = [
  '#tafsirCurtainHandle',
  '#adhkarBtn',
  '#prayerBar',
  '#hifzRoomToggle',
  '#qiblaBtn',
  '#favoritesOpenBtn',
];

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function railBoxes(page: import('@playwright/test').Page): Promise<Record<string, Box | null>> {
  return page.evaluate((selectors) => {
    const out: Record<string, { x: number; y: number; width: number; height: number } | null> = {};
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) {
        out[sel] = null;
        continue;
      }
      const r = el.getBoundingClientRect();
      out[sel] = { x: r.x, y: r.y, width: r.width, height: r.height };
    }
    return out;
  }, RAIL_TOOLS);
}

test.describe('reader side rail', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#readerSideTools')).toBeAttached();
    // The hifz room is wired up asynchronously, so wait for the full set before
    // measuring — otherwise a slow run reports a missing tool as a layout fault.
    await page.waitForFunction(
      (selectors) => selectors.every((s) => document.querySelector(s) !== null),
      RAIL_TOOLS,
      { timeout: 20_000 },
    );
  });

  const viewports: Array<[string, { width: number; height: number }]> = [
    ['portrait phone', PORTRAIT_PHONE],
    ...LANDSCAPE_HEIGHTS.map(
      (h) =>
        [`landscape phone at ${h}px tall`, { width: 900, height: h }] as [string, { width: number; height: number }],
    ),
  ];

  for (const [name, viewport] of viewports) {
    test(`every tool is rendered and on screen — ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(400);

      const boxes = await railBoxes(page);

      for (const sel of RAIL_TOOLS) {
        const box = boxes[sel];
        expect(box, `${sel} must exist in the rail`).not.toBeNull();
        const b = box as Box;
        expect(b.width, `${sel} must have width`).toBeGreaterThan(0);
        expect(b.height, `${sel} must have height`).toBeGreaterThan(0);
        expect(b.height, `${sel} must stay a usable touch target`).toBeGreaterThanOrEqual(38);
        expect(b.y, `${sel} must not start above the viewport`).toBeGreaterThanOrEqual(-1);
        expect(b.y + b.height, `${sel} must end inside the viewport (rail overflows on ${name})`).toBeLessThanOrEqual(
          viewport.height + 1,
        );
      }
    });
  }

  test('the rail itself never exceeds the viewport height', async ({ page }) => {
    for (const height of LANDSCAPE_HEIGHTS) {
      await page.setViewportSize({ width: 900, height });
      await page.waitForTimeout(300);

      const railHeight = await page.evaluate(() => {
        const rail = document.querySelector('#readerSideTools');
        return rail ? rail.getBoundingClientRect().height : Number.POSITIVE_INFINITY;
      });

      // Rows that shrink to fit must together stay under the viewport, otherwise
      // the tail of the rail silently disappears.
      expect(railHeight, `rail overflows a ${height}px-tall viewport`).toBeLessThanOrEqual(height);
    }
  });
});
