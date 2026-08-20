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
});
