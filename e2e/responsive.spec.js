import { test, expect } from '@playwright/test';

test.describe('التنقل السفلي (جوال)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
  });

  test('شريط التنقل السفلي مرئي', async ({ page }) => {
    await expect(page.locator('#bottomNav')).toBeVisible();
  });

  test('يحتوي على 5 أزرار', async ({ page }) => {
    const btns = page.locator('#bottomNav .bottom-nav-btn');
    await expect(btns).toHaveCount(5);
  });

  test('النقر على زر المشغل يظهر خيار المشغل', async ({ page }) => {
    await page.click('#bottomNav .bottom-nav-btn[data-tab="player"]');
    await expect(page.locator('#player')).toBeVisible();
  });
});

test.describe('التوافق — أوضاع مختلفة', () => {
  test('يعمل على شاشة سطح المكتب (1920×1080)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await expect(page.locator('.container')).toBeVisible();
  });

  test('يعمل على شاشة لوحية (768×1024)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await expect(page.locator('.container')).toBeVisible();
  });
});
