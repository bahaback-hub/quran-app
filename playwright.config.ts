import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration for Quran App.
 *
 * Runs E2E tests across three desktop browser engines (Chromium, Firefox,
 * WebKit) plus a mobile Chrome project (Pixel 5). All projects are
 * blocking in CI — the responsive UI has been optimized to support both
 * desktop and mobile viewports.
 *
 * Run with: npx playwright test
 * UI mode:  npx playwright test --ui
 * Specific: npx playwright test --project=firefox
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html'], ['github'], ['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
