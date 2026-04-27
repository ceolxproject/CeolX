import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Set env vars at vitest startup so modules using @CeolX/env/server can
    // evaluate at import time (e.g. the notification.push handler pulls in
    // @CeolX/db, which validates required server env at module load).
    // Mirrors src/__tests__/setup.ts; that file relies on vi.stubEnv which
    // runs too late for top-level imports.
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      BETTER_AUTH_SECRET: 'test-secret-at-least-32-characters-long-for-testing',
      BETTER_AUTH_URL: 'http://localhost:3000',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
      NODE_ENV: 'test',
      TYPESENSE_HOST: 'localhost',
      TYPESENSE_API_KEY: 'test',
    },
  },
});
