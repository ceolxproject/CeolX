# Ops Runbooks

Operational procedures for CeolX and the traps that have actually bitten in this repo. Audience: fluent in RN/Expo/Hono/Drizzle — this only covers what's CeolX-specific or non-obvious. Real on-disk app names are `apps/native`, `apps/server`, `apps/admin` (package names `native`, `server`, `admin`) — see [04-architecture.md](./04-architecture.md) for why this differs from `CLAUDE.md`'s `apps/mobile`/`apps/api`.

All commands below are verified against the repo as of 2026-07-14 (`apps/native/eas.json`, root `package.json`, `apps/server/package.json`, `.github/workflows/`, `docker-compose.yml`, `.envxrc`, `apps/admin/vercel.json`, `apps/server/vercel.json`) unless flagged `⚠️ unverified`.

---

## EAS build & submit

**When you do this:** cutting a new native binary (a store build, not a JS-only OTA) for iOS or Android — staging or production.

```bash
cd apps/native

# build only (per-platform or both)
pnpm build:staging:ios          # eas build --profile staging --platform ios
pnpm build:staging:android      # eas build --profile staging --platform android
pnpm build:staging              # eas build --profile staging --platform all

# submit an already-finished build
pnpm submit:staging:ios         # node scripts/submit-latest.mjs ios staging com.ceolx.app.staging
pnpm submit:staging:android     # node scripts/submit-latest.mjs android staging com.ceolx.app.staging

# build + auto-submit in one shot
pnpm ship:staging                # eas build --profile staging --platform all --auto-submit
```

Swap `staging` → `production` for the prod profile/bundle id (`com.ceolx.app`). CI equivalent: the "Mobile Staging Build" / "Mobile Production Build" GitHub Actions workflows (`.github/workflows/mobile-staging.yml`, `mobile-production.yml`) are `workflow_dispatch`-only (binary builds autoIncrement + submit to the stores, so they're never fired automatically on push) and run `eas build --platform <p> --profile <profile> --auto-submit --non-interactive --no-wait` from the `staging` git branch.

### Traps

- **Node floor per profile.** `apps/native/eas.json` pins `"node": "24.18.0"` on every build profile (development/staging/production), matching root `engines.node` and `.nvmrc`. This isn't cosmetic: a `packageManager` pnpm bump can silently require a higher Node floor than the EAS image ships by default (pnpm 11.8.0 needs Node ≥22.13). If a future pnpm bump isn't matched by the `node` field per profile, the build fails inside "Install dependencies" with `pnpm install --frozen-lockfile exited with non-zero code: 1` — reads like a lockfile problem, isn't. Get the real error via `eas build:view <id> --json` → `logFiles[0]` (signed URL, 15-min TTL, **brotli**-compressed — decode with `node -e "...zlib.brotliDecompressSync..."`).
- **Fingerprint mismatch with no `app.config.js` change → stale local install.** EAS always runs `pnpm install --frozen-lockfile` against the committed lockfile; if local `node_modules` was installed against an older lockfile, the `.pnpm/<hash>/` directory names diverge and the runtimeVersion fingerprint differs even though nothing meaningful changed. Fix: `pnpm install --frozen-lockfile` (the exact command EAS runs), then re-check with `pnpm mobile:release-check` or `npx expo fingerprint:generate` from `apps/native`. Recognize it by the diff being dominated by `.pnpm/<pkg>@<ver>_<hashA>/` vs `_<hashB>/` swaps rather than file-content changes.
- **Android must ship app-bundle, never apk.** `eas.json` already sets `android.buildType: "app-bundle"` on both `staging` and `production`. Google Play rejects APK uploads for new apps outright — don't "fix" a submit failure by switching to apk. `"Google Api Error: Version code N has already been used"` means `versionCode` didn't autoIncrement (both profiles have `"autoIncrement": true` — if that's ever missing, that's the bug), not a build-format problem. `versionCode` is baked in at **build** time, so the fix is a new build + submit, never a re-submit of the old artifact. Check the remote counter with `eas build:version:get --platform android --profile staging`.
- **EAS Cloud never sees local `.env.*` files.** `apps/native/.env.staging`/`.env.production` are gitignored (envx-encrypted as `.env.*.gpg` in git); EAS also sets `NODE_ENV=production` for every profile, so `.env.staging` wouldn't auto-load even if it were present. Every `EXPO_PUBLIC_*` var the app needs must live in `eas.json`'s per-profile `env` block (already how `EXPO_PUBLIC_SERVER_URL`, `EXPO_PUBLIC_SHARE_BASE_URL`, etc. are wired today) or an EAS dashboard named environment (`preview`/`production`). Adding or renaming an `EXPO_PUBLIC_*` var requires updating **both** the local `.env.*` file (for `pnpm dev`) and `eas.json`/dashboard — miss the second and the next build crashes at JS startup with `Invalid environment variables`.
- **`apps/native/fingerprint.config.cjs` must stay `.cjs`.** `apps/native/package.json` is `"type": "module"`, so a `.js` fingerprint config would be evaluated as ESM; `@expo/fingerprint`'s loader wraps `require()` in a try/catch that silently swallows `ERR_REQUIRE_ESM`, collapsing the config to `{}` — which drops the `sourceSkips` (`ExpoConfigVersions`, etc.) that keep `version`/`versionCode`/`buildNumber` out of the runtimeVersion hash, and every version bump then orphans OTAs. The file is currently `.cjs` on disk — keep it that way.
- **Local staging validation needs the scheme spelled out.** To pre-flight a staging build without Apple creds:
  ```bash
  cd apps/native
  export APP_VARIANT=staging
  export GOOGLE_IOS_URL_SCHEME="com.googleusercontent.apps.1057693721951-08nqa00s0ood9pimkpbb5p7njtmm4qal"

  npx expo prebuild --platform android --clean
  (cd android && ./gradlew :app:assembleDebug)   # debug = self-signed, no creds needed

  npx expo prebuild --platform ios --clean
  xcodebuild -workspace ios/CeolXStaging.xcworkspace -scheme CeolXStaging \
    -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
    build CODE_SIGNING_ALLOWED=NO
  ```
  `xcodebuild -list` returns schemes alphabetically, so `schemes[0]` is `AppAuth` (a transitive pod) — building that gives a false-positive `BUILD SUCCEEDED` without ever compiling the app. Always pass `-scheme CeolXStaging` explicitly. This validates config-plugin/native-module compile+link only — it does not exercise release signing or R8/minify.
- **Play App Signing re-signs the upload — auth against ITS SHA, not the EAS upload key's.** Because staging/production ship as an app-bundle via `eas submit`, Google Play re-signs the binary; the app users actually install presents the **Play App Signing cert**, not the EAS upload key. Every Google Android API (Maps, Sign-In, App Links) authorizes on `(package name, signing SHA of the installed app)`, so registering the upload key's SHA does nothing — a blank map or Sign-In `DEVELOPER_ERROR` (code 10) on a store-distributed build is the signature of this trap. The Play App Signing SHA is **only visible in Play Console → Test and release → Setup → App integrity → App signing key certificate** (never derivable from anything local). Register the per-variant SHA in three places:
  1. Google Cloud Console → Maps API key restriction (Android apps list) — SHA-1, correct package (`com.ceolx.app.staging`, watch for typos).
  2. Firebase Console → Android app → Add fingerprint — SHA-1 + SHA-256 (Google Sign-In).
  3. Server `ANDROID_SHA256_CERT_FINGERPRINT` env — SHA-256 (feeds `assetlinks.json` for App Links).

  No rebuild needed for the Maps/Firebase fixes — both are server-side Google config, live in ~5 min after a force-quit/reopen. `adb logcat | grep -iE "Google Maps|Authorization"` prints the exact package+SHA the SDK expected, useful for diagnosing a mismatch.

---

## OTA update to staging

**When you do this:** shipping a JS-only fix or content change to testers already on a staging binary, without cutting a new store build.

```bash
cd apps/native
pnpm update:staging   # eas update --branch staging --environment preview
```

This is also what CI does automatically: `.github/workflows/mobile-ota.yml` fires on every push to the git `staging` or `main` branch and publishes to the matching channel, but only after a hard gate — `eas fingerprint:compare --build-id <latest-finished-binary-for-that-tier> --environment <preview|production>` — that fails the workflow instead of publishing a bundle no installed binary can run.

Manual publish matching what CI does (useful for one-off/out-of-band testing), run from `apps/native`:

```bash
APP_VARIANT=staging \
EXPO_PUBLIC_SHARE_BASE_URL=https://api-staging.ceolx.com \
eas update --branch staging --platform all --environment preview --message "..."
```

### Traps

- **`APP_VARIANT=staging` and `EXPO_PUBLIC_SHARE_BASE_URL` are BOTH mandatory** when publishing outside `pnpm update:staging`/CI (which already set them). `app.config.js` derives the bundle id from `APP_VARIANT`; it isn't part of the EAS `preview` dashboard environment, so omitting it makes the bundle fingerprint as *production* and the staging binary silently ignores the update. `EXPO_PUBLIC_SHARE_BASE_URL` only lives in `eas.json`'s `staging` build-profile inline `env` block (currently `https://api-staging.ceolx.com`) — not the EAS dashboard `preview` environment — and drives `associatedDomains`/`intentFilters` in `app.config.js`. Omit it and the host falls back to the production default, diverging the fingerprint and orphaning the OTA with **no error at publish time**.
- **Verify before publishing:** `eas fingerprint:compare --build-id <id> --environment preview` (get build IDs via `eas build:list --channel staging --json`), or just run `pnpm mobile:release-check` from repo root. A mismatch means the OTA is a silent no-op — nothing crashes, the update just never gets picked up.
- **Native modules can't ship OTA.** Anything that adds or changes a native module or config plugin (`expo-calendar` for Add to Calendar, the Android "open email app" intent fix, a new Firebase pod, etc.) requires a fresh EAS build (see the section above / the "Mobile Staging Build" workflow) — `eas update` cannot deliver it, no matter how small the JS diff looks.

---

## Neon migrate

Two different procedures depending on whether the target Neon branch already has schema.

**Existing DB (staging/production, day-to-day change):**

```bash
pnpm db:generate                                        # writes SQL under packages/db/src/migrations
git add packages/db/src/migrations && git commit -m "..."
git push raftlabs staging && git push client staging    # or main, for production — see Vercel section below
```

CI applies it — never run this by hand against a shared DB:

- `.github/workflows/db-migrate-staging.yml` — triggers on push to `staging` touching `packages/db/src/migrations/**`, plus `workflow_dispatch`.
- `.github/workflows/db-migrate-production.yml` — triggers on push to `main` (same path filter), gated behind the `production` GitHub Environment (requires reviewer approval before it runs).

Both bypass turbo and call drizzle-kit directly:

```bash
pnpm --filter @CeolX/db exec drizzle-kit migrate
```

**Fresh/empty DB (bootstrapping a brand-new Neon branch):** do **not** use `migrate` — replaying the full migration history from empty is broken (`0002_tearful_sue_storm.sql` does `DROP TABLE users CASCADE`, which auto-drops FK constraints that a later statement in the same migration then explicitly tries to drop again → Postgres 42704). Use push + manual stamp on the **direct (non-pooler)** endpoint instead:

```bash
psql "$DIRECT_DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS cube; CREATE EXTENSION IF NOT EXISTS earthdistance;"
pnpm --filter @CeolX/db exec drizzle-kit push --force    # against the DIRECT endpoint, not the -pooler host
# then stamp drizzle.__drizzle_migrations with (hash, created_at) for every existing migration file
# so future `migrate` runs (staging/production CI) are a no-op against this branch
```

### Traps

- **Never run `db:migrate` through turbo in CI.** `turbo.json` marks `db:migrate` as `"persistent": true` (needed for `db:watch`/studio locally) — a turbo-wrapped call in CI hangs forever. Both workflows call `pnpm --filter @CeolX/db exec drizzle-kit migrate` directly, bypassing turbo on purpose.
- **CI uses `migrate`, not `push`, on purpose.** `drizzle-kit push` live-diffs schema and can drop data on a shared DB; `migrate` applies committed SQL deterministically and idempotently via `__drizzle_migrations`. Don't "fix" a CI failure by switching it to push.
- **A workflow only appears in the Actions tab — and only gets a run entry — once it exists on the default branch, `main`.** Even though feature PRs target `development` (see the repo's PR-base rule), a workflow file added only on `staging` won't show the manual "Run workflow" button and won't create a run listing on its first push (not on `main`, and the path filter skips a `.yml`-only change anyway). Land new/changed workflow files on `main` too.
- **Fresh-DB bootstrap:** `push --force` + manual `__drizzle_migrations` stamping, on the DIRECT endpoint — the pooler endpoint makes `migrate`/`push` hang on the spinner with no error.

---

## Vercel deploy

**When you do this:** shipping `apps/admin` or `apps/server`.

Both apps deploy automatically on push — each app's `vercel.json` has an `ignoreCommand` that only proceeds (exit 1 = don't skip) for `staging` and `main`; every other branch is skipped. There's normally no manual `vercel deploy` step.

### Traps

- **Push to BOTH remotes, or Vercel never sees it.** The repo has two GitHub remotes: `raftlabs` (agency working copy, github.com/Raft-Labs/CeolX, where PRs/review happen) and `client` (github.com/ceolxproject/CeolX). **Vercel's `ceolxproject-6613s-projects` team is connected only to `client`.**
  ```bash
  git push raftlabs staging && git push client staging   # (or main)
  ```
  Push to `raftlabs` alone and `vercel ls` shows no new deployment — no webhook fired. Feature branches don't need this (Vercel's `ignoreCommand` skips them regardless of remote).
- **Hono entry must `export default app`, never `handle()`.** `apps/server/src/vercel-entry.ts` must directly export the Hono app instance (a fetch-handler shape: an object with `.fetch(request)`). Wrapping it in `handle()` from `hono/vercel` forces Vercel's legacy Node-style (`req,res`) runtime, under which `Request.url` gets **replaced** with the rewrite destination on every request — `apps/server/vercel.json`'s rewrite is `"/(.*)" → "/api"`, so every route except that literal path 404s. Just re-export the app default; Vercel auto-detects the fetch-handler shape and preserves the caller-facing `Request.url`.
- **Shared-post deep links (`/post/:id`) depend on live infra, not just code.** `apps/admin/vercel.json` rewrites `/.well-known/*`, `/post/*`, `/event/*`, `/invite/*` to `https://api.ceolx.com` — the **current** production API domain (this has moved off `ceolx.ie`, which now only survives as a stale example string in a native `linkify` test, not a live domain). For AASA/App-Links verification to actually work: `api.ceolx.com` must be the live prod custom domain for `apps/server` (if it's ever back on a bare `*.vercel.app` URL, update the rewrite target); the per-env Android SHA-256 (`ANDROID_SHA256_CERT_FINGERPRINT`) must match that environment's actual signing cert (the **Play App Signing** SHA for store builds — see the EAS section above, not the EAS upload key); and **Vercel deployment protection must be OFF** on the target deployment, or Apple's AASA crawler and public `/post` hits get the Vercel SSO wall instead of real content.

---

## Typesense

CeolX's production search backend is **Typesense Cloud** (managed, historically <$20/mo) — not the `typesense` service in the root `docker-compose.yml` (`ceolx_typesense` container, port 8108, `dev-local-key`), which is **local-dev only**. Production is driven entirely by env vars on `apps/server`: `TYPESENSE_HOST` / `TYPESENSE_PORT` / `TYPESENSE_PROTOCOL` / `TYPESENSE_API_KEY`.

### Traps

- Don't assume "self-hosted" or "Postgres FTS" when discussing the search stack or infra cost — there's a real external managed dependency and bill here, separate from docker-compose.
- Migration cost to leave Typesense (schema rewrite + full re-index) is non-trivial — factor that in before proposing a search-backend swap.

---

## envx (`.env.*.gpg`)

**When you do this:** resolving a merge conflict that touches `apps/server/.env.*.gpg` or `apps/native/.env.*.gpg`, or rotating a secret.

`.env.*.gpg` files **always** conflict when two branches both touch env — GPG encryption is non-deterministic, so ciphertext diverges even for byte-identical plaintext. A textual/line merge of the ciphertext is meaningless — never attempt it.

Resolution — re-encrypt the correct local plaintext, don't merge ciphertext:

```bash
npx envx encrypt -e staging --overwrite     # -e scopes to ONE env
git add apps/server/.env.staging.gpg
```

(Root `pnpm env:encrypt` / `env:decrypt` run `envx encrypt/decrypt --all --overwrite` — fine for a full local resync of every env, but do **not** use `--all` mid-merge-resolution, or you overwrite envs you weren't trying to touch.)

### Traps

- **Mandatory pre-check before trusting "local plaintext is correct":** key-diff local vs **both** sides of the merge before resolving. Extract each conflicted side (`git show ":2:apps/server/.env.staging.gpg"` for ours, `:3:` for theirs — back up local plaintext first, since decrypting clobbers it), decrypt each, and diff the variable **names**. Encryption hides which keys a bad merge silently dropped — this has actually caught a missing `GOOGLE_OAUTH_IOS_CLIENT_ID` in a real merge.
- **JSON config that restructures keys can auto-merge with no conflict and still silently drop a value** — e.g. renaming `submit.staging-testflight` → `submit.staging` in `eas.json` merges cleanly but can drop a sibling key like `ascAppId`. Always value-check restructured config after a merge, not just `git status` showing no conflict markers.
- `.envxrc` (repo root) scopes envx to `["development", "staging", "production"]` and excludes the usual build/cache dirs.

---

## QStash long-delay jobs

**When you do this:** scheduling any job that needs to fire more than ~7 days out (e.g. a GDPR erasure sweep).

QStash's `delay` option is plan-capped: **7 days on the free plan**, 1 year on pay-as-you-go. `publishJob(..., { delay: '30d' })` is rejected outright on free — don't build a feature around a single long-delayed publish. Worse, a DB write followed by a fallible external publish call, with an idempotency guard in between, makes a partial failure look like success on retry (this shipped once: account deletion "succeeded" with no erasure job ever actually scheduled, because the DB row was already stamped before the doomed publish call).

**Pattern used in this codebase:** stamp a `*_scheduled_for` timestamp on the DB row at request time (no external call on the request path), then let a **daily QStash cron sweep** process every row whose timestamp has elapsed. `apps/server/src/jobs/setup-crons.ts` registers:

- `account.flag-inactive` — daily 02:00 UTC
- `account.anonymize-sweep` — daily 03:00 UTC (the GDPR erasure sweep)

To (re-)register crons after a deploy:

```bash
pnpm --filter server exec tsx src/jobs/setup-crons.ts
```

⚠️ unverified as of 2026-07-14 — the doc comment inside `setup-crons.ts` describes the intended wiring as a `pnpm --filter server jobs:setup-crons` script, but no `jobs:setup-crons` script currently exists in `apps/server/package.json`. Use the `tsx` invocation above until that script is added. Run this once per deploy — **never** on a Lambda/serverless cold start, or you register duplicate schedules.

---

## Build gate

The real merge/release gate is `turbo build` (tsdown/rolldown bundling for `server`), **not** `server#check-types`. `server`'s `tsc -b` check is a pre-existing false-negative on `development`: every `.tsx` email template under `packages/email` throws `TS2875` (wrong JSX runtime resolution when type-checked from the server project's tsconfig) — this is known noise, not a real regression signal. Don't block a PR on `pnpm --filter server check-types` being red; it already is, independent of your change.

```bash
pnpm exec turbo run build --filter=server        # the actual gate
```

### Traps

- **`tsc -b`'s incremental cache can mask a real error.** Local `pnpm --filter server check-types` can print PASS while a clean build FAILS. Force a true check by clearing the cache first:
  ```bash
  rm -f apps/server/*.tsbuildinfo
  pnpm exec turbo run check-types --filter=server --force
  ```
  To confirm one specific error code is actually gone (not just re-cached), grep for it and expect no output — the unrelated `TS2875` lines will still print:
  ```bash
  pnpm exec turbo run check-types --filter=server --force | grep TS2741
  ```
- **The package name is `server`, not `@CeolX/server`.** `turbo --filter=@CeolX/server` matches zero packages and exits non-zero — looks like a build failure, isn't. Always use `--filter=server` with turbo (`pnpm --filter` is more lenient about the unscoped name, but turbo is strict). Compare `packages/db`, whose real name **is** scoped: `@CeolX/db`.
