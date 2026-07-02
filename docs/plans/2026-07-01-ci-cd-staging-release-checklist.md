# CI/CD Staging Release — Work Checklist

**Asana task:** [1216149969140135](https://app.asana.com/1/1194107417268910/project/1210959953917909/task/1216149969140135)
**Branch:** `feature/ci-cd-mobile`
**Owner:** Priya · **Reviewer:** Aravind
**Created:** 2026-07-01

> Code side (bundle-id standardization + 3 workflows) is done. Remaining work is external
> registration (Firebase/Google/Apple), Vercel domains, and the config edits that follow.

## Audit snapshot (as of 2026-07-01)

- ✅ `app.config.js` defines `STAGING_BUNDLE_ID = com.ceolx.app.staging` and switches on `IS_STAGING`.
- ✅ Workflows present: `mobile-staging.yml`, `mobile-production.yml`, `mobile-ota.yml` (fingerprint-gated).
- ❌ `google-services.staging.json` + `GoogleService-Info.staging.plist` still `com.raftlabs.ceolx.staging` — **build blocker**.
- ❌ All committed staging URLs are Vercel git-branch previews (`ceol-x-server-git-staging-...vercel.app`).
- ❌ `apps/server/.env.staging` `APPLE_OAUTH_CLIENT_ID=ie.ceolx.signin.staging` — task text wrongly said this was already migrated.
- ❌ `EXPO_TOKEN` GitHub secret, `ascAppId`, and EAS named envs pending (external).
- ℹ️ `ios/` + `android/` legacy ids are untracked prebuild artifacts — ignore, they regenerate.

---

## Phase 0 — Unblock decisions (Aravind)

- [ ] Confirm staging domain names (`api-staging` / `admin-staging` / `staging`.ceolx.com)
- [ ] Confirm whether prod also moves to a custom domain (`api.ceolx.com`)
- [ ] Resolve CORS `.ie` vs `.com` inconsistency
- [ ] Confirm who owns DNS + console access (Priya vs Aravind)
- [ ] Confirm Apple OAuth migration to `com.ceolx.app.staging` (still legacy `ie.*`)

## Phase 1 — 🔴 Firebase re-registration (BUILD BLOCKER)

- [ ] Firebase `ceolx-staging`: add iOS app, bundle `com.ceolx.app.staging`
- [ ] Get EAS Android SHA-256 (`eas credentials -p android`)
- [ ] Firebase `ceolx-staging`: add Android app, package `com.ceolx.app.staging` + SHA-256
- [ ] Replace `apps/native/google-services.staging.json` with new download
- [ ] Replace `apps/native/GoogleService-Info.staging.plist` with new download
- [ ] Verify `grep com.raftlabs apps/native/*.staging.*` returns nothing

## Phase 2 — Google Cloud OAuth (new clients)

- [ ] Create iOS OAuth client
- [ ] Create Android OAuth client (needs SHA-256)
- [ ] Create Web OAuth client
- [ ] Update `eas.json` staging env: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_URL_SCHEME`
- [ ] Update `apps/native/.env.staging` (same two vars)
- [ ] Update `apps/server/.env.staging`: `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` / `_IOS_CLIENT_ID` / `_ANDROID_CLIENT_ID` / `GOOGLE_IOS_URL_SCHEME`

## Phase 3 — Apple Developer

- [ ] Enable Sign in with Apple on App ID `com.ceolx.app.staging` (native flow, no Service ID)
- [ ] Fix `apps/server/.env.staging:31` → `APPLE_OAUTH_CLIENT_ID=com.ceolx.app.staging`

## Phase 4 — Stable custom domains (after DNS live)

- [ ] Vercel: map staging custom domains (server + admin)
- [ ] Vercel: confirm prod custom domain
- [ ] `eas.json` staging env (27–28): `EXPO_PUBLIC_SERVER_URL` + `EXPO_PUBLIC_SHARE_BASE_URL`
- [ ] `apps/native/.env.staging:2` → `EXPO_PUBLIC_API_BASE_URL`
- [ ] `apps/native/.env.development:2` (confirm intended target)
- [ ] `apps/server/.env.staging`: `BETTER_AUTH_URL` (18), `CORS_ALLOWED_ORIGINS` (21), add `PUBLIC_WEB_ORIGIN`
- [ ] (If prod moving) `eas.json` prod env (59–60) + `apps/native/.env.production`
- [ ] Verify `SHARE_HOST` in app matches new staging share host (universal links resolve)

## Phase 5 — Re-encrypt secrets (CRITICAL)

- [ ] `pnpm exec envx encrypt -e staging --overwrite`
- [ ] Verify `.gpg` files changed in `git status`, plaintext not committed
- [ ] Commit config changes to `feature/ci-cd-mobile`

## Phase 6 — Secrets & EAS environments

- [ ] Add `EXPO_TOKEN` GitHub Actions secret (Expo org `raftlabs_expo`)
- [ ] Set `submit.staging-testflight.ios.ascAppId` in `eas.json` (needs ASC record, Phase 7)
- [ ] Populate EAS named envs `preview` + `production` to mirror `eas.json`

## Phase 7 — Store records (only if a build was ever submitted under old id)

- [ ] Confirm with Aravind whether old-id builds exist
- [ ] If needed: create App Store Connect record under `com.ceolx.app.staging` → set `ascAppId`
- [ ] If needed: create Play Console record under `com.ceolx.app.staging`

## Phase 8 — Build (build first, then OTA)

- [ ] Actions → Mobile Staging Build → Run workflow
- [ ] Wait for EAS finish (iOS → TestFlight, Android → Play internal)
- [ ] Verify on device: launches as CeolX (Staging) / `com.ceolx.app.staging`
- [ ] Verify Google sign-in works
- [ ] Verify Apple sign-in works
- [ ] Verify app points at staging custom domain (not Vercel URL)

## Phase 9 — OTA on top

- [ ] Push to `staging` (or run Mobile OTA Update) → `eas fingerprint:compare` gate green
- [ ] Confirm OTA JS update applies on installed binary

## Phase 10 — Close out

- [ ] `grep -rn "git-staging" apps/` returns nothing in committed config
- [ ] Open PR → base `development`, reviewer Aravind (rebase-and-merge)
- [ ] Update Asana task with outcome

---

### Key reminders

- 🔴 **Phase 1 gates everything** — no binary builds until the Firebase staging files are regenerated.
- 🔗 **Phase 5 easy to forget** — edits to plaintext `.env.*` are invisible to CI until re-encrypted to `.gpg`.
