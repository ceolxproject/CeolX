import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Set env vars at vitest startup so modules that import @CeolX/env/server can
    // evaluate at import time. That package validates its whole schema on module
    // load via @t3-oss/env-core, so a single transitive import anywhere in the
    // graph fails the entire test file with "Invalid environment variables" —
    // which is what happened when _profile-helpers started reading the venue gate
    // config, taking four unrelated suites down with it.
    //
    // Mirrors apps/server/vitest.config.ts. Values are deliberately obvious
    // non-secrets: anything that needs a specific value should mock
    // @CeolX/env/server with the getter idiom (see src/__tests__/mux.test.ts)
    // rather than depend on what is set here.
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      BETTER_AUTH_SECRET: 'test-secret-at-least-32-characters-long-for-testing',
      BETTER_AUTH_URL: 'http://localhost:3000',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
      NODE_ENV: 'test',
      TYPESENSE_HOST: 'localhost',
      TYPESENSE_API_KEY: 'test',
      GOOGLE_MAPS_API_KEY: 'test-google-key',
    },
  },
});
