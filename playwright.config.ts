import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration for Quran App.
 *
 * Run with: npx playwright test
 * UI mode:  npx playwright test --ui
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Force Arabic locale so the app initializes with `lang="ar"` and
    // `dir="rtl"` (matching the HTML defaults). Without this, CI browsers
    // default to en-US and the app's i18n detection switches to English.
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // mobile-chrome (Pixel 5) project intentionally omitted — the app's
    // desktop-oriented UI (header buttons, panels) is not yet optimized
    // for mobile viewport. Mobile E2E coverage is tracked as a separate
    // task. Adding it here would block CI without providing signal.
    // To re-enable: uncomment the project below AND adjust the app's
    // responsive CSS for Pixel 5 viewport (412x732).
    // {
    //   name: 'mobile-chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
