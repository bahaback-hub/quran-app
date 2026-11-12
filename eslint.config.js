import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Files that still assign HTML through `.innerHTML`. They are grandfathered so
 * the ban can land without a 61-site refactor in one go; every other source
 * file gets the error. Remove a file from this list when it stops using it —
 * new code should build DOM nodes (`createElement`/`textContent`) or go through
 * the escaped templates in `src/templates*`.
 */
const INNERHTML_LEGACY = [
  'src/adhkar.ts',
  'src/adhkar-personal.ts',
  'src/ayah-modal.ts',
  'src/error-boundary.ts',
  'src/events/help-events.ts',
  'src/favorites.ts',
  'src/features/audio/audio.ts',
  'src/features/mushaf/mushaf.ts',
  'src/features/prayer/prayer.ts',
  'src/features/presentation/presentation.ts',
  'src/features/search/search-ui.ts',
  'src/hifz-room.ts',
  'src/home.ts',
  'src/lang-switcher.ts',
  'src/main.ts',
  'src/overlays.ts',
  'src/reading-plans.ts',
  'src/reading-stats.ts',
  'src/surah-list.ts',
  'src/surah-loader.ts',
  'src/surah-render.ts',
  'src/tafsir.ts',
  'src/tajweed.ts',
];

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        // Capacitor globals
        Capacitor: 'readonly',
        CapacitorHttp: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-undef': 'off', // TypeScript handles this
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-prototype-builtins': 'off',
      'prefer-const': 'warn',
      'no-var': 'error',
      // Strict equality — prevents accidental type coercion bugs
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      // Prevent accidental assignment in conditions
      'no-cond-assign': ['error', 'except-parens'],
      // Require default case in switch statements
      'default-case': 'warn',
      // Enforce consistent brace style for control statements
      curly: ['error', 'all'],
      // Disallow empty block statements (except catch)
      'no-empty-function': 'warn',
      // Disallow unnecessary concatenation
      'no-useless-concat': 'warn',
      // Disallow unnecessary escape characters
      'no-useless-escape': 'warn',
      // No new HTML injection sinks: an unescaped `.innerHTML` is the shortest
      // path from user data to XSS. Build nodes instead (see AGENTS.md).
      'no-restricted-properties': [
        'error',
        {
          property: 'innerHTML',
          message:
            'Do not assign HTML strings to .innerHTML. Build DOM nodes (createElement/textContent) or use the escaped templates in src/templates*.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.js'],
    rules: {
      // Warn on console.log/info/debug in source; allow warn/error for user-facing messages
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['src/__tests__/**/*.ts', 'src/__tests__/**/*.js', 'e2e/**/*.js', 'e2e/**/*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: INNERHTML_LEGACY,
    rules: {
      // Grandfathered: these files predate the ban. Do not add new sinks here.
      'no-restricted-properties': 'off',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'android/', '.tmp/', 'coverage/', 'src/translations/', 'src/__tests__/'],
  },
);
