import { test, expect } from '@playwright/test';

test.describe('التنقل السفلي (جوال)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.evaluate(() => {
      const ws = document.getElementById('welcomeScreen');
      if (ws) ws.remove();
    });
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

  test('يعمل على آيفون صغير (375×667)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.locator('.container')).toBeVisible();
  });

  test('يعمل على بكسل صغير (360×640)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/');
    await expect(page.locator('.container')).toBeVisible();
  });

  test('يعمل في الوضع الأفقي (740×360)', async ({ page }) => {
    await page.setViewportSize({ width: 740, height: 360 });
    await page.goto('/');
    await expect(page.locator('.container')).toBeVisible();
  });

  test('شاشة عريضة جداً (2560×1440)', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.goto('/');
    await expect(page.locator('.container')).toBeVisible();
  });

  test('العنوان الرئيسي لا يفيض على شاشة 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await page.evaluate(() => {
      const ws = document.getElementById('welcomeScreen');
      if (ws) ws.remove();
    });
    const h1 = page.locator('.header h1');
    await expect(h1).toBeVisible();
    const box = await h1.boundingBox();
    expect(box.width).toBeLessThanOrEqual(320);
  });

  test('أزرار الرأس لا تتجاوز عرض الشاشة على 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await page.evaluate(() => {
      const ws = document.getElementById('welcomeScreen');
      if (ws) ws.remove();
    });
    const menu = page.locator('.header-menu-container');
    await expect(menu).toBeVisible();
    const box = await menu.boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  });
});
