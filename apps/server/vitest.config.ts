import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      BETTER_AUTH_SECRET: 'test-secret-at-least-32-characters-long-for-testing',
      BETTER_AUTH_URL: 'http://localhost:3000',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
      NODE_ENV: 'test',
    },
  },
});
