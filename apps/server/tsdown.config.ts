import { defineConfig } from 'tsdown';

const sharedExternals = ['firebase-admin', 'firebase-admin/app', 'firebase-admin/messaging'];
const sharedNoExternal = [/@CeolX\/.*/];

export default defineConfig([
  {
    entry: './src/index.ts',
    format: 'esm',
    outDir: './dist',
    clean: true,
    noExternal: sharedNoExternal,
    external: sharedExternals,
  },
  {
    entry: { index: './src/vercel-entry.ts' },
    format: 'esm',
    outDir: './api',
    outExtensions: () => ({ js: '.js' }),
    noExternal: sharedNoExternal,
    external: sharedExternals,
    // CJS interop wrappers must be split into chunks; route them into a
    // _chunks/ subdirectory so Vercel's serverless-function discovery
    // (which only scans top-level api/*.js) ignores them.
    outputOptions: {
      chunkFileNames: '_chunks/[name].js',
    },
  },
]);
