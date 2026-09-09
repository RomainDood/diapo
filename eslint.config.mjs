import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';
import craftRules from '@craft-ts/dev-tools/eslint-rules';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '.references/**', 'test-results/**', '**/architecture/catalog.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    plugins: { 'craft-ts': craftRules },
    rules: {
      ...craftRules.configs.security.rules,
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: [
      'src/server/**/*.ts',
      'src/**/*.fn-serveur.ts',
      'src/**/*.mw-serveur.ts',
      'src/**/*.spec.ts',
      'src/**/*.test.ts',
    ],
    plugins: { 'craft-ts': craftRules },
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.app.json', './tsconfig.spec.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...craftRules.configs.effect.rules,
      // Visible text belongs to src/i18n, not to a template literal.
      ...craftRules.configs.i18n.rules,
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_' }],

    },
  },
  {
    files: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.spec.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'craft-ts/no-async-await': 'off',
      'craft-ts/no-throw': 'off',
      'craft-ts/prefer-browser-boundaries': 'off',
      'craft-ts/prefer-craft-template-blocks': 'off',
      'craft-ts/no-ephemeral-template-form-state': 'off',
    },
  },

  {
    files: ['e2e/**/*.ts'],
    ...playwright.configs['flat/recommended'],
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
  prettier,
);
