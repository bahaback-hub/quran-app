import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup-i18n.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    // Enable global test APIs for convenience
    globals: true,
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'src/__tests__/**',
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/types.ts',
        'src/config.ts',
        'src/surahs-data.ts',
        'src/adhkar-data.ts',
      ],
    },
  },
});
