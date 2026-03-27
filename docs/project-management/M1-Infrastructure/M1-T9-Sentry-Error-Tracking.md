# M1-T9 · Sentry Error Tracking Setup

| Field          | Value                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------- |
| **Milestone**  | M1 — Project Setup & Infrastructure                                                      |
| **Status**     | ✅ Complete — PR #13                                                                     |
| **Depends on** | M1-T3 (Hono API scaffold), M1-T4 (React Native scaffold), M1-T5 (React admin scaffold)   |
| **PRD Ref**    | Section 10.1 (Observability — Sentry), Non-functional requirements (crash-free sessions) |

---

## Description

Integrate Sentry error tracking across all three CeolX applications: the Hono API (AWS Lambda), the React admin dashboard (Vite + TanStack Router), and the React Native / Expo mobile app. Sentry captures unhandled exceptions, network errors, and performance traces so production issues can be diagnosed quickly. Wire Sentry in M1 so that every feature built in M2–M12 is automatically covered — errors don't fall silently into void.

CeolX uses Sentry's **free tier** for V1 (5K errors/month, 10K performance transactions/month). This is more than sufficient for a <1,000 user controlled launch.

Three separate Sentry projects are created (one per app surface), all under a single CeolX organization for unified error visibility.

---

## Affected Apps / Packages

| App / Package | Role                                                                         |
| ------------- | ---------------------------------------------------------------------------- |
| `apps/api`    | Sentry Node / Lambda SDK — captures Hono unhandled errors and Lambda crashes |
| `apps/admin`  | Sentry React SDK — captures client errors and React error boundaries         |
| `apps/mobile` | Sentry React Native SDK — captures JS errors and native crashes              |

---

## Requirements

### 1. Sentry Organization & Projects

- Create Sentry organization: `ceolx`
- Create 3 separate Sentry projects:
  - `ceolx-api` — platform: **Node.js** (Serverless)
  - `ceolx-admin` — platform: **React** (browser)
  - `ceolx-mobile` — platform: **React Native**
- Enable **environment tagging**: `development`, `staging`, `production`
- Enable **release tagging**: use Git commit SHA (`process.env.GIT_COMMIT_SHA` or Vercel/EAS build metadata)
- Team alerts: configure email alert to Priya's email for new issues in `production` environment only (not dev/staging noise)

### 2. Hono API (AWS Lambda)

- Install `@sentry/node` and `@sentry/serverless`
- Initialize Sentry in `apps/server/src/instrumentation.ts` — import this file first in `src/index.ts` (before any other imports)
- Wrap the Lambda handler with `Sentry.AWSLambda.wrapHandler()`
- Capture unhandled errors from Hono's `onError` handler via `Sentry.captureException(err)`
- Set `tracesSampleRate: 0.1` (10% of transactions in production to stay in free tier)
- Attach user context on authenticated requests: `Sentry.setUser({ id: userId })`
- Strip PII from breadcrumbs: do NOT log request bodies (may contain passwords, tokens)

### 3. React Admin Dashboard (Vite + TanStack Router)

- Install `@sentry/react` and `vite-plugin-sentry` (for source map uploads on build)
- Initialize Sentry in `apps/admin/src/main.tsx` — before `ReactDOM.createRoot()`
- Wrap the root with `<Sentry.ErrorBoundary>` in `main.tsx`
- Configure `vite-plugin-sentry` in `vite.config.ts` to upload source maps to Sentry on `vite build` — requires `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` env vars
- Set `tracesSampleRate: 0.1` in production
- Disable in development: `enabled: import.meta.env.PROD`

### 4. React Native / Expo Mobile App

- Install `@sentry/react-native`
- Initialize Sentry in `apps/native/src/App.tsx` (or `apps/native/app/_layout.tsx` if using Expo Router) — **before** any other initialization
- Configure `@sentry/react-native` with EAS build metadata for release tracking:
  - `release: Constants.expoConfig?.version`
  - `dist: Constants.expoConfig?.runtimeVersion`
- Wrap the root component with `Sentry.wrap(App)` for automatic error boundary
- Enable native crash reporting (Sentry uploads `.dSYM` on iOS and Proguard mappings on Android via EAS)
- Set `tracesSampleRate: 0.1` in production
- Disable Sentry in development: set `enabled: process.env.NODE_ENV !== 'development'`

### 5. Environment Variables

```bash
# apps/api .env
SENTRY_DSN_API=https://xxxxx@o000000.ingest.sentry.io/0000000
SENTRY_ENVIRONMENT=development

# apps/admin .env.local
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@o000000.ingest.sentry.io/0000001
SENTRY_DSN=https://xxxxx@o000000.ingest.sentry.io/0000001
SENTRY_ORG=ceolx
SENTRY_PROJECT=ceolx-admin

# apps/mobile
# Sentry DSN is typically embedded in app config, not a secret
```

### 6. What to Capture vs. Ignore

| Capture                         | Ignore                                  |
| ------------------------------- | --------------------------------------- |
| Unhandled JavaScript exceptions | Expected 4xx errors (validation, auth)  |
| Lambda invocation failures      | Health check endpoint errors            |
| React render errors             | Network retries that ultimately succeed |
| Native crashes (mobile)         | Expo development-only warnings          |
| Stripe webhook errors           | Rate limit 429s (these are expected)    |

Configure `ignoreErrors` in Sentry config to filter known noise.

---

## Acceptance Criteria

- [ ] 3 Sentry projects created: `ceolx-api`, `ceolx-admin`, `ceolx-mobile`
- [ ] Sentry DSNs stored in environment variables — not hardcoded in source
- [ ] Hono API: unhandled exceptions appear in `ceolx-api` Sentry project within 30 seconds of triggering
- [ ] Admin dashboard: client-side JS error appears in `ceolx-admin` Sentry project
- [ ] Admin dashboard: client-side render error (inside `<Sentry.ErrorBoundary>`) appears in `ceolx-admin` Sentry project
- [ ] Mobile app: throwing an unhandled error in development appears in `ceolx-mobile` Sentry project (with `enabled: true` for test)
- [ ] Environment tag (`development`/`staging`/`production`) correct on all captured events
- [ ] Production alerts configured to notify Priya's email for new issues only
- [ ] Sentry **disabled** in API and mobile when `NODE_ENV=development` (prevents noise)
- [ ] TypeScript compilation passes with zero errors across all three apps

---

## Technical Notes

### Hono API Sentry Initialization

```typescript
// apps/server/src/instrumentation.ts — import FIRST in src/index.ts

import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN_API,
  environment: process.env.SENTRY_ENVIRONMENT ?? 'development',
  enabled: process.env.NODE_ENV !== 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  ignoreErrors: [
    // Expected client errors — not bugs
    'ValidationError',
    'AuthenticationError',
  ],
});
```

### Capture in Hono Error Handler

```typescript
// apps/server/src/middleware/errorHandler.ts

import * as Sentry from '@sentry/node';
import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

export const errorHandler = (err: Error, c: Context) => {
  // Only capture unexpected server errors — not expected 4xx
  if (!(err instanceof HTTPException) || err.status >= 500) {
    Sentry.captureException(err, {
      extra: {
        route: c.req.path,
        method: c.req.method,
      },
    });
  }

  // ... rest of error handler from M1-T3
};
```

### Set User Context on Authenticated Requests

```typescript
// apps/server/src/middleware/auth.ts — after verifying token

import * as Sentry from '@sentry/node';

// After successful token verification:
Sentry.setUser({ id: payload.userId });
c.set('userId', payload.userId);
c.set('currentRole', payload.currentRole);
```

### Mobile App Initialization (Expo Router)

```typescript
// apps/native/app/_layout.tsx

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

Sentry.init({
  dsn: 'https://xxxxx@o000000.ingest.sentry.io/0000002',
  environment: __DEV__ ? 'development' : 'production',
  enabled: !__DEV__,
  tracesSampleRate: 0.1,
  release: Constants.expoConfig?.version,
  dist: String(
    Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? 1
  ),
});

export default Sentry.wrap(RootLayout);
```

---

## Common Gotchas

- **Import order matters on Lambda**: Sentry **must** be imported before any other module in the Lambda entry point. Otherwise it cannot patch async context and will miss some errors.
- **DSN is not a secret**: Sentry DSNs are safe to embed in client-side and mobile code — they are write-only (events can only be sent, not read). No need to hide the mobile DSN.
- **Free tier limits**: 5K errors/month resets on the 1st. In a V1 launch, if a bug causes mass errors (e.g., all map loads fail), 5K can be hit in hours. Set up a Sentry alert at 80% quota usage.
- **React Native source maps**: Without `.dSYM` (iOS) and Proguard mapping (Android) uploads, Sentry crash reports show minified/native stack frames. Wire EAS build hooks to upload maps automatically.
- **`Sentry.wrap()` on mobile**: Required for Expo Router apps — without it, unhandled promise rejections in navigation code may not be captured.
- **Development noise**: Keep `enabled: false` in development unless actively debugging Sentry integration — Sentry in dev creates false confidence that issues are being tracked when they won't be in the Sentry dashboard.
