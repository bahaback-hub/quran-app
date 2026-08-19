import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Keep API route mocks in control; Workbox can otherwise intercept
    // cross-origin requests before Playwright receives them.
    serviceWorkers: 'block',
    // Force Arabic locale so the app initializes with `lang="ar"` and
    // `dir="rtl"` (matching the HTML defaults). Without this, CI browsers
    // default to en-US and the app's i18n detection switches to English,
    // breaking the smoke tests that assert RTL/Arabic.
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npx vite preview --port 4173',
    port: 4173,
    reuseExistingServer: true,
  },
});
