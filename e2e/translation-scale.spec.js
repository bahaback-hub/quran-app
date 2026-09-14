import { test, expect } from './fixtures/mock-network';

// Item 5: translation text must scale with the ayah size (0.62 ratio with a
// 13px floor) on phones, tablets, and large screens — never the old tiny
// fixed size, and boosted on big touch screens.
const cases = [
  { name: 'phone', width: 390, height: 844, minRatio: 0.6 },
  { name: 'tablet', width: 768, height: 1024, minRatio: 0.6 },
  { name: 'desktop', width: 1920, height: 1080, minRatio: 0.6 },
];

for (const c of cases) {
  test(`translation scales with ayah size (${c.name})`, async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });
    await page.evaluate(() => {
      document.getElementById('welcomeScreen')?.remove();
      document.getElementById('translationToggle')?.classList.remove('hidden');
    });
    await page.setViewportSize({ width: c.width, height: c.height });
    await page.waitForTimeout(400);
    await page.locator('#translationToggle').click();
    await expect(page.locator('.translation-text').first()).toBeVisible({ timeout: 30000 });

    const sizes = await page.evaluate(() => {
      const container = document.querySelector('.ayahs-container');
      const trans = document.querySelector('.translation-text');
      if (!container || !trans) return null;
      const cs = getComputedStyle(container).fontSize;
      const ts = getComputedStyle(trans).fontSize;
      return { container: parseFloat(cs), trans: parseFloat(ts) };
    });
    expect(sizes).not.toBeNull();
    // Ratio holds and the floor keeps small screens legible.
    expect(sizes.trans / sizes.container).toBeGreaterThanOrEqual(c.minRatio);
    expect(sizes.trans).toBeGreaterThanOrEqual(13);
  });
}
