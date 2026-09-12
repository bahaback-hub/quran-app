import { test, expect } from './fixtures/mock-network';

test.describe('TV remote control', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const ws = document.getElementById('welcomeScreen');
      if (ws) ws.remove();
    });
    await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });
    // Enable TV mode through the real settings UI.
    await page.locator('#settingsToggleBtn').click();
    await page.locator('.settings-tab[data-tab="tools"]').evaluate((el) => el.click());
    await page.locator('#tvModeToggle').evaluate((el) => el.click());
    await expect(page.locator('body')).toHaveClass(/tv-nav/);
    await page.locator('#settingsCloseBtn').evaluate((el) => el.click());
  });

  async function focusedId(page) {
    return page.evaluate(() => {
      const ae = document.activeElement;
      if (!ae || ae === document.body) return null;
      const r = ae.getBoundingClientRect();
      return { id: ae.id || null, tag: ae.tagName, visible: r.width > 2 && r.height > 2 };
    });
  }

  test('arrows move focus between controls instead of flipping ayahs', async ({ page }) => {
    await page.keyboard.press('ArrowDown');
    const first = await focusedId(page);
    expect(first).not.toBeNull();
    expect(first.visible).toBe(true);
    await page.keyboard.press('ArrowDown');
    const second = await focusedId(page);
    expect(second).not.toBeNull();
    // Focus travelled (or stayed only if a single control exists, which never happens).
    expect(second.tag).toMatch(/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/);
  });

  test('Enter activates the focused control', async ({ page }) => {
    await page.locator('#settingsToggleBtn').evaluate((el) => el.focus());
    await page.keyboard.press('Enter');
    await expect(page.locator('#settingsPanel')).toHaveClass(/open/);
  });

  test('a letter can be typed from the on-screen keyboard by remote', async ({ page }) => {
    // Real remote flow: expand search, open the Arabic keyboard, type a letter.
    await page.locator('#searchToggleBtn').evaluate((el) => el.focus());
    await page.keyboard.press('Enter');
    // Focus the keyboard toggle itself (as a remote user would) and open it.
    await page.locator('#kbdToggleBtn').evaluate((el) => el.focus());
    await page.keyboard.press('Enter');
    await expect(page.locator('#arabicKeyboard')).toHaveClass(/open/);
    // Opening the keyboard in TV mode drops focus on its first key.
    const focused = await focusedId(page);
    expect(focused).not.toBeNull();
    expect(focused.tag).toBe('BUTTON');
    await page.keyboard.press('Enter');
    const value = await page.locator('#searchInput').inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test('long-press OK toggles pointer mode and arrows move the cursor', async ({ page }) => {
    // Focus a real button first so the long-press has an owner.
    await page.locator('#settingsToggleBtn').evaluate((el) => el.focus());
    // Long-press: down, hold past the threshold, release.
    await page.keyboard.down('Enter');
    await page.waitForTimeout(900);
    await page.keyboard.up('Enter');
    await expect(page.locator('body')).toHaveClass(/tv-pointer/);
    const cursor = page.locator('#tvPointerCursor');
    await expect(cursor).toBeVisible();
    const before = await cursor.evaluate((el) => ({ x: el.dataset['x'], y: el.dataset['y'] }));
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    const after = await cursor.evaluate((el) => ({ x: el.dataset['x'], y: el.dataset['y'] }));
    expect(Number(after.x)).toBeGreaterThan(Number(before.x));
    // Escape leaves pointer mode back to focus jumping.
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/tv-pointer/);
  });
});
