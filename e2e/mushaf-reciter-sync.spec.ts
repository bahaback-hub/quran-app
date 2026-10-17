/**
 * Regression: changing the surah from the reader dropdown while in mushaf
 * mode must sync the player/reciter to the chosen surah (the page jump alone
 * used to leave the previous surah loaded) and keep the mushaf page on screen
 * (loadSurah renders the text view, so the page is force-reloaded after it).
 */

import { test, expect } from './fixtures/mock-network';

test('surah change in mushaf mode updates the reciter and keeps the page', async ({ page }) => {
  test.setTimeout(180_000);

  // Ayah lookups: surah 2 starts on page 2, everything else on page 1.
  await page.route('https://api.alquran.cloud/v1/ayah/**', (route) => {
    const m = /\/ayah\/(\d+):/.exec(route.request().url());
    const pageNum = m && m[1] === '2' ? 2 : 1;
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 200, status: 'OK', data: { page: pageNum } }),
    });
  });

  await page.goto('/');
  await page.waitForSelector('#surahContent .ayah', { timeout: 60_000 });

  await expect
    .poll(
      async () => {
        if (!(await page.evaluate(() => document.body.classList.contains('mushaf-active')))) {
          await page.locator('#viewMushafBtn').click();
        }
        return page.evaluate(() => document.body.classList.contains('mushaf-active'));
      },
      { timeout: 60_000 },
    )
    .toBe(true);
  await page.waitForSelector('.mushaf-container', { timeout: 60_000 });

  await page.selectOption('#surahSelect', '2');

  await expect
    .poll(
      async () => {
        const name = await page.locator('#playerSurahName').textContent();
        const hasPage = (await page.locator('.mushaf-container').count()) === 1;
        return hasPage && (name ?? '').includes('البقرة');
      },
      { timeout: 30_000 },
    )
    .toBe(true);
});
