# M1-T7 · API Rate Limiting

| Field          | Value                                            |
| -------------- | ------------------------------------------------ |
| **Milestone**  | M1 — Project Setup & Infrastructure              |
| **Status**     | 🔲 To Do                                         |
| **Depends on** | M1-T3 (Hono API scaffold)                        |
| **PRD Ref**    | Section 10.1 (Backend API — security middleware) |

---

## Description

Add rate limiting middleware to the Hono API to protect against brute-force attacks, credential stuffing, and API abuse. CeolX's V1 launch is under 1,000 users — rate limiting requirements are relatively lightweight but must be enforced on authentication endpoints from day one because auth endpoints are the most commonly abused vectors.

Rate limiting is implemented at two layers:

1. **AWS API Gateway** — coarse throttling at the infrastructure level (burst + rate limits per stage), no code required
2. **Hono middleware** — fine-grained per-IP limits on sensitive routes (auth, password reset) using an in-process sliding window counter backed by DynamoDB

DynamoDB is used as the counter store because CeolX already depends on AWS infrastructure (Lambda + S3) and adding a full Redis/Upstash dependency for V1 scale is unnecessary overhead. A Redis-backed approach (Upstash) can be swapped in if usage scales beyond ~10k users.

---

## Affected Apps / Packages

| App / Package   | Role                                                                            |
| --------------- | ------------------------------------------------------------------------------- |
| `apps/api`      | New `src/middleware/rateLimiter.ts` — Hono middleware factory                   |
| `apps/api`      | New `src/lib/rateLimitStore.ts` — DynamoDB counter store (or in-memory for dev) |
| AWS API Gateway | Stage-level throttling configured via CloudFormation / console                  |

---

## Rate Limit Tiers

| Endpoint Category                                   | Limit    | Window | Key                       |
| --------------------------------------------------- | -------- | ------ | ------------------------- |
| Auth: Sign-in                                       | 10 req   | 15 min | IP                        |
| Auth: Sign-up                                       | 10 req   | 15 min | IP                        |
| Auth: Password reset request                        | 5 req    | 1 hour | IP                        |
| Auth: Email verification resend                     | 5 req    | 15 min | IP                        |
| Public: Map/feed queries                            | 60 req   | 1 min  | IP                        |
| Authenticated: General API                          | 120 req  | 1 min  | User ID                   |
| Authenticated: Write operations (POST/PATCH/DELETE) | 30 req   | 1 min  | User ID                   |
| Webhooks: Stripe                                    | No limit | —      | Verified Stripe signature |
| Admin routes                                        | 300 req  | 1 min  | User ID                   |
| `GET /health`                                       | No limit | —      | —                         |

---

## Requirements

### 1. AWS API Gateway Throttling (Infrastructure Layer)

- Set stage-level defaults in API Gateway:
  - **Burst limit**: 500 requests (concurrent)
  - **Rate limit**: 1,000 requests/second
- This catches catastrophic DDoS before Lambda even invokes — no Hono code needed for this layer
- Configure via `serverless.yml`, AWS CDK, or API Gateway console — document the values in `apps/api/README.md`

### 2. Hono Rate Limiter Middleware

Create `apps/api/src/middleware/rateLimiter.ts`:

- Factory function: `createRateLimiter(options: RateLimiterOptions)` → Hono middleware
- Options: `{ limit: number, windowMs: number, keyFn: (c: Context) => string }`
- `keyFn` determines the rate limit key:
  - For IP-based: extract from `X-Forwarded-For` header (first IP) → sanitize
  - For user-based: extract from Hono context `userId` (set by auth middleware)
- Sliding window algorithm: count requests in the window using DynamoDB atomic increment
- On limit exceeded: return `429 Too Many Requests` with JSON body and headers
- Response headers on every rate-limited response:
  - `X-RateLimit-Limit` — max requests in window
  - `X-RateLimit-Remaining` — requests left
  - `X-RateLimit-Reset` — Unix timestamp when window resets
  - `Retry-After` — seconds until retry (only on 429)

### 3. DynamoDB Rate Limit Store

- Table: `ceolx-rate-limits` (provisioned in dev; on-demand in staging/prod)
- Partition key: `pk` (string) — rate limit key, e.g. `rate:ip:203.0.113.5:auth-signin`
- Attributes: `count` (number), `ttl` (number, DynamoDB TTL for auto-cleanup)
- Use `UpdateItem` with `ADD count 1` and `ConditionExpression` — atomic, no race conditions
- TTL set to window end timestamp — DynamoDB auto-deletes expired entries, no cron needed
- In **development** (`NODE_ENV=development`): use in-memory `Map` instead of DynamoDB to avoid AWS setup friction

### 4. Route Integration

Apply rate limiters in `apps/api/src/index.ts`:

```typescript
// IP-based rate limit on auth routes
app.use(
  "/api/v1/auth/sign-in",
  ipRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 }),
);
app.use(
  "/api/v1/auth/sign-up",
  ipRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 }),
);
app.use(
  "/api/v1/auth/forgot-password",
  ipRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 }),
);

// User-based rate limit on authenticated routes
app.use("/api/v1/*", userRateLimiter({ limit: 120, windowMs: 60 * 1000 }));
```

Webhooks (`/api/v1/webhooks/*`) are excluded — they validate via Stripe signature verification instead.

### 5. Environment Variables

```bash
# apps/api .env
AWS_DYNAMODB_RATE_LIMIT_TABLE=ceolx-rate-limits
AWS_REGION=eu-west-1
```

---

## Acceptance Criteria

- [ ] AWS API Gateway burst/rate throttling configured and documented in `apps/api/README.md`
- [ ] `createRateLimiter()` middleware factory implemented in `src/middleware/rateLimiter.ts`
- [ ] DynamoDB store implemented with atomic increment and TTL-based cleanup
- [ ] In-memory store used automatically in `NODE_ENV=development` (no AWS needed locally)
- [ ] Auth endpoints (`/sign-in`, `/sign-up`, `/forgot-password`) have IP-based rate limits applied
- [ ] Authenticated routes have user-based rate limits applied
- [ ] Webhook routes explicitly bypass rate limiting
- [ ] `429` response includes correct `X-RateLimit-*` headers and `Retry-After`
- [ ] TypeScript compilation passes with zero errors
- [ ] Manual test: 11 rapid requests to `/api/v1/auth/sign-in` → 11th returns 429

---

## Technical Notes

### Middleware Factory

```typescript
// apps/api/src/middleware/rateLimiter.ts

import type { Context, Next } from "hono";
import {
  getRateLimitCount,
  incrementRateLimitCount,
} from "../lib/rateLimitStore";

interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  keyFn: (c: Context) => string;
}

export function createRateLimiter(options: RateLimiterOptions) {
  return async (c: Context, next: Next) => {
    const { limit, windowMs, keyFn } = options;
    const key = keyFn(c);
    const windowSec = Math.floor(windowMs / 1000);
    const resetAt = Math.floor(Date.now() / 1000) + windowSec;

    const count = await incrementRateLimitCount(key, windowSec);

    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(Math.max(0, limit - count)));
    c.header("X-RateLimit-Reset", String(resetAt));

    if (count > limit) {
      const retryAfter = windowSec;
      c.header("Retry-After", String(retryAfter));
      return c.json(
        {
          error: "RateLimitExceeded",
          code: "TOO_MANY_REQUESTS",
          message: "Too many requests. Please try again later.",
          retryAfter,
        },
        429,
      );
    }

    return next();
  };
}

// Convenience helpers
export const ipRateLimiter = (opts: Omit<RateLimiterOptions, "keyFn">) =>
  createRateLimiter({
    ...opts,
    keyFn: (c) => {
      const forwarded = c.req.header("X-Forwarded-For") ?? "unknown";
      const ip = forwarded.split(",")[0].trim();
      return `rate:ip:${ip}:${c.req.path.replace(/\//g, "-")}`;
    },
  });

export const userRateLimiter = (opts: Omit<RateLimiterOptions, "keyFn">) =>
  createRateLimiter({
    ...opts,
    keyFn: (c) => {
      const userId = c.get("userId") ?? "anonymous";
      return `rate:user:${userId}`;
    },
  });
```

### In-Memory Store (Development)

```typescript
// apps/api/src/lib/rateLimitStore.ts

const memoryStore = new Map<string, { count: number; expiresAt: number }>();

async function incrementMemory(
  key: string,
  windowSec: number,
): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const entry = memoryStore.get(key);

  if (!entry || entry.expiresAt < now) {
    memoryStore.set(key, { count: 1, expiresAt: now + windowSec });
    return 1;
  }

  entry.count += 1;
  return entry.count;
}

export async function incrementRateLimitCount(
  key: string,
  windowSec: number,
): Promise<number> {
  if (process.env.NODE_ENV === "development") {
    return incrementMemory(key, windowSec);
  }
  // TODO: DynamoDB implementation for staging/prod
  return incrementMemory(key, windowSec); // placeholder until DynamoDB wired
}
```

---

## Common Gotchas

- **Lambda cold starts and in-memory state**: The in-memory `Map` resets on every cold start — only use for development. DynamoDB is required for production correctness.
- **X-Forwarded-For spoofing**: API Gateway adds a verified IP to `X-Forwarded-For`; always take the **first** entry (leftmost = original client). Validate before use.
- **Webhook exclusion**: Stripe sends valid bursts on reconciliation — always exclude `/webhooks/*` from rate limiting. Stripe signature verification is the correct protection there.
- **DynamoDB TTL delay**: TTL expiry is eventual (up to 48h delay in practice). For sub-minute windows, this is fine since the `count` resets via the expiry check anyway.
- **V1 scale note**: With <1,000 users, rate limiting is primarily for abuse prevention (credential stuffing bots), not for capacity management. The thresholds above are generous for legitimate users.
