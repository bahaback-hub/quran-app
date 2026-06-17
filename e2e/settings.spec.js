import { test, expect } from '@playwright/test';

/**
 * Helper: activate a settings tab by its data-tab attribute.
 * The settings panel uses CSS-only tabs: `.settings-tab-content` is
 * `display: none` unless it has the `.active` class (set by clicking
 * the corresponding `.settings-tab` button).
 */
async function activateTab(page, tabName) {
  await page.evaluate((name) => {
    // Click the tab button — this triggers the app's tab-switch handler
    const btn = document.querySelector(`.settings-tab[data-tab="${name}"]`);
    if (btn) btn.click();
    // Fallback: manually toggle .active classes
    document.querySelectorAll('.settings-tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.settings-tab-content').forEach((c) => c.classList.remove('active'));
    const tabBtn = document.querySelector(`.settings-tab[data-tab="${name}"]`);
    const tabContent = document.querySelector(`.settings-tab-content[data-tab="${name}"]`);
    if (tabBtn) tabBtn.classList.add('active');
    if (tabContent) tabContent.classList.add('active');
  }, tabName);
  await page.waitForTimeout(150);
}

test.describe('الإعدادات', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      const panel = document.getElementById('settingsPanel');
      if (panel) {
        panel.classList.add('open');
        // Force the panel on-screen in case the CSS transition hasn't
        // completed yet, so toBeVisible() assertions on inner elements
        // don't time out.
        panel.style.right = '0';
      }
    });
    // Give the layout a tick to settle
    await page.waitForTimeout(300);
  });

  test('لوحة الإعدادات تفتح', async ({ page }) => {
    await expect(page.locator('#settingsPanel')).toHaveClass(/open/);
    await expect(page.locator('#settingsPanel h2')).toBeVisible();
  });

  test('يوجد حقل المدينة والدولة', async ({ page }) => {
    // These inputs live under the "prayer" tab (active by default).
    await expect(page.locator('#cityInput')).toBeVisible();
    await expect(page.locator('#countryInput')).toBeVisible();
  });

  test('طريقة الحساب قابلة للتغيير', async ({ page }) => {
    await page.selectOption('#methodSelect', '5');
    await expect(page.locator('#methodSelect')).toHaveValue('5');
  });

  test('مفتاح الأذان موجود', async ({ page }) => {
    // #azanToggle lives under the "azan" tab.
    await activateTab(page, 'azan');
    await expect(page.locator('#azanToggle')).toBeVisible();
  });

  test('اختيار حجم الخط', async ({ page }) => {
    // #fontSizeSelect lives under the "display" tab.
    await activateTab(page, 'display');
    await page.selectOption('#fontSizeSelect', '36');
    await expect(page.locator('#fontSizeSelect')).toHaveValue('36');
  });

  test('اختيار الخلفية', async ({ page }) => {
    // The actual select id in settings panel is #presBgSelect (presentation
    // background), not #bgSelect — the old selector never matched any
    // element and the test always failed. It lives under the "display" tab.
    // Valid options: plain | nature | singleNature | animated | scene | auto
    await activateTab(page, 'display');
    await page.selectOption('#presBgSelect', 'nature');
    await expect(page.locator('#presBgSelect')).toHaveValue('nature');
  });

  test('زر إعادة ضبط الإعدادات موجود', async ({ page }) => {
    // The reset button lives under the "tools" tab.
    await activateTab(page, 'tools');
    await expect(page.locator('#resetSettingsBtn')).toBeVisible();
  });
});
