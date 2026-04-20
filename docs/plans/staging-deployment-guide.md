# CeolX — Staging Deployment Guide (for QA testing)

**Audience:** Priya (solo dev) shipping the first end-to-end staging build to the QA team.
**Goal:** QA can install an Android APK, the app talks to a real staging backend on Vercel, backed by real staging vendors (Neon, Upstash, Typesense, Sentry).
**Who NOT to share secrets with:** Nobody outside the project. Store everything in 1Password / Bitwarden as you create it.

---

## 0. High-level architecture

```
 ┌──────────────────────────┐        ┌────────────────────────────┐
 │  Android APK (Expo EAS)  │──────▶│  https://api-staging…       │
 │  APP_VARIANT=staging     │        │  Hono on Vercel (Node fn)   │
 │  bundleId com.raftlabs…  │        └──────┬──────────────┬──────┘
 └──────────────────────────┘               │              │
              │ download link               │              │
              ▼                              ▼              ▼
 ┌──────────────────────────┐   ┌────────────────┐   ┌──────────────┐
 │  EAS internal dist URL   │   │  Neon (staging │   │  Upstash     │
 │  (QA clicks, installs)   │   │   branch)       │   │  Redis+QStash│
 └──────────────────────────┘   └────────────────┘   └──────────────┘
                                       │
                                       ▼
                                 ┌──────────────┐    ┌──────────────┐
                                 │  Typesense    │    │  Sentry (2  │
                                 │  Cloud (stg) │    │  projects)  │
                                 └──────────────┘    └──────────────┘
```

**Scope of this cycle:** one Vercel project for the Hono API + one Android APK via EAS. The admin dashboard (`apps/admin`) is **not deployed** yet — deferred to a later cycle (see section 9).

**What's in:** Postmark (email verification), Google OAuth Web client (Google Sign-In).
**What's deferred:** Google Maps API key (awaiting team decision on GCP billing — Android will render a gray grid instead of real tiles; pins and interactions work). Apple Developer, Stripe, AWS, Firebase FCM, Mux.

---

## 0.5. Linear deployment sequence — do these in order

| #   | Step                                                           | Section | ~Time       |
| --- | -------------------------------------------------------------- | ------- | ----------- |
| 1   | Create vendor accounts + install CLIs                          | §1      | 30 min      |
| 2   | Create Neon `staging` branch + push schema                     | §2      | 10 min      |
| 3   | Create Upstash Redis DB + grab QStash keys                     | §3      | 10 min      |
| 4   | Provision Typesense Cloud cluster                              | §4      | 5 min       |
| 5   | Create Sentry `ceolx-api` + `ceolx-native` projects            | §5      | 5 min       |
| 6   | Postmark server token + Google OAuth Web client                | §6      | 15 min      |
| 7   | Refactor `apps/server` for Vercel (code change)                | §7      | 20 min      |
| 8   | `vercel link` → set env vars → `vercel --prod` → attach domain | §8      | 30 min      |
| 9   | Seed Typesense against staging DB (one-time)                   | §4 tail | 2 min       |
| 10  | Fill `eas.json` staging env + switch to internal APK           | §10a–b  | 5 min       |
| 11  | `eas build --profile staging --platform android`               | §10c    | 15 min wait |
| 12  | Record SHA-1 from EAS (save for when Maps is un-deferred)      | §10d    | 2 min       |
| 13  | Run smoke-test checklist                                       | §11     | 15 min      |
| 14  | Send APK URL + message to QA                                   | §12     | 2 min       |

Total active work ≈ 2½ hours, plus 15–20 min waiting on the EAS build.

---

## 1. Prerequisites — accounts & CLI tools

Create these accounts if you don't already have them (free tier is fine for staging):

| Service         | What you'll use it for                        | URL                              |
| --------------- | --------------------------------------------- | -------------------------------- |
| Vercel          | Host Hono API                                 | https://vercel.com               |
| Neon            | Postgres (staging branch)                     | https://console.neon.tech        |
| Upstash         | Redis (rate limiting) + QStash (jobs)         | https://console.upstash.com      |
| Typesense Cloud | Map viewport search                           | https://cloud.typesense.org      |
| Sentry          | Error tracking (2 projects)                   | https://sentry.io                |
| Expo (EAS)      | Build APK, internal distribution              | https://expo.dev                 |
| Postmark        | Verification + password-reset emails          | https://postmarkapp.com          |
| Google Cloud    | Google OAuth Web client (Sign-In with Google) | https://console.cloud.google.com |

**Deferred this cycle** (don't create accounts or keys for these — code paths are stubs):

- Google Maps API key (awaiting team decision on GCP billing — see section 6)
- Apple Developer (iOS-only, Apple Sign-In)
- Stripe (subscriptions)
- AWS S3 + CloudFront (media uploads)
- Firebase (FCM push notifications)
- Mux (video streaming)

Install these CLIs locally — **no Android Studio or Java needed**, EAS builds run in the cloud:

```bash
# Node + pnpm (already set up)
corepack enable

# Vercel CLI
npm i -g vercel

# EAS CLI
npm i -g eas-cli

# envx-cli — the repo already uses this for encrypted env files
npm i -g envx-cli
```

Login once per tool:

```bash
vercel login
eas login          # uses your Expo account (owner = ceolxprojects-organization)
```

---

## 2. Neon — create staging database branch

1. Go to https://console.neon.tech → open the CeolX project (create it if it doesn't exist).
2. Click **Branches** → **Create branch** → name it `staging`. Parent = `main` (so schema copies over).
3. Click the `staging` branch → **Connection details** → copy the **pooled** connection string. It looks like:
   ```
   postgresql://<user>:<pass>@<host>-pooler.eu-central-1.aws.neon.tech/<db>?sslmode=require
   ```
4. Save this as `STAGING_DATABASE_URL` in your password manager. You will paste it into Vercel and `.env.staging` in step 8.

> **Why pooled?** Vercel serverless functions open new connections on every cold start. Without pooling, you'll exhaust Postgres connections within minutes under QA load.

Apply the current schema to the staging branch (one-time):

```bash
# From repo root, temporarily point drizzle at the staging DB
DATABASE_URL="<paste staging URL here>" pnpm db:push
```

After this, `staging` will match your current schema. Future schema changes: check out the `staging` git branch, run `pnpm db:push` against `STAGING_DATABASE_URL`.

---

## 3. Upstash — Redis (rate limits) + QStash (background jobs)

### 3a. Redis

1. https://console.upstash.com → **Redis** → **Create database**.
2. Name `ceolx-staging`, region `eu-west-1` (closest to Ireland), Type **Regional**, TLS on.
3. After create → **Details** tab → copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

### 3b. QStash

1. https://console.upstash.com → **QStash** → you'll see:
   - `QSTASH_TOKEN` (publishing key)
   - `QSTASH_CURRENT_SIGNING_KEY`
   - `QSTASH_NEXT_SIGNING_KEY`
2. Copy all three.
3. `QSTASH_BASE_URL` = the **public HTTPS URL** of your deployed server's QStash webhook endpoint. You can't know this until Vercel is live. Leave it blank for now; you'll set it in step 8 after the first Vercel deploy. It will be:
   ```
   https://api-staging.ceolx.ie/api/webhooks/qstash
   ```
   (or whatever Vercel URL you end up using).

---

## 4. Typesense Cloud — staging cluster

1. https://cloud.typesense.org → **New cluster**.
2. Plan: the smallest dev tier is fine for QA. Region `eu-west` / `eu-central`.
3. Name `ceolx-staging`. Wait ~2 min for provisioning.
4. Once green → **API Keys** tab → copy the **Admin API key** (starts with `xyz…`). You need _admin_, not search-only, because the server ingests events.
5. **Cluster** tab → copy the hostname, e.g. `abc123.a1.typesense.net`.

Staging env values:

```
TYPESENSE_HOST=abc123.a1.typesense.net
TYPESENSE_API_KEY=<admin key>
TYPESENSE_PORT=443
TYPESENSE_PROTOCOL=https
```

After the API is deployed (step 8), seed the collection:

```bash
# From repo root
DATABASE_URL="<STAGING_DATABASE_URL>" \
TYPESENSE_HOST=abc123.a1.typesense.net \
TYPESENSE_API_KEY=<admin key> \
TYPESENSE_PORT=443 TYPESENSE_PROTOCOL=https \
npx tsx scripts/seed-typesense.ts
```

---

## 5. Sentry — two projects (admin project deferred)

Create **one Sentry org** (or reuse existing) → two separate projects so errors are partitioned:

| Project slug   | Platform     | Used by       |
| -------------- | ------------ | ------------- |
| `ceolx-api`    | Node.js      | `apps/server` |
| `ceolx-native` | React Native | `apps/native` |

For each: Settings → Client Keys (DSN) → copy the DSN. You'll end up with 2 DSNs.

Sentry auto-creates a `staging` environment from the `environment` field in SDK init — nothing to configure on Sentry's side.

Source-map uploads: **only `apps/native` would want this today**, and the Metro plugin is currently disabled (see section 11.5), so you don't need a `SENTRY_AUTH_TOKEN` for this cycle. When you re-enable the Metro plugin or deploy the admin dashboard, create one at https://sentry.io/settings/account/api/auth-tokens/ with `project:releases` + `org:read` scopes.

Create `ceolx-admin` later, when `apps/admin` is being deployed.

---

## 6. Postmark + Google OAuth setup

### 6a. Postmark (email verification + password reset)

1. Sign up at https://postmarkapp.com (free sandbox is fine — 100 emails/month, no card needed).
2. Dashboard → Servers → your default server (or create one named `ceolx-staging`).
3. **API Tokens** tab → copy the **Server API Token** (not the account token). Save as `POSTMARK_API_TOKEN`.
4. **Sender Signatures** tab → add `noreply@ceolx.ie` → click the verification link Postmark emails you. Until this is verified, all sends fail. If you don't control `ceolx.ie` DNS yet, verify a sender address you do control (e.g. `priya+ceolx-staging@…`) and temporarily set `POSTMARK_FROM_ADDRESS` to that instead.

Env values:

```
POSTMARK_API_TOKEN=<server token>
POSTMARK_FROM_ADDRESS=noreply@ceolx.ie   # or your verified sender
```

### 6b. Google OAuth — Web client (for "Sign in with Google")

Only a **Web client** is needed for this cycle. Expo AuthSession on Android proxies through Expo's auth server, which uses the Web client ID. You don't need an Android OAuth client until you move to native Google Sign-In later.

1. https://console.cloud.google.com → create project `ceolx-staging` (or reuse existing). **Do not enable billing** for this cycle — Web OAuth doesn't require it.
2. **APIs & Services → OAuth consent screen** → set User Type = **External** → app name = `CeolX (Staging)`, support email = your email, developer contact = your email → save.
3. While still in "Testing" mode, add your QA team's email addresses under **Test users**. External apps in testing mode can only authorise listed test users.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID** → Application type = **Web application** → name = `CeolX Web (staging)`.
5. **Authorised redirect URIs** — add these three:
   - `https://api-staging.ceolx.ie/api/auth/callback/google` (BetterAuth callback)
   - `https://auth.expo.io/@ceolxprojects-organization/ceolx` (Expo AuthSession proxy, dev builds)
   - `ceolx-staging://` (deep link back into the APK after auth)
6. Save → copy **Client ID** and **Client secret**.

Env values:

```
GOOGLE_OAUTH_CLIENT_ID=<web client id>.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=<web client secret>
```

> **No billing, no Maps** — because this GCP project has billing disabled, Maps SDK calls from the APK would fail even with an API key. That's fine — Maps is intentionally deferred this cycle (see section 6c).

### 6c. Google Maps API key — deferred

**Not set up this cycle.** Blocked on the client enabling billing on the GCP project (Maps Platform requires an attached billing account, even for free-tier usage).

Consequence for QA: on Android the map renders a gray grid with pins floating on top. Interactions, camera fallback (GPS → IP → Ireland centre), and pin rendering all work — only the tile background is missing. The QA handover message (section 12) flags this explicitly so QA doesn't file it as a bug.

When billing is resolved, the full Maps setup takes ~10 min:

1. Same GCP project → APIs & Services → Library → enable **Maps SDK for Android** + **Geocoding API**.
2. Credentials → Create credentials → API key.
3. Restriction: Android apps → add package `com.raftlabs.ceolx` + the SHA-1 from `eas credentials` (step 10d).
4. Set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in `apps/native/eas.json` → rebuild the APK.

---

## 7. Refactor the server so Vercel can serve it

Right now `apps/server/src/index.ts` both defines the Hono app _and_ starts a long-running Node server via `serve()`. Vercel serverless functions want a handler, not a process. Small three-file split:

### 7a. Create `apps/server/src/app.ts` (extract the Hono app)

Move **everything except** `serve(...)` and the `PORT`/`import './instrumentation'` lines out of `src/index.ts` into a new file `apps/server/src/app.ts`. It should end with `export default app;`.

### 7b. Update `apps/server/src/index.ts` to only boot locally

```ts
import './instrumentation';
import { serve } from '@hono/node-server';
import app from './app';

const port = Number(process.env.PORT) || 3001;
serve({ fetch: app.fetch, port }, () => {
  console.log(`API running on http://localhost:${port}`);
});
```

### 7c. Create `apps/server/api/index.ts` — the Vercel entry

Vercel looks for an `api/` folder at the project root (or deployment root). Create this file:

```ts
// apps/server/api/index.ts
import '../src/instrumentation';
import { handle } from 'hono/vercel';
import app from '../src/app';

export const config = {
  runtime: 'nodejs',
};

export default handle(app);
```

`runtime: 'nodejs'` is required here — `@sentry/node`, `pg`, and parts of `@neondatabase/serverless` rely on Node-only APIs. The Edge runtime would fail to load them. If QA later hits timeouts on long-running endpoints (e.g. bulk Typesense sync), add `maxDuration: 60` to this config (requires Vercel Pro; Hobby caps at 10s).

### 7d. Create `apps/server/vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile",
  "buildCommand": "cd ../.. && pnpm turbo -F server check-types",
  "framework": null,
  "rewrites": [{ "source": "/(.*)", "destination": "/api" }]
}
```

Notes:

- **No `outputDirectory`**: this is a serverless-function-only project (no static assets). Vercel auto-detects `apps/server/api/*.ts` as functions.
- **`buildCommand` runs type-check only**: the actual bundling is done by Vercel's function builder (`ncc`), not by tsdown. We keep `turbo -F server check-types` so a type error fails the deploy instead of blowing up at runtime. If you'd rather skip the check for faster deploys, set it to `"echo skip"`.

The `rewrites` rule sends every incoming request (including `/trpc/*`, `/api/auth/*`, `/health`) to the single Vercel function at `api/index.ts`, which hands it to Hono's router. Without this, only URLs starting with `/api` would reach your code.

> **Why `cd ../..`?** Turborepo + pnpm workspaces need to install from the repo root, not from `apps/server`. Vercel's "Root Directory" setting will be `apps/server` (step 8a), so we step up two levels to find the workspace.

### 7e. What happens to `packages/` on Vercel

The server imports seven workspace packages (`@CeolX/api`, `@CeolX/auth`, `@CeolX/cache`, `@CeolX/db`, `@CeolX/email`, `@CeolX/env`, `@CeolX/shared`). You do **not** publish them, copy them, or do anything special. Here's the chain:

1. Vercel clones the entire git repo (even though Root Directory is `apps/server`).
2. `installCommand` runs `cd ../.. && pnpm install --frozen-lockfile` at the repo root. pnpm sees `pnpm-workspace.yaml`, reads every `"@CeolX/*": "workspace:*"` in `apps/server/package.json`, and symlinks `apps/server/node_modules/@CeolX/foo` → `packages/foo`.
3. When Vercel builds the function from `api/index.ts`, its bundler (`ncc`) traces imports and **bundles every reachable `packages/*/src/*.ts` file into the single Lambda output**. No runtime filesystem lookups into `packages/`.
4. Packages the server never imports (`packages/ui` is admin-only, for example) are excluded from the bundle automatically.

One gotcha: every `packages/*/package.json` must declare its own dependencies correctly. If `packages/api` uses `typesense` but doesn't list it in `dependencies`, `pnpm install --frozen-lockfile` on Vercel will succeed but the Lambda will crash at runtime with "Cannot find module 'typesense'". Safest check: from a clean clone, run `pnpm install --frozen-lockfile && pnpm -F server build` locally before deploying.

---

## 8. Deploy the API to Vercel

### 8a. First-time project setup

```bash
cd apps/server
vercel link
```

Pick:

- Scope: your Vercel team
- Link to existing? **N**
- Project name: `ceolx-api-staging`
- Root directory: `apps/server` ← important

This creates `.vercel/project.json` (gitignored).

### 8b. Set env vars in Vercel

Open https://vercel.com → `ceolx-api-staging` → **Settings → Environment Variables**. Add each variable, and for each one tick **Preview** + **Production** (or just **Preview** if you want `vercel --prod` to be reserved for real production later).

Paste the staging values you collected in steps 2–6:

```
NODE_ENV=production
PORT=3001                       # harmless on Vercel, validator wants it
DATABASE_URL=<neon staging pooled URL>

BETTER_AUTH_SECRET=<32+ random bytes, generate: openssl rand -base64 48>
BETTER_AUTH_URL=https://api-staging.ceolx.ie
# Admin not deployed yet — list only the API's own origin (mobile sends no Origin header so this is effectively unused, but the validator requires a non-empty string).
CORS_ALLOWED_ORIGINS=https://api-staging.ceolx.ie

# Postmark (from §6a)
POSTMARK_API_TOKEN=<server token>
POSTMARK_FROM_ADDRESS=noreply@ceolx.ie

# Google OAuth Web client (from §6b)
GOOGLE_OAUTH_CLIENT_ID=<web client id>.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=<web client secret>

# Sentry (server)
SENTRY_DSN_API=https://<key>@o<org>.ingest.sentry.io/<project>
SENTRY_ENVIRONMENT=staging

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://<id>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<token>
RATE_LIMIT_ENABLED=true

# Upstash QStash
QSTASH_TOKEN=<token>
QSTASH_CURRENT_SIGNING_KEY=<key>
QSTASH_NEXT_SIGNING_KEY=<key>
QSTASH_BASE_URL=https://api-staging.ceolx.ie/api/webhooks/qstash

# Typesense
TYPESENSE_HOST=abc123.a1.typesense.net
TYPESENSE_API_KEY=<admin key>
TYPESENSE_PORT=443
TYPESENSE_PROTOCOL=https

# Deferred this cycle (do NOT set):
#   APPLE_OAUTH_*, STRIPE_*, AWS_*, S3_*, MUX_*, FIREBASE_*
# These are all marked optional in packages/env/src/server.ts so omitting them
# won't fail the zod validator at boot.
```

### 8c. Deploy

```bash
cd apps/server
vercel --prod          # yes, use --prod even for staging — "prod" just means "not a preview"
```

First deploy takes ~3 min. When done Vercel prints a URL like `https://ceolx-api-staging-xxxx.vercel.app`.

### 8d. Attach the custom domain

In Vercel → `ceolx-api-staging` → **Settings → Domains** → add `api-staging.ceolx.ie`. Vercel shows the CNAME target (e.g. `cname.vercel-dns.com`). Add that CNAME record at your DNS provider. Wait ~5 min for DNS + Vercel's automatic Let's Encrypt cert.

Smoke test:

```bash
curl https://api-staging.ceolx.ie/health
# → {"status":"ok","timestamp":"...","version":"1.0.0"}
```

If this fails, check Vercel → Deployments → click latest → **Runtime Logs**. 99% of the time it's a missing env var (the `@t3-oss/env-core` validator throws on boot).

### 8e. Go back and fill `QSTASH_BASE_URL`

Edit the env var in Vercel (you set it to `https://api-staging.ceolx.ie/api/webhooks/qstash` above — confirm it's correct) and trigger a redeploy: `vercel --prod` again, or click **Redeploy** in the dashboard.

---

## 9. Admin dashboard — deferred

**Not deploying `apps/admin` in this staging cycle.** QA is testing the mobile app against the API only. When the admin dashboard is ready to deploy, follow the same pattern as the server:

- `vercel link` from `apps/admin`, root dir `apps/admin`
- Build: `cd ../.. && pnpm turbo -F @ceolx/admin build`, output dir `dist`
- Env: `VITE_SERVER_URL`, `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_SENTRY_DSN` + build-time Sentry token
- Attach `admin-staging.ceolx.ie`, add it to the server's `CORS_ALLOWED_ORIGINS`, redeploy the API

Until then, the Stripe subscription flow (which lives at `ceolx.ie/subscribe` inside the admin SPA) is not testable end-to-end. QA should skip those flows or test them against a locally-run admin.

---

## 10. Build the staging APK with EAS

The `staging` profile already exists in `apps/native/eas.json` and points to `https://api-staging.ceolx.ie`. Now finish the Expo side:

### 10a. Update `apps/native/eas.json` staging profile

Current state (lines 40–47):

```json
"staging": {
  "distribution": "store",
  "env": {
    "APP_VARIANT": "staging",
    "EXPO_PUBLIC_SERVER_URL": "https://api-staging.ceolx.ie",
    "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY": "TODO-ADD-KEY-HERE"
  }
}
```

End state:

```json
"staging": {
  "distribution": "internal",
  "channel": "staging",
  "android": { "buildType": "apk" },
  "env": {
    "APP_VARIANT": "staging",
    "EXPO_PUBLIC_SERVER_URL": "https://api-staging.ceolx.ie",
    "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY": "TODO-ADD-KEY-HERE",
    "EXPO_PUBLIC_SENTRY_DSN": "https://<key>@o<org>.ingest.sentry.io/<native project>"
  }
}
```

Three changes: `distribution` → `internal`, add `channel` + `android.buildType`, add `EXPO_PUBLIC_SENTRY_DSN`. Leave the Maps placeholder **as-is** — Maps is deferred (§6c). Commit. EAS reads env from `eas.json` at build time for public vars.

### 10b. Why `distribution: internal` + `buildType: apk`

The old value `"store"` uploads to Google Play's Internal Testing track (QA needs a Google account invited, and Play Store gives you an AAB, not a direct download).

`"internal"` + `"buildType": "apk"` gives you a direct `.apk` download URL hosted by EAS — QA clicks the link, allows "install from unknown sources" on their device, done. Switch back to `store` + AAB when QA stabilises and you want Play Store beta.

> **Note on `apps/native/eas.json` `submit.staging`:** the block with ASC + Play Store service account keys (lines 56–68) is for `eas submit` (store uploads). It's unused by `eas build` and harmless to leave in place.

### 10c. First build

```bash
cd apps/native
eas build --profile staging --platform android
```

- EAS will prompt to create a keystore — let it generate one. **Save it** (`eas credentials` → Android → download).
- Build runs on EAS cloud, takes ~15 min first time.
- When done EAS prints a URL like `https://expo.dev/artifacts/eas/xxxxx.apk`.

That URL is what you share with QA. It never expires (but EAS keeps artifacts only on paid plans — export and host yourself if you need > 30 days).

### 10d. Grab the SHA-1 and finalise Google OAuth

```bash
eas credentials
# → Android → staging profile → copy SHA-1 fingerprint
```

- GCP → APIs & Services → Credentials → open your **Web OAuth client** from §6b → the SHA-1 isn't needed for the Web client (it's URL-based). But keep the SHA-1 handy — you'll need it later when you add a dedicated Android OAuth client and when Maps is un-deferred.
- Maps API key restriction: skipped this cycle (no key exists yet).

> If Google Sign-In fails in the APK with "redirect_uri_mismatch", your authorised redirect URIs in the Web client (§6b step 5) don't match what the app is sending. Check Vercel logs for the `callback/google` request path; whatever comes through must exactly match one of the URIs you listed.

---

## 11. Smoke-test checklist before sending to QA

Run these in order. Stop at the first failure.

- [ ] `curl https://api-staging.ceolx.ie/health` → `{"status":"ok",…}`
- [ ] Install the APK on one Android device → sign up with email/password → **verification email arrives from Postmark** within ~30s → click link → logged in
- [ ] Sign out → sign in again via **"Continue with Google"** (use an email you added as a test user in §6b step 3) → returns to the app authenticated
- [ ] Map tab: **gray grid expected** (Maps deferred, §6c). Pins should still render on top (Typesense returns results)
- [ ] Create a dummy event as a Venue account → appears in the event list within ~3s (Typesense sync works)
- [ ] Vercel → Deployments → Runtime Logs → no red errors since last deploy
- [ ] Sentry → `ceolx-api` and `ceolx-native` → `staging` environment shows activity (at minimum session/breadcrumb events)

---

## 11.5. Known staging limits (things you should be aware of before shipping)

These are **not blockers** for QA — they're gaps you should know about so you don't waste time debugging them and can decide whether to close them before or after the first QA cycle.

### Sentry source maps are not uploaded for the native app

`apps/native/metro.config.cjs` currently has `withSentryConfig` **commented out** (lines 3–5 and 38–40):

```js
// TODO: re-enable once @sentry/react-native fixes eager bundling crash (8.7.0 bug)
// const { withSentryConfig } = require('@sentry/react-native/metro');
...
module.exports = uniwindConfig;   // not wrapped with Sentry
```

**Impact:** Runtime crashes still reach Sentry's `ceolx-native` project (the DSN works independently of the Metro plugin). But stack traces will be **minified** — you'll see `at a.b (index.bundle:1:48293)` instead of `at createEvent (app/(tabs)/create.tsx:42:12)`. Fine for "did it crash?" triage, painful for "why did it crash?".

Three choices, pick one before handing off to QA:

- **Accept it for this staging cycle** (recommended) — QA is checking flows, not stack traces. You'll revisit when the Sentry bug is fixed. No action needed.
- **Manual sourcemap upload after each build** — install `@sentry/cli`, grab the build artifact's sourcemap from EAS, run `sentry-cli sourcemaps upload --release <version> ...`. Works but is extra friction on every rebuild.
- **Pin Sentry to pre-8.7.0** — in `apps/native/package.json` change `@sentry/react-native` from `^8.6.0` to an exact older version, then re-enable `withSentryConfig` in `metro.config.cjs`. Clean but you're freezing a dependency indefinitely.

### Metro has a custom `.js` → `.ts` resolver

`metro.config.cjs:15-31` retries failing `.js` imports as `.ts`/`.tsx` — a workaround for `packages/shared` using TypeScript NodeNext-style paths. Not a staging issue, but if a cold EAS build ever fails with "Unable to resolve module ./foo.js", it's this resolver plus cache weirdness. Fix: `expo start --clear` locally, then rebuild on EAS.

### Apple Sign-In is off for the Android-only staging

`app.config.ts:42` has `usesAppleSignIn: true` but the staging Apple OAuth creds aren't wired. Irrelevant for Android QA. Complete in step 6 before shipping an iOS staging build.

---

## 12. Handing off to QA — the single message

Send this to QA in one message:

> **CeolX staging build is ready for testing.**
>
> - **Install:** <EAS APK URL from step 10c>
> - **Uninstall any previous CeolX build first.** The staging app is a separate app (bundle `com.raftlabs.ceolx`, name "CeolX (Staging)"), so it can coexist with a production install if one exists later.
> - **Backend:** `https://api-staging.ceolx.ie` (invisible to you — just works).
> - **Sign-up:** either **email + password** (verification link arrives via email within ~30s), or **Continue with Google** (only works for the email addresses I've whitelisted as test users — let me know the emails your team wants and I'll add them).
> - **Map:** Android staging renders a **gray grid** instead of real map tiles. This is intentional — Google Maps billing isn't set up yet. Pins, clustering, search, location fallback all still work. Don't file this as a bug.
> - **Report bugs with:** screenshot + steps + approx timestamp. For crashes, a **screen recording** helps more than a screenshot — staging stack traces are minified (see section 11.5), so reproduction steps matter.
> - **What's NOT in this build (don't test):** Apple Sign-In, Stripe subscriptions, image/video uploads, push notifications. These are stubs — they'll be wired in a later staging drop.

---

## 13. Ongoing — how to redeploy after a code change

```bash
# Backend — Vercel auto-deploys from git
git push origin staging            # → ceolx-api-staging rebuilds

# Or manually from a local branch
cd apps/server && vercel --prod

# Native — every JS-only change can ship as OTA, native changes need a new build
cd apps/native
eas update --branch staging        # JS-only, QA gets it on next app open
eas build --profile staging --platform android   # only when native deps change
```

Wire Vercel's git integration to auto-deploy on push to the `staging` git branch: Vercel → project → Settings → Git → Production Branch = `staging`.

---

## 14. Appendix — full env var reference

### `apps/server` (Vercel env vars on `ceolx-api-staging`)

See `apps/server/.env.example` — that file is the canonical list and the zod schema in `packages/env/src/server.ts` is enforced at startup. If a **required** one is missing, the Vercel function will fail to boot and `/health` will return 500.

Required (function won't start without these):
`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ALLOWED_ORIGINS`, `TYPESENSE_HOST`, `TYPESENSE_API_KEY`.

Optional but set this cycle (QA flows depend on them):
Upstash Redis, Upstash QStash, Sentry DSN, Postmark token, Google OAuth client ID + secret.

Deliberately skipped this cycle (leave unset — all `.optional()` in the zod schema, so the function boots fine without them):
Google Maps key (deferred, §6c), Apple OAuth, Stripe, AWS/S3, Mux, Firebase.

### `apps/admin` — not deployed this cycle

When you're ready: env vars needed are `VITE_SERVER_URL`, `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_SENTRY_DSN`, plus build-time `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`. See section 9.

### `apps/native` (in `eas.json` → `build.staging.env`)

```
APP_VARIANT=staging                     required
EXPO_PUBLIC_SERVER_URL                  required
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY         leave as placeholder — deferred (§6c)
EXPO_PUBLIC_SENTRY_DSN                  recommended
```

---

## 15. Troubleshooting one-liners

| Symptom                                                                                           | Where to look                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/health` returns 500                                                                             | Vercel → Runtime Logs. Usually a missing env var — the zod validator throws on import.                                                                             |
| CORS error from browser (admin not deployed yet, but you may hit this poking the API from a tool) | `CORS_ALLOWED_ORIGINS` pipe-separated exact-match, https, no trailing slash.                                                                                       |
| App map is gray grid                                                                              | **Expected this cycle** — Google Maps deferred (§6c).                                                                                                              |
| Verification email never arrives                                                                  | Postmark sender not verified (§6a step 4), or using a From address not in Postmark's verified signatures. Check Postmark → Activity → Outbound for rejected sends. |
| Google Sign-In fails with "redirect_uri_mismatch"                                                 | Your Web OAuth client (§6b step 5) is missing one of the three authorised redirect URIs. Compare the error URL with the three you registered.                      |
| Google Sign-In fails with "access_denied"                                                         | OAuth consent screen is in Testing mode and this email isn't in Test users (§6b step 3). Add it, retry.                                                            |
| Auth works but rate-limit 429 on first request                                                    | `RATE_LIMIT_ENABLED=true` with no Upstash URL — set the URL/token or flip to `false` for staging.                                                                  |
| Events created but don't appear on map                                                            | Typesense not seeded. Re-run `scripts/seed-typesense.ts` against staging.                                                                                          |
| `QStash signature invalid` in logs                                                                | `QSTASH_BASE_URL` doesn't match the URL QStash was called with — must be the exact public HTTPS endpoint.                                                          |
| APK installs but crashes instantly                                                                | Check Sentry `ceolx-native` → staging → look for a red error at app start. Usually a missing `EXPO_PUBLIC_*` var.                                                  |
| Sentry native errors show minified traces (`at a.b (index.bundle:1:...)`)                         | Expected — the Metro Sentry plugin is disabled (see section 11.5). Use the user's reproduction steps, not the stack trace.                                         |

---

**Last updated:** 2026-04-18 by Priya (solo dev, RaftLabs) — Postmark + Google OAuth in scope; Google Maps deferred pending GCP billing.
