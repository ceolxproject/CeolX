# Android Staging Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an installable Android staging build of CeolX to QA via a single `expo.dev/install/<id>` URL, pointing at a live Vercel-hosted staging backend at `api-staging.ceolx.ie`, with EAS Update OTA on the `staging` channel and CI auto-builds on push to `development`.

**Architecture:** Backend Hono app refactored into a reusable `app` export consumed by both the local Node bootstrap and a new `apps/server/api/index.ts` Vercel handler. Native app gains a function-form `app.config.ts` that switches `package` / `bundleIdentifier` / `name` on `APP_VARIANT`, plus a new `staging` EAS profile using internal distribution + APK + EAS Update channel `staging`. CI is a single EAS Workflow file triggering on `development` pushes that runs both an APK build and an OTA publish.

**Tech Stack:** Hono + `hono/vercel` adapter, Vercel Hobby (10s function timeout), Drizzle + Neon staging branch, BetterAuth, Firebase Admin SDK + FCM, EAS Build internal distribution, EAS Update, EAS Workflows.

**Spec:** `docs/superpowers/specs/2026-05-05-android-staging-build-design.md`

**Branch:** `feature/staging-android-build` (already created)

---

## File Structure

| Path                                       | Action           | Responsibility                                                                                                                                                                   |
| ------------------------------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/server/src/app.ts`                   | NEW              | Bare Hono app builder; exports configured `app`. Importable by both Node bootstrap and Vercel adapter.                                                                           |
| `apps/server/src/index.ts`                 | MODIFY           | Drop inline `app` construction; import from `./app`; keep only the `serve()` Node bootstrap for local dev.                                                                       |
| `apps/server/api/index.ts`                 | NEW              | Vercel handler — imports `app` and wraps with `handle()` from `hono/vercel`.                                                                                                     |
| `apps/server/vercel.json`                  | NEW              | Rewrite all paths to `/api`; declare Node runtime.                                                                                                                               |
| `apps/native/app.config.ts`                | MODIFY           | Convert to function form; switch `android.package`, `ios.bundleIdentifier`, `name` on `APP_VARIANT`.                                                                             |
| `apps/native/scripts/verify-app-config.ts` | NEW              | Smoke script that imports `app.config.ts` under both `APP_VARIANT=staging` and `production` and asserts the right package IDs. Replaces a unit-test framework for a config file. |
| `apps/native/eas.json`                     | MODIFY           | Add `staging` profile; set `cli.appVersionSource: "remote"`.                                                                                                                     |
| `apps/native/google-services.staging.json` | NEW (gitignored) | Firebase Android config for `ie.ceolx.app.staging`.                                                                                                                              |
| `apps/native/.gitignore`                   | MODIFY           | Ignore `google-services.staging.json`.                                                                                                                                           |
| `.eas/workflows/staging-android.yml`       | NEW              | EAS Workflow: on push to `development`, build Android APK + publish OTA.                                                                                                         |
| `docs/qa-staging-install.md`               | NEW              | QA install + bug-reporting runbook.                                                                                                                                              |

Boundary note: `apps/server/src/app.ts` is the new "Hono app builder" unit — same responsibility regardless of host (Node, Vercel, future Lambda). `apps/server/src/index.ts` is now strictly the Node-only bootstrap. `apps/server/api/index.ts` is strictly the Vercel adapter. Each file does one thing.

---

## Conventions

- **Branch:** `feature/staging-android-build` (already current).
- **Commits:** emoji + lowercase type + scope + lowercase subject. Scopes available: `server`, `native`, `admin`, `deps`, `ci`, `docs`, `claude`, `agents`, `stack`, `shared`.
- **Pre-commit:** lint-staged runs prettier on `*.{json,css,md}` and ESLint on `*.{ts,tsx,js}`. Don't bypass with `--no-verify`.
- **PR base:** `development` (NOT `main`). When opening a PR, pass `--base development` to `gh pr create`.

---

## Task 1 — Pre-flight checklist [HUMAN]

These are dashboard / console actions outside the codebase. Complete all six before starting Task 2 — Tasks 5, 6, 12, 13, 16 will block on them.

- [ ] **Step 1.1: Create Firebase project `ceolx-staging`**

Open https://console.firebase.google.com → Add project → name: `ceolx-staging` → disable Google Analytics for staging (optional — saves quota) → Create.

- [ ] **Step 1.2: Provision Firebase service account**

In the new project: ⚙ Settings → Service accounts → Generate new private key → save the JSON locally (will use in Task 6 to populate `FIREBASE_PRIVATE_KEY` and `FIREBASE_CLIENT_EMAIL` env vars on Vercel).

- [ ] **Step 1.3: Confirm Vercel account on Hobby tier**

Sign in at https://vercel.com → confirm Hobby plan. Note the team slug or personal username — needed for `vercel link` in Task 5.

- [ ] **Step 1.4: Confirm DNS access for `ceolx.ie`**

Confirm you can add a CNAME record at the registrar / Cloudflare dashboard for `api-staging.ceolx.ie`. Needed in Task 7.

- [ ] **Step 1.5: Confirm Stripe test mode + price ID**

Stripe Dashboard → toggle Test mode → Products → confirm a test-mode `price_test_…` exists for the Venue subscription (or create one). Capture the price ID for Task 6's `STRIPE_VENUE_PRICE_ID` env var.

- [ ] **Step 1.6: Confirm Postmark sender domain**

Postmark Dashboard → Sender Signatures → confirm `ceolx.ie` is verified (DKIM + SPF green). If not, escalate to client to add DNS records — staging emails will silently fail otherwise.

No commit for Task 1 (no code changes). Proceed to Task 2.

---

## Task 2 — Extract Hono app to `apps/server/src/app.ts`

**Files:**

- Create: `apps/server/src/app.ts`
- Modify: `apps/server/src/index.ts:1-126` (move app construction out, keep only the `serve()` bootstrap)

The current `apps/server/src/index.ts` builds the Hono app and immediately starts a Node server with `serve()`. Vercel can't use that — it expects a request handler. We split: the app construction moves to `app.ts`, which both `index.ts` (Node) and `api/index.ts` (Vercel, Task 3) consume.

- [ ] **Step 2.1: Create `apps/server/src/app.ts`**

```ts
import './instrumentation'; // Must be first — Sentry/OpenTelemetry instrumentations must register before application modules load

import { trpcServer } from '@hono/trpc-server';
import * as Sentry from '@sentry/node';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { createContext } from '@CeolX/api/context';
import { appRouter } from '@CeolX/api/routers/index';
import { auth } from '@CeolX/auth';
import { rateLimiter, RATE_LIMIT_TIERS } from '@CeolX/cache';
import '@CeolX/env/server';

import { isAllowedOrigin } from './config/cors';
import { publishJob } from './jobs/publish';
import { errorHandler } from './middleware/errorHandler';
import locationRoutes from './routes/location';
import webhooksRoutes from './routes/webhooks';
import { dispatchNotification } from './services/notifications-dispatcher';

const scheduleAccountAnonymize = async ({
  userId,
  requestedAt,
}: {
  userId: string;
  requestedAt: Date;
}) => {
  await publishJob(
    'account.anonymize',
    { userId, requestedAt: requestedAt.toISOString() },
    { delay: '30d' }
  );
};

export function buildApp() {
  const app = new Hono();

  app.use(logger());
  app.use(
    '/*',
    cors({
      origin: (origin) => {
        if (!origin) return null;
        if (isAllowedOrigin(origin)) return origin;
        console.warn('[CORS] Rejected origin:', origin);
        return null;
      },
      credentials: true,
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
      maxAge: 86400,
    })
  );

  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    })
  );

  app.use('/api/auth/*', rateLimiter(RATE_LIMIT_TIERS.authLogin));
  app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw));

  app.use('/trpc/*', rateLimiter(RATE_LIMIT_TIERS.authenticatedGeneral));
  app.use(
    '/trpc/*',
    trpcServer({
      router: appRouter,
      createContext: (_opts, context) =>
        createContext({ context, dispatchNotification, scheduleAccountAnonymize }),
      onError: ({ error, path }) => {
        if (error.code === 'INTERNAL_SERVER_ERROR') {
          Sentry.captureException(error, { extra: { trpcPath: path } });
          console.error('[tRPC Error]', {
            path,
            message: error.message,
            cause: error.cause,
            stack: error.stack,
          });
        }
      },
    })
  );

  app.use('/location/*', rateLimiter(RATE_LIMIT_TIERS.locationLookup));
  app.route('/location', locationRoutes);

  app.route('/api/webhooks', webhooksRoutes);

  app.onError(errorHandler);
  app.notFound((c) =>
    c.json(
      {
        error: 'NotFound',
        code: 'ROUTE_NOT_FOUND',
        message: 'Endpoint not found',
        statusCode: 404,
      },
      404
    )
  );

  return app;
}

export const app = buildApp();
```

- [ ] **Step 2.2: Replace `apps/server/src/index.ts` with the Node-only bootstrap**

```ts
import { serve } from '@hono/node-server';

import { app } from './app';

const port = Number(process.env.PORT) || 3001;
serve({ fetch: app.fetch, port }, () => {
  // eslint-disable-next-line no-console
  console.log(`API running on http://localhost:${port}`);
});

export default app;
```

- [ ] **Step 2.3: Verify local dev still works**

```bash
cd apps/server && pnpm dev
```

Expected: `API running on http://localhost:3001`. In another terminal:

```bash
curl -s http://localhost:3001/health | jq .
```

Expected: `{ "status": "ok", "timestamp": "...", "version": "1.0.0" }`.

Stop the dev server (`Ctrl-C`) before proceeding.

- [ ] **Step 2.4: Run tests + type-check**

```bash
cd apps/server && pnpm check-types && pnpm test
```

Expected: types clean, all existing tests still pass.

- [ ] **Step 2.5: Commit**

```bash
git add apps/server/src/app.ts apps/server/src/index.ts
git commit -m "$(cat <<'EOF'
♻️ refactor(server): extract hono app into reusable builder

splits app construction from the node bootstrap so the same configured
hono instance can be consumed by the upcoming vercel adapter without
duplicating middleware wiring.

EOF
)"
```

---

## Task 3 — Add Vercel adapter at `apps/server/api/index.ts`

**Files:**

- Create: `apps/server/api/index.ts`
- Create: `apps/server/vercel.json`

`hono/vercel` is part of Hono core (no extra dep needed — `hono` is already in `apps/server/package.json`). The `handle()` helper turns a Hono app into a Vercel `Request → Response` function compatible with the Node 20 runtime.

- [ ] **Step 3.1: Create `apps/server/api/index.ts`**

```ts
import { handle } from 'hono/vercel';

import { app } from '../src/app';

export const config = {
  runtime: 'nodejs',
};

export default handle(app);
```

- [ ] **Step 3.2: Create `apps/server/vercel.json`**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [{ "source": "/(.*)", "destination": "/api" }],
  "functions": {
    "api/index.ts": {
      "maxDuration": 10
    }
  }
}
```

`maxDuration: 10` is the Hobby cap — being explicit so any future Pro upgrade is a one-line bump.

- [ ] **Step 3.3: Type-check the adapter**

```bash
cd apps/server && pnpm check-types
```

Expected: clean.

- [ ] **Step 3.4: Commit**

```bash
git add apps/server/api/index.ts apps/server/vercel.json
git commit -m "$(cat <<'EOF'
✨ feat(server): add vercel adapter + vercel.json

wraps the shared hono app via hono/vercel handle() so apps/server
deploys as a vercel function. vercel.json rewrites all paths to /api
and pins maxDuration to the hobby-tier cap.

EOF
)"
```

---

## Task 4 — Verify firebase-admin lazy init [SANITY CHECK]

**Files:**

- Read: `apps/server/src/lib/firebase-admin.ts`

Cold starts on Vercel re-execute module-level code. The Firebase Admin SDK throws if `initializeApp()` is called twice. Existing code at `apps/server/src/lib/firebase-admin.ts` already uses `getApps()` to short-circuit — confirm before deploying.

- [ ] **Step 4.1: Read the file**

```bash
cat apps/server/src/lib/firebase-admin.ts
```

Expected pattern (already present):

```ts
const [existing] = getApps();
if (existing) return existing;
return initializeApp({ ... });
```

If the pattern is missing, add it. If present, no-op — proceed.

No commit unless changes were needed.

---

## Task 5 — Link Vercel project + initial deploy [HUMAN + CLI]

**Prerequisites:** Tasks 1, 2, 3 complete.

- [ ] **Step 5.1: Install Vercel CLI globally**

```bash
npm install -g vercel
vercel --version
```

Expected: version printed (any 30.x+ is fine).

- [ ] **Step 5.2: Login**

```bash
vercel login
```

Follow the email magic link.

- [ ] **Step 5.3: Link the project**

```bash
cd apps/server
vercel link
```

Prompts: pick scope (your team / personal account) → "Link to existing project?" → No → Project name: `ceolx-api-staging` → root directory: `./` (you're already in `apps/server`) → confirm.

This creates `apps/server/.vercel/project.json` (gitignored by default).

- [ ] **Step 5.4: First deploy (will fail validation but provisions the project)**

```bash
vercel --prod
```

Expected: deploys successfully but auth/tRPC routes return 500 because env vars aren't set yet. That's fine — we just wanted the URL provisioned. Capture the deploy URL printed (looks like `https://ceolx-api-staging-abc123.vercel.app`).

- [ ] **Step 5.5: Smoke-test the health endpoint**

```bash
curl -s https://ceolx-api-staging-<your-deploy>.vercel.app/health | jq .
```

Expected: `{ "status": "ok", ... }`. If 500 → check Vercel deployment logs in dashboard; most likely a missing env var that's read at module load.

No commit (no source changes — `.vercel/` is gitignored).

---

## Task 6 — Push env vars to Vercel [HUMAN + CLI]

**Files:**

- Read: `apps/server/.env.staging`

Vercel needs every server env var. The `.env.staging` file already has the full list — we just push each entry.

- [ ] **Step 6.1: Decrypt the staging env (if needed)**

```bash
cd apps/server
envx copy -e staging
```

This decrypts `.env.staging.gpg` to `.env`. Or read `.env.staging` directly if it's already the unencrypted source of truth.

- [ ] **Step 6.2: Replace placeholder values**

Open `apps/server/.env.staging` and replace these placeholder values with real ones from Task 1:

- `BETTER_AUTH_SECRET` — generate a 32-char secret: `openssl rand -base64 32`
- `FIREBASE_PRIVATE_KEY` / `FIREBASE_CLIENT_EMAIL` — from Step 1.2's service-account JSON. Note: the private key contains literal `\n` newlines that need to stay escaped. Wrap the value in double-quotes when adding to Vercel.
- `STRIPE_VENUE_PRICE_ID` — from Step 1.5
- AWS / Mux / Postmark / Sentry / Google OAuth values — from your client-managed secret store

Do NOT commit the populated `.env.staging`; the encrypted `.env.staging.gpg` is the version-controlled source.

- [ ] **Step 6.3: Push env vars to Vercel for the Production environment (this Vercel project's "production" = our staging)**

For each variable, run:

```bash
cd apps/server
vercel env add <NAME> production
# paste value when prompted
```

Variables to add (full list):

- `NODE_ENV` → `staging`
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL` → `https://api-staging.ceolx.ie`
- `CORS_ALLOWED_ORIGINS` → `https://admin-staging.ceolx.ie|https://app-staging.ceolx.ie`
- `GOOGLE_OAUTH_CLIENT_ID_IOS`
- `GOOGLE_OAUTH_CLIENT_ID_ANDROID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `APPLE_OAUTH_CLIENT_ID` → `ie.ceolx.app`
- `APPLE_OAUTH_TEAM_ID`
- `APPLE_OAUTH_KEY_ID`
- `APPLE_OAUTH_PRIVATE_KEY`
- `POSTMARK_API_TOKEN`
- `POSTMARK_FROM_ADDRESS` → `noreply@ceolx.ie`
- `FIREBASE_PROJECT_ID` → `ceolx-staging`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_CLIENT_EMAIL`
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `S3_BUCKET_NAME`
- `CLOUDFRONT_DOMAIN`
- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`
- `MUX_WEBHOOK_SECRET`
- `STRIPE_SECRET_KEY` (test-mode `sk_test_…`)
- `STRIPE_WEBHOOK_SECRET` (placeholder for now — updated in Task 8)
- `STRIPE_VENUE_PRICE_ID`
- `SENTRY_DSN_API`

Note: `PORT` is omitted (Vercel sets it).

- [ ] **Step 6.4: Redeploy to pick up env vars**

```bash
vercel --prod
```

- [ ] **Step 6.5: Smoke-test sign-up via curl**

```bash
DEPLOY_URL="https://ceolx-api-staging-<your-deploy>.vercel.app"
curl -s -X POST "$DEPLOY_URL/api/auth/sign-up/email" \
  -H "Content-Type: application/json" \
  -d '{"email":"qa-smoke@ceolx.ie","password":"SmokeTest123!","name":"Smoke Test"}' | jq .
```

Expected: 200 with a session response. Verify a row landed in the Neon staging branch:

```bash
psql "$DATABASE_URL" -c "select id, email, created_at from \"user\" where email='qa-smoke@ceolx.ie';"
```

Expected: one row. If 500 → tail Vercel logs (`vercel logs --follow`) and fix the offending env var.

No commit (env config lives outside the repo).

---

## Task 7 — Custom domain `api-staging.ceolx.ie` [HUMAN]

- [ ] **Step 7.1: Add the domain in Vercel**

```bash
cd apps/server
vercel domains add api-staging.ceolx.ie
```

Vercel prints the required DNS record (typically a CNAME → `cname.vercel-dns.com`).

- [ ] **Step 7.2: Add the CNAME at the DNS provider**

In Cloudflare (or registrar) DNS for `ceolx.ie`:

- Type: `CNAME`
- Name: `api-staging`
- Target: `cname.vercel-dns.com` (use whatever Vercel printed)
- Proxy: OFF (orange cloud disabled — Vercel manages SSL)
- TTL: Auto

- [ ] **Step 7.3: Wait for SSL issuance + verify**

```bash
until curl -sf https://api-staging.ceolx.ie/health > /dev/null; do
  echo "waiting..."
  sleep 10
done
curl -s https://api-staging.ceolx.ie/health | jq .
```

Expected: `{ "status": "ok", ... }`. Cloudflare DNS propagates in ~minutes; legacy registrars can take longer.

- [ ] **Step 7.4: Update `BETTER_AUTH_URL` if it changed**

The env var was set to `https://api-staging.ceolx.ie` in Step 6.3. Confirm it's correct:

```bash
vercel env ls
```

If wrong, update:

```bash
vercel env rm BETTER_AUTH_URL production
vercel env add BETTER_AUTH_URL production
# enter https://api-staging.ceolx.ie
vercel --prod
```

No commit.

---

## Task 8 — Register Stripe webhook + capture secret [HUMAN]

- [ ] **Step 8.1: Add webhook endpoint in Stripe Dashboard (test mode)**

https://dashboard.stripe.com → toggle Test mode (top right) → Developers → Webhooks → Add endpoint.

- Endpoint URL: `https://api-staging.ceolx.ie/api/webhooks/stripe`
- Events: subscribe to whatever the production Stripe webhook subscribes to. At minimum: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.
- Add endpoint.

- [ ] **Step 8.2: Capture signing secret + push to Vercel**

After creating the endpoint, click on it → Signing secret → Reveal → copy the `whsec_...` value.

```bash
cd apps/server
vercel env rm STRIPE_WEBHOOK_SECRET production
vercel env add STRIPE_WEBHOOK_SECRET production
# paste the whsec_ value
vercel --prod
```

- [ ] **Step 8.3: Send a test event from Stripe dashboard**

Stripe Webhooks → your new endpoint → Send test webhook → pick `checkout.session.completed`. Check `vercel logs` — should see the webhook handler fire and respond 200.

No commit.

---

## Task 9 — Convert `app.config.ts` to function form

**Files:**

- Modify: `apps/native/app.config.ts:1-117`
- Create: `apps/native/scripts/verify-app-config.ts`

The function form lets us read `process.env.APP_VARIANT` (set per-build by EAS via `eas.json#build.<profile>.env`) and toggle `package`, `bundleIdentifier`, and display `name`. Verification is a quick `tsx` smoke script that asserts the right values for both variants — better than wiring vitest into `apps/native` for one config file.

- [ ] **Step 9.1: Replace `apps/native/app.config.ts`**

Current shape is `const config = { ... }; export default config;`. New shape is `export default ({ config: _ }: ConfigContext): ExpoConfig => ({ ... })`.

```ts
import type { ConfigContext, ExpoConfig } from 'expo/config';

const VARIANT = (process.env.APP_VARIANT ?? 'production') as 'staging' | 'production';
const IS_STAGING = VARIANT === 'staging';

const PROD_BUNDLE_ID = 'ie.ceolx.app';
const STAGING_BUNDLE_ID = 'ie.ceolx.app.staging';

export default (_: ConfigContext): ExpoConfig => ({
  name: IS_STAGING ? 'CeolX (Staging)' : 'CeolX',
  slug: 'ceolx',
  owner: 'ceolxprojects-organization',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  scheme: 'ceolx',
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: IS_STAGING ? STAGING_BUNDLE_ID : PROD_BUNDLE_ID,
    usesAppleSignIn: true,
    googleServicesFile: process.env.GOOGLE_SERVICES_INFO_PLIST ?? './GoogleService-Info.plist',
    associatedDomains: ['applinks:ceolx.ie'],
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'CeolX uses your location to show nearby Irish music events',
      NSCameraUsageDescription: 'Upload videos of your performances',
      NSPhotoLibraryUsageDescription: 'Upload images and videos',
      NSMicrophoneUsageDescription: 'Record audio for posts',
      NSAppTransportSecurity: {
        NSAllowsLocalNetworking: true,
      },
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    package: IS_STAGING ? STAGING_BUNDLE_ID : PROD_BUNDLE_ID,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ??
      (IS_STAGING ? './google-services.staging.json' : './google-services.json'),
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
      },
    },
    permissions: [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.CAMERA',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.RECORD_AUDIO',
    ],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: 'ceolx.ie', pathPrefix: '/post' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    bundler: 'metro',
  },
  plugins: [
    'expo-font',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Allow CeolX to use your location to show nearby Irish music events',
      },
    ],
    'expo-secure-store',
    '@react-native-firebase/app',
    './plugins/with-modular-headers.cjs',
    'expo-notifications',
    'expo-apple-authentication',
    [
      'react-native-maps',
      {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
      },
    ],
    '@react-native-community/datetimepicker',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      projectId: '91f9219e-c91c-47f2-b55a-5ee1db979b66',
    },
    appVariant: VARIANT,
  },
});
```

- [ ] **Step 9.2: Create the verification script `apps/native/scripts/verify-app-config.ts`**

```ts
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const configPath = path.resolve(here, '..', 'app.config.ts');

function loadConfig(variant: 'staging' | 'production') {
  const result = spawnSync(
    'tsx',
    [
      '-e',
      `import('${configPath}').then((m) => process.stdout.write(JSON.stringify(m.default({ config: {} }))));`,
    ],
    {
      env: { ...process.env, APP_VARIANT: variant },
      encoding: 'utf8',
    }
  );
  if (result.status !== 0) {
    throw new Error(`tsx exited ${result.status}: ${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

const staging = loadConfig('staging');
assert.equal(staging.android.package, 'ie.ceolx.app.staging');
assert.equal(staging.ios.bundleIdentifier, 'ie.ceolx.app.staging');
assert.equal(staging.name, 'CeolX (Staging)');
assert.equal(staging.extra.appVariant, 'staging');

const prod = loadConfig('production');
assert.equal(prod.android.package, 'ie.ceolx.app');
assert.equal(prod.ios.bundleIdentifier, 'ie.ceolx.app');
assert.equal(prod.name, 'CeolX');
assert.equal(prod.extra.appVariant, 'production');

console.log('app.config.ts: both variants verified ✓');
```

- [ ] **Step 9.3: Run the verification script**

```bash
cd apps/native
pnpm exec tsx scripts/verify-app-config.ts
```

Expected: `app.config.ts: both variants verified ✓` and exit 0. If an assertion fails → fix the config and re-run.

- [ ] **Step 9.4: Commit**

```bash
git add apps/native/app.config.ts apps/native/scripts/verify-app-config.ts
git commit -m "$(cat <<'EOF'
✨ feat(native): convert app.config.ts to function form with variant switch

reads APP_VARIANT env var and toggles android.package, ios.bundleIdentifier,
display name, and android.googleServicesFile between production and staging.
includes a tsx smoke script that asserts both variants resolve to the right
package ids before any eas build.

EOF
)"
```

---

## Task 10 — Add `staging` profile to `eas.json`

**Files:**

- Modify: `apps/native/eas.json`

- [ ] **Step 10.1: Replace `apps/native/eas.json`**

```json
{
  "cli": {
    "version": ">= 5.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal"
    },
    "staging": {
      "distribution": "internal",
      "channel": "staging",
      "env": {
        "APP_VARIANT": "staging"
      },
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "distribution": "store",
      "channel": "production",
      "env": {
        "APP_VARIANT": "production"
      }
    }
  }
}
```

`buildType: "apk"` is required for internal distribution (AAB can't be installed via the install URL).

- [ ] **Step 10.2: Validate**

```bash
cd apps/native
pnpm exec eas build:configure --help > /dev/null 2>&1 && echo "eas-cli available"
```

(Just confirms `eas-cli` is callable. We'll do the real `eas build` in Task 16.)

- [ ] **Step 10.3: Commit**

```bash
git add apps/native/eas.json
git commit -m "$(cat <<'EOF'
🔧 chore(native): add staging eas profile + remote app version source

internal-distribution apk build with channel=staging and APP_VARIANT
injected into the build env. production gains an explicit channel for
parity. cli.appVersionSource=remote moves version + build number
management to eas across all profiles.

EOF
)"
```

---

## Task 11 — gitignore staging Firebase config

**Files:**

- Modify: `apps/native/.gitignore`

- [ ] **Step 11.1: Append to `apps/native/.gitignore`**

```bash
cd apps/native
echo "" >> .gitignore
echo "# Staging Firebase Android config — downloaded from Firebase Console for ie.ceolx.app.staging" >> .gitignore
echo "google-services.staging.json" >> .gitignore
```

- [ ] **Step 11.2: Verify**

```bash
grep "google-services.staging.json" apps/native/.gitignore
```

Expected: line printed.

- [ ] **Step 11.3: Commit**

```bash
git add apps/native/.gitignore
git commit -m "$(cat <<'EOF'
🔧 chore(native): gitignore google-services.staging.json

staging firebase android config gets downloaded per-developer from the
firebase console and uploaded to eas as a file secret; never committed.

EOF
)"
```

---

## Task 12 — Create staging Firebase Android app + download config [HUMAN]

**Prerequisites:** Task 1 (Firebase staging project exists).

- [ ] **Step 12.1: Add Android app in Firebase Console**

https://console.firebase.google.com → `ceolx-staging` project → Project Overview → Add app → Android.

- Android package name: `ie.ceolx.app.staging`
- App nickname: `CeolX Android Staging`
- Debug signing certificate SHA-1: leave blank for now (registered after Task 17)
- Register app

- [ ] **Step 12.2: Download `google-services.json`**

Firebase prompts you to download. Save it as `apps/native/google-services.staging.json`.

```bash
mv ~/Downloads/google-services.json apps/native/google-services.staging.json
```

- [ ] **Step 12.3: Confirm gitignore is honoured**

```bash
cd apps/native
git status apps/native/google-services.staging.json
```

Expected: file does NOT appear (because Task 11 ignored it). If it shows up, re-check `.gitignore`.

- [ ] **Step 12.4: Skip Firebase's "Add SDK" + "Verify" steps**

The Firebase Console will prompt you to install the SDK and run a verification. Skip both — `@react-native-firebase/app` is already in the native app, and verification will happen on the first build (Task 16).

No commit (file is gitignored).

---

## Task 13 — Generate staging Google Maps Android API key [HUMAN]

**Prerequisites:** Task 12 (Android app registered, so the GCP project exists).

- [ ] **Step 13.1: Open the GCP project that backs the Firebase staging project**

Firebase auto-creates a GCP project when you create a Firebase project. https://console.cloud.google.com → project picker → select the project that matches `ceolx-staging`.

- [ ] **Step 13.2: Enable Maps SDK for Android**

APIs & Services → Library → search "Maps SDK for Android" → Enable.

- [ ] **Step 13.3: Create an API key**

APIs & Services → Credentials → Create credentials → API key.

- Name: `CeolX Staging Android Maps`
- Application restriction: leave "None" for now (will tighten in Task 17 once we have the EAS-generated SHA-1)
- API restrictions: restrict to `Maps SDK for Android`

Copy the generated key — you'll paste it in Task 15 as `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`.

No commit.

---

## Task 14 — Configure EAS Update

**Files:**

- Modify: `apps/native/app.config.ts` (auto-edited by `eas update:configure`)

- [ ] **Step 14.1: Run `eas update:configure`**

```bash
cd apps/native
pnpm exec eas update:configure
```

Prompts: confirm project. The CLI auto-edits `app.config.ts` to add:

- `runtimeVersion: { policy: 'appVersion' }`
- `updates: { url: 'https://u.expo.dev/91f9219e-c91c-47f2-b55a-5ee1db979b66' }`

- [ ] **Step 14.2: Re-run the verification script**

```bash
pnpm exec tsx scripts/verify-app-config.ts
```

Expected: still passes (assertions don't touch `runtimeVersion` or `updates`). If it fails, the auto-edit broke the function shape — fix manually.

- [ ] **Step 14.3: Commit**

```bash
git add apps/native/app.config.ts
git commit -m "$(cat <<'EOF'
✨ feat(native): wire eas update with appversion runtime policy

adds runtimeVersion + updates.url to app.config.ts so eas update can
ship js-only fixes via the staging channel without rebuilding the apk.

EOF
)"
```

---

## Task 15 — Set EAS environment variables [CLI]

**Prerequisites:** Tasks 12, 13 complete (you have the values to push).

- [ ] **Step 15.1: Push string env vars**

```bash
cd apps/native

pnpm exec eas env:create \
  --environment preview \
  --name EXPO_PUBLIC_API_BASE_URL \
  --value https://api-staging.ceolx.ie

pnpm exec eas env:create \
  --environment preview \
  --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY \
  --value <paste-key-from-task-13>

pnpm exec eas env:create \
  --environment preview \
  --name EXPO_PUBLIC_SENTRY_DSN \
  --value <staging-sentry-dsn>

pnpm exec eas env:create \
  --environment preview \
  --name APP_VARIANT \
  --value staging
```

The `staging` build profile uses EAS's `preview` environment by convention (preview = non-production). If you want a dedicated namespace later, you can create a custom EAS environment.

- [ ] **Step 15.2: Push the file secret**

```bash
pnpm exec eas env:create \
  --environment preview \
  --name GOOGLE_SERVICES_JSON \
  --type file \
  --value ./google-services.staging.json
```

- [ ] **Step 15.3: Verify all four are registered**

```bash
pnpm exec eas env:list --environment preview
```

Expected: 5 entries (4 strings + 1 file).

No commit.

---

## Task 16 — First Android staging build [CLI]

**Prerequisites:** Tasks 9–15 complete.

- [ ] **Step 16.1: Kick off the build**

```bash
cd apps/native
pnpm exec eas build -p android --profile staging
```

Expected: EAS uploads source, generates a new Android keystore (first time only — subsequent builds reuse it), and queues the build. Takes ~10–15 minutes.

- [ ] **Step 16.2: While the build runs, capture the SHA-1**

In a second terminal:

```bash
cd apps/native
pnpm exec eas credentials
```

Prompt: select Android → select the `ie.ceolx.app.staging` package → Keystore: Download credentials. The CLI prints `SHA1 Fingerprint: AB:CD:EF:...`. Save it for Task 17.

- [ ] **Step 16.3: When the build finishes, capture the install URL**

Output ends with something like:

```
Build URL: https://expo.dev/accounts/ceolxprojects-organization/projects/ceolx/builds/<id>
Install Build: https://expo.dev/install/<id>
```

Save the `expo.dev/install/<id>` URL.

If the build fails:

- "Could not find google-services.json" → check Step 15.2 file secret name matches `process.env.GOOGLE_SERVICES_JSON` in `app.config.ts`.
- "Package name mismatch" → confirm Task 12's Firebase Android app uses exactly `ie.ceolx.app.staging`.
- "appVersionSource: remote requires…" → run `pnpm exec eas build:version:set -p android --build-number 1` once.

No commit (build artifacts are stored on EAS).

---

## Task 17 — Register SHA-1 fingerprint in Firebase + Google Maps [HUMAN]

**Prerequisites:** Task 16 (SHA-1 captured).

Without this, FCM and Maps both fail silently in the installed APK with "API key not authorized" / "no Firebase app registered."

- [ ] **Step 17.1: Add SHA-1 to Firebase**

Firebase Console → `ceolx-staging` → Project settings → Your apps → `CeolX Android Staging` → Add fingerprint → paste the SHA-1 → Save.

- [ ] **Step 17.2: Re-download `google-services.json`**

After saving the fingerprint, the file changes (it embeds the cert hash). Download it again and overwrite `apps/native/google-services.staging.json`.

- [ ] **Step 17.3: Re-upload the file secret to EAS**

```bash
cd apps/native
pnpm exec eas env:update \
  --environment preview \
  --name GOOGLE_SERVICES_JSON \
  --type file \
  --value ./google-services.staging.json
```

- [ ] **Step 17.4: Restrict the Maps API key**

GCP Console → Credentials → `CeolX Staging Android Maps` → Application restrictions → Android apps → Add:

- Package: `ie.ceolx.app.staging`
- SHA-1: paste fingerprint
- Save.

- [ ] **Step 17.5: Re-run the build**

```bash
pnpm exec eas build -p android --profile staging
```

Same ~10-min wait. Capture the new install URL — this is the one you share with QA.

No commit.

---

## Task 18 — Device smoke test [HUMAN + CLI]

- [ ] **Step 18.1: Open the install URL on a physical Android device**

Use Chrome on the device. Tap the URL → "Install build" page → tap Install → Android prompts "Install from unknown sources" → grant Chrome the permission → APK downloads → install.

- [ ] **Step 18.2: Verify side-by-side install**

Confirm the device's app drawer shows both "CeolX" and "CeolX (Staging)" if a prod build is also installed (skip if no prod build).

- [ ] **Step 18.3: Sign-up flow**

Open CeolX (Staging) → sign-up with email/password → confirm Postmark email arrives → click verification link → email is verified.

- [ ] **Step 18.4: Map renders**

After sign-in, navigate to the Map screen → confirm Google Maps tiles render (not blank). If blank → Maps API key is misconfigured (check Step 17.4).

- [ ] **Step 18.5: FCM token registered**

Firebase Console → `ceolx-staging` → Cloud Messaging → confirm a "registration token" event in the last 5 minutes (or check the `fcm_tokens` table in Neon staging branch via `psql`):

```bash
psql "$DATABASE_URL" -c "select user_id, platform, created_at from fcm_tokens order by created_at desc limit 5;"
```

- [ ] **Step 18.6: Sentry events**

Trigger a deliberate error (e.g., navigate to a deep link that doesn't exist) → confirm an event lands in the staging Sentry project within ~1 min.

- [ ] **Step 18.7: Test EAS Update OTA**

```bash
cd apps/native
pnpm exec eas update --channel staging --message "ota smoke test"
```

On the device: kill the app from recents → reopen → wait ~2 seconds → close + reopen again. The OTA should apply on the second cold start. (Expo's default behaviour: download in background on launch, apply on next launch.)

No commit.

---

## Task 19 — Add EAS Workflow for CI

**Files:**

- Create: `.eas/workflows/staging-android.yml`

- [ ] **Step 19.1: Create `.eas/workflows/staging-android.yml`**

```yaml
name: Staging Android
on:
  push:
    branches: [development]
jobs:
  build:
    name: Build APK
    type: build
    params:
      platform: android
      profile: staging
  publish_update:
    name: Publish OTA
    type: update
    needs: [build]
    params:
      branch: staging
      message: ${{ github.event.head_commit.message }}
```

- [ ] **Step 19.2: Validate against the EAS Workflows schema**

```bash
node .claude/skills/expo-cicd-workflows/scripts/validate.js .eas/workflows/staging-android.yml
```

Expected: validator reports OK. If it errors on `type: update` or `branch:`, the schema may have evolved — refetch via:

```bash
node .claude/skills/expo-cicd-workflows/scripts/fetch.js https://api.expo.dev/v2/workflows/schema
```

…and adjust to the current spec.

- [ ] **Step 19.3: Commit**

```bash
git add .eas/workflows/staging-android.yml
git commit -m "$(cat <<'EOF'
✨ feat(ci): add eas workflow for android staging on push to development

triggers an apk build + ota publish to channel=staging on every push.
runtimeversion mismatches silently skip the ota; testers on the latest
apk pick up js-only changes in seconds.

EOF
)"
```

---

## Task 20 — Verify CI trigger end-to-end

**Prerequisites:** Task 19 committed; PR not yet open (we trigger via push to feature branch first to confirm syntax, then to `development` after merge).

- [ ] **Step 20.1: Push feature branch to GitHub**

```bash
git push -u origin feature/staging-android-build
```

The workflow file's `on.push.branches` is `[development]`, so this push won't trigger anything yet — it just gets the changes onto the remote.

- [ ] **Step 20.2: Confirm in EAS dashboard**

https://expo.dev/accounts/ceolxprojects-organization/projects/ceolx/workflows → confirm `Staging Android` is listed (it appears once it's been seen on any branch).

- [ ] **Step 20.3: Defer "real" trigger until merge**

The actual push-to-`development` trigger will happen after PR merge in Task 22 — no point burning a build slot before the PR is reviewed.

No commit.

---

## Task 21 — QA install runbook

**Files:**

- Create: `docs/qa-staging-install.md`

- [ ] **Step 21.1: Create `docs/qa-staging-install.md`**

```markdown
# CeolX QA — Staging Android Install Guide

## What you're testing

The **CeolX (Staging)** app — a separate build from the production CeolX app, pointing at a staging backend (`api-staging.ceolx.ie`) and a staging database. **Use a fresh email address for staging accounts** — staging data is regularly wiped and not synced with production.

## Prerequisites

- Android 8 (Oreo) or newer.
- Chrome browser on the device.
- Permission to install apps from "unknown sources" (Chrome will prompt the first time).

## Install

1. Open the install URL shared by the dev team in **Chrome on your Android device**:
   `https://expo.dev/install/<id>`
2. Tap **Install build** on the Expo page.
3. Android prompts "Install unknown apps". Tap **Settings** → toggle **Allow from this source** for Chrome.
4. Return to the install page → tap Install again. The APK downloads and installs.
5. Open the **CeolX (Staging)** app from your home screen (icon name distinguishes it from prod).

## Updates

- The dev team ships JavaScript-only fixes via Expo's Over-The-Air (OTA) updates. These apply automatically: cold-start the app, wait ~3 seconds, kill from recents, reopen — the update is now applied.
- Native-code or dependency changes require a **new APK install** — you'll get a new install URL when this happens.

## Reporting bugs

Log issues in Asana project `1210959953917909`. Include:

- **Build ID** (Settings → About in the app, or pull from the install URL)
- **Account email** used to reproduce
- **Device model + Android version**
- **Steps to reproduce**
- **Screenshot or screen recording**

## What to ignore

- Test-mode Stripe payments will not actually charge any card. Use test card `4242 4242 4242 4242`, any future expiry, any CVC.
- Postmark emails on staging may have a slight delay (~2 min) vs production.
- The icon and app name are intentionally different from production — this is how you confirm you're on the staging build.
```

- [ ] **Step 21.2: Commit**

```bash
git add docs/qa-staging-install.md
git commit -m "$(cat <<'EOF'
📝 docs(docs): add qa staging install runbook

walks qa through chrome-based apk install, ota update behaviour, bug-
report fields (asana project + build id + device model), and what to
ignore (test-mode stripe, slight postmark delay, expected ui differences).

EOF
)"
```

---

## Task 22 — Open PR to `development`

- [ ] **Step 22.1: Push final state**

```bash
git push origin feature/staging-android-build
```

- [ ] **Step 22.2: Create PR with `--base development`**

```bash
gh pr create --base development --title "feat: android staging build for qa" --body "$(cat <<'EOF'
## Summary

Ships an installable Android staging build of CeolX to QA via a single `expo.dev/install/<id>` URL, with a Vercel-hosted staging backend and EAS Update OTA on the `staging` channel.

- Backend: `apps/server` refactored to expose a reusable Hono `app` builder; new `apps/server/api/index.ts` Vercel adapter; deployed to `api-staging.ceolx.ie`.
- Native: `app.config.ts` is now a function reading `APP_VARIANT`, switching `package` / `bundleIdentifier` / display name between `ie.ceolx.app.staging` and `ie.ceolx.app`. New `staging` EAS profile (internal distribution, APK, channel `staging`).
- CI: `.eas/workflows/staging-android.yml` builds + publishes OTA on every push to `development`.
- Docs: spec at `docs/superpowers/specs/2026-05-05-android-staging-build-design.md`; QA runbook at `docs/qa-staging-install.md`.

## Test plan

- [ ] `curl https://api-staging.ceolx.ie/health` returns 200
- [ ] `pnpm exec tsx apps/native/scripts/verify-app-config.ts` passes (both variants)
- [ ] `eas build -p android --profile staging` succeeds
- [ ] Install link works on a physical Android device; sign-up + map + FCM all functional
- [ ] OTA update applied via `eas update --channel staging`
- [ ] Push to `development` (post-merge) triggers the CI workflow

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Capture the printed PR URL for the next step.

- [ ] **Step 22.3: Verify PR base is `development`**

```bash
gh pr view --json baseRefName -q .baseRefName
```

Expected: `development`. If `main`, close the PR and re-create with `--base development`.

- [ ] **Step 22.4: After review + merge: confirm CI fires**

Once merged into `development`, watch:

https://expo.dev/accounts/ceolxprojects-organization/projects/ceolx/workflows

The `Staging Android` workflow should fire within ~30 seconds and produce a fresh build URL + OTA publish.

---

## Self-Review

**Spec coverage:**

- Phase 0 (Vercel backend): Tasks 2, 3, 4, 5, 6, 7, 8 ✓
- Phase 1 (native plumbing): Tasks 9, 10, 11, 12, 13 ✓
- Phase 2 (EAS Update): Task 14 ✓
- Phase 3 (secrets + first build): Tasks 15, 16, 17, 18 ✓
- Phase 4 (CI): Tasks 19, 20 ✓
- Phase 5 (QA handoff): Task 21 ✓
- Plus PR: Task 22 ✓
- Prerequisites: Task 1 ✓

**Type / signature consistency:** `buildApp()` declared in Task 2 and re-used by name in Task 3. `APP_VARIANT` referenced consistently across Tasks 9, 10, 14, 15. `expo.dev/install/<id>` URL pattern consistent. `ie.ceolx.app.staging` package ID consistent. `staging` channel name consistent across Tasks 10, 14, 18, 19.

**Hard prerequisites flagged:** Task 1 lists six manual setup items; Tasks 5/12/13/15/17 explicitly cite which pre-flight step they depend on.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-05-android-staging-build.md`.** Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach?
