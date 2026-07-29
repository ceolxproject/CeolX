import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Metro injects __DEV__; a plain node test env does not, so any module that
  // reads it at import time throws ReferenceError before a single test runs.
  // Defining it here covers every current and future module rather than making
  // each one guard with `typeof __DEV__`.
  define: {
    __DEV__: 'false',
  },
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
