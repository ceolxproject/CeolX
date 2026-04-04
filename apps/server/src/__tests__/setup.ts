/**
 * Test environment setup — stubs required env vars so that modules using
 * @CeolX/env/server can load without a real .env file during vitest runs.
 */
import { vi } from 'vitest';

vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test');
vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-at-least-32-characters-long-for-testing');
vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000');
vi.stubEnv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000');
vi.stubEnv('NODE_ENV', 'test');
