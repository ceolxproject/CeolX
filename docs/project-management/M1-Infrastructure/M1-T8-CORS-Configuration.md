# M1-T8 · CORS Configuration

| Field          | Value                                                                           |
| -------------- | ------------------------------------------------------------------------------- |
| **Milestone**  | M1 — Project Setup & Infrastructure                                             |
| **Status**     | ✅ Complete — PR #8                                                             |
| **Depends on** | M1-T3 (Hono API scaffold — basic CORS stub is in place)                         |
| **PRD Ref**    | Section 10.1 (Backend API — middleware), Section 10.3 (Mobile App cross-origin) |

---

## Description

Harden and fully document the CORS configuration for the Hono API. M1-T3 includes a basic `cors()` call to get routes reachable during scaffold — this task replaces that stub with production-ready CORS rules that are environment-aware, correctly handle credentials (required for BetterAuth session cookies), and explicitly whitelist only approved origins.

CORS misconfiguration is a common security vulnerability. This task ensures the allowed-origin list is stored in environment variables (not hardcoded), preflight requests are handled correctly, and no wildcard origins are ever permitted in production.

---

## Affected Apps / Packages

| App / Package | Role                                                                                 |
| ------------- | ------------------------------------------------------------------------------------ |
| `apps/server` | Replace stub `cors()` call in `src/index.ts` with production CORS config             |
| `apps/server` | New `src/config/cors.ts` — origin list builder, isolated and testable                |
| `apps/server` | Update `.env.example` — remove hardcoded dev origins from `CORS_ALLOWED_ORIGINS`     |
| `apps/admin`  | Vite dev proxy config if needed for local dev (production CORS handled at API level) |

> **Note**: The monorepo uses `apps/server` (not `apps/api` as originally drafted). All paths below reflect `apps/server`.

---

## Current State & Gaps (as of 2026-03-26)

The M1-T3 stub at `apps/server/src/index.ts:17-23` is:

```typescript
app.use(
  '/*',
  cors({
    origin: env.CORS_ALLOWED_ORIGINS.split('|'),
    credentials: true,
  })
);
```

`CORS_ALLOWED_ORIGINS` is declared in `packages/env/src/server.ts`. The `.env.example` currently hardcodes dev origins inside this variable — this is incorrect; dev origins should be auto-injected by `NODE_ENV=development`, not listed in the env var.

| Gap                                      | Detail                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| No `src/config/cors.ts` module           | Origin logic is inline; not isolated or testable                                   |
| Array origin instead of dynamic function | No per-request WARN logging on rejected origins                                    |
| No dev-origin auto-injection             | Dev origins hardcoded in `.env.example` instead of injected by `NODE_ENV`          |
| Missing `allowMethods`                   | Only GET/POST handled; PATCH, DELETE, OPTIONS not explicitly listed                |
| Missing `allowHeaders`                   | `Content-Type` and `Authorization` not declared                                    |
| Missing `exposeHeaders`                  | `X-RateLimit-*` headers not exposed to browser clients                             |
| Missing `maxAge`                         | No `Access-Control-Max-Age: 86400` — preflight not cached                          |
| `.env.example` misleading                | Shows dev origins in `CORS_ALLOWED_ORIGINS` — implies they must be listed manually |

---

## Requirements

### 1. Allowed Origins

| Environment | Allowed Origins                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Development | `http://localhost:3000`, `http://localhost:3001`, `http://localhost:8081` (Expo dev client), `http://localhost:19006` (Expo web) |
| Staging     | `https://admin.staging.ceolx.ie`, `https://app.staging.ceolx.ie`                                                                 |
| Production  | `https://admin.ceolx.ie`, `https://app.ceolx.ie`                                                                                 |

- Origins stored in `CORS_ALLOWED_ORIGINS` environment variable — pipe-separated: `origin1|origin2`
- Development origins always included when `NODE_ENV=development`
- React Native mobile app makes requests from the device (no browser origin) — the Expo Go client sends `null` origin or no origin; requests without an `Origin` header are allowed (API-style requests)

### 2. CORS Options

| Option          | Value                                                         | Reason                                                         |
| --------------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| `origin`        | Dynamic whitelist function                                    | No wildcards in production                                     |
| `credentials`   | `true`                                                        | Required for BetterAuth session cookies                        |
| `allowMethods`  | `GET, POST, PATCH, DELETE, OPTIONS`                           | Standard REST methods                                          |
| `allowHeaders`  | `Content-Type, Authorization`                                 | Minimal — add only as needed                                   |
| `exposeHeaders` | `X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset` | Rate limit visibility for clients                              |
| `maxAge`        | `86400` (24h)                                                 | Browsers cache preflight for 24h — reduces OPTIONS round trips |

### 3. Preflight Handling

- Hono's built-in `cors()` middleware handles `OPTIONS` preflight automatically when configured correctly
- Verify preflight requests return `204 No Content` (not `200`) — some browsers require this
- Webhook endpoint (`/api/v1/webhooks/stripe`) never receives browser preflight — exclude from strict CORS if needed

### 4. Environment Variables

```bash
# apps/server/.env.example — production-style values only
# Dev origins (localhost:3000, :3001, :8081, :19006) are auto-injected when NODE_ENV=development
# Only set this for staging/prod:
CORS_ALLOWED_ORIGINS=https://admin.ceolx.ie|https://app.ceolx.ie
```

**Local dev**: leave `CORS_ALLOWED_ORIGINS` empty (or omit it) in `.env.development`. The `buildAllowedOrigins()` function will inject all dev origins automatically because `NODE_ENV=development`.

**Staging**: set `CORS_ALLOWED_ORIGINS=https://admin.staging.ceolx.ie|https://app.staging.ceolx.ie` in `.env.staging`.

Development origins are injected automatically when `NODE_ENV=development` — no need to add them to `.env`.

### 5. Security Rules

- **Never** use `origin: '*'` in any environment — this would expose the API to any website
- **Never** reflect the `Origin` header unconditionally — always validate against the whitelist
- Log rejected origins at `WARN` level (not `ERROR` — they're common from scanners)

---

## Acceptance Criteria

- [x] `apps/server/src/config/cors.ts` created with `buildAllowedOrigins()` and `isAllowedOrigin()` exports
- [x] `CORS_ALLOWED_ORIGINS` env var parsed at startup; dev origins auto-injected when `NODE_ENV=development`
- [x] Stub `cors()` in `apps/server/src/index.ts` replaced with full production config
- [x] Requests from whitelisted origins receive `Access-Control-Allow-Origin` matching the request origin
- [x] Requests from non-whitelisted origins receive no `Access-Control-Allow-Origin` header + `WARN` log
- [x] `Access-Control-Allow-Credentials: true` present on all CORS responses
- [x] `OPTIONS` preflight requests return `204 No Content` with correct CORS headers
- [x] `X-RateLimit-*` headers exposed to browser clients via `Access-Control-Expose-Headers`
- [x] `preflight cache: 86400s` — verify with `Access-Control-Max-Age: 86400` header
- [x] Expo dev client (`http://localhost:8081`) works in development without CORS errors — verified without adding localhost to `CORS_ALLOWED_ORIGINS` env var
- [x] `.env.example` updated — `CORS_ALLOWED_ORIGINS` shows production-only origins; dev origins documented as auto-injected
- [x] TypeScript compilation passes with zero errors

---

## Technical Notes

### CORS Config Module

```typescript
// apps/server/src/config/cors.ts  (new file)

export function buildAllowedOrigins(): string[] {
  const envOrigins = process.env.CORS_ALLOWED_ORIGINS ?? '';
  const configured = envOrigins
    .split('|')
    .map((o) => o.trim())
    .filter(Boolean);

  const devOrigins =
    process.env.NODE_ENV === 'development'
      ? [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:8081', // Expo dev client
          'http://localhost:19006', // Expo web
        ]
      : [];

  return [...new Set([...configured, ...devOrigins])];
}

export function isAllowedOrigin(origin: string): boolean {
  const allowed = buildAllowedOrigins();
  return allowed.includes(origin);
}
```

### Hono CORS Middleware

```typescript
// apps/server/src/index.ts — replace the stub cors() call at line 17-23

import { cors } from 'hono/cors';
import { buildAllowedOrigins, isAllowedOrigin } from './config/cors';

app.use(
  cors({
    origin: (origin) => {
      // No Origin header = native mobile request or same-origin — allow
      if (!origin) return null;
      if (isAllowedOrigin(origin)) return origin;

      // Log rejected origins at warn level (not error)
      console.warn('[CORS] Rejected origin:', origin);
      return null; // Hono treats null as "deny"
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400,
  })
);
```

### Verifying Preflight

```bash
# Test preflight from allowed origin
curl -X OPTIONS https://api.ceolx.ie/api/v1/events \
  -H "Origin: https://app.ceolx.ie" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v

# Expected headers in response:
# Access-Control-Allow-Origin: https://app.ceolx.ie
# Access-Control-Allow-Credentials: true
# Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
# Access-Control-Max-Age: 86400
```

---

## Common Gotchas

- **React Native / Expo has no browser-enforced CORS**: Native fetch does not enforce CORS — CORS errors in Expo only appear when running in Expo Web (`localhost:19006`) or a browser. The native iOS/Android app will work regardless of CORS config. Confirm this is understood so time isn't spent debugging non-issues.
- **BetterAuth sessions require `credentials: true`**: Without `Access-Control-Allow-Credentials: true`, the browser will not send or store session cookies. This breaks the admin dashboard login entirely.
- **Wildcard + credentials is invalid**: Browsers block `Access-Control-Allow-Origin: *` combined with `credentials: true`. Always use a specific origin from the whitelist.
- **Staging origins**: Add staging origins to `CORS_ALLOWED_ORIGINS` in the staging Lambda environment before any cross-origin testing — easy to miss.
- **Stripe webhooks**: Stripe sends webhooks server-to-server — no `Origin` header, no CORS. The webhook route doesn't need CORS config; it just needs Stripe signature verification.
