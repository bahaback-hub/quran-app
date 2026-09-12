import { test, expect } from './fixtures/mock-network';

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
    await page.waitForTimeout(800);
    await page.locator('#viewMushafBtn').click();
    await page.waitForSelector('.mushaf-container', { timeout: 60000 });
    await page.waitForTimeout(1500);
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
