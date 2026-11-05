import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const nodeModules = ['fs', 'path', 'crypto', 'child_process', 'os', 'electron', 'node:fs', 'node:path', 'node:crypto'];

export default tseslint.config(
  { ignores: ['main.js', 'legacy-v1/**', 'node_modules/**', 'scripts/**', '*.config.*'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-imports': ['error', { paths: nodeModules }],
      'no-restricted-properties': ['error',
        { property: 'innerHTML', message: 'Usa el constructor DOM (ui/dom.ts); nunca innerHTML con datos.' },
        { property: 'outerHTML', message: 'No uses outerHTML.' }],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: [...nodeModules, 'obsidian'] }],
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);
