import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default tseslint.config(
  // ── Ignored paths ──────────────────────────────────────────────────────────
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/.expo/**',
      '**/*.d.ts',
      '**/*.gen.ts',
      '**/metro.config.js',
      '**/metro.config.cjs',
      '**/babel.config.js',
      'eslint.config.js',
      'commitlint.config.js',
    ],
  },

  // ── Base: JS recommended ───────────────────────────────────────────────────
  js.configs.recommended,

  // ── Base: TypeScript recommended (type-checked) ───────────────────────────
  ...tseslint.configs.recommendedTypeChecked,

  // ── Base config: all TS/JS files ──────────────────────────────────────────
  {
    files: ['**/*.{js,mjs,cjs,jsx,ts,tsx,mts,cts}'],
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import/resolver': {
        node: true,
      },
      'import/internal-regex': '^@CeolX/',
    },
    rules: {
      // ── TypeScript ──────────────────────────────────────────────────────
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // ── Imports ─────────────────────────────────────────────────────────
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          pathGroups: [
            {
              pattern: '@CeolX/**',
              group: 'internal',
            },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-duplicates': 'error',
      'import/no-cycle': ['error', { ignoreExternal: true }],

      // ── General ─────────────────────────────────────────────────────────
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },

  // ── React / JSX rules — admin and native apps ─────────────────────────────
  {
    files: ['apps/admin/**/*.{tsx,jsx}', 'apps/native/**/*.{tsx,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // ── Native app: additional browser globals ────────────────────────────────
  {
    files: ['apps/native/**/*.{js,mjs,cjs,jsx,ts,tsx,mts,cts}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  // ── Test files: relax strict rules ────────────────────────────────────────
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.tsx', '**/*.spec.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },

  // ── Seed scripts: relax unsafe rules ─────────────────────────────────────
  // Drizzle's .returning() generics don't resolve fully through ESLint's
  // type-checker. tsc --noEmit is clean; these are dev-only scripts.
  {
    files: ['**/seed.ts', '**/seed.*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  }
);
