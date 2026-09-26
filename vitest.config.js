import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup-i18n.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    globals: true,
    testTimeout: 120000,
    hookTimeout: 120000,
    teardownTimeout: 30000,
    pool: 'forks',
    isolate: true,
    fileParallelism: false,
    // Vitest 4.x worker teardown can race with an in-flight console RPC call,
    // surfacing as "EnvironmentTeardownError ... onUserConsoleLog was pending"
    // and failing the run (exit 1) even though every test passes. Writing worker
    // console output straight to stdout instead of forwarding it over the worker
    // RPC removes that race entirely — the documented Vitest remedy.
    disableConsoleIntercept: true,
    coverage: {
      reporter: ['text', 'html', 'json-summary', 'json'],
      // Enforced thresholds — current baseline is lines 86.7%, branches 74.9%,
      // functions 85.6%, statements 86.3%. We hold at 80% lines/statements and
      // 70% branches/functions as a hard floor; the CI also enforces 80% lines
      // via coverage-summary.json. Tightening these numbers forces new code to
      // keep coverage discipline rather than regressing silently.
      thresholds: {
        lines: 80,
        functions: 70,
        branches: 70,
        statements: 80,
      },
      exclude: [
        'src/translations/**',
        'src/**/index.js',
        'src/features/search/search.ts',
        'src/types.ts',
        // Re-export wrappers — they have no logic to test
        'src/schemas-validate.ts',
        'src/templates.ts',
      ],
    },
  },
});
