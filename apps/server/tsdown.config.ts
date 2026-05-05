import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: './src/index.ts',
  format: 'esm',
  outDir: './dist',
  clean: true,
  noExternal: [/@CeolX\/.*/],
  external: ['firebase-admin', 'firebase-admin/app', 'firebase-admin/messaging'],
});
