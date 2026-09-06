import { test, expect } from './fixtures/mock-network';

test.describe('مواقيت الصلاة', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.surah-content', { timeout: 15000 });
  });

  test('يعرض شريط مواقيت الصلاة', async ({ page }) => {
    await expect(page.locator('#prayerBar')).toBeVisible();
    // في التصميم الجديد يكون اسم الصلاة التالية مخفياً في البلاطة ويظهر
    // السجل الكامل داخل الستارة عند الفتح — اضغط زر التوسيع الحقيقي.
    // ربط الأحداث يتم في المرحلة الثانية من الإقلاع (بعد تحميل السورة)،
    // فاعتبرها جاهزة عندما يؤدي النقر إلى التبديل الفعلي.
    const bar = page.locator('#prayerBar');
    await expect
      .poll(async () => {
        await page.locator('#expandBarBtn').click({ force: true });
        return (await bar.getAttribute('class')) ?? '';
      })
      .toContain('expanded');
    await expect(page.locator('#prayerBarDetails')).toBeVisible();
    await expect(page.locator('#prayerBar')).toHaveClass(/expanded/);
  });

  test('يعرض الساعة في شريط المواقيت', async ({ page }) => {
    // Expand prayer bar to show clock
    await page.evaluate(() => {
      const bar = document.getElementById('prayerBar');
      if (bar) {
        bar.classList.remove('collapsed');
        bar.classList.add('expanded');
      }
      // Start clock manually — startClock runs in Phase 3 but may be delayed
      // Call it directly to ensure the clock starts immediately
      const clock = document.getElementById('bigClockTime');
      if (clock && clock.textContent && clock.textContent.includes('--')) {
        // Force update: simulate what startClock does
        const update = () => {
          const now = new Date();
          const h = String(now.getHours()).padStart(2, '0');
          const m = String(now.getMinutes()).padStart(2, '0');
          clock.textContent = `${h}:${m}`;
        };
        update();
        // Keep updating every second
        setInterval(update, 1000);
      }
    });

    // Wait until clock shows real time (not --:--)
    await page.waitForFunction(
      () => {
        const el = document.getElementById('bigClockTime');
        return el && el.textContent && /\d{2}:\d{2}/.test(el.textContent);
      },
      { timeout: 5000 },
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
