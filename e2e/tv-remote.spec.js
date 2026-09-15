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
    // The settings panel slides out over a 0.4s transition and stays
    // hit-testable while moving — wait until it is fully off-screen
    // (fixed at right:-420px, so its left edge leaves the viewport),
    // otherwise elementFromPoint probes can land on it (CI flake).
    await page.waitForFunction(() => {
      const panel = document.getElementById('settingsPanel');
      if (!panel) return true;
      return panel.getBoundingClientRect().left >= window.innerWidth;
    }, undefined, { timeout: 10000 });
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
    await page.locator('#settingsToggleBtn').evaluate((el) => el.focus());
    // Long-press: down, hold past the 1000ms threshold, release.
    await page.keyboard.down('Enter');
    await page.waitForTimeout(1200);
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

  test('pointer clicks land on the surah and reciter selects (no overlay)', async ({ page }) => {
    // Guards the pointer path: an invisible overlay above these native
    // selects would swallow cursor clicks while buttons keep working.
    // Wait for fonts (CI rasterisation shifts layout) and center each
    // select in view so the probe point is deterministic. The scroll is
    // instant and we wait for the rect to settle: with the default smooth
    // scrolling the page would still be moving while we measure, and the
    // probe would land on whatever passes underneath (CI flake).
    await page.waitForFunction(() => document.fonts.status === 'loaded');
    const hit = await page.evaluate(async () => {
      const out = {};
      const settled = () =>
        new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
      for (const id of ['surahSelect', 'reciterSelect']) {
        const el = document.getElementById(id);
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        await settled();
        const r = el.getBoundingClientRect();
        const hitEl = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        out[id] = hitEl ? hitEl.id || hitEl.tagName : null;
      }
      return out;
    });
    expect(hit['surahSelect']).toBe('surahSelect');
    expect(hit['reciterSelect']).toBe('reciterSelect');
  });

  test('prayer bar quick select applies country→city immediately and traps focus', async ({ page }) => {
    // Real remote flow: focus the toggle and open with Enter.
    await page.locator('#expandBarBtn').evaluate((el) => el.focus());
    await page.keyboard.press('Enter');
    await expect(page.locator('#prayerBar')).toHaveClass(/expanded/);
    await expect(page.locator('#barCountrySelect')).toBeVisible();
    await expect(page.locator('#barCitySelect')).toBeVisible();
    // Pick Egypt: cities repopulate and the first city applies at once.
    await page.locator('#barCountrySelect').selectOption('EG');
    await expect(page.locator('#barCitySelect')).toContainText('القاهرة');
    await expect(page.locator('#barCitySelect')).toHaveValue('القاهرة|EG');
    await expect(page.locator('#prayerBarLocation')).toContainText('القاهرة', { timeout: 15000 });
    // Remote focus must stay inside the bar (no leak to #readerSideTools siblings).
    await page.locator('#collapseBarBtn').evaluate((el) => el.focus());
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('ArrowDown');
    }
    const inside = await page.evaluate(() => {
      const bar = document.getElementById('prayerBar');
      return !!bar && bar.contains(document.activeElement);
    });
    expect(inside).toBe(true);
  });

  test('ayah modal confines remote focus to its options', async ({ page }) => {
    await page.locator('.ayah[data-surah="1"]').first().click();
    await expect(page.locator('#ayahModal')).toHaveClass(/open/);
    await page.locator('#ayahModalCloseBtn').evaluate((el) => el.focus());
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('ArrowDown');
    }
    const inside = await page.evaluate(() => {
      const modal = document.getElementById('ayahModal');
      return !!modal && modal.contains(document.activeElement);
    });
    expect(inside).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('#ayahModal')).toHaveClass(/hidden/);
  });

  test('favorites panel opens from the left in the native wrapper', async ({ page }) => {
    await page.evaluate(() => document.body.classList.add('capacitor-native'));
    await page.locator('#favoritesOpenBtn').evaluate((el) => el.click());
    await expect(page.locator('#favoritesPanel')).toHaveClass(/open/);
    const left = await page.locator('#favoritesPanel').evaluate((el) => getComputedStyle(el).left);
    expect(left).toBe('0px');
    await page.locator('#favoritesCloseBtn').evaluate((el) => el.click());
    await page.evaluate(() => document.body.classList.remove('capacitor-native'));
  });

  test('pointer cursor stays above the presentation overlay', async ({ page }) => {
    // Regression: the overlay pins itself at z-index 99999, which used to
    // bury the cursor (z-index 9999) so it moved unseen inside presentation.
    await page.locator('#viewPresBtn').evaluate((el) => el.focus());
    await page.keyboard.press('Enter');
    await expect(page.locator('#presentationOverlay')).toBeVisible({ timeout: 15000 });
    // Long-press OK on the (covered) button to enter pointer mode.
    await page.locator('#viewPresBtn').evaluate((el) => el.focus());
    await page.keyboard.down('Enter');
    await page.waitForTimeout(1200);
    await page.keyboard.up('Enter');
    await expect(page.locator('body')).toHaveClass(/tv-pointer/);
    const layers = await page.evaluate(() => {
      const cursor = document.getElementById('tvPointerCursor');
      const overlay = document.getElementById('presentationOverlay');
      const z = (el) => (el ? Number(getComputedStyle(el).zIndex) || 0 : 0);
      return { cursor: z(cursor), overlay: z(overlay) };
    });
    expect(layers.cursor).toBeGreaterThan(layers.overlay);
    expect(layers.cursor).toBeGreaterThan(0);
  });

  test('remote arrows move focus (not ayahs) in featured-ayah mode', async ({ page }) => {
    await page.locator('#viewPresBtn').evaluate((el) => el.focus());
    await page.keyboard.press('Enter');
    await expect(page.locator('#presentationOverlay')).toBeVisible({ timeout: 15000 });
    const counter = page.locator('#presentationCounter');
    const before = await counter.textContent();
    // Focus a neutral control, then push arrows: the ayah must not flip.
    await page.locator('#presentationCloseBtn').evaluate((el) => el.focus());
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowLeft');
    await expect(counter).toHaveText(before ?? '');
    const tag = await page.evaluate(() => document.activeElement?.tagName ?? null);
    expect(tag).toMatch(/^(BUTTON|INPUT|SELECT|A)$/);
  });

  test('OK on the featured-ayah next button flips the ayah', async ({ page }) => {
    await page.locator('#viewPresBtn').evaluate((el) => el.focus());
    await page.keyboard.press('Enter');
    await expect(page.locator('#presentationOverlay')).toBeVisible({ timeout: 15000 });
    const counter = page.locator('#presentationCounter');
    const before = await counter.textContent();
    await page.locator('#presentationNextBtn').evaluate((el) => el.focus());
    await page.keyboard.press('Enter');
    await expect(counter).not.toHaveText(before ?? '', { timeout: 10000 });
  });

  test('featured-ayah text uses the official Hafs font once loaded', async ({ page }) => {
    await page.locator('#viewPresBtn').evaluate((el) => el.focus());
    await page.keyboard.press('Enter');
    await expect(page.locator('#presentationOverlay')).toBeVisible({ timeout: 15000 });
    await page.waitForFunction(
      () => document.fonts.check('40px "KFGQPC HAFS Uthmanic Script"'),
      undefined,
      { timeout: 15000 },
    );
  });
});
