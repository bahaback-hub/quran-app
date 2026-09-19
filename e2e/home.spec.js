import { test, expect } from './fixtures/mock-network';

/**
 * Home launcher tests — a first visit (no saved reading position) must land on
 * the launcher with quick tools and a 114-surah grid instead of a random surah.
 * The shared fixture seeds a reading position so most specs keep booting into
 * the reader; these tests clear it to exercise the new-visitor path.
 */

test.describe('home launcher', () => {
  test('first visit lands on the launcher with the full surah grid', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('quran_app_last_position'));
    await page.goto('/');

    const screen = page.locator('#homeScreen');
    await expect(screen).toBeVisible({ timeout: 20000 });
    await expect(screen.locator('.home-surah-card')).toHaveCount(114);
    await expect(screen.locator('.home-surah-card[data-surah="1"]')).toHaveCount(1);
    await expect(screen.locator('.home-browse-title')).toBeVisible();
    // No reader content has been loaded yet — the visitor is still choosing.
    await expect(page.locator('.ayah')).toHaveCount(0);
  });

  test('selecting a surah from the grid loads it and replaces the launcher', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('quran_app_last_position'));
    await page.goto('/');
    await expect(page.locator('#homeScreen')).toBeVisible({ timeout: 20000 });

    await page.locator('.home-surah-card[data-surah="2"]').click();

    await expect(page.locator('.ayah[data-surah="2"]').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#homeScreen')).toHaveCount(0);
    await expect(page.locator('.surah-title')).toContainText('البقرة');
  });

  test('quick action opens search from the launcher', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('quran_app_last_position'));
    await page.goto('/');
    await expect(page.locator('#homeScreen')).toBeVisible({ timeout: 20000 });

    await page.locator('.home-action-btn[data-action="search"]').click();

    await expect(page.locator('#searchInput')).toBeVisible({ timeout: 10000 });
  });

  test('launcher shows 4 primary actions with the rest tucked behind "المزيد"', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('quran_app_last_position'));
    await page.goto('/');
    await expect(page.locator('#homeScreen')).toBeVisible({ timeout: 20000 });

    // Exactly the four primary entries are visible…
    await expect(page.locator('.home-primary-actions .home-action-btn')).toHaveCount(4);
    await expect(page.locator('.home-primary-actions [data-action="read"]')).toHaveCount(1);
    await expect(page.locator('.home-primary-actions [data-action="mushaf"]')).toHaveCount(1);
    await expect(page.locator('.home-primary-actions [data-action="listen"]')).toHaveCount(1);
    await expect(page.locator('.home-primary-actions [data-action="search"]')).toHaveCount(1);

    // …while the secondary tools stay hidden until "المزيد" is tapped.
    const moreActions = page.locator('#homeMoreActions');
    await expect(moreActions).toBeHidden();
    await page.locator('#homeMoreToggle').click();
    await expect(moreActions).toBeVisible();
    await expect(moreActions.locator('.home-action-btn')).toHaveCount(5);
    await expect(moreActions.locator('[data-action="qibla"]')).toHaveCount(1);
    await expect(moreActions.locator('[data-action="prayer"]')).toHaveCount(1);
    await expect(moreActions.locator('[data-action="adhkar"]')).toHaveCount(1);
    await expect(moreActions.locator('[data-action="favorites"]')).toHaveCount(1);
    await expect(moreActions.locator('[data-action="settings"]')).toHaveCount(1);
  });

  test('primary "القراءة" opens the reader from the launcher', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('quran_app_last_position'));
    await page.goto('/');
    await expect(page.locator('#homeScreen')).toBeVisible({ timeout: 20000 });

    await page.locator('.home-action-btn[data-action="read"]').click();

    await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#homeScreen')).toHaveCount(0);
  });
});
