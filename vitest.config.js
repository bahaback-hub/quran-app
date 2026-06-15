import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup-i18n.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    globals: true,
  },
});
