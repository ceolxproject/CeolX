# Task 8: API Rate Limiting Middleware

## Description

Implement comprehensive API rate limiting for the Hono API using Upstash Redis as the backing store. Rate limiting protects against brute-force attacks, API abuse, and ensures fair usage across all platform users. Implements per-route, per-user, and per-role rate limits with configurable thresholds. Uses a sliding window algorithm for accurate rate counting and includes special handling for authentication endpoints, webhook receivers, and admin operations.

## Affected Apps/Packages

- Backend: `apps/api` (Hono) — middleware integration
- Shared: `packages/cache` (`@mentor/cache`) — Redis client for rate limit counters
- Shared: `packages/auth` (`@mentor/auth`) — role-based rate limit tiers

## API Endpoints Affected

All API endpoints, with specific limits per category:

| Endpoint Category           | Rate Limit | Window | Key                |
| --------------------------- | ---------- | ------ | ------------------ |
| Auth: Login/Signup          | 10 req     | 15 min | IP                 |
| Auth: Password Reset        | 5 req      | 1 hour | IP                 |
| Auth: Email Verification    | 5 req      | 15 min | IP                 |
| Public: Course Catalog      | 60 req     | 1 min  | IP                 |
| Public: Search              | 30 req     | 1 min  | IP                 |
| Authenticated: General      | 120 req    | 1 min  | User ID            |
| Authenticated: Writes       | 30 req     | 1 min  | User ID            |
| Instructor: Course Mgmt     | 60 req     | 1 min  | User ID            |
| Instructor: Video Upload    | 10 req     | 1 hour | User ID            |
| Admin: General              | 300 req    | 1 min  | User ID            |
| Admin: Bulk Operations      | 10 req     | 1 min  | User ID            |
| Webhooks: Stripe/Mux/QStash | No limit   | —      | Verified signature |

## Requirements

### Middleware Implementation

- Create Hono middleware factory: `createRateLimiter(options)`
- Use sliding window algorithm via `@upstash/ratelimit` SDK
- Support multiple rate limit tiers applied per route group
- Return standard rate limit headers:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining in window
  - `X-RateLimit-Reset`: Timestamp when window resets (Unix epoch seconds)
  - `Retry-After`: Seconds until next request allowed (only on 429)
- Return `429 Too Many Requests` with JSON error body when exceeded

### Rate Limit Key Strategy

- **Unauthenticated requests**: Key by IP address (via `X-Forwarded-For` header on Vercel)
- **Authenticated requests**: Key by user ID (extracted from session)
- **Role-based tiers**: Admin users get higher limits than learners/instructors

### Redis Storage

- Use existing Upstash Redis instance from `@mentor/cache` package
- Rate limit keys prefixed with `rl:` namespace
- TTL automatically managed by `@upstash/ratelimit`
- Monitor Redis memory usage for rate limit keys

### Security Considerations

- Bypass rate limiting for verified webhook signatures (Stripe, Mux, QStash)
- Implement IP allowlisting for internal services and monitoring
- Log rate limit violations to audit trail (IP, user ID, endpoint, timestamp)
- Alert on sustained rate limit violations (potential attack detection)
- Handle `X-Forwarded-For` header safely (trust Vercel's proxy, not client-provided)

### Developer API

```typescript
// Route-level rate limiting
import { rateLimiter } from "@mentor/cache";

// Apply to auth routes
app.use(
  "/api/auth/*",
  rateLimiter({
    tier: "auth",
    limit: 10,
    window: "15m",
    keyBy: "ip",
  })
);

// Apply to authenticated API routes
app.use(
  "/api/v1/*",
  rateLimiter({
    tier: "authenticated",
    limit: 120,
    window: "1m",
    keyBy: "userId",
  })
);
```

## Acceptance Criteria

- [x] Rate limiting middleware applies to all API route groups — auth, rpc, api-reference routes covered (`app.ts:63-65`)
- [x] Authentication endpoints limited to 10 requests per 15 minutes per IP — `RATE_LIMIT_TIERS.authLogin` (`rate-limit.ts:17-22`)
- [x] Authenticated endpoints limited to 120 requests per minute per user — `RATE_LIMIT_TIERS.authenticatedGeneral` (`rate-limit.ts:23-28`)
- [ ] Admin endpoints allow 300 requests per minute per user — no admin tier defined yet (deferred to Milestone 04 RBAC)
- [x] Webhook endpoints bypass rate limiting when signature is valid — webhook routes fall outside rate-limited prefixes; QStash uses `qstashVerify()` middleware
- [x] `429 Too Many Requests` returned with correct headers when limit exceeded — (`rate-limit.ts:132-137`)
- [x] `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers present on all responses — (`rate-limit.ts:128-130`)
- [x] `Retry-After` header present on 429 responses — (`rate-limit.ts:133`)
- [x] Rate limit counters stored in Upstash Redis with correct TTLs — `@upstash/ratelimit` sliding window (`rate-limit.ts:63-74`)
- [ ] Rate limit violations logged to audit trail — currently `console.warn` only; no DB audit log write
- [x] Unit tests for each rate limit tier — 3 tiers tested in `rate-limit.test.ts`; admin tier deferred
- [ ] Integration test confirming 429 after exceeding limit — unit test with mock exists; no multi-request integration test
- [x] IP allowlist bypasses rate limiting for configured addresses — `RATE_LIMIT_IP_ALLOWLIST` env var (`rate-limit.ts:86-90`)
- [x] No rate limiting applied in test environment (configurable) — `NODE_ENV=test` or `RATE_LIMIT_ENABLED=false` bypasses (`rate-limit.ts:77-84`)

## Dependencies

- Upstash Redis provisioned (Milestone 01 or 03, Task 10: Cache Adapter)
- Hono API scaffolded (Milestone 01, Task 02)
- BetterAuth session middleware (Milestone 04, Task 01) for user ID extraction

## Technical Notes

### Why @upstash/ratelimit?

- Purpose-built for serverless environments
- Sliding window algorithm (more accurate than fixed window)
- Atomic Redis operations (no race conditions)
- Built-in support for multiple rate limit tiers
- Zero configuration for Upstash Redis integration

### Sliding Window vs Fixed Window

- Fixed window: Allows burst at window boundaries (e.g., 120 requests at 0:59 + 120 at 1:00)
- Sliding window: Distributes limit evenly across time, preventing burst abuse
- QStash uses sliding window — more accurate and fairer

### Common Gotchas

- Vercel serverless: IP address is in `X-Forwarded-For` header, not `req.ip`
- Multiple Vercel regions may have separate Redis connections — use global Upstash endpoint
- Rate limit headers should be set even on successful requests (for client awareness)
- Don't rate limit health check endpoints (`/api/health`)
- In development, set higher limits or disable entirely via `RATE_LIMIT_ENABLED=false`
