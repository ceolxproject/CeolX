Rate Limiting Architecture

Stack

- @upstash/ratelimit — sliding window algorithm via Upstash Redis REST API
- @upstash/redis — HTTP-based Redis client (works serverless/edge)
- Falls back to no-op if Upstash credentials are absent (local dev uses IORedis but rate limiting is skipped)

---

Layer 1 — Route-group middleware (apps/api/src/app.ts:75-77)

Three broad limiters are applied to entire URL groups via Hono middleware:

app.use("/api/auth/_", rateLimiter(RATE_LIMIT_TIERS.authLogin)); // 100 req/min by IP
app.use("/rpc/_", rateLimiter(RATE_LIMIT_TIERS.authenticatedGeneral)); // 500 req/min by userId
app.use("/api-reference/\*", rateLimiter(RATE_LIMIT_TIERS.publicCatalog)); // 200 req/min by IP

The health check (/) is explicitly exempt.

---

Layer 2 — Per-procedure granular limits (e.g. packages/api/src/routers/auth.ts)

Sensitive operations add their own Redis incr/expire counters inside the procedure handler:

const rateLimitKey = `rl:resend-verify:${input.email}`;
const count = await cache.incr(rateLimitKey);
if (count === 1) await cache.set(rateLimitKey, 1, { ex: 900 }); // 15 min window
if (count > 3) throw new ORPCError("TOO_MANY_REQUESTS");

This gives finer-grained control (e.g. keyed by email, not just userId/IP).

---

The rateLimiter Hono middleware (packages/cache/src/rate-limit.ts)

Key design points:

┌──────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Concern │ Implementation │
├──────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Algorithm │ Ratelimit.slidingWindow(tokens, window) │
├──────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Key strategy │ "ip" → X-Forwarded-For / X-Real-IP; "userId" → session.user.id, falls back to IP if not authed │
├──────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
│ No-op conditions │ NODE_ENV=test, RATE_LIMIT_ENABLED=false, or missing Upstash env vars │
├──────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
│ IP allowlist │ RATE_LIMIT_IP_ALLOWLIST env var (comma-separated) — bypasses all limits │
├──────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Limiter caching │ Map<string, Ratelimit> singleton per process — avoids re-instantiating Redis clients │
├──────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Response headers │ X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After on 429 │
├──────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 429 response │ { error: "Too Many Requests" } with Retry-After header │
└──────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────┘

---

Rate Limit Tiers (RATE_LIMIT_TIERS)

┌──────────────────────┬────────┬────────┬────────┐
│ Tier │ Tokens │ Window │ Key │
├──────────────────────┼────────┼────────┼────────┤
│ authLogin │ 100 │ 1 min │ IP │
├──────────────────────┼────────┼────────┼────────┤
│ authenticatedGeneral │ 500 │ 1 min │ userId │
├──────────────────────┼────────┼────────┼────────┤
│ publicCatalog │ 200 │ 1 min │ IP │
├──────────────────────┼────────┼────────┼────────┤
│ adminGeneral │ 500 │ 1 min │ userId │
├──────────────────────┼────────┼────────┼────────┤
│ muxUpload │ 5 │ 60s │ userId │
├──────────────────────┼────────┼────────┼────────┤
│ communityLike │ 100 │ 1 min │ userId │
├──────────────────────┼────────┼────────┼────────┤
│ communityComment │ 10 │ 1 min │ userId │
├──────────────────────┼────────┼────────┼────────┤
│ qaQuestion │ 5 │ 1 day │ userId │
├──────────────────────┼────────┼────────┼────────┤
│ qaAnswer │ 20 │ 1 day │ userId │
├──────────────────────┼────────┼────────┼────────┤
│ qaFeedback │ 100 │ 1 min │ userId │
├──────────────────────┼────────┼────────┼────────┤
│ activityExport │ 5 │ 1 min │ userId │
└──────────────────────┴────────┴────────┴────────┘

---

Env Variables needed

UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
RATE_LIMIT_ENABLED=true # optional, defaults to enabled
RATE_LIMIT_IP_ALLOWLIST=127.0.0.1,10.0.0.1 # optional

---

Key files to copy to another project

1. packages/cache/src/rate-limit.ts — the full middleware + tiers
2. apps/api/src/app.ts:75-77 — how it's wired into Hono
3. packages/env/src/server.ts — env var definitions for UPSTASH*\* and RATE_LIMIT*\*

The design is clean and self-contained — the rateLimiter function is a standard Hono MiddlewareHandler, so it can drop into any Hono app with
just the @upstash/ratelimit and @upstash/redis packages.

⏺ Ran 1 stop hook (ctrl+o to expand)
⎿ Stop hook error: Failed with non-blocking status code: /bin/sh:
/Users/priyayadav/.claude/plugins/marketplaces/claude-plugins-official/plugins/ralph-loop/hooks/stop-hook.sh: Permission denied

✻ Cooked for 53s

❯ what is @packages/env  
 ⎿ Listed directory packages/env/
⎿ ⧉ Selected 1 lines from packages/email/src/i18n/index.ts in Cursor

Read 2 files (ctrl+o to expand)

⏺ @mentor/env is a runtime environment variable validation package built on @t3-oss/env-core. It acts as a typed, validated gateway to  
 process.env — if a required var is missing at startup, it throws immediately with a clear error instead of failing silently at runtime.

Three entry points

┌────────────────────┬───────────────┬────────────────────────────────────────┐  
 │ Import │ File │ Context │  
 ├────────────────────┼───────────────┼────────────────────────────────────────┤  
 │ @mentor/env/server │ src/server.ts │ API server — all backend vars │
├────────────────────┼───────────────┼────────────────────────────────────────┤
│ @mentor/env/web │ src/web.ts │ Next.js apps — only NEXT*PUBLIC*_ vars │  
 ├────────────────────┼───────────────┼────────────────────────────────────────┤  
 │ @mentor/env/native │ src/native.ts │ Expo mobile — only EXPO*PUBLIC*_ vars │  
 └────────────────────┴───────────────┴────────────────────────────────────────┘

How it works

import { env } from "@mentor/env/server";

env.DATABASE_URL // string — throws at import if missing  
 env.REDIS_URL // string | undefined — optional  
 env.RATE_LIMIT_ENABLED // "true" | "false" — has default "true"

- All vars are defined with Zod schemas — you get type inference + validation for free
- emptyStringAsUndefined: true — FOO="" is treated the same as FOO not set
- Server vars auto-map from process.env (no explicit runtimeEnv entries needed)
- Web/native vars require explicit runtimeEnv mapping (Next.js/Expo requirement)
- Loads .env.local automatically via dotenv in non-Vercel environments

When you add a new env var

1. Add a Zod schema to the appropriate file (server.ts, web.ts, native.ts)
2. Mark .optional() if not required at startup
3. Add to turbo.json globalEnv array — otherwise Turbo won't include it in cache keys (stale builds)
