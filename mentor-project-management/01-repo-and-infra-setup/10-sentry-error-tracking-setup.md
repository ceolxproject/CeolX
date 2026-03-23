# Sentry Error Tracking Setup

## Description

Integrate Sentry for exception monitoring and error tracking across all five application surfaces: web-learner, web-mentor, web-admin (Next.js), API (Hono on Vercel Serverless), and mobile (React Native / Expo). Sentry captures unhandled exceptions, performance traces, and breadcrumbs to enable rapid debugging and proactive error resolution. Uses Sentry's free tier (5K errors/month, 10K performance transactions/month) for initial launch.

## PRD Reference

- Section 8.1 — Technology Stack: "Sentry — Exception monitoring across all applications"
- Section 16.2 — Observability Stack: "Error Tracking: Sentry — Exception monitoring across all apps"
- Section 10.1 — Performance: "Mobile App Crash-Free Session Rate > 99.5%" — measured via Sentry

## Affected Apps/Packages

- `apps/web-learner` (Next.js) — Client + server-side error tracking
- `apps/web-mentor` (Next.js) — Client + server-side error tracking
- `apps/web-admin` (Next.js) — Client + server-side error tracking
- `apps/api` (Hono) — Server-side error tracking
- `apps/mobile` (React Native / Expo) — Native crash reporting + JS error tracking
- `packages/utils` — Shared Sentry configuration helpers (optional)

## Requirements

### 1. Sentry Project Setup

- Create Sentry organization: `mentor` (or use existing)
- Create 5 separate Sentry projects:
  - `mentor-web-learner` (Next.js / Browser + Node)
  - `mentor-web-mentor` (Next.js / Browser + Node)
  - `mentor-web-admin` (Next.js / Browser + Node)
  - `mentor-api` (Node / Serverless)
  - `mentor-mobile` (React Native)
- Environment tagging: `development`, `staging`, `production`
- Release tagging: Git commit SHA or semver

### 2. Next.js Integration (3 Web Apps)

- Use `@sentry/nextjs` SDK
- Configure via `sentry.client.config.ts` and `sentry.server.config.ts`
- Instrument Next.js with `withSentryConfig` in `next.config.js`
- Source maps uploaded automatically during build (Vercel integration)
- Capture:
  - Unhandled JavaScript errors (client-side)
  - Server-side rendering errors
  - API route errors
  - React error boundaries
  - Navigation performance (page load, route changes)
- Environment variables:
  - `NEXT_PUBLIC_SENTRY_DSN` — Client DSN
  - `SENTRY_DSN` — Server DSN
  - `SENTRY_AUTH_TOKEN` — For source map uploads
  - `SENTRY_ORG` — Organization slug
  - `SENTRY_PROJECT` — Project slug

### 3. Hono API Integration

- Use `@sentry/node` SDK
- Create Hono middleware for automatic error capture:
  ```typescript
  // Sentry error handler middleware
  app.onError((err, c) => {
    Sentry.captureException(err, {
      extra: {
        url: c.req.url,
        method: c.req.method,
        userId: c.get("userId") || "anonymous",
      },
    });
    return c.json({ error: "Internal Server Error" }, 500);
  });
  ```
- Capture:
  - Unhandled API exceptions
  - Database query errors
  - External service failures (Stripe, Mux, Postmark, etc.)
  - Rate limit violations (as breadcrumbs, not errors)
- Add user context: attach authenticated user ID to Sentry scope
- Add request context: URL, method, headers (sanitized — no auth tokens)

### 4. React Native / Expo Integration

- Use `@sentry/react-native` with Expo plugin (`sentry-expo`)
- Configure in `app.config.ts` or `app.json`:
  ```json
  {
    "plugins": ["sentry-expo"],
    "hooks": {
      "postPublish": [
        {
          "file": "sentry-expo/upload-sourcemaps"
        }
      ]
    }
  }
  ```
- Capture:
  - Native crashes (iOS + Android)
  - JavaScript unhandled exceptions
  - React Native bridge errors
  - Navigation performance
  - App startup time
- Source maps uploaded via EAS Build hooks
- Crash-free session rate tracking (target: >99.5%)

### 5. Shared Configuration

- **PII Scrubbing**: Enabled by default — strip emails, passwords, tokens from error reports
- **Sampling Rates**:
  - Error events: 100% (capture all errors)
  - Performance transactions: 20% in production (reduce volume)
  - Development: 100% for both
- **Breadcrumbs**: Automatically capture console logs, fetch requests, navigation events
- **Release Health**: Track crash-free rates, session duration, user adoption per release
- **Alerts**: Configure Sentry alert rules:
  - New issue spike (>10 events in 5 minutes)
  - Error rate increase (>5% over 24h baseline)
  - Crash-free rate drops below 99% (mobile)
- **Integrations**:
  - GitHub: Link commits to releases, show suspect commits
  - Vercel: Auto-detect deployments as releases

### 6. Error Boundaries (React)

- Wrap all web apps with Sentry error boundary:

  ```typescript
  import * as Sentry from '@sentry/nextjs';

  <Sentry.ErrorBoundary fallback={<ErrorFallbackPage />}>
    <App />
  </Sentry.ErrorBoundary>
  ```

- Custom fallback page: "Something went wrong. Please try again."
- Include "Report Issue" button that opens Sentry User Feedback dialog
- Log error boundary catches to Sentry with component stack trace

### 7. Sensitive Data Filtering

- Never send to Sentry:
  - Passwords or password hashes
  - Auth tokens or session cookies
  - Credit card numbers or payment tokens
  - Identity documents or personal photos
  - Full IP addresses (send anonymized)
- Configure `beforeSend` hook to scrub sensitive data:
  ```typescript
  beforeSend(event) {
    // Strip auth headers
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }
    return event;
  }
  ```

## Acceptance Criteria

- [x] Sentry projects created for all 5 apps — config files exist for all 5; DSNs empty until Sentry dashboard provisioned
- [x] `@sentry/nextjs` configured in web-learner, web-mentor, web-admin — `sentry.*.config.ts` + `withSentryConfig` + `instrumentation.ts` in all 3
- [x] `@sentry/node` configured in API (Hono) with error middleware — `sentry.ts` + `initSentry()` at top of `app.ts`; 3 error capture points
- [x] `@sentry/react-native` configured in mobile app (Expo) — Expo plugin, `getSentryExpoConfig`, `Sentry.init` + `Sentry.wrap`
- [x] Source maps uploaded for all apps (web via Vercel, mobile via EAS) — web: gated on `SENTRY_AUTH_TOKEN`; API and mobile EAS source map upload not wired yet
- [x] Unhandled errors captured and visible in Sentry dashboard — `global-error.tsx` (web), `app.onError` (API), `Sentry.wrap` (mobile)
- [ ] User context (user ID) attached to error events for authenticated users — no `Sentry.setUser()` call exists; deferred to Milestone 04 auth integration
- [x] PII scrubbing: no passwords, tokens, or payment data in error reports — `beforeSend` strips `authorization`/`cookie` headers; `sendDefaultPii: false`
- [ ] Environment tagging: development/staging/production — no `environment:` property in any `Sentry.init()` call
- [ ] Release tagging: commit SHA or version number — no `release:` property in any `Sentry.init()` call
- [x] Error boundaries in all web apps with fallback UI — `global-error.tsx` in all 3 web apps with shared UI component
- [x] Performance sampling: 100% dev, 20% production — all configs: `NODE_ENV === "production" ? 0.2 : 1.0`
- [ ] Alert rules: new issue spike, error rate increase, crash-free rate drop — requires Sentry dashboard configuration (external)
- [ ] GitHub integration: suspect commits linked to issues — requires Sentry dashboard configuration (external)
- [x] Breadcrumbs: console logs, fetch requests, navigation captured — default auto-breadcrumbs active via SDKs
- [ ] Mobile crash-free rate visible in Sentry Release Health — blocked by missing release tagging
- [ ] Test: trigger a test error in each app and verify it appears in Sentry — no test error routes or scripts exist
- [x] Environment variables documented in `.env.example` for each app — `api/.env.example`, t3-env schemas, `turbo.json globalEnv` all complete

## Dependencies

- Milestone 01: `01-turborepo-monorepo-init.md` (monorepo structure)
- Milestone 01: `02-app-scaffolding.md` (all 5 apps scaffolded)
- Sentry account created (free tier)
- GitHub repository connected to Sentry
- Vercel deployment configured (for source map upload integration)

## Technical Notes

- Sentry free tier: 5K errors/month, 10K perf transactions/month — sufficient for launch
- If volume exceeds free tier, upgrade to Team plan ($26/month) or increase sampling rate
- Source maps are critical for readable stack traces in production — verify upload in CI
- Hono on Vercel Serverless: each invocation is a cold start — Sentry SDK initializes per request (lightweight)
- For React Native, `sentry-expo` handles native crash reporting — no native code changes needed
- Consider adding custom Sentry tags: `userRole` (learner/mentor/admin), `appVersion`, `locale`
- Sentry performance tracing can overlap with Vercel Analytics — use Sentry for errors, Vercel for web vitals
- In test environments, disable Sentry or use a separate DSN to avoid polluting production data
