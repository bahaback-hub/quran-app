/**
 * E2E Tests — Reader Side Rail Layout.
 *
 * The rail holds six rows (tafsir, adhkar, prayer bar, hifz room, qibla,
 * favourites). When it is taller than the space below its anchor, the tail of
 * the rail falls off the bottom with no way to scroll to it — verified on a
 * real 1080x2392 phone in landscape, where qibla/favourites/hifz reported
 * zero-size boxes and could not be tapped.
 *
 * Two earlier attempts both passed in a desktop browser and did nothing on the
 * device:
 *   1. a `max-height: 700px` media query — the WebView's CSS viewport does not
 *      match what its pixel count suggests, so the query never fired;
 *   2. a viewport-agnostic flex fix on the *desktop* rail rules — but on a
 *      phone the layout is a different set of rules, top-anchored below the
 *      header with fixed-height rows, and the desktop test viewport (900px
 *      wide) never entered that branch.
 *
 * So the viewports below are deliberately phone-width, which is the branch that
 * actually runs on a handset, and several heights, because the phone reports a
 * CSS viewport that is neither its width nor its height in pixels.
 *
 * Nothing else guards this: the CSS is static, so only a rendered layout
 * assertion catches a rail that no longer fits.
 */

import { test, expect } from './fixtures/mock-network';

/** Upright phone. */
const PORTRAIT_PHONE = { width: 393, height: 851 };
/**
 * Sideways phone at the several CSS heights a WebView might report. Width stays
 * under 760px so the phone layout branch is the one under test.
 */
const LANDSCAPE_PHONES = [
  { width: 700, height: 393 },
  { width: 700, height: 560 },
  { width: 700, height: 750 },
] as const;

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
    await page.waitForFunction((selectors) => selectors.every((s) => document.querySelector(s) !== null), RAIL_TOOLS, {
      timeout: 20_000,
    });
  });

  const viewports: Array<[string, { width: number; height: number }]> = [
    ['portrait phone', PORTRAIT_PHONE],
    ...LANDSCAPE_PHONES.map(
      (v) => [`landscape phone ${v.width}x${v.height}`, v] as [string, { width: number; height: number }],
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

  test('the rail itself never exceeds the space below its anchor', async ({ page }) => {
    for (const viewport of LANDSCAPE_PHONES) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(300);

      const rail = await page.evaluate(() => {
        const el = document.querySelector('#readerSideTools');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, height: r.height, bottom: r.bottom };
      });

      expect(rail, 'rail must exist').not.toBeNull();
      // Rows that shrink to fit must together stay inside the viewport,
      // otherwise the tail of the rail silently disappears.
      expect(rail!.bottom, `rail overflows a ${viewport.height}px-tall viewport`).toBeLessThanOrEqual(
        viewport.height + 1,
      );
      expect(rail!.top, 'rail must not start above the viewport').toBeGreaterThanOrEqual(-1);
    }
  });
});
