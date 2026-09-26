/**
 * E2E Tests — Reader Side Rail Layout.
 *
 * The rail holds six fixed-height rows (tafsir, adhkar, prayer bar, hifz room,
 * qibla, favourites). On a phone held sideways the viewport is only ~400px
 * tall, so those rows overflowed and the last three tools were laid out below
 * the fold with no way to reach them — verified on a real 1080x2392 device,
 * where qibla/favourites/hifz reported zero-size boxes.
 *
 * Nothing else guards this: the CSS is static, so only a rendered layout
 * assertion catches a rail that no longer fits.
 */

import { test, expect } from './fixtures/mock-network';

/** Sideways phone: ~400 CSS px tall. Matches the failing device orientation. */
const LANDSCAPE_PHONE = { width: 851, height: 393 };
/** Upright phone, where the rail has always fit. */
const PORTRAIT_PHONE = { width: 393, height: 851 };

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
  });

  for (const [name, viewport] of [
    ['landscape phone', LANDSCAPE_PHONE],
    ['portrait phone', PORTRAIT_PHONE],
  ] as const) {
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
        expect(b.y, `${sel} must not start above the viewport`).toBeGreaterThanOrEqual(-1);
        expect(b.y + b.height, `${sel} must end inside the viewport (rail overflows on ${name})`).toBeLessThanOrEqual(
          viewport.height + 1,
        );
      }
    });
  }

  test('the rail is short enough that no tool is pushed off a sideways screen', async ({ page }) => {
    await page.setViewportSize(LANDSCAPE_PHONE);
    await page.waitForTimeout(400);

    const railHeight = await page.evaluate(() => {
      const rail = document.querySelector('#readerSideTools');
      return rail ? rail.getBoundingClientRect().height : Number.POSITIVE_INFINITY;
    });

    // Six rows that each shrink to fit must together stay under the viewport,
    // otherwise the tail of the rail silently disappears.
    expect(railHeight).toBeLessThanOrEqual(LANDSCAPE_PHONE.height);
  });
});
