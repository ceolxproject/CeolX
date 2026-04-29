# FCM Adoption Plan — Mentor Pattern Applied to CeolX

**Author:** Priya Yadav
**Date:** 2026-04-29
**Status:** Draft — captures decisions for resuming work later

---

## TL;DR — final recommendation

**Path forward: replay PR #51 with one build-fix line, layer mentor's small wins later.**

1. **Mobile FCM SDK:** keep `@react-native-firebase/messaging` (PR #51's approach). Switching to mentor's `expo-notifications + @react-native-firebase/app` is cosmetic only — both still require iOS static frameworks and hit the same RN 0.83 build issue.
2. **Server transport:** keep QStash (PR #51's approach). Already wired for emails; decouples API responses from FCM latency; free retries for transient failures.
3. **Audit table:** **don't add for V1.** CeolX has no marketing notifications, so frequency limits aren't needed. Add 2-3 nullable columns to `notification_users` later if push-delivery debugging becomes a real need.
4. **The build fix:** add `ios.buildReactNativeFromSource: true` to `expo-build-properties` in `apps/native/app.config.ts`. One line. Resolves the prebuilt-RNCore vs static-frameworks conflict on RN 0.83.

**Phase 1 = single PR** that replays PR #51 + this one build-fix line.
**Phase 2 = additive PR** layering mentor's `isFirebaseConfigured()` silent guard + `last_used_at` token column.

---

## How to resume this work

For future-me (or anyone picking this up after context loss):

1. **Read this doc top-to-bottom first.** It has the rationale; everything below the TL;DR explains why.
2. **Check current state:**
   - PR #55 status: `gh pr view 55` — needs to be merged before Phase 1.
   - PR #51 source branch: `git ls-remote origin feature/m7-t1-fcm-push-notifications` — should still exist on origin.
   - APNs Auth Key in Firebase Console — operator task, verify via Firebase Console UI.
3. **Relevant memory entries:**
   - `project_pr55_fcm_revert.md` — captures the root-cause analysis (prebuilt-RNCore vs static-frameworks)
   - `project_app_config_fcm_lines_commented.md` — note: this memory is now stale post-revert; remove on cleanup
4. **Reference docs:**
   - `docs/plans/FCM_mentor_summary` — the mentor monorepo's FCM architecture
   - `docs/plans/2026-04-27-m7-t1-fcm-push-notifications-plan.md` — original PR #51 plan
   - `docs/project-management/M7-Notifications-Emails/M7-Notification-Triggers.md` — trigger matrix

---

## Context

- PR #51 (M7-T1 FCM push notifications) was reverted via PR #55 because the iOS build failed on RN 0.83's prebuilt-RNCore xcframework conflicting with `@react-native-firebase`'s static-frameworks requirement.
- Source branch `feature/m7-t1-fcm-push-notifications` is preserved on origin with all of PR #51's code intact.
- Mentor monorepo has a working FCM stack documented at `docs/plans/FCM_mentor_summary`.
- Goal: get FCM working end-to-end on CeolX, ideally with a cleaner architecture than PR #51's first attempt.

---

## Three direct decisions (rationale)

### Decision 1: Mobile FCM SDK — `@react-native-firebase/messaging` vs `expo-notifications + @react-native-firebase/app`

**Decision: keep `@react-native-firebase/messaging` (PR #51's approach).**

|                               | Mentor's approach                                                                                     | PR #51's approach                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Native modules on iOS         | RNFB/app only (provides Firebase iOS SDK at native level)                                             | RNFB/app + RNFB/messaging (extra native module)                                                 |
| JS API                        | `expo-notifications.getDevicePushTokenAsync()`, `addNotificationReceivedListener` — platform-agnostic | `messaging().getToken()`, `messaging().onMessage()`, `getInitialNotification()` — RNFB-specific |
| Lock-in                       | Looser — could switch SDKs without major JS rewrite                                                   | Tighter — RNFB-specific patterns throughout                                                     |
| Bundle size                   | Slightly smaller (no `/messaging` JS module)                                                          | Slightly bigger                                                                                 |
| iOS static frameworks needed? | **YES**                                                                                               | **YES**                                                                                         |
| iOS build issue on RN 0.83?   | **YES** (same prebuilt-RNCore conflict)                                                               | **YES**                                                                                         |

Both work functionally identically. Mentor's pattern is _cosmetically_ cleaner on the JS side but **does not** dodge the iOS build issue — both require `buildReactNativeFromSource: true`.

PR #51's code is already written, tested (101 server + 199 api tests passing on the revert branch verification), and on `feature/m7-t1-fcm-push-notifications`. The cosmetic improvement isn't worth the rewrite cost.

**Why mentor's `getDevicePushTokenAsync()` returns an FCM token on iOS:** because `@react-native-firebase/app` loads the Firebase iOS native SDK. Without RNFB/app, the same call would return an APNs token instead. So you can't go "all expo-notifications, no RNFB" without changing the server's transport too.

### Decision 2: Server transport — direct FCM vs QStash queue

**Decision: keep QStash (PR #51's approach).**

| Reason                    | Why it matters for CeolX                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Already wired for emails  | Same pattern, zero new infrastructure                                                                      |
| Festival-spike traffic    | Booking-confirm endpoints shouldn't block on FCM latency. Async = instant API response                     |
| Free retries              | Transient FCM hiccup → QStash auto-retries with exponential backoff. Direct would need a custom retry loop |
| Free tier                 | 500 msg/day covers V1 scale (< 1000 users, transactional only) at $0                                       |
| Decouples deploy concerns | If FCM creds break, API endpoints stay up; only push delivery degrades                                     |

Mentor uses direct `sendEach()` because it batches multiple devices in one HTTP call (efficient for fan-out) and they presumably don't have spiky traffic. For CeolX at festival-launch with sub-1000 users, the latency you save with direct (~100-300 ms) is invisible to users; the resilience QStash gives you is real.

### Decision 3: Audit table — add for V1?

**Decision: don't add an audit table for V1.**

The mentor's audit table exists because they need it for **frequency limits** ("3 marketing/week, 10 transactional/day per user"). CeolX V1 has only transactional notifications (booking, moderation) — frequency limits don't apply. You can't tell a user "sorry, you've hit your booking-confirmation limit."

**Alternatives that solve the same needs without an audit table:**

| Need                                           | How CeolX solves it without an audit table                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------------- |
| "Did we send this user a push?" debugging      | QStash dashboard shows job history                                            |
| Dead-token detection                           | FCM error codes already trigger token cleanup in PR #51's handler             |
| "What % of users have push enabled?" analytics | `select count(*) from device_tokens where is_active = true` — no audit needed |
| Frequency limits                               | N/A in V1                                                                     |

**If push-delivery visibility becomes a real need later** (e.g. user complains "I never got the booking notification"), add 2-3 nullable columns to `notification_users` instead of a new table:

```ts
notificationUsers: {
  // ...existing columns...
  pushAttemptedAt: timestamp('push_attempted_at'),
  pushDeliveredAt: timestamp('push_delivered_at'),
  pushErrorCode: varchar('push_error_code', { length: 100 }),
}
```

The same per-user-delivery row that tracks "did the user read it?" also tracks "did we even deliver it?" — single source of truth, no joins.

**Add an audit table when (V2 signals):**

- Marketing/promotional notifications enter the matrix
- Push frequency caps become a product requirement
- Historical analytics across deleted users matter (audit survives `notification_users` cascades)

---

## Architecture comparison (full)

| Dimension                    | Mentor monorepo                                                                                                                                 | CeolX PR #51 (reverted)                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Mobile FCM SDK**           | `expo-notifications` + `@react-native-firebase/app` (analytics + remote-config, NOT messaging)                                                  | `@react-native-firebase/messaging` directly — `messaging().getToken()`                                     |
| **Mobile token API**         | `Notifications.getDevicePushTokenAsync()` returns FCM token (Firebase iOS SDK provides translation)                                             | `messaging().getToken()` — FCM token directly                                                              |
| **Server SDK**               | `firebase-admin`                                                                                                                                | `firebase-admin` (same)                                                                                    |
| **Server credential format** | 3 env vars: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (with `\\n`→`\n` unescape)                                   | 2 env vars: `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_KEY` (full JSON)                              |
| **Server boot guard**        | `isFirebaseConfigured()` — silent no-op when missing                                                                                            | Throws on first call to `getMessaging()` — QStash retries indefinitely                                     |
| **Send architecture**        | Direct `messaging.sendEach()` — synchronous fan-out, multi-platform shape on each message                                                       | QStash-queued: dispatcher → `notification.push` job → handler calls `messaging().send()` per token         |
| **Dead token cleanup**       | On send error code (`messaging/invalid-registration-token`, `messaging/registration-token-not-registered`) → soft-deactivate (`isActive=false`) | Same error codes → hard delete from `device_tokens` table                                                  |
| **Quiet hours**              | Per-user timezone, `isInQuietHours()` check, `bypassQuietHours: true` for security                                                              | Not implemented                                                                                            |
| **Frequency limits**         | 3 marketing/week + 10 transactional/day per user, counted from notification audit                                                               | Not implemented                                                                                            |
| **Localization**             | 10 types × 4 locales via `PUSH_TEMPLATES[type][locale]`                                                                                         | Single locale (English) — out of V1 scope per CLAUDE.md                                                    |
| **Web push**                 | Full flow: `firebase/messaging` + service worker + `firebase-messaging-sw.js` postMessage config dance                                          | Not in scope — admin web app doesn't need real-time push for V1                                            |
| **Inbox schema**             | Flat `notifications` table + `notification_audit` for rate-limit counters                                                                       | `notifications` + `notification_users` split (per-user delivery state) — better fan-out shape              |
| **Token table**              | `fcm_token` — `isActive`, `deviceType` (ios/android/web), `deviceName`, `lastUsedAt`                                                            | `device_tokens` — `fcm_token`, `user_id`, `device_type`, `device_name` (mostly aligned, no `last_used_at`) |
| **Trigger registry**         | Inline templates per type/locale                                                                                                                | `@CeolX/shared/notifications/triggers.ts` with `IN_APP` + `PUSH` variant per trigger (richer than mentor)  |

---

## The build issue is orthogonal to architecture choice

The iOS build failure (prebuilt-RNCore xcframework + static-frameworks) is triggered by **any** `@react-native-firebase/*` package on RN 0.83 — including `@react-native-firebase/app` alone. The mentor architecture installs `@react-native-firebase/app` for analytics + remote-config + the iOS Firebase SDK (which is what makes `getDevicePushTokenAsync()` return an FCM token on iOS). On RN 0.83 it would hit the same build error.

**Conclusion:** adopting the mentor architecture does not by itself fix the build problem. We need the build fix regardless of which architecture path we choose. The fix is one line in `expo-build-properties`:

```ts
[
  'expo-build-properties',
  {
    ios: {
      useFrameworks: 'static',
      buildReactNativeFromSource: true,  // ← unblocks RN 0.83 + RNFB
    },
  },
],
```

This forces React-Core to compile from source as a proper modular framework instead of using the prebuilt xcframework. Cost: +5-10 min on cold pod-install (first-time + CI). Subsequent incremental builds are unaffected.

---

## Three viable paths (full comparison)

### Option A — adopt mentor architecture wholesale

Replace PR #51's mobile code with `expo-notifications`-based registration; replace QStash with direct `sendEach`; layer in quiet hours / frequency limits.

**Pros:**

- Cleaner mobile code (no direct RNFB messaging import on the JS side)
- Matches a known-working reference pattern
- Adds production hardening (quiet hours, rate limits)

**Cons:**

- Largest delta from current code — full rewrite of mobile hook + server dispatcher + handler
- **Still needs `ios.buildReactNativeFromSource: true`** because `@react-native-firebase/app` is retained
- Drops QStash retry resilience for `sendEach`'s synchronous error handling
- Most of PR #51's existing code (already tested) is discarded

### Option B — pure `expo-notifications`, no `@react-native-firebase`

Remove all RNFB packages. Use `expo-notifications.getDevicePushTokenAsync()` only. iOS returns APNs token; Android returns FCM token. Server needs dual transport (firebase-admin for FCM tokens; an APNs library or Firebase APNs proxy for APNs tokens).

**Pros:**

- Cleanest mobile setup: no static-frameworks needed at all
- **Avoids the iOS build issue without `buildReactNativeFromSource`**
- Smallest mobile dependency footprint

**Cons:**

- Server gains complexity: needs to detect token type and route to correct transport
- iOS APNs path requires an APNs Auth Key (`.p8`) — different operator setup vs FCM service account
- No public reference implementation in the mentor doc — we'd be inventing the dual-transport server
- Incompatible with PR #51's existing code

### Option C — reinstate PR #51 with the build fix, layer mentor's hardening as additive (RECOMMENDED)

Apply `ios.buildReactNativeFromSource: true` to `expo-build-properties` in `app.config.ts`. Replay PR #51 (already on `feature/m7-t1-fcm-push-notifications`) plus that single line. Then in a follow-up PR, layer mentor's best ideas: `isFirebaseConfigured()` guard, `last_used_at` token column.

**Pros:**

- Smallest patch — most code already exists, tested, and reviewed
- Single fix line unblocks the build
- Can layer in mentor's quiet hours, frequency limits, isConfigured guard later
- QStash retry semantics retained — handles transient FCM failures gracefully without server-side complexity
- CeolX's `notifications` + `notification_users` split is preserved (architecturally cleaner than mentor's flat table for fan-out)

**Cons:**

- Cold builds (especially CI/EAS) get +5-10 min from `buildReactNativeFromSource: true`
- Direct `@react-native-firebase/messaging` import on JS side is slightly more coupled than mentor's `expo-notifications` wrapper

---

## Patterns worth absorbing from mentor (regardless of path)

| Mentor pattern                                 | Why adopt                                                      | Where to apply                                                                                |
| ---------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `isFirebaseConfigured()` silent no-op          | Server boots in dev/test/CI without FCM creds — no error spam  | `apps/server/src/lib/firebase-admin.ts` — replace the throw with a configured-check           |
| Dead-token error-code list                     | Authoritative list of "drop this token" FCM error codes        | `apps/server/src/jobs/handlers/notification.ts` — already implemented in PR #51, verify match |
| `firebase-admin` externalize in bundler config | Native deps in firebase-admin break bundlers that include them | `apps/server/tsdown.config.ts` — verify already externalized                                  |
| `lastUsedAt` on token table                    | Powers "prune devices that haven't checked in for X days"      | `packages/db/src/schema/notifications.ts` `device_tokens` — additive migration                |

---

## Patterns NOT worth absorbing (explicit out-of-scope)

| Pattern                                            | Why skip                                                                                                                                                   |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4-locale `PUSH_TEMPLATES` matrix                   | CeolX V1 is English-only (CLAUDE.md, business rule)                                                                                                        |
| Web push (firebase-messaging service worker dance) | Admin app doesn't need real-time push for V1 — admin moderation flow uses polling/inbox                                                                    |
| Frequency limits (3/wk, 10/d)                      | PR #51 has no marketing notifications. All current triggers are transactional (booking, moderation). Add only when marketing notifications land.           |
| Quiet hours                                        | V1 user base < 1000, festival-windowed launch. Defer to V1.5.                                                                                              |
| Flat notifications table                           | CeolX's split is better — keep it                                                                                                                          |
| Audit table for sent notifications                 | See Decision 3 — V1 doesn't need it.                                                                                                                       |
| Private-key `\\n` → `\n` unescape                  | Only relevant if we change credential format. PR #51 uses `FIREBASE_SERVICE_ACCOUNT_KEY` (full JSON parsed via `JSON.parse`) — escaping handled naturally. |

---

## Migration plan (Option C)

### Phase 0 — Pre-work (must complete first)

1. **Merge PR #55** — `development` becomes FCM-free
2. **Confirm Firebase Console operator setup** (operator task, not code):
   - Firebase project exists (`ie.ceolx.app`)
   - APNs Auth Key (`.p8`) uploaded to Firebase Console → Cloud Messaging tab → Apple app configuration
   - `GoogleService-Info.plist` and `google-services.json` regenerated and provided to dev/CI

### Phase 1 — Reinstate FCM with build fix (single PR, replaces PR #51)

Push to `feature/m7-t1-fcm-push-notifications`:

```ts
// apps/native/app.config.ts — expo-build-properties block
[
  'expo-build-properties',
  {
    ios: {
      useFrameworks: 'static',
      buildReactNativeFromSource: true,  // ← NEW LINE — unblocks RN 0.83 + RNFB
    },
  },
],
```

Then:

1. Locally regenerate iOS folder: `pnpm expo prebuild --clean -p ios`
2. Verify build: `pnpm -F native ios` — should compile cleanly (~5-10 min first time)
3. Open new PR (e.g. #56) with base `development`. Reference #51 in description.
4. Merge after review.

### Phase 2 — Mentor hardening (separate additive PR after Phase 1 merges)

Single PR, server-only changes:

1. **Convert `firebase-admin.ts` throw to silent no-op:**

   ```ts
   export function isFirebaseConfigured(): boolean {
     return Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
   }

   export function getMessaging(): Messaging | null {
     if (!isFirebaseConfigured()) return null;
     // ... existing init ...
   }
   ```

2. **Update `notification.push` handler** to no-op when `getMessaging()` returns null (dev/CI safety net).
3. **Add `last_used_at` column** to `device_tokens` — additive migration, update on every token register/refresh.

### Phase 3 — Optional / future (not blocking V1)

- **Push delivery visibility** — add `pushAttemptedAt` / `pushDeliveredAt` / `pushErrorCode` columns to `notification_users` if debugging push delivery becomes a real need (see Decision 3)
- **Frequency limits** — only when marketing notifications land
- **Quiet hours** — V1.5 candidate
- **Web push for admin** — only if real-time admin UX becomes a need
- **Audit table** — only when V2 signals appear (see Decision 3)

---

## Open questions

1. **Is `buildReactNativeFromSource: true` acceptable?** EAS Build cold-build time goes from ~8 min to ~13-15 min. Within free-tier budget? Worth checking.
2. **APNs Auth Key uploaded to Firebase Console?** Required for iOS push delivery. Operator task — verify before Phase 1.
3. **Token `last_used_at` — useful enough to add?** Or drop until inactive-device pruning is a real concern.
4. **Should we drop the legacy `payload` JSONB column from notifications schema?** Per CLAUDE.md memory, it's a legacy column — already cleaned up in PR #51's migration but worth verifying.

---

## Risks

| Risk                                                                                                           | Likelihood                                      | Mitigation                                                                                                        |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `buildReactNativeFromSource: true` doesn't fix the build (deeper RN 0.83 + RNFB incompatibility)               | Low — it's the documented Expo escape hatch     | Fallback to Option B (pure expo-notifications, dual server transport)                                             |
| APNs Auth Key not uploaded → iOS pushes silently fail                                                          | Medium — requires operator action               | Verify in Phase 0; add Firebase Console "Apple app configured" check to deployment runbook                        |
| EAS build time / cost increase blocks daily dev                                                                | Low                                             | Measure once after Phase 1 merge; if blocking, switch to source-built React Native locally + prebuilt for CI only |
| `notification_users` schema is incompatible with mentor's frequency-limit model when we want to layer it later | Low — we're not adopting frequency limits in V1 | Reassess at Phase 3                                                                                               |

---

## Files touched

### Phase 1

This is what the new PR replacing #51 would change vs the current `development`:

- All of PR #51's 41 files (already on `feature/m7-t1-fcm-push-notifications`)
- Plus a 1-line addition to `apps/native/app.config.ts` `expo-build-properties` block (`ios.buildReactNativeFromSource: true`)

### Phase 2

- `apps/server/src/lib/firebase-admin.ts` — add `isFirebaseConfigured()` guard
- `apps/server/src/jobs/handlers/notification.ts` — no-op when `getMessaging()` returns null
- `packages/db/src/schema/notifications.ts` — add `last_used_at` column
- New migration in `packages/db/src/migrations/`

---

**Decision needed before resuming:** confirm Phase 0 operator setup (APNs Auth Key in Firebase Console, GoogleService-Info.plist available).
