/**
 * E2E Tests — Settings Panel.
 *
 * The settings panel is built from a template that overlays.ts injects at
 * runtime, then wired by bindHeaderAndSettingsEvents(). Nothing about that
 * wiring was covered: the tab buttons were clickable-looking but untested, so a
 * refactor that injected the panel before cacheDom() (leaving dom.settingsPanel
 * null and initSettingsTabs() a silent no-op) would have shipped unnoticed.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from './fixtures/mock-network';

const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
  version: string;
};

const TABS = ['prayer', 'display', 'azan', 'adhkar', 'language', 'tools'] as const;

async function openSettings(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });
  await page.locator('#settingsToggleBtn').click();
  await expect(page.locator('#settingsPanel')).toHaveClass(/open/);
}

test.describe('Quran App — Settings Panel', () => {
  test('opens and closes from the header button', async ({ page }) => {
    await openSettings(page);
    await page.locator('#settingsCloseBtn').click();
    await expect(page.locator('#settingsPanel')).not.toHaveClass(/open/);
  });

  test('every tab switches its own content', async ({ page }) => {
    await openSettings(page);

    for (const tab of TABS) {
      const button = page.locator(`#settingsTabs .settings-tab[data-tab="${tab}"]`);
      await expect(button, `tab button for "${tab}" must exist`).toBeVisible();
      await button.click();
      await expect(button, `tab button for "${tab}" must become active`).toHaveClass(/active/);
      await expect(
        page.locator(`.settings-tab-content[data-tab="${tab}"]`),
        `content for "${tab}" must become active`,
      ).toHaveClass(/active/);
    }
  });

  test('reports the version the Android package ships', async ({ page }) => {
    await openSettings(page);
    await page.locator('#settingsTabs .settings-tab[data-tab="tools"]').click();

    const label = page.locator('#appVersionLabel');
    await expect(label).toBeVisible();
    // Must equal package.json, which scripts/check-version-consistency.mjs
    // pins to android/app/build.gradle versionName. If this drifts, the
    // settings screen is telling users the wrong build.
    await expect(label).toHaveText(pkg.version);
  });
});
