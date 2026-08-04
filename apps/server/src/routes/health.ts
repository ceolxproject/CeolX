import { sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { typesenseClient } from '@CeolX/api/lib/typesense';
import { isRedisConfigured, pingRedis } from '@CeolX/cache';
import { db } from '@CeolX/db';

const health = new Hono();

const CHECK_TIMEOUT_MS = 3_000;

type CheckStatus = 'ok' | 'down' | 'skipped';
type Check = { status: CheckStatus; latencyMs: number };

/**
 * Runs a dependency probe with a hard ceiling so one hung socket can't hold the
 * whole response open past the monitor's own timeout. The timer is always
 * cleared — a dangling one keeps the serverless invocation billable.
 */
async function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function probe(fn: () => Promise<unknown>): Promise<Check> {
  const started = Date.now();
  try {
    await withTimeout(fn, CHECK_TIMEOUT_MS);
    return { status: 'ok', latencyMs: Date.now() - started };
  } catch {
    // The error is swallowed on purpose: driver errors carry connection strings
    // and internal hostnames, and this endpoint is public and unauthenticated.
    // Sentry already captures the real failure from the request path.
    return { status: 'down', latencyMs: Date.now() - started };
  }
}

/**
 * Liveness — deliberately touches nothing. A 200 here means the function booted,
 * which covers the common outages: bad deploy, dead DNS/cert, and a crash on
 * boot (env validation in app.ts throws at module load). Cheap enough to poll
 * every minute forever.
 */
health.get('/health', (c) =>
  c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    // Tells us which build is live when an alert fires — the single most useful
    // fact during incident triage.
    commit: process.env['VERCEL_GIT_COMMIT_SHA'] ?? 'local',
  })
);

/**
 * Readiness — probes every backing service in parallel.
 *
 * Severity is not uniform, because blast radius isn't either:
 *   - Postgres or Redis down  → the API cannot serve. 503, wake someone.
 *   - Typesense down          → feed empties and map errors, but auth, bookings,
 *                               profiles and subscriptions all still work. 200
 *                               with degraded=true, so it never pages at 2am.
 *
 * Redis is critical because the rate limiter has no fallback: an Upstash error
 * propagates and 500s every rate-limited route (packages/cache/src/rate-limit.ts).
 *
 * ponytail: an unconfigured Upstash reports "skipped" (green) even in
 * production, where it means rate limiting is silently off. Make the vars
 * required in @CeolX/env/server if that trade stops being acceptable.
 */
health.get('/health/deps', async (c) => {
  const [database, redis, search] = await Promise.all([
    probe(() => db.execute(sql`select 1`)),
    isRedisConfigured()
      ? probe(pingRedis)
      : Promise.resolve<Check>({ status: 'skipped', latencyMs: 0 }),
    probe(() => typesenseClient.health.retrieve()),
  ]);

  const checks = { database, redis, search };
  const criticalDown = database.status === 'down' || redis.status === 'down';
  const degraded = search.status === 'down';

  return c.json(
    {
      status: criticalDown ? 'down' : degraded ? 'degraded' : 'ok',
      degraded,
      timestamp: new Date().toISOString(),
      commit: process.env['VERCEL_GIT_COMMIT_SHA'] ?? 'local',
      checks,
    },
    criticalDown ? 503 : 200
  );
});

export default health;
