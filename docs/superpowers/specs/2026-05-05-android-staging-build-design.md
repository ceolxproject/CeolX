# Android Staging Build for QA — Design

- **Date**: 2026-05-05
- **Author**: Priya Yadav (with Butter)
- **Status**: Approved (pre-implementation)
- **Branch**: `feature/staging-android-build`

## Goal

Ship an installable, shareable Android **staging** build of the CeolX mobile app to the QA team via a single URL. The build must point at a live staging backend, coexist with the production app on the same device, and receive JS-only fixes via Over-The-Air (OTA) updates without reinstalling.

## Non-goals

- iOS staging build (the work sets up the parallel iOS bundle identifier so a future iOS staging is one EAS profile away, but this spec does not deliver a TestFlight build).
- Public beta distribution via Google Play Internal Testing (we use EAS Internal Distribution instead).
- Production deployment of `apps/server` to Vercel (only the staging environment is provisioned here).
- Multi-tester management features (groups, per-tester release notes, crash linkage). EAS Internal Distribution gives a single shared install URL — sufficient for the current QA team size.

## Prerequisites (manual setup before Phase 0)

These are dashboard / console actions that have to happen outside the codebase before any phase can run end-to-end. The implementation plan will include them as explicit pre-flight tasks; flagging them here so they're not invisible.

1. **Create Firebase project `ceolx-staging`** in the Firebase Console. Provision a Service Account → download the private key JSON → split into `FIREBASE_PRIVATE_KEY` and `FIREBASE_CLIENT_EMAIL` for the server `.env.staging`. (Without this, FCM registration on the server side fails and Phase 1 step 4 has no project to register the Android app inside.)
2. **Vercel account on Hobby tier** with permission to create a new project under the team (or personal) account that owns the deployment.
3. **DNS access to `ceolx.ie`** to add the `api-staging` CNAME pointing at Vercel.
4. **EAS organisation membership** — confirm the account running `eas build` is a member of `ceolxprojects-organization` with build permissions (project ID `91f9219e-c91c-47f2-b55a-5ee1db979b66`).
5. **Stripe test mode** enabled on the CeolX Stripe account, with a `price_test_…` price ID for the staging Venue subscription.
6. **Postmark sender domain `ceolx.ie` verified** for the staging stream (or share the prod stream if the domain check is already passing).

## Success criteria

1. A QA tester opens `https://expo.dev/install/<id>` on an Android device and the staging app installs in a single tap.
2. The staging app boots, signs in via email/password and Google OAuth, calls `https://api-staging.ceolx.ie`, and persists data to the Neon staging branch.
3. The staging app is installed under package `ie.ceolx.app.staging` and coexists with a production install (`ie.ceolx.app`) on the same device.
4. After Phase 4: pushing a JS-only commit to `development` automatically publishes an EAS Update to the `staging` channel within ~5 minutes; QA receives the fix on next app launch with no reinstall.
5. Stripe (test mode), Postmark, FCM, and Mux all function end-to-end in the staging environment.

## Decisions captured

| #   | Decision             | Choice                                                    | Rationale                                                                               |
| --- | -------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | Android package ID   | Separate (`ie.ceolx.app.staging`)                         | Side-by-side install with prod; clean isolation                                         |
| 2   | Distribution channel | EAS Internal Distribution                                 | Friction-free for sub-50-tester QA; one URL, no per-tester invites                      |
| 3   | Staging backend host | Vercel (`apps/server` deployed via `hono/vercel` adapter) | Hono ships first-class Vercel adapter; faster than configuring AWS Lambda + API Gateway |
| 4   | OTA updates          | Yes — EAS Update channel `staging`                        | JS-only fixes ship in seconds, QA productivity win                                      |
| 5   | Build trigger        | GitHub Actions / EAS Workflow on push to `development`    | Push-button deployments without manual `eas build`                                      |
| 6   | Build-time secrets   | `eas env:create --environment preview` per var            | First-class Expo solution; encrypted at rest in EAS                                     |

## Architecture — 6 phases (in order)

### Phase 0 — Staging backend on Vercel (BLOCKER; do first)

`api-staging.ceolx.ie` currently does not resolve (`curl` returns HTTP 000). Without a live backend, the QA app cannot authenticate or load data. This phase is a hard prerequisite for Phase 1.

Steps:

1. Add a Vercel adapter entrypoint at `apps/server/api/index.ts` that imports the existing Hono app and exports `handle(app)` from `hono/vercel`.
2. Create `apps/server/vercel.json` rewriting all paths to `/api`:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/api" }] }
   ```
3. `vercel link` the `apps/server` directory → new Vercel project `ceolx-api-staging` under the team account.
4. Mirror every variable in `apps/server/.env.staging` to Vercel via `vercel env add` for **both** Preview and Production environments on this Vercel project (the project itself represents staging; its "Production" deployment is what the staging app calls).
5. Configure custom domain `api-staging.ceolx.ie` → CNAME → Vercel. Wait for SSL certificate issuance (~minutes via Vercel managed certs).
6. Deploy: `vercel --prod`. Verify `GET /api/health` returns `200`.
7. Register Stripe test-mode webhook → `https://api-staging.ceolx.ie/webhooks/stripe`. Capture `whsec_…` and update `STRIPE_WEBHOOK_SECRET` on Vercel.

**Exit criteria**: `curl https://api-staging.ceolx.ie/health` returns the same JSON shape that `apps/server/src/index.ts` returns when run locally on port 3001; a smoke-test sign-up via tRPC client against the staging URL succeeds and the row appears in the Neon staging branch.

### Phase 1 — Native staging plumbing

Steps:

1. Convert `apps/native/app.config.ts` to **function form** that reads `process.env.APP_VARIANT` (`staging` | `production`, defaulting to `production`) and toggles:
   - `android.package`: `ie.ceolx.app.staging` vs `ie.ceolx.app`
   - `ios.bundleIdentifier`: `ie.ceolx.app.staging` vs `ie.ceolx.app` (parallel suffix sets up future iOS staging)
   - `name`: `CeolX (Staging)` vs `CeolX`
   - `icon`: a tinted staging icon vs prod icon (tint helps testers visually distinguish; optional polish)
2. Add `staging` profile to `apps/native/eas.json`:
   - `distribution: "internal"`
   - `channel: "staging"`
   - `env: { APP_VARIANT: "staging" }`
   - `android: { buildType: "apk" }` (APK, not AAB — internal distribution requires APK)
3. Add `cli.appVersionSource: "remote"` to `eas.json` so EAS owns version + build numbers across env profiles.
4. Create a new Firebase Android app for `ie.ceolx.app.staging` inside the existing `ceolx-staging` Firebase project (referenced in `apps/server/.env.staging`). Download the new `google-services.json`; save as `apps/native/google-services.staging.json`.
5. Add `google-services.staging.json` to `apps/native/.gitignore`.
6. Generate a separate Google Maps Android API key in the GCP project that backs `ceolx-staging`. Restrict to:
   - Application: Android apps
   - Package: `ie.ceolx.app.staging`
   - SHA-1: the Android signing certificate fingerprint EAS generates on the first build (we register this in Phase 3 after build succeeds, then redeploy if needed).

### Phase 2 — EAS Update wiring

Steps:

1. Run `eas update:configure` from `apps/native/`. This:
   - Adds `runtimeVersion: { policy: "appVersion" }` to `app.config.ts`
   - Adds `updates.url: "https://u.expo.dev/<project-id>"` to `app.config.ts`
2. Confirm the `staging` profile in `eas.json` has `channel: "staging"` (set in Phase 1). Channel-to-branch mapping: any update published with `--channel staging` is consumed by builds on this profile.
3. Verify update behaviour with `eas update --channel staging --message "init"` after the first APK is installed (smoke test in Phase 3).

**Caveat**: EAS Update only ships JS bundle changes. Any change to native plugins, dependencies with native code, or `app.config.ts` plugin list bumps `runtimeVersion` and silently fails to apply — those require a fresh APK build. Document this in the QA runbook (Phase 5).

### Phase 3 — Secrets + first build

Steps:

1. For each variable required at native build time, run:
   ```
   eas env:create --environment preview --name <NAME> --value <VALUE>
   ```
   Variables:
   - `EXPO_PUBLIC_API_BASE_URL=https://api-staging.ceolx.ie`
   - `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=<staging-android-maps-key>`
   - `EXPO_PUBLIC_SENTRY_DSN=<staging-sentry-dsn>`
   - `APP_VARIANT=staging`
2. Upload the staging `google-services.json` as an EAS file secret:
   ```
   eas env:create --environment preview --name GOOGLE_SERVICES_JSON \
     --type file --value ./google-services.staging.json
   ```
   The function-form `app.config.ts` reads `process.env.GOOGLE_SERVICES_JSON` at build time; EAS substitutes the file path.
3. Run the first build:
   ```
   eas build -p android --profile staging
   ```
4. While the build runs, capture the SHA-1 fingerprint EAS prints (or pull from `eas credentials`) and register it in:
   - Firebase staging Android app
   - Google Maps Android API key restrictions
   - Google Cloud OAuth Android client (if Google Sign-In on Android is in scope for the QA pass)
5. Open `expo.dev/install/<id>` on a real Android device. Smoke-test:
   - App installs and launches under "CeolX (Staging)" with staging icon
   - Email/password sign-up + verification email arrives via Postmark
   - Map renders with pins (Google Maps key working)
   - FCM device token registers successfully (check Firebase console → Cloud Messaging → recent registrations)
6. Share the install URL with QA.

### Phase 4 — CI automation

Add `.eas/workflows/staging-android.yml`:

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
  update:
    name: Publish OTA
    type: update
    needs: [build]
    params:
      branch: staging
      message: ${{ github.sha }}
```

Notes:

- The workflow runs **both** an APK build and an OTA publish on every `development` push. This is intentional: each tester's app at launch checks its installed `runtimeVersion` against the latest update on the `staging` channel. If they match, the OTA bundle applies (JS-only changes ship in seconds, no reinstall). If they don't (because the push touched native code, plugins, or dependencies — anything that bumps `runtimeVersion`), the OTA is silently ignored on that device and the tester needs to reinstall from the new APK URL. Running both jobs unconditionally means whichever channel a tester is on, they get the latest code with no manual coordination.
- Optional follow-up: post the build URL to Asana via a `custom` job step calling `mcp__claude_ai_Asana__add_comment` against an active QA tracking task.
- Validation: `node .claude/skills/expo-cicd-workflows/scripts/validate.js .eas/workflows/staging-android.yml` before committing.

### Phase 5 — QA handoff

Create `docs/qa-staging-install.md` covering:

1. Prerequisites: Android 8+ device.
2. Installing the APK from the Expo install link (the "Install from unknown sources" prompt and how to grant permission to Chrome / your browser).
3. How OTA updates appear (cold app start downloads update; second start applies it).
4. Distinguishing staging vs production (icon tint, app name suffix).
5. Bug reporting: where to log issues (Asana project ID `1210959953917909`), what to include (build ID, account email used, screenshot, device model).

## Key file changes

| Path                                                                | Action                                                                                           |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `apps/server/api/index.ts`                                          | NEW — `hono/vercel` adapter wrapping existing Hono app                                           |
| `apps/server/vercel.json`                                           | NEW — rewrite all paths to `/api`                                                                |
| `apps/server/package.json`                                          | No new deps (Hono already includes `hono/vercel` exports)                                        |
| `apps/native/app.config.ts`                                         | Refactor to function form; read `APP_VARIANT`; conditional `package`, `bundleIdentifier`, `name` |
| `apps/native/eas.json`                                              | Add `staging` profile; set `cli.appVersionSource: "remote"`                                      |
| `apps/native/google-services.staging.json`                          | NEW (gitignored)                                                                                 |
| `apps/native/.gitignore`                                            | Add `google-services.staging.json`                                                               |
| `.eas/workflows/staging-android.yml`                                | NEW                                                                                              |
| `docs/qa-staging-install.md`                                        | NEW                                                                                              |
| `docs/superpowers/specs/2026-05-05-android-staging-build-design.md` | NEW (this file)                                                                                  |

## Risks and open items

1. **Google OAuth client IDs are placeholders** — `GOOGLE_OAUTH_CLIENT_ID_IOS` and `GOOGLE_OAUTH_CLIENT_ID_ANDROID` in `.env.staging` are placeholder strings. Real OAuth clients must be created in GCP Console (Android client tied to package `ie.ceolx.app.staging` + the EAS-generated SHA-1). If Google Sign-In is out of scope for the first QA pass, this can be deferred — email/password still works.
2. **Vercel Hobby tier — 10-second function timeout (confirmed)**. This is the staging budget for every server invocation. Surface areas to watch:
   - **Cold-start latency** — first request after idle: Vercel Node cold start (~500 ms) + Neon serverless connection wake (~500 ms–1 s) + Hono/tRPC handler. Worst case ~2 s, well inside the budget.
   - **`firebase-admin` initialisation** — the Admin SDK reads the service-account credentials on cold start. If we recreate the app on every invocation it adds ~300 ms; ensure `getApps().length` is checked before `initializeApp()` in `apps/server/src/lib/firebase.ts` (or wherever the Admin SDK is initialised).
   - **Long-running tRPC procedures** — anything that loops over external API calls (e.g., a future bulk-import endpoint) will silently 504 at 10 s. None of the V1 procedures listed in the routers should fall into this bucket (S3 uploads use presigned URLs, Mux uses async webhooks, Postmark sends are single requests). If the smoke test in Phase 0 surfaces a slow procedure, the fix is either to refactor it into a QStash background job or upgrade Vercel to Pro.
3. **Postmark sender domain** — `noreply@ceolx.ie` requires DKIM/SPF on `ceolx.ie`. Likely already configured for prod; confirm staging emails aren't blocked by Postmark's signature verification gate.
4. **DNS propagation for `api-staging.ceolx.ie`** — Cloudflare-managed DNS propagates in ~minutes; legacy registrar DNS can take hours. Plan accordingly.

## Time estimate

- Phase 0 (Vercel backend): ~1.5 hours, gated on DNS propagation.
- Phase 1 (native plumbing): ~1 hour.
- Phase 2 (EAS Update wiring): ~15 minutes.
- Phase 3 (first build + smoke test): ~45 minutes including ~10-minute EAS build wait.
- Phase 4 (CI workflow): ~45 minutes.
- Phase 5 (QA docs): ~20 minutes.

**Total**: ~4–5 hours of focused work to hand QA a working install link with CI automation.
