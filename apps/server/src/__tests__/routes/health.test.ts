import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbExecute = vi.fn();
const typesenseHealth = vi.fn();
const redisPing = vi.fn();

vi.mock('@CeolX/db', () => ({ db: { execute: dbExecute } }));
vi.mock('@CeolX/api/lib/typesense', () => ({
  typesenseClient: { health: { retrieve: typesenseHealth } },
}));
vi.mock('@CeolX/cache', () => ({
  pingRedis: redisPing,
  isRedisConfigured: () =>
    Boolean(process.env['UPSTASH_REDIS_REST_URL'] && process.env['UPSTASH_REDIS_REST_TOKEN']),
}));

const { default: healthRoutes } = await import('../../routes/health.js');

type Check = { status: 'ok' | 'down' | 'skipped'; latencyMs: number };
type HealthBody = {
  status: string;
  commit: string;
  degraded?: boolean;
  checks?: { database: Check; redis: Check; search: Check };
};

function buildApp() {
  const app = new Hono();
  app.route('/', healthRoutes);
  return app;
}

async function readBody(res: Response): Promise<HealthBody> {
  return (await res.json()) as HealthBody;
}

/** Upstash vars are absent in the vitest env, so Redis reports "skipped" unless a test opts in. */
function enableRedis() {
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://test.upstash.io');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
}

beforeEach(() => {
  dbExecute.mockResolvedValue([{ '?column?': 1 }]);
  typesenseHealth.mockResolvedValue({ ok: true });
  redisPing.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('GET /health', () => {
  it('returns 200 without touching any dependency', async () => {
    const res = await buildApp().request('/health');

    expect(res.status).toBe(200);
    expect((await readBody(res)).status).toBe('ok');
    expect(dbExecute).not.toHaveBeenCalled();
    expect(typesenseHealth).not.toHaveBeenCalled();
    expect(redisPing).not.toHaveBeenCalled();
  });

  it('reports the live commit so an alert identifies the build', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234');

    const res = await buildApp().request('/health');

    expect((await readBody(res)).commit).toBe('abc1234');
  });
});

describe('GET /health/deps', () => {
  it('returns 200 ok when every dependency responds', async () => {
    enableRedis();

    const res = await buildApp().request('/health/deps');
    const body = await readBody(res);

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.degraded).toBe(false);
    expect(body.checks?.database.status).toBe('ok');
    expect(body.checks?.redis.status).toBe('ok');
    expect(body.checks?.search.status).toBe('ok');
  });

  it('returns 503 when Postgres is unreachable', async () => {
    dbExecute.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await buildApp().request('/health/deps');
    const body = await readBody(res);

    expect(res.status).toBe(503);
    expect(body.status).toBe('down');
    expect(body.checks?.database.status).toBe('down');
  });

  it('returns 503 when Redis is unreachable — the rate limiter has no fallback', async () => {
    enableRedis();
    redisPing.mockRejectedValue(new Error('ENOTFOUND'));

    const res = await buildApp().request('/health/deps');

    expect(res.status).toBe(503);
    expect((await readBody(res)).checks?.redis.status).toBe('down');
  });

  it('returns 200 degraded when only Typesense is unreachable', async () => {
    enableRedis();
    typesenseHealth.mockRejectedValue(new Error('ENOTFOUND'));

    const res = await buildApp().request('/health/deps');
    const body = await readBody(res);

    expect(res.status).toBe(200);
    expect(body.status).toBe('degraded');
    expect(body.degraded).toBe(true);
    expect(body.checks?.search.status).toBe('down');
  });

  it('reports Redis as skipped when Upstash is not configured', async () => {
    const res = await buildApp().request('/health/deps');

    expect(res.status).toBe(200);
    expect((await readBody(res)).checks?.redis.status).toBe('skipped');
    expect(redisPing).not.toHaveBeenCalled();
  });

  it('never leaks driver error details', async () => {
    dbExecute.mockRejectedValue(new Error('password authentication failed for user "ceolx"'));

    const res = await buildApp().request('/health/deps');

    expect(await res.text()).not.toContain('password');
  });
});
