import { test, expect } from './fixtures/mock-network';
import { waitForReflow } from './fixtures/wait';

// Guards the tablet gap (769–1099px) where mushaf relied on neither the
// phone offset (≤768) nor the centered desktop window (≥1100): the rail
// used to sit over the mushaf page container.
for (const [w, h] of [
  [834, 1112],
  [1024, 768],
  [800, 1280],
]) {
  test(`mushaf-rail ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.addInitScript(() => {
      localStorage.setItem('quran_app_help_seen', JSON.stringify(true));
    });
    await page.goto('/');
    await page.waitForSelector('#surahContent .ayah', { timeout: 45000 });
    // The mushaf view button is only wired up once the deferred init has bound
    // its handlers, so retry the click until mushaf mode actually activates.
    await expect
      .poll(
        async () => {
          if (!(await page.evaluate(() => document.body.classList.contains('mushaf-active')))) {
            await page.locator('#viewMushafBtn').click();
          }
          return page.evaluate(() => document.body.classList.contains('mushaf-active'));
        },
        { timeout: 60000 },
      )
      .toBe(true);
    await page.waitForSelector('.mushaf-container', { timeout: 60000 });
    // The page canvases are measured against the QCF fonts — wait for them and
    // for the resulting layout to settle before probing geometry.
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await waitForReflow(page);
    const data = await page.evaluate(() => {
      const rail = document.getElementById('readerSideTools');
      const rr = rail.getBoundingClientRect();
      const pick = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), w: Math.round(r.width) };
      };
      return {
        railRight: Math.round(rr.x + rr.width),
        mushafMode: document.body.classList.contains('mushaf-active'),
        container: pick('.container'),
        mushaf: pick('.mushaf-container'),
      };
    });
    console.log(
      `MUSHAF-PROBE ${w}x${h} railRight=${data.railRight} mushaf=${data.mushaf?.x} container=${data.container?.x} active=${data.mushafMode}`,
    );
    expect(data.mushafMode).toBe(true);
    if (data.mushaf) expect(data.mushaf.x + 2).toBeGreaterThanOrEqual(data.railRight);
  });
}
