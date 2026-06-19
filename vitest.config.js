import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup-i18n.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    globals: true,
    coverage: {
      reporter: ['text', 'html', 'json-summary', 'json'],
      exclude: [
        'src/translations/**',
        'src/**/index.js',
        'src/search.ts',
        'src/types.ts',
        // Re-export wrappers — they have no logic to test
        'src/schemas-validate.ts',
      ],
    },
  },
});
