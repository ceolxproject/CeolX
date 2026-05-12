// This file exists for Vercel's serverless-function autodetect — it scans
// for committed api/*.{ts,js} files. The real handler is the tsdown-built
// `dist/vercel-bundle.mjs` (which inlines workspace deps + adds `.js`
// extensions on every internal import). Importing it with the explicit
// `.mjs` extension avoids Node ESM's "Cannot find module" error that fires
// when @vercel/node transpile-only output keeps extensionless relative
// imports.
export { default } from '../dist/vercel-bundle.mjs';
