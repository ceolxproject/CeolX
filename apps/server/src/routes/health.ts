import { sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { typesenseClient } from '@CeolX/api/lib/typesense';
import { isRedisConfigured, pingRedis } from '@CeolX/cache';
import { db } from '@CeolX/db';

const health = new Hono();

/**
 * Ceiling on how long the response can take. Deliberately below the Typesense
 * client's own connectionTimeoutSeconds: 5 (packages/api/src/lib/typesense.ts):
 * a hung search socket lingers in the background for another ~2s, but it no
 * longer delays the reply. Lowering the shared client instead would change feed,
 * map and discovery behaviour, which this endpoint has no business doing.
 */
const CHECK_TIMEOUT_MS = 3_000;

/**
 * The dependency probe is public and each call costs real money — a Postgres
 * connection, a billed Upstash command, a Typesense query. Memoising the result
 * means a monitor polling every 30s and a hostile loop hammering the URL cost
 * the same.
 *
 * ponytail: module scope, so the cache is per warm instance — N instances allow
 * N probes per window, not one. That's enough to defuse the cost vector; if it
 * needs to be airtight, require a shared secret header the monitor sends.
 */
const CACHE_TTL_MS = 10_000;

type CheckStatus = 'ok' | 'down' | 'skipped';
type Check = { status: CheckStatus; latencyMs: number };
type DepsPayload = {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  commit: string;
  checks: { database: Check; redis: Check; search: Check };
};

let cached: { at: number; payload: DepsPayload; httpStatus: 200 | 503 } | null = null;

/** Monitors must never be handed a stale 200 by an intermediate cache during an outage. */
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function commitSha(): string {
  return process.env['VERCEL_GIT_COMMIT_SHA'] ?? 'local';
}

/**
 * Runs a dependency probe with a hard ceiling so one hung socket can't hold the
 * response open past the monitor's own timeout. The timer is always cleared —
 * left dangling it would keep the event loop alive after the reply is sent.
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
  c.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      // Tells us which build is live when an alert fires — the single most
      // useful fact during incident triage.
      commit: commitSha(),
    },
    200,
    NO_STORE
  )
);

/**
 * Readiness — probes every backing service in parallel.
 *
 * Severity is not uniform, because blast radius isn't either:
 *   - Postgres or Redis down  → the API cannot serve. 503, wake someone.
 *   - Typesense down          → feed empties and map errors, but auth, bookings,
 *                               profiles and subscriptions all still work. 200
 *                               with status 'degraded', so it never pages at 2am.
 *
 * Redis is critical because the rate limiter has no fallback: an Upstash error
 * propagates and 500s every rate-limited route (packages/cache/src/rate-limit.ts).
 * That same coupling is why this route can't be rate limited itself — the
 * limiter needs Upstash, so an Upstash outage would 500 the very endpoint meant
 * to report it. The memo above is the cost control instead.
 *
 * ponytail: an unconfigured Upstash reports "skipped" (green) even in
 * production, where it means rate limiting is silently off. Make the vars
 * required in @CeolX/env/server if that trade stops being acceptable.
 */
health.get('/health/deps', async (c) => {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return c.json(cached.payload, cached.httpStatus, NO_STORE);
  }

  const [database, redis, search] = await Promise.all([
    probe(() => db.execute(sql`select 1`)),
    isRedisConfigured()
      ? probe(pingRedis)
      : Promise.resolve<Check>({ status: 'skipped', latencyMs: 0 }),
    probe(() => typesenseClient.health.retrieve()),
  ]);

  const criticalDown = database.status === 'down' || redis.status === 'down';
  const payload: DepsPayload = {
    status: criticalDown ? 'down' : search.status === 'down' ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    commit: commitSha(),
    checks: { database, redis, search },
  };
  const httpStatus = criticalDown ? 503 : 200;

  cached = { at: Date.now(), payload, httpStatus };

  return c.json(payload, httpStatus, NO_STORE);
});

export default health;
