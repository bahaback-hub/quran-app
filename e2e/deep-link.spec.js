import { test, expect } from './fixtures/mock-network';

/**
 * Deep-link smoke tests — the pre-rendered SEO pages and share links land on
 * `#surah=N` or `#surah=N/A` and the SPA must boot directly into that surah,
 * syncing the selector and highlighting the requested ayah.
 */

test.describe('deep links', () => {
  test('#surah=N opens the surah and syncs the selector', async ({ page }) => {
    await page.goto('/#surah=2');

    await expect(page.locator('.ayah[data-surah="2"]').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#surahSelect')).toHaveValue('2');
  });

  test('#surah=N/A highlights the requested ayah and scrolls it into view', async ({ page }) => {
    await page.goto('/#surah=2/2');

    await expect(page.locator('.ayah[data-surah="2"]').first()).toBeVisible({ timeout: 20000 });

    const current = page.locator('.ayah[data-surah="2"][data-index="1"].current');
    await expect(current).toBeVisible({ timeout: 10000 });
    await expect(current).toContainText('ذَٰلِكَ الْكِتَابُ');
  });

  test('#page=P keeps the reader usable (no crash)', async ({ page }) => {
    await page.goto('/#page=42');

    // A page deep link simply remembers the target mushaf page; the reader
    // still lands on a usable surah (default surah 1 with no saved position).
    await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#surahSelect')).toHaveValue('1');
    await expect(page.locator('#searchToggleBtn')).toBeVisible();
  });
});
