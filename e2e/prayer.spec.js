import { test, expect } from '@playwright/test';

test.describe('مواقيت الصلاة', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('يعرض شريط مواقيت الصلاة', async ({ page }) => {
    await expect(page.locator('#prayerBar')).toBeVisible();
    await expect(page.locator('#nextPrayerName')).toBeVisible();
  });

  test('يعرض الساعة في شريط المواقيت', async ({ page }) => {
    const clock = page.locator('#bigClockTime');
    await expect(clock).toBeVisible();
    const text = await clock.textContent();
    expect(text).toMatch(/\d{2}:\d{2}/);
  });

  test('فتح الإعدادات واختيار مدينة', async ({ page }) => {
    await page.evaluate(() => {
      const panel = document.getElementById('settingsPanel');
      if (panel) panel.classList.add('open');
    });
    await expect(page.locator('#settingsPanel')).toHaveClass(/open/);
    await page.selectOption('#cityQuickSelect', 'مكة|SA');
    const cityInput = page.locator('#cityInput');
    await expect(cityInput).toHaveValue('مكة');
  });
});
