import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

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
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      // Prevent accidental assignment in conditions
      'no-cond-assign': ['error', 'except-parens'],
      // Require default case in switch statements
      'default-case': 'warn',
      // Enforce consistent brace style for control statements
      'curly': ['error', 'all'],
      // Disallow empty block statements (except catch)
      'no-empty-function': 'warn',
      // Disallow unnecessary concatenation
      'no-useless-concat': 'warn',
      // Disallow unnecessary escape characters
      'no-useless-escape': 'warn',
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.js'],
    rules: {
      'no-console': 'off', // Allow console in source files for structured logging
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
    ignores: ['dist/', 'node_modules/', 'android/', '.tmp/', 'coverage/', 'src/translations/', 'src/__tests__/'],
  },
);
