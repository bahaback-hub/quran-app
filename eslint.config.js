import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
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
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-undef': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-prototype-builtins': 'off',
      'prefer-const': 'warn',
      'no-var': 'error',
    },
  },
  {
    files: ['src/**/*.js'],
    rules: {
      'no-console': 'off', // Allow console in source files for now
    },
  },
  {
    files: ['src/__tests__/**/*.js', 'e2e/**/*.js'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'android/', '.tmp/', 'coverage/'],
  },
];
