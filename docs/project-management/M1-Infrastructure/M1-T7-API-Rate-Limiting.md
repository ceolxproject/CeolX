# M1-T7 · API Rate Limiting

## Description

Implement two-layer API rate limiting for the Hono API using Upstash Redis as the backing store.

- **Layer 1** — Hono middleware applied to route groups (broad limits by IP or userId)
- **Layer 2** — Per-procedure Redis counters inside sensitive handlers (keyed by email/userId)

Uses sliding window algorithm via `@upstash/ratelimit`. Gracefully no-ops in local dev when Upstash credentials are absent.

## Affected Apps/Packages

- `apps/api` — middleware wiring in `app.ts`, per-procedure limits in auth handlers
- `packages/cache` (`@CeolX/cache`) — `rateLimiter()` middleware factory, `RATE_LIMIT_TIERS`, Redis client
- `packages/env` (`@CeolX/env`) — Upstash env var definitions

## Rate Limit Tiers (Layer 1)

| Tier                   | Tokens | Window | Key    | Route group         |
| ---------------------- | ------ | ------ | ------ | ------------------- |
| `authLogin`            | 10     | 15 min | IP     | `/api/auth/*`       |
| `authenticatedGeneral` | 500    | 1 min  | userId | `/rpc/*`            |
| `publicCatalog`        | 200    | 1 min  | IP     | `/api-reference/*`  |
| `adminGeneral`         | 500    | 1 min  | userId | `/admin/*` (future) |
| `muxUpload`            | 5      | 60s    | userId | applied per-route   |

## Per-Procedure Limits (Layer 2)

| Operation                 | Key pattern                     | Limit        |
| ------------------------- | ------------------------------- | ------------ |
| Forgot password           | `rl:forgot-password:{email}`    | 5 per hour   |
| Resend email verification | `rl:resend-verify:{email}`      | 3 per 15 min |
| Resend venue activation   | `rl:resend-activation:{userId}` | 3 per 15 min |

Layer 2 uses raw Redis `incr`/`expire` — not `@upstash/ratelimit` — so the key is set with a TTL only on the first increment.

```ts
const key = `rl:resend-activation:${userId}`;
const count = await redis.incr(key);
if (count === 1) await redis.expire(key, 900); // 15 min TTL
if (count > 3) throw new HTTPException(429, { message: "Too many requests" });
```

## Middleware Design (`packages/cache/src/rate-limit.ts`)

| Concern          | Implementation                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| Algorithm        | `Ratelimit.slidingWindow(tokens, window)`                                                      |
| Key strategy     | `"ip"` → `X-Forwarded-For` / `X-Real-IP`; `"userId"` → session user ID, falls back to IP       |
| No-op conditions | `NODE_ENV=test`, `RATE_LIMIT_ENABLED=false`, or missing Upstash env vars — no errors thrown    |
| IP allowlist     | `RATE_LIMIT_IP_ALLOWLIST` env var (comma-separated) — bypasses all limits                      |
| Limiter caching  | `Map<string, Ratelimit>` singleton per process — avoids re-instantiating Redis clients         |
| Response headers | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` on all; `Retry-After` on 429 |
| 429 response     | `{ error: "Too Many Requests" }` JSON with `Retry-After` header                                |

## Wiring in `apps/api/src/app.ts`

```ts
app.use("/api/auth/*", rateLimiter(RATE_LIMIT_TIERS.authLogin));
app.use("/rpc/*", rateLimiter(RATE_LIMIT_TIERS.authenticatedGeneral));
app.use("/api-reference/*", rateLimiter(RATE_LIMIT_TIERS.publicCatalog));
// Health check (/) — no rate limit
// Webhooks (/api/webhooks/*) — outside rate-limited prefixes; signature verification handles abuse
```

## Webhook Bypass

Stripe, Mux, and Postmark webhook routes (`/api/webhooks/*`) are **not under any rate-limited prefix**. Abuse is prevented by signature verification middleware on each webhook route.

## Env Variables (`packages/env/src/server.ts`)

```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
RATE_LIMIT_ENABLED=true          # optional, defaults to enabled
RATE_LIMIT_IP_ALLOWLIST=127.0.0.1,10.0.0.1  # optional
```

## Acceptance Criteria

- [ ] `rateLimiter()` middleware factory implemented in `packages/cache/src/rate-limit.ts`
- [ ] All 5 tiers defined in `RATE_LIMIT_TIERS` constant
- [ ] Layer 1 applied to `/api/auth/*`, `/rpc/*`, `/api-reference/*` in `app.ts`
- [ ] Layer 2 per-procedure limits on forgot-password, resend-verify, resend-activation handlers
- [ ] No-op when `NODE_ENV=test` or `RATE_LIMIT_ENABLED=false` or Upstash vars absent
- [ ] IP allowlist bypasses all limits
- [ ] `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers on all responses
- [ ] `Retry-After` header on 429 responses only
- [ ] `429 Too Many Requests` with JSON error body when limit exceeded
- [ ] Webhook routes (`/api/webhooks/*`) excluded from rate limiting
- [ ] Upstash env vars added to `packages/env/src/server.ts`
- [ ] Unit tests for each tier (mock Upstash client)

## Dependencies

- Upstash Redis provisioned (M1-T10 Cache Adapter)
- Hono API scaffolded (M1-T3)
- BetterAuth session middleware (M4) — needed for userId extraction in Layer 1

## Key Files

1. `packages/cache/src/rate-limit.ts` — middleware factory + tiers
2. `apps/api/src/app.ts` — route-group wiring
3. `packages/env/src/server.ts` — env var definitions
