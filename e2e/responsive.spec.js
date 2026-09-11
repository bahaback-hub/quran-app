import { test, expect } from './fixtures/mock-network';

// Note: Some tests are skipped on CI (process.env.CI === 'true') due to
// environment-specific flakiness (headless browser timing, panel-open
// pointer interception, sub-pixel layout differences). They still run
// locally for development feedback.

test.describe('أدوات القراءة على الجوال', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.evaluate(() => {
      const ws = document.getElementById('welcomeScreen');
      if (ws) ws.remove();
    });
  });

  test('لا يوجد شريط تنقل سفلي', async ({ page }) => {
    await expect(page.locator('#bottomNav')).toHaveCount(0);
  });

  test('أدوات القراءة ظاهرة مباشرة', async ({ page }) => {
    await expect(page.locator('#controls')).toBeVisible();
    await expect(page.locator('#surahSelect')).toBeVisible();
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
    // Allow 2px tolerance for sub-pixel rounding
    expect(box.x + box.width).toBeLessThanOrEqual(322);
  });

  test('أدوات القراءة ظاهرة على الشاشة الكبيرة (1920×1080)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await expect(page.locator('#controls')).toBeVisible();
  });

  test('أدوات القراءة ظاهرة على الجوال (390×844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('#controls')).toBeVisible();
  });

  test('شكل الجوال لا يُفرض على شاشة كبيرة حتى داخل بيئة Capacitor', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    // Simulate the Capacitor-native class (what the WebView adds) and confirm
    // the broad layout still wins on a wide viewport.
    await page.evaluate(() => {
      document.body.classList.add('capacitor-native');
      document.documentElement.classList.add('capacitor-native');
    });
    // The container must not be forced to phone width.
    const width = await page.evaluate(() =>
      document.querySelector('.container').getBoundingClientRect().width
    );
    expect(width).toBeGreaterThan(1200);
  });

  test('شكل الجوال يبقى على شاشة صغيرة داخل بيئة Capacitor', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.evaluate(() => {
      document.body.classList.add('capacitor-native');
      document.documentElement.classList.add('capacitor-native');
    });
    await expect(page.locator('#controls')).toBeVisible();
  });

  test('الحاوية تتسع على الشاشة الواسعة (≥1440)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    const width = await page.evaluate(() =>
      document.querySelector('.container').getBoundingClientRect().width
    );
    // Wider than the desktop default (1200px) once the >=1440 rule applies.
    expect(width).toBeGreaterThan(1200);
  });

  test('الشريط الجانبي لا يغطي الآيات على الجوال (390×844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.evaluate(() => {
      const ws = document.getElementById('welcomeScreen');
      if (ws) { ws.remove(); }
    });
    // Wait for real surah content to render.
    await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });

    const railBox = await page.locator('#readerSideTools').boundingBox();
    const content = await page.locator('.surah-content').boundingBox();
    const bodyPad = await page.evaluate(() => getComputedStyle(document.body).paddingLeft);
    // Closed state: the rail is a slim vertical rail on the far left (~10%).
    // The surah content reserves space (body/surah padding) so the ayah text
    // never runs underneath the rail.
    expect(railBox).not.toBeNull();
    expect(content).not.toBeNull();
    expect(bodyPad).toBe('0px');
    expect(railBox.width).toBeLessThanOrEqual(64);
    expect(railBox.width).toBeGreaterThanOrEqual(40);
    // The content's left padding keeps the ayahs clear of the rail. The text
    // region starts at content.x + paddingLeft, which must sit at/right of the
    // rail's right edge (with a small rounding tolerance across engines).
    const contentPad = await page.locator('.surah-content').evaluate((el) =>
      getComputedStyle(el).paddingLeft
    );
    const textStart = content.x + parseFloat(contentPad);
    expect(textStart + 2).toBeGreaterThanOrEqual(railBox.x + railBox.width);

    // Open the tafsir: the screen splits 40% curtain / 60% ayahs.
    await page.locator('#tafsirCurtainHandle').click();
    await expect(page.locator('.tafsir-curtain')).toHaveClass(/open/, { timeout: 10000 });
    await page.waitForTimeout(400);

    const curtainBox = await page.locator('.tafsir-curtain').boundingBox();
    const contentOpen = await page.locator('.surah-content').boundingBox();
    const bodyPadOpen = await page.evaluate(() => getComputedStyle(document.body).paddingLeft);
    expect(curtainBox).not.toBeNull();
    expect(contentOpen).not.toBeNull();
    // Curtain occupies ~40% from the left edge.
    expect(curtainBox.width / 390).toBeGreaterThan(0.36);
    expect(curtainBox.width / 390).toBeLessThan(0.44);
    // Body pushed right by ~40% so the ayahs take the remaining ~60%.
    expect(parseFloat(bodyPadOpen)).toBeGreaterThan(130);
    expect(contentOpen.x).toBeGreaterThan(150);
  });

  test('الشريط الجانبي لا يغطي الآيات على اللوحي (1024×1366)', async ({ page }) => {
    // Tablet viewports (768–1024) hit the range where the rail (78px) floats
    // over the centered container, so the surah text must reserve its width.
    await page.setViewportSize({ width: 1024, height: 1366 });
    await page.goto('/');
    await page.evaluate(() => {
      const ws = document.getElementById('welcomeScreen');
      if (ws) { ws.remove(); }
    });
    await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });

    const railBox = await page.locator('#readerSideTools').boundingBox();
    const content = await page.locator('.surah-content').boundingBox();
    expect(railBox).not.toBeNull();
    expect(content).not.toBeNull();
    expect(railBox.width).toBeLessThanOrEqual(78);
    // The whole surah box (background included) must start at/right of the
    // rail's right edge — not just the ayah text inside it.
    expect(content.x + 2).toBeGreaterThanOrEqual(railBox.x + railBox.width);
    const contentPad = await page.locator('.surah-content').evaluate((el) =>
      getComputedStyle(el).paddingLeft
    );
    const textStart = content.x + parseFloat(contentPad);
    expect(textStart + 2).toBeGreaterThanOrEqual(railBox.x + railBox.width);
  });
});
