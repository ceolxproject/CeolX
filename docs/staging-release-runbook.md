# CeolX — Staging Release Runbook

**What:** the repeatable end-to-end procedure for shipping a release to **staging** (backend + web + mobile), for QA.
**When:** every time `development` has work that needs to go to the QA/staging environment.
**Audience:** whoever is cutting the staging release (currently Priya, solo dev).
**Scope:** staging only. Production (the `ceol_x` Apple/EAS org) is a separate cut — see the notes at the end.

> This is the **sequence**. For per-topic depth (EAS traps, Neon, Vercel, envx), see
> [`docs/handoff/03-ops-runbooks.md`](./handoff/03-ops-runbooks.md) and the gotchas in
> [`docs/handoff/01-gotchas.md`](./handoff/01-gotchas.md). This runbook links to them rather than repeating.

---

## 0. Mental model — read once, saves hours

**Two git remotes:**
| Remote | Repo | Role |
| --- | --- | --- |
| `origin` | `github.com/Raft-Labs/CeolX` | Agency working copy — PRs + review. **No CI secrets.** |
| `client` | `github.com/ceolxproject/CeolX` | **CI + Vercel run here.** Holds `STAGING_DATABASE_URL`, `STAGING_EXPO_TOKEN`, etc. |

→ **Push `staging` to BOTH.** The real CI (migration, OTA, builds) + Vercel fire on **`client`**. Pushing `origin` too keeps the agency copy in sync and produces a **harmless red ✗ "Migrate Neon" run on origin** (no secret there) — expected, ignore it.

**Two EAS orgs (per `apps/native/app.config.js`):**
| Variant | EAS org | Project | Bundle |
| --- | --- | --- | --- |
| dev + **staging** | `raftlabs_expo` | `222e34aa-…` | `com.ceolx.app.staging` |
| production | `ceol_x` | `fba52ffe-…` | `com.ceolx.app` |

→ For any **local** `eas` command, set **`APP_VARIANT=staging`** or `app.config.js` resolves the wrong org/project.

**Branch flow:** `development → staging` by **fast-forward only** (`git merge --ff-only`). Linear history, no merge commits (repo rule).

**What auto-runs on push to `client/staging`:**

- `db-migrate-staging.yml` — applies committed Drizzle migrations to staging Neon (only if `packages/db/src/migrations/**` changed).
- **Vercel** — redeploys `apps/server` + `apps/admin`.
- `mobile-ota.yml` — publishes an OTA to the `staging` channel, behind a fingerprint gate. **⚠️ See the gate bug in §8.**

**What is manual:** the native binary build (`mobile-staging.yml`, `workflow_dispatch`) and the Play Console draft rollout.

---

## 1. Decide: OTA or new binary?

The single most important call. It's decided by the **fingerprint**:

- **JS/asset-only change** → fingerprint unchanged → ships **OTA** (`eas update`), reaches installed binaries on next app open.
- **Native / config-plugin / `app.config.js` change** (new dependency, permission, **intent filter / App Link path**, plugin) → fingerprint changes → needs a **new store build**. OTA cannot deliver it.

Check locally (needs `eas login` + clean worktree):

```bash
pnpm mobile:release-check          # per-env: "OTA-safe" vs "new binary required"
```

Rule of thumb: **if `apps/native/app.config.js` changed, assume a new binary.**

---

## 2. Pre-flight (local, on `development`)

```bash
git checkout development
git status                                   # must be clean
git rev-parse --short HEAD                   # note the release commit
pnpm exec turbo run build --filter=server    # the REAL release gate
```

- `turbo build --filter=server` is the gate. **Do NOT trust `server check-types`** — it's known-red on `development` (email `.tsx` `TS2875` noise), not CI-gated. See [gotchas → Build gate].

---

## 3. Promote `development → staging`

```bash
git checkout staging
git fetch origin && git fetch client
git merge --ff-only development              # linear; aborts if not a clean FF
```

**Then VERIFY the delta against the REMOTES, not the local branch** (local `staging` can be stale/behind — the FF still lands correctly, but confirm what will actually push):

```bash
git rev-list --left-right --count origin/staging...HEAD      # expect  0  <N>
git log --oneline origin/staging..HEAD                       # exactly the intended commits, no merges
git rev-list --left-right --count client/staging...HEAD      # expect  0  <N>
git merge-base --is-ancestor origin/staging HEAD && echo FF-clean
git merge-base --is-ancestor client/staging HEAD && echo FF-clean
```

---

## 4. Push to both remotes

```bash
git push client staging       # REAL CI + Vercel fire here
git push origin staging        # sync only; expect a harmless red ✗ "Migrate Neon" on origin
```

---

## 5. Verify the backend auto-deploy (client)

```bash
gh run list -R ceolxproject/CeolX --limit 6
```

- **"Migrate Neon (staging)"** → **✓** (only appears if a migration file was in the push).
- **"Mobile OTA Update"** → see §8 (for a native change it "succeeds" but the bundle is orphaned — expected).

Then confirm server + web + App Links are live:

```bash
curl -s https://api-staging.ceolx.com/.well-known/apple-app-site-association | jq '.applinks.details'
curl -s https://api-staging.ceolx.com/.well-known/assetlinks.json | jq '.[].target.package_name'
curl -s -o /dev/null -w "%{http_code}\n" https://api-staging.ceolx.com/health   # 200
```

**If the change was JS-only → you're basically done after the OTA publishes. Skip to §9.**
**If it needs a binary → continue to §6.**

---

## 6. Build the staging binary (native changes only)

Trigger on the **client** repo (has `STAGING_EXPO_TOKEN`, builds under `raftlabs_expo`):

```bash
gh workflow run mobile-staging.yml -R ceolxproject/CeolX --ref staging
gh run view <run-id> -R ceolxproject/CeolX          # both jobs ✓ in ~2 min (they only SUBMIT the build)
```

> Prefer this CI path over local `pnpm ship:staging` — CI does a clean `pnpm install --frozen-lockfile`, so the binary's fingerprint matches the OTA's. A local build off drifted `node_modules` can shift the fingerprint. If you must build locally: `pnpm install --frozen-lockfile` first, then `pnpm ship:staging`.

The GitHub run finishing ≠ the build finishing. The real builds run ~15–20 min on EAS:

```bash
cd apps/native && APP_VARIANT=staging eas build:list --build-profile staging --limit 4 --non-interactive
```

Verify: both **`finished`**, `Commit` = staging HEAD, and (sanity) the Android `Runtime Version` matches whatever the OTA published to. `autoIncrement` should bump versionCode / iOS build number.

---

## 7. Release to testers

### EAS submission

`--auto-submit` uploads to the stores after each build finishes. Confirm:

```
https://expo.dev/accounts/raftlabs_expo/projects/ceolx/submissions
```

Both **iOS App Store** and **Android Play Store** rows should be **✓** for the new version.

### Android — roll out the DRAFT (REQUIRED, manual)

`eas.json` submits with `releaseStatus: "draft"`, so it does **NOT** auto-release — the current build stays live until you roll out:

1. Play Console → **Test and release → Testing → Internal testing** → **"Edit release"** on the new draft.
2. Paste release notes (see §9) → **Next** → **Save** → **Review release** → **Start rollout to Internal testing**.
3. Warning "no deobfuscation file" → **non-blocking**, ignore (staging accepts obfuscated native traces).
4. Release flips to **"Available to internal testers"**.

- **Tester link** = **Testers** tab → "How testers join" → **Copy link** (`play.google.com/apps/internaltest/<id>`). It's **stable per track** — existing testers auto-update; no need to re-share.

### iOS — TestFlight (mostly automatic)

- `ITSAppUsesNonExemptEncryption: false` is set in `app.config.js` → **no export-compliance prompt**. Internal testers need no Beta App Review.
- So after Apple's Processing (~5–30 min) the build is **auto-available** to the internal group — **no App Store Connect action needed**.
- **Verify without ASC login:** have an internal iOS tester open the **TestFlight app** and confirm the new version appears. (Adding _new_ testers still needs ASC access — see §10.)

---

## 8. ⚠️ Known bug — the OTA fingerprint gate does NOT block

`mobile-ota.yml`'s "Verify fingerprint matches latest binary" step runs `eas fingerprint:compare`, which **prints** a mismatch but **exits 0**. So the workflow publishes the OTA **anyway**, even for a native change. Observed on this release: the diff clearly showed the new `/u` App Link, yet the run went ✓ and published to a new runtime **no installed binary has** (a harmless orphan — no device receives it, and the later store build matches it).

**Implications:**

- Do **not** treat a green "Mobile OTA Update" run as proof the change was OTA-safe.
- Use §1 (`pnpm mobile:release-check`) or the build's runtime vs the last binary's runtime as the real signal.
- **Fix owed:** make the gate parse the compare output (or check for the "differs" line) and fail on mismatch. Tracked separately.

---

## 9. Release notes + tracking

**There is no committed release-note doc.** Conventions:

- **`CHANGELOG.md`** — auto-generated by `gitmoji-changelog` on **`pnpm release`** (from conventional commits). Never hand-edit. A staging cut without a version bump won't add a changelog entry — that happens at the production `pnpm release`.
- **Store notes** (TestFlight "What to Test", Play internal notes) — entered in the consoles, not the repo.
- **Dated Asana staging-release task** — the team's release log. One per release, title = date. Include env, timestamp, changelog/feature-task link, and **the ACTUAL build numbers** (e.g. `1.0.12 (8)` Android / `1.0.12 (6)` iOS) — update these **after** the Android draft is rolled out and iOS shows in TestFlight, or the task points QA at the wrong build.

---

## 10. Known gaps / follow-ups

- **No staging Apple / App Store Connect login for the solo dev.** Internal TestFlight works without it (compliance pre-set), but **adding testers and the production "Submit for Review" require ASC access.** Escalate to the Apple-account owner before the production cut.
- **OTA gate bug** (§8) — track + fix.
- **R8 mapping file not uploaded** → obfuscated native crash traces on staging (accepted; Sentry source maps are also off on staging).
- **Version not bumped** — this staging build kept `1.0.12`. For the production cut, run `pnpm release` first to bump (→ `1.0.13`) and regenerate `CHANGELOG.md`.

---

## TL;DR — the happy path (native change)

```bash
# pre-flight
git checkout development && git status && pnpm exec turbo run build --filter=server

# promote
git checkout staging && git fetch origin && git fetch client && git merge --ff-only development
git rev-list --left-right --count origin/staging...HEAD          # sanity

# push (both remotes)
git push client staging && git push origin staging

# verify backend
gh run list -R ceolxproject/CeolX --limit 6                       # migrate ✓
curl -s -o /dev/null -w "%{http_code}\n" https://api-staging.ceolx.com/health

# build binary
gh workflow run mobile-staging.yml -R ceolxproject/CeolX --ref staging
cd apps/native && APP_VARIANT=staging eas build:list --build-profile staging --limit 2 --non-interactive

# release: EAS submissions ✓ → Play Console roll out draft → verify iOS in TestFlight
# then: update the dated Asana staging-release task with the real build numbers
```

_Last updated: 2026-07-21 — first documented run (username feature, v1.0.12 build 6 / code 8)._
