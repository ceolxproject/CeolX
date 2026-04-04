import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'apps/server/vitest.config.ts',
      'packages/api/vitest.config.ts',
      'packages/auth/vitest.config.ts',
      'packages/cache/vitest.config.ts',
      'packages/email/vitest.config.ts',
    ],
  },
});
