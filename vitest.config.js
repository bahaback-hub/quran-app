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
    // Parallel test files for speed (was fileParallelism:false). Safe because
    // every file runs in an isolated fork AND worker console output goes
    // straight to stdout (disableConsoleIntercept), which removes the Vitest
    // teardown race that originally forced sequential runs.
    fileParallelism: true,
    // Vitest 4.x worker teardown can race with an in-flight console RPC call,
    // surfacing as "EnvironmentTeardownError ... onUserConsoleLog was pending"
    // and failing the run (exit 1) even though every test passes. Writing worker
    // console output straight to stdout instead of forwarding it over the worker
    // RPC removes that race entirely — the documented Vitest remedy.
    disableConsoleIntercept: true,
    coverage: {
      reporter: ['text', 'html', 'json-summary', 'json'],
      // Enforced thresholds — current baseline is lines 86.85%, branches 75.06%,
      // functions 85.37%, statements 86.35%. The floors sit ~1.5-2 points below
      // the baseline so ordinary coverage jitter does not fail CI, while any
      // silent regression below them stops the build (the previous floors of
      // 80/70 left too much room for unnoticed drift).
      thresholds: {
        lines: 85,
        functions: 84,
        branches: 73,
        statements: 85,
      },
      exclude: [
        'src/translations/**',
        'src/**/index.js',
        'src/features/search/search.ts',
        'src/types.ts',
        // Re-export wrappers — they have no logic to test
        'src/schemas-validate.ts',
        'src/templates.ts',
        // Stylesheets are not JavaScript. Feature modules import them since
        // the CSS split, and the v8 instrumenter lists them with 0 statements.
        '**/*.css',
      ],
    },
  },
});
