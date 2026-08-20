import { test, expect } from './fixtures/mock-network';

test.describe('Quran App — Mobile Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });
  });

  test('should expose the five-tab mobile navigation', async ({ page }) => {
    await expect(page.locator('#bottomNav')).toBeVisible();
    await expect(page.locator('#bottomNav .bottom-nav-btn')).toHaveCount(5);
  });

  test('should reveal reader controls from the controls tab', async ({ page }) => {
    await page.locator('#bottomNav .bottom-nav-btn[data-tab="controls"]').click();
    await expect(page.locator('#controls')).toBeVisible();
    await expect(page.locator('#surahSelect')).toBeVisible();
    await expect(page.locator('#reciterSelect')).toBeVisible();
  });

  test('should reveal the search field from the search tab', async ({ page }) => {
    await page.locator('#bottomNav .bottom-nav-btn[data-tab="search"]').click();
    await expect(page.locator('#searchInput')).toBeVisible();
  });

  test('should expand the player from the player tab', async ({ page }) => {
    await page.locator('#bottomNav .bottom-nav-btn[data-tab="player"]').click();
    await expect(page.locator('#player')).not.toHaveClass(/collapsed/);
    await expect(page.locator('#playPauseBtn')).toBeVisible();
  });

  test('should show a clear static Qibla bearing when a live compass is unavailable', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 24.7136, longitude: 46.6753 });

    await page.locator('#qiblaBtn').click();
    await expect(page.locator('#qiblaOverlay')).toBeVisible();
    await expect(page.locator('#qiblaAngle')).toHaveText(/\d+°/);
    await expect(page.locator('#qiblaStatus')).toContainText(/الشمال الحقيقي|البوصلة الحية/);
  });

  test('should keep primary header actions in one row and keep theme controls separate', async ({ page }) => {
    const primaryActions = page.locator('.header-primary-actions .header-action-btn');
    await expect(primaryActions).toHaveCount(5);
    await expect(page.locator('#helpToggleBtn')).toBeVisible();
    await expect(page.locator('#breadcrumbs')).toHaveCount(0);

    const firstAction = await primaryActions.nth(0).boundingBox();
    const lastAction = await primaryActions.nth(4).boundingBox();
    const theme = await page.locator('#themeToggle').boundingBox();
    expect(firstAction).not.toBeNull();
    expect(lastAction).not.toBeNull();
    expect(theme).not.toBeNull();
    expect(Math.abs(firstAction!.y - lastAction!.y)).toBeLessThan(2);
    expect(theme!.y).toBeGreaterThan(firstAction!.y + firstAction!.height);

    await expect(page.locator('#collapsedInfo')).not.toHaveText('');
    await expect(page.locator('#collapsedInfo')).not.toContainText(/آية/);
  });
});
