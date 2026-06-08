import { test, expect } from '@playwright/test';

test.describe('الصوت', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      const ws = document.getElementById('welcomeScreen');
      if (ws) ws.remove();
    });
    await page.selectOption('#surahSelect', '1');
    await page.waitForTimeout(3000);
    await page.evaluate(() => {
      const player = document.getElementById('player');
      if (player) player.classList.remove('collapsed');
    });
  });

  test('أزرار المشغل الأساسية موجودة', async ({ page }) => {
    await expect(page.locator('#playPauseBtn')).toBeVisible();
    await expect(page.locator('#prevAyahBtn')).toBeVisible();
    await expect(page.locator('#nextAyahBtn')).toBeVisible();
    await expect(page.locator('#prevSurahBtn')).toBeVisible();
    await expect(page.locator('#nextSurahBtn')).toBeVisible();
  });

  test('زر التشغيل/الإيقاف يعمل', async ({ page }) => {
    const playBtn = page.locator('#playPauseBtn');
    const initialIcon = await playBtn.textContent();
    await page.evaluate(() => {
      const player = document.getElementById('audioPlayer');
      if (player) {
        player.src = '';
        const btn = document.getElementById('playPauseBtn');
        if (btn) btn.click();
      }
    });
    await page.waitForTimeout(500);
    const toggledIcon = await playBtn.textContent();
    expect(toggledIcon).not.toBe(initialIcon);
  });

  test('أزرار السورة السابقة والتالية موجودة', async ({ page }) => {
    await expect(page.locator('#prevSurahBtn')).toBeVisible();
    await expect(page.locator('#nextSurahBtn')).toBeVisible();
  });

  test('يعرض اسم السورة والفاتحة في المشغل', async ({ page }) => {
    await page.waitForTimeout(1000);
    const surahName = page.locator('#playerSurahName');
    await expect(surahName).toBeVisible();
    const ayahText = page.locator('#playerCurrentAyah');
    await expect(ayahText).toBeVisible();
  });
});
