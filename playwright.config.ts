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
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      // Mobile tests run but don't block CI — the app's desktop-oriented
      // UI is still being optimized for mobile viewport. Tests that fail
      // on mobile are expected to fail; they provide signal for future
      // responsive improvements without blocking the build.
      // To make mobile tests blocking: remove 'mobile-chrome' from the
      // grep ignore list in the CI workflow's playwright command.
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
