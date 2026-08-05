import { sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { typesenseClient } from '@CeolX/api/lib/typesense';
import { isRateLimitActive, pingRedis } from '@CeolX/cache';
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
 * How long a probe verdict is reused. The endpoint is public and every fan-out
 * costs real money — a Postgres connection, a billed Upstash command, a Typesense
 * query — so a monitor polling on a schedule and a hostile loop hammering the URL
 * cost the same.
 *
 * The cache is per warm instance, so N instances allow N fan-outs per window
 * rather than one. That is enough to defuse the cost vector; requiring a shared
 * secret header from the monitor is the fix if it ever needs to be airtight.
 */
const CACHE_TTL_MS = 10_000;

type CheckStatus = 'ok' | 'down' | 'skipped';
type Check = { status: CheckStatus; latencyMs: number };
type DepsPayload = {
  status: 'ok' | 'degraded' | 'down';
  checkedAt: string;
  commit: string;
  checks: { database: Check; redis: Check; search: Check };
};
type DepsResult = { payload: DepsPayload; httpStatus: 200 | 503 };

/**
 * Holds the in-flight promise, not the resolved value, so requests arriving
 * during a fan-out await the same probes instead of each starting their own.
 * Caching the result would leave a concurrency hole: 50 simultaneous requests
 * would all miss and issue 50 sets of backend calls.
 */
let cached: { at: number; result: Promise<DepsResult> } | null = null;

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
 * Probes every backing service in parallel.
 *
 * Cannot reject: probe() turns any failure into a `down` check, which is what
 * makes it safe to cache this promise. A throw introduced here would be cached
 * for the full TTL and replayed to every caller in that window, so keep any new
 * work inside probe().
 */
async function runProbes(): Promise<DepsResult> {
  const [database, redis, search] = await Promise.all([
    probe(() => db.execute(sql`select 1`)),
    isRateLimitActive()
      ? probe(pingRedis)
      : Promise.resolve<Check>({ status: 'skipped', latencyMs: 0 }),
    probe(() => typesenseClient.health.retrieve()),
  ]);

  const criticalDown = database.status === 'down';
  const degraded = redis.status === 'down' || search.status === 'down';

  return {
    payload: {
      status: criticalDown ? 'down' : degraded ? 'degraded' : 'ok',
      checkedAt: new Date().toISOString(),
      commit: commitSha(),
      checks: { database, redis, search },
    },
    httpStatus: criticalDown ? 503 : 200,
  };
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
 * Readiness.
 *
 * Severity is not uniform, because blast radius isn't either. Only Postgres can
 * take the API down, so only Postgres returns 503:
 *   - Postgres down  → nothing can be served. 503, wake someone.
 *   - Redis down     → the limiter fails open (packages/cache/src/rate-limit.ts),
 *                      so requests still serve, just unthrottled. Worth knowing
 *                      about, not worth a 2am page.
 *   - Typesense down → feed empties and map errors, but auth, bookings, profiles
 *                      and subscriptions all still work.
 *
 * The last two report 200 with status 'degraded'; `checks` names which one it is,
 * so an alert is still actionable without a third severity level.
 *
 * This route can't be rate limited itself — the limiter needs Upstash, so an
 * Upstash outage would break the endpoint meant to report it. The memo is the
 * cost control instead.
 *
 * When rate limiting is switched off, Redis reports 'skipped' rather than being
 * probed — nothing in the app talks to it, so its state is irrelevant.
 */
health.get('/health/deps', async (c) => {
  if (!cached || Date.now() - cached.at >= CACHE_TTL_MS) {
    cached = { at: Date.now(), result: runProbes() };
  }

  const { payload, httpStatus } = await cached.result;

  // `timestamp` is when this response was produced, `checkedAt` when the probes
  // actually ran — up to CACHE_TTL_MS earlier. A monitor asserting response
  // freshness would fail against a memoised verdict if these were one field.
  return c.json({ ...payload, timestamp: new Date().toISOString() }, httpStatus, NO_STORE);
});

export default health;
