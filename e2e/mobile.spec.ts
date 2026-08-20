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

  test('should place the command bar before the compact surah and reciter controls', async ({ page }) => {
    await page.locator('#bottomNav .bottom-nav-btn[data-tab="controls"]').click();
    const commandBar = page.locator('.reader-command-bar');
    const contextCard = page.locator('.reader-context-card');
    await expect(commandBar).toBeVisible();
    await expect(contextCard).toBeVisible();

    const commandBox = await commandBar.boundingBox();
    const contextBox = await contextCard.boundingBox();
    expect(commandBox).not.toBeNull();
    expect(contextBox).not.toBeNull();
    expect(commandBox!.y).toBeLessThan(contextBox!.y);
    await expect(contextCard.locator('.control-card-title')).toHaveCount(0);
  });

  test('should hide the skip link only for the native Android class', async ({ page }) => {
    const skipLink = page.locator('.skip-link');
    const readingProgress = page.locator('.reading-progress');
    await expect(skipLink).toBeVisible();
    await expect(readingProgress).toHaveCSS('display', 'block');
    await page.locator('body').evaluate((body) => body.classList.add('capacitor-native'));
    await expect(skipLink).toBeHidden();
    await expect(readingProgress).toHaveCSS('display', 'none');
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

  test('should reveal the repeat range controls when repeat is enabled', async ({ page }) => {
    await page.locator('#bottomNav .bottom-nav-btn[data-tab="player"]').click();
    await page.locator('#playerMoreBtn').click();
    await expect(page.locator('#repeatBtn')).toBeVisible();

    await page.locator('#repeatBtn').click();

    await expect(page.locator('#repeatControls')).toBeVisible();
    await expect(page.locator('#repeatFrom')).toBeVisible();
    await expect(page.locator('#repeatTo')).toBeVisible();
    await expect(page.locator('#repeatTimes')).toBeVisible();
    await expect(page.locator('#repeatFrom')).toHaveValue('1');
    await expect(page.locator('#repeatTimes')).toHaveValue('3');

    await page.locator('#repeatBtn').click();
    await expect(page.locator('#repeatControls')).toBeHidden();
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

  test('should keep the surah information button beside one localized title', async ({ page }) => {
    const title = page.locator('[data-surah-title-name]');
    const infoButton = page.locator('.surah-secret-title-btn');
    await expect(title).toBeVisible();
    await expect(infoButton).toBeVisible();

    const titleText = await title.textContent();
    expect(titleText).toMatch(/الفاتحة|Al-Faatiha/);
    expect(titleText).not.toMatch(/الفاتحة.*Al-Faatiha|Al-Faatiha.*الفاتحة/);

    const titleBox = await title.boundingBox();
    const infoBox = await infoButton.boundingBox();
    expect(titleBox).not.toBeNull();
    expect(infoBox).not.toBeNull();
    expect(Math.abs(titleBox!.y - infoBox!.y)).toBeLessThan(8);

    await expect(page.locator('.juz-label').first()).not.toHaveText('juz_num');
  });

  test('should resize the tafsir sheet with its grip and keep its body scroll-contained', async ({ page }) => {
    await page.locator('#tafsirCurtainHandle').click();
    const curtain = page.locator('#tafsirCurtain');
    const grip = page.locator('#tafsirCurtainGrip');
    const body = page.locator('#tafsirCurtainBody');
    await expect(curtain).toHaveClass(/open/);
    await expect(grip).toBeVisible();

    const before = await curtain.boundingBox();
    expect(before).not.toBeNull();
    await grip.dispatchEvent('pointerdown', { pointerId: 31, clientY: 500 });
    await grip.dispatchEvent('pointermove', { pointerId: 31, clientY: 420 });
    await grip.dispatchEvent('pointerup', { pointerId: 31, clientY: 420 });

    const after = await curtain.boundingBox();
    expect(after).not.toBeNull();
    expect(after!.height).toBeGreaterThan(before!.height + 40);
    await expect(body).toHaveCSS('overflow-y', 'auto');
    await expect(body).toHaveCSS('overscroll-behavior-y', 'contain');
  });
});
