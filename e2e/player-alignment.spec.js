import { test, expect } from './fixtures/mock-network';

// Regression (tablet report): in the 601–1655px band the centered
// `.container` is shifted `margin-left: 78px` to clear the fixed sidebar,
// but the fixed `.player` was aligned to the viewport only — so it stuck
// out past the container edge and slid under the sidebar.
// The player width must equal the container width (like on desktop),
// collapsed and expanded, in portrait and landscape.
test('player matches container width on tablet viewports', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });
  await page.evaluate(() => {
    const ws = document.getElementById('welcomeScreen');
    if (ws) ws.remove();
  });

  const edges = () =>
    page.evaluate(() => {
      const player = document.getElementById('player');
      const container = document.querySelector('.container');
      if (!player || !container) return null;
      const p = player.getBoundingClientRect();
      const c = container.getBoundingClientRect();
      return { pLeft: p.left, pRight: p.right, cLeft: c.left, cRight: c.right };
    });

  for (const vp of [
    { name: 'tablet-portrait', width: 768, height: 1024 },
    { name: 'tablet-landscape', width: 1024, height: 768 },
  ]) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(400);

    // Collapsed state (default).
    let r = await edges();
    expect(r, vp.name).not.toBeNull();
    expect(Math.abs(r.pLeft - r.cLeft), `${vp.name} collapsed left`).toBeLessThanOrEqual(2);
    expect(Math.abs(r.pRight - r.cRight), `${vp.name} collapsed right`).toBeLessThanOrEqual(2);

    // Expanded state.
    await page.evaluate(() => {
      document.getElementById('player')?.classList.remove('collapsed');
    });
    await page.waitForTimeout(400);
    r = await edges();
    expect(r, vp.name).not.toBeNull();
    expect(Math.abs(r.pLeft - r.cLeft), `${vp.name} expanded left`).toBeLessThanOrEqual(2);
    expect(Math.abs(r.pRight - r.cRight), `${vp.name} expanded right`).toBeLessThanOrEqual(2);

    // Restore collapsed state for the next viewport.
    await page.evaluate(() => {
      document.getElementById('player')?.classList.add('collapsed');
    });
  }
});
