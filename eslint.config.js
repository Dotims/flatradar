import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // dist holds Vite output: minified third-party code that no rule here has anything
  // useful to say about.
  { ignores: ['**/node_modules/**', '**/dist/**', 'data/**', '.vercel/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // The dashboard runs in a browser; the collector runs in Node. Neither set of
    // globals is declared by the recommended configs, and no-undef cannot see either.
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { window: 'readonly', document: 'readonly', fetch: 'readonly', console: 'readonly' },
    },
  },
  {
    files: ['apps/collector/**/*.ts', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', fetch: 'readonly', Buffer: 'readonly' },
    },
  },
);
