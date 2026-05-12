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
    // Written to dist/vercel-bundle.mjs (not api/index.js) for two reasons:
    // 1. apps/server/api/index.ts is committed so Vercel autodetects the
    //    serverless function — it re-exports from this .mjs bundle.
    // 2. The explicit .mjs extension lets @vercel/node's esbuild resolve the
    //    import without falling foul of Node ESM's "explicit extension required"
    //    rule that breaks plain `import '../src/app'` in transpile-only output.
    entry: { 'vercel-bundle': './src/vercel-entry.ts' },
    format: 'esm',
    outDir: './dist',
    outExtensions: () => ({ js: '.mjs' }),
    noExternal: sharedNoExternal,
    external: sharedExternals,
    outputOptions: {
      chunkFileNames: '_chunks/vercel-[name].mjs',
    },
  },
]);
