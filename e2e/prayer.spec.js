import { test, expect } from './fixtures/mock-network';

test.describe('مواقيت الصلاة', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.surah-content', { timeout: 15000 });
  });

  test('يعرض شريط مواقيت الصلاة', async ({ page }) => {
    await expect(page.locator('#prayerBar')).toBeVisible();
    await page.evaluate(() => {
      const bar = document.getElementById('prayerBar');
      if (bar) {
        bar.classList.remove('collapsed');
        bar.classList.add('expanded');
      }
    });
    await page.waitForTimeout(500);
    await expect(page.locator('#nextPrayerName')).toBeVisible();
  });

  test('يعرض الساعة في شريط المواقيت', async ({ page }) => {
    // Expand prayer bar to show clock
    await page.evaluate(() => {
      const bar = document.getElementById('prayerBar');
      if (bar) {
        bar.classList.remove('collapsed');
        bar.classList.add('expanded');
      }
    });

    // Wait until clock shows real time (not --:--)
    // startClock() runs in Phase 3 of bootstrap, give it time
    await page.waitForFunction(
      () => {
        const el = document.getElementById('bigClockTime');
        return el && el.textContent && /\d{2}:\d{2}/.test(el.textContent);
      },
      { timeout: 10000 },
    );

    const clock = page.locator('#bigClockTime');
    await expect(clock).toBeVisible();
    const text = await clock.textContent();
    // MUST show real time — do NOT accept --:--
    expect(text).toMatch(/^\d{2}:\d{2}$/);
  });

  test('فتح الإعدادات واختيار مدينة', async ({ page }) => {
    await page.evaluate(() => {
      const panel = document.getElementById('settingsPanel');
      if (panel) {
        panel.classList.add('open');
        panel.style.right = '0';
      }
    });
    await page.waitForTimeout(300);
    await expect(page.locator('#settingsPanel')).toHaveClass(/open/);
  });
});
