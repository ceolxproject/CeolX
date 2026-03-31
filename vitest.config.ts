import { defineConfig } from 'vitest/config';

// Root vitest config — routes test files to per-project configs so that each
// project's environment settings (happy-dom for admin, node for shared/api) are
// respected when lint-staged runs `vitest related`.
export default defineConfig({
  test: {
    projects: ['apps/admin/vitest.config.ts'],
  },
});
