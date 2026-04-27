# M7-T1 — Push Notifications via Firebase Cloud Messaging

## Context

CeolX needs production push notifications for booking, event-moderation, and subscription events. Aravind has explicitly redirected from Expo Push Notifications to **Firebase Cloud Messaging directly** — `@react-native-firebase/messaging` on the device, `firebase-admin` on the server. Reasons cited: future web push reuse, native topics/conditions, no Expo proxy hop, Firebase Analytics tie-in.

The good news: most plumbing already exists.

| Layer                                                                    | Status                                                                                                                                                   |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `device_tokens` table                                                    | ✅ exists (`packages/db/src/schema/notifications.ts:65`) — uses `(user_id, fcm_token)` unique key                                                        |
| `notifications` table + inbox tRPC router                                | ✅ M7-T2 merged in PR #49                                                                                                                                |
| Booking notification triggers                                            | ✅ exist as direct `db.insert(notifications)` calls (`packages/api/src/routers/bookings.ts:126,269,406`) — must be refactored through the new dispatcher |
| QStash job queue + `notification.push` schema                            | ✅ schema declared at `apps/server/src/jobs/types.ts:42-49` (per-token payload)                                                                          |
| `notification.push` job handler                                          | ❌ stub — throws "Not implemented" (`apps/server/src/jobs/handlers/notification.ts:4`)                                                                   |
| Firebase Admin SDK                                                       | ❌ no `firebase-admin` dep on server                                                                                                                     |
| `@react-native-firebase/*` packages                                      | ❌ not installed; mobile has unused `expo-notifications` instead                                                                                         |
| Device-token register/unregister tRPC router                             | ❌ missing                                                                                                                                               |
| Mobile FCM hook (permission, token, listeners, deep-link)                | ❌ missing                                                                                                                                               |
| Native config files (`google-services.json`, `GoogleService-Info.plist`) | ❌ human handoff                                                                                                                                         |

## Scope alignment with M7-T0 Notifications Matrix

The M7-T0 matrix (`docs/project-management/M7-Notifications-Emails/M7-T0-Notifications-Matrix.md`, rev 2 — pending Pratiksha audit) is the **canonical inventory**. M7-T1's spec lists only 8 triggers; the matrix lists 22 V1 push rows. This PR delivers the **infrastructure + the matrix rows whose source-code triggers are already merged**. The remaining rows are owned by their originating milestones, which will call the same `ctx.dispatchNotification(...)` helper this PR introduces.

### Cross-reference: matrix rows ↔ this PR

| Matrix row                | Trigger                                                  | Source code                                                     | This PR?    | Owner if deferred                                                                           |
| ------------------------- | -------------------------------------------------------- | --------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| **A-09**                  | Booking invitation received (Venue invites Artist)       | `bookings.ts:126` `create`                                      | ✅ wired    | —                                                                                           |
| **V-09**                  | Booking request received (Artist applies to Venue event) | `bookings.ts:265` `requestToPerform`                            | ✅ wired    | —                                                                                           |
| **A-10 / V-10**           | Booking accepted                                         | `bookings.ts:406` `update` (PENDING → ACCEPTED)                 | ✅ wired    | —                                                                                           |
| **A-11 / V-11**           | Booking rejected                                         | `bookings.ts:406` `update` (PENDING → REJECTED)                 | ✅ wired    | —                                                                                           |
| **A-12 / V-12**           | Booking cancelled (post-acceptance)                      | `bookings.ts:406` `update` (ACCEPTED → CANCELLED)               | ✅ wired    | —                                                                                           |
| **V-13**                  | Pending Artist withdrew application                      | `bookings.ts:406` `update` (PENDING → CANCELLED, sender=artist) | ✅ wired    | —                                                                                           |
| A-05 / A-06 / V-05 / V-06 | Subscription activated / renewed                         | Stripe webhook handler                                          | ❌ deferred | **M8-T2** (webhook stub at `apps/server/src/routes/webhooks.ts:10`)                         |
| A-13                      | Added as confirmed Collaborator                          | event create / update collaborator add                          | ❌ deferred | **M4-T1 follow-up** (no existing trigger code)                                              |
| A-15 / V-14               | Event removed by admin (with reason)                     | admin `removeEvent`                                             | ❌ deferred | **M4-T3** (now scoped under M9 — task file updated by this PR with dispatcher-call example) |
| A-16 / V-15               | Event resubmitted successfully                           | `events/crud.ts:498` (REMOVED → ACTIVE transition)              | ❌ deferred | **M4-T3** (same — transition exists, dispatcher call to be added there)                     |
| U-01 / U-02               | Saved event reminder 2d / 1d                             | scheduled QStash job                                            | ❌ deferred | **M4-T5** (new task — saved-events feature not yet scoped)                                  |
| U-03                      | Saved event removed (cascade)                            | admin removeEvent + cascade                                     | ❌ deferred | **M4-T3 + M9-T2 cascade**                                                                   |
| U-04                      | Saved event details changed (cascade)                    | `events/crud.ts` update + cascade                               | ❌ deferred | **M4-T5 follow-up**                                                                         |

**Counts**: this PR wires **8 of 22** V1 push matrix rows (covering 3 source-code call sites in `bookings.ts`). The other 14 rows are deferred to milestones whose source-code triggers don't exist yet.

### Spec deviations driven by CLAUDE.md / matrix

1. **No persona switching on tap.** `CLAUDE.md` (MoM 03/04/2026 §2.1) prohibits Artist↔Venue switching. The inbox screen already follows this (`apps/native/app/(app)/notifications.tsx:21-32` — tap = mark-read + navigate). FCM tap handlers (foreground, background, cold-start) match. Spec **R4.1** and **R5.1** persona-switch-and-toast steps are **dropped**; **R3.2** (`persona` field stays in payload) is kept.

   > Side note: matrix Section 9 still references "M7-T1 R4.1 auto-switch" — that line is stale and should be flagged for Pratiksha's audit. Not blocking this PR.

2. **Rate limiting (R7.2) deferred.** No rate-limit library in the codebase; matrix doesn't mandate it. QStash handles per-job retry (R7.3). A TODO will mark the spot in the dispatcher; revisit when notification volume warrants.

3. **Drop `device_identifier`.** Spec (lines 32-47) called for `(user_id, device_identifier)` unique. The actual schema uses `(user_id, fcm_token)` which is simpler and equivalent — Firebase rotates the token per device install, so the token itself is the device identity. Keep current schema.

## Architecture

### Server side (apps/server + packages/api)

```
[booking router mutation]
   ↓
ctx.dispatchNotification({ userId, type, title, body, route, persona })
   ├── INSERT into notifications  (in-app inbox row)
   └── SELECT device_tokens WHERE user_id = ?
        └── for each token → publishJob('notification.push', { deviceToken, title, body, persona, route })
                                   ↓
                          QStash → POST /api/webhooks/qstash
                                   ↓
                          routeJob → handleNotificationPush
                                   ├── firebaseAdmin.messaging().send({ token, notification, data })
                                   └── if errorCode === 'messaging/registration-token-not-registered'
                                       → DELETE FROM device_tokens WHERE fcm_token = ?
                                       → swallow (don't retry)
```

The `dispatchNotification` function lives in `apps/server/src/services/notifications-dispatcher.ts` (server-side because it needs `publishJob`). It is **injected into the tRPC context** so routers in `packages/api` can call it without importing from `apps/server`. The Context type gains a new typed function field. This keeps package boundaries clean and makes the dispatcher trivially mockable in router tests.

### Mobile side (apps/native)

```
post-login (apps/native/app/(app)/_layout.tsx)
   ↓
useFcmRegistration() hook  ← new
   ├── requestPermission()                 (iOS APNs + Android 13+ POST_NOTIFICATIONS)
   ├── messaging().getToken()
   ├── trpc.deviceTokens.register.mutate({ token, platform })
   ├── messaging().onTokenRefresh(re-register)
   ├── messaging().onMessage(foreground → toast + invalidate inbox query)
   ├── messaging().onNotificationOpenedApp(background tap → router.push(route))
   └── messaging().getInitialNotification(cold-start tap → router.push after auth resolves)
```

### Library decisions (both verified before implementation in Phase 4)

| Concern                         | Library                                                                                                                           | Why                                                                                                                                                   |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile FCM SDK                  | `@react-native-firebase/messaging` + `@react-native-firebase/app`                                                                 | Aravind's directive; native FCM APIs; works with Expo via config plugin. Requires custom dev client (no Expo Go).                                     |
| Mobile permission (Android 13+) | `react-native`'s built-in `PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS`                                                     | No new dep; `messaging()` doesn't handle Android 13+ runtime permission.                                                                              |
| Mobile foreground display       | `appToast.info(title, body)` (existing — `apps/native/components/AppToast.tsx`) + `useNotifications().refresh()` to refetch inbox | FCM does NOT auto-display when app foregrounded. Use existing toast system.                                                                           |
| Server FCM SDK                  | `firebase-admin` (modular v13+)                                                                                                   | Standard. Service-account JSON via env var, lazy-initialised singleton.                                                                               |
| Foreground/background routing   | `expo-router` `router.push()` (existing)                                                                                          | Already used in the inbox screen tap handler.                                                                                                         |
| `expo-notifications` package    | **REMOVE**                                                                                                                        | Aravind asked for one stack. With FCM directly handling permission + delivery and AppToast handling foreground UI, `expo-notifications` adds nothing. |

## Files

### NEW

| Path                                                         | Purpose                                                                                                                |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/validators/device-tokens.ts`            | `registerDeviceTokenSchema`, `unregisterDeviceTokenSchema`, `RegisterDeviceTokenInput` type                            |
| `packages/api/src/routers/device-tokens.ts`                  | `register` mutation (upsert) + `unregister` mutation (delete) — both `protectedProcedure`                              |
| `packages/api/src/__tests__/device-tokens.test.ts`           | TDD coverage for register/unregister                                                                                   |
| `apps/server/src/lib/firebase-admin.ts`                      | Lazy singleton: parses `FIREBASE_SERVICE_ACCOUNT_KEY`, calls `initializeApp({ credential })`, exports `getMessaging()` |
| `apps/server/src/services/notifications-dispatcher.ts`       | `makeDispatchNotification(db, publishJob)` factory returning the `DispatchNotificationFn` injected into tRPC context   |
| `apps/server/src/__tests__/notifications-dispatcher.test.ts` | Tests dispatcher inserts row + fans out one job per token + handles zero-token case                                    |
| `apps/server/src/__tests__/notification-handler.test.ts`     | Tests `handleNotificationPush` calls `messaging().send` with correct payload + cleans up unregistered tokens           |
| `apps/native/hooks/use-fcm-registration.ts`                  | Permission request + token register + listeners + cold-start handler                                                   |
| `apps/native/lib/fcm-permission.ts`                          | Cross-platform permission helper (iOS via `messaging().requestPermission`, Android 13+ via `PermissionsAndroid`)       |

### MODIFY

| Path                                                                     | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/validators/index.ts`                                | Re-export device-token validators                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `packages/api/src/context.ts`                                            | Add `dispatchNotification: DispatchNotificationFn` to `Context` and `CreateContextOptions`. Export `DispatchNotificationFn` type.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `packages/api/src/routers/index.ts`                                      | Register `deviceTokensRouter` on `appRouter`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `packages/api/src/routers/bookings.ts`                                   | Replace 3 direct `db.insert(notifications).values({ … })` calls (lines 126, 265, 406) with `await ctx.dispatchNotification({ … })`. Same payload fields, same call sites. Covers matrix rows A-09, V-09, A-10/11/12, V-10/11/12/13.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `apps/server/src/index.ts`                                               | Build `dispatchNotification` once at startup and pass into `createContext({ context, dispatchNotification })`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `apps/server/src/jobs/handlers/notification.ts`                          | Implement `handleNotificationPush` against `getMessaging().send(...)` with UNREGISTERED-token cleanup. Leave `handleNotificationBatch` stub with TODO (out of scope).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `apps/server/package.json`                                               | Add `firebase-admin`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `apps/native/package.json`                                               | Add `@react-native-firebase/app`, `@react-native-firebase/messaging`. Remove `expo-notifications`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `apps/native/app.config.ts`                                              | Remove `'expo-notifications'` from plugins. Add `'@react-native-firebase/app'` plugin. Add `googleServicesFile` paths under `ios` and `android`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `apps/native/app/(app)/_layout.tsx`                                      | Call `useFcmRegistration()` once user is authenticated and onboarding-complete (after the existing `meData` guard)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `packages/db/src/schema/enums.ts`                                        | Add new notification types to `NOTIFICATION_TYPES` enum if missing (verify which of the 4 booking types are already enumerated; the table column is `varchar` so this is type-only safety)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `apps/native/.env.example` (or equivalent)                               | Document `FIREBASE_*` mobile env vars if any                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `apps/server/.env.example` (or equivalent)                               | Document `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_KEY`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `docs/project-management/M4-Event-System/M4-T3-Event-Moderation-Flow.md` | Add a "Notification dispatch (deferred from M7-T1)" subsection under Requirements documenting that: (a) the FCM dispatcher already exists as `ctx.dispatchNotification` from M7-T1, (b) M4-T3 owns wiring the following M7-T0 matrix rows: **A-15 / V-14** (admin removes event — fires from `removeEvent` mutation, with `removal_reason` in body), **A-16 / V-15** (creator resubmits removed event — fires from `events/crud.ts:498` REMOVED→ACTIVE transition), **U-03** (cascade — every user who saved this event gets a `saved_event_removed` push, depends on M4-T5 saved_events table). Includes one code example showing the `ctx.dispatchNotification({ userId, type, title, body, route, persona })` call pattern so the implementer doesn't have to dig through M7-T1 PR. Update the existing "Notify creator via FCM" code block (lines 280-292) which still shows the legacy direct-FCM pattern — replace with the dispatcher call. |

### Existing utilities to reuse

- `publishJob` — `apps/server/src/jobs/publish.ts:32` (typed QStash publisher)
- `routeJob` / `verifyQStashSignature` — `apps/server/src/jobs/handlers/index.ts`, `apps/server/src/jobs/verify.ts` (already wired to `/api/webhooks/qstash`)
- `notificationPushSchema` — `apps/server/src/jobs/types.ts:42` (already accepts the exact payload we need)
- `appToast.info/success/error` — `apps/native/components/AppToast.tsx:99`
- `useNotifications().refresh()` — `apps/native/hooks/use-notifications.ts:59` (call from foreground listener)
- `authClient.useSession()` via `useAuth()` — `apps/native/contexts/auth-context.tsx:99` (gate FCM init on `isAuthenticated`)
- tRPC mutation pattern — `apps/native/hooks/use-mark-notifications.ts:12` (mirror for `deviceTokens.register`)
- Vitest router test pattern — `packages/api/src/__tests__/notifications.test.ts` (use this template for device-tokens + dispatcher tests)

## Implementation order (strict TDD)

1. **Shared validators** — `device-tokens.ts` + barrel export. No tests needed (Zod schemas).
2. **Context type extension** — add `DispatchNotificationFn` to `Context`. Stub the impl so existing routers/tests still compile.
3. **Device-tokens router** — write `device-tokens.test.ts` first (register inserts; register-twice is upsert; unregister deletes; both require auth). Then implement. Wire into root `appRouter`.
4. **Firebase Admin singleton** — `firebase-admin.ts` with deferred init (so import doesn't crash without env). Trivial test: throws clear error when `FIREBASE_SERVICE_ACCOUNT_KEY` missing.
5. **Notification dispatcher service** — write `notifications-dispatcher.test.ts` first (mock `publishJob` + `db`; assert 1 inbox INSERT + N publishJob calls). Then implement `makeDispatchNotification`. Wire factory call into `apps/server/src/index.ts` `createContext`.
6. **Refactor bookings router call sites** — replace 3 direct `db.insert(notifications)` with `ctx.dispatchNotification`. Update `notifications.test.ts` (or bookings tests) to assert dispatcher is called rather than db.insert.
7. **`handleNotificationPush` impl** — write `notification-handler.test.ts` first (mock `firebase-admin`; assert `messaging().send` called with expected `{ token, notification, data }`; assert UNREGISTERED → token deleted; assert other errors → throw → QStash retry). Then implement.
8. **Mobile install + native config** — `pnpm add @react-native-firebase/app @react-native-firebase/messaging` in `apps/native`, `pnpm remove expo-notifications`. Update `app.config.ts`. **STOP for human handoff** — user must place `google-services.json` and `GoogleService-Info.plist`, configure APNs key in Firebase console, and run `npx expo prebuild` + EAS build.
9. **Mobile permission helper** — `lib/fcm-permission.ts` with `requestNotificationPermission(): Promise<boolean>`.
10. **Mobile registration hook** — `useFcmRegistration()` wiring permission + getToken + register mutation + 4 listeners. Mount in `(app)/_layout.tsx` after the `meData` guard.
11. **Update M4-T3 task spec** — add the "Notification dispatch (deferred from M7-T1)" subsection per the modify-list entry above. Pure docs change; no code. Done in the same commit as the PR description so M4-T3's future implementer has clear guidance.

## Verification

### Server-only (automated)

```bash
pnpm lint
pnpm check-types
pnpm test:coverage    # must hit 80% threshold for new files
pnpm build
```

Targeted checks:

- `pnpm test --filter=@CeolX/api -- device-tokens` — register/unregister procedures
- `pnpm test --filter=@CeolX/api -- bookings` — confirm dispatcher is called from booking flows
- `pnpm test --filter=server -- notifications-dispatcher` — fan-out + zero-token + persona pass-through
- `pnpm test --filter=server -- notification-handler` — UNREGISTERED cleanup + retry semantics

### Mobile (human handoff — Phase 6b)

Cannot Playwright a React Native app. After PR is open the user must on a real iOS + Android device:

1. EAS dev-client build with the new native config files
2. Sign in → confirm device-token row appears in DB
3. Send test push from Firebase Console → confirm receipt in foreground (toast + inbox refresh)
4. Lock device, send push → tap from lock screen → app opens to correct route
5. Force-quit app, send push → tap → cold-start opens to correct route
6. Sign out → confirm unregister mutation fires
7. Trigger a real booking invitation flow end-to-end → confirm push received with correct title/body/route

### Acceptance criteria mapping

| #   | Criterion                                                     | Where verified                                                                                                                                                                                                |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Device token registered via POST endpoint                     | `device-tokens.test.ts` + manual sign-in check                                                                                                                                                                |
| 2   | Token refresh listener auto-reregisters                       | manual + listener wired in `useFcmRegistration`                                                                                                                                                               |
| 3   | Permission requested on first launch post-login               | manual on iOS + Android 13+                                                                                                                                                                                   |
| 4   | Push received in background on iOS + Android                  | manual EAS build test                                                                                                                                                                                         |
| 5   | Foreground tap navigates (no persona switch — adjusted scope) | `useFcmRegistration` listener test + manual                                                                                                                                                                   |
| 6   | Cold-start tap navigates to correct route                     | manual cold-start test                                                                                                                                                                                        |
| 7   | All notification types fire                                   | **8 of 22 matrix push rows in scope** (booking flows). Event-moderation, subscription, collaborator, saved-event triggers deferred to M9-T2 / M8-T2 / M4-T1 / M4-T5 — see Matrix Cross-reference table above. |
| 8   | Notifications logged to `notifications` table                 | `notifications-dispatcher.test.ts`                                                                                                                                                                            |
| 9   | Rate limiting                                                 | **deferred** with TODO — out of scope (justified above)                                                                                                                                                       |
| 10  | FCM failures retried with backoff                             | `notification-handler.test.ts` (UNREGISTERED swallowed; other errors throw → QStash retry x3)                                                                                                                 |

## Human handoff checklist (pre-merge)

These cannot be automated and must be completed by the user before mobile testing:

1. Create / select Firebase project; enable Cloud Messaging
2. iOS: generate APNs auth key in Apple Developer portal → upload to Firebase project settings
3. Download `GoogleService-Info.plist` → place at `apps/native/GoogleService-Info.plist`
4. Download `google-services.json` → place at `apps/native/google-services.json`
5. Create Firebase service account → download JSON → set `FIREBASE_SERVICE_ACCOUNT_KEY` env (stringified JSON) and `FIREBASE_PROJECT_ID` in encrypted env files (envx)
6. Run `npx expo prebuild --clean` then EAS dev-client build for iOS + Android
7. Add the two native config files to `.gitignore` if they aren't already (they contain project secrets)

## Research log (to be filled during Phase 2-4)

Before any library API call, verify against current docs:

- `firebase-admin` modular v13 — `initializeApp`, `getMessaging`, `messaging.send` payload shape, error code constants — **Context7**
- `@react-native-firebase/messaging` — Expo config plugin setup, `getToken`, `onMessage`, `onNotificationOpenedApp`, `getInitialNotification`, `onTokenRefresh`, `requestPermission` — **Context7**
- Android 13+ `POST_NOTIFICATIONS` runtime permission flow — **Context7 (react-native docs)**
- QStash retry semantics — confirm 3-attempt default and backoff curve — **Context7 (@upstash/qstash)**
- Expo config plugin syntax for `googleServicesFile` paths — **Context7 / Expo docs**

Findings will be presented to the user in Phase 2-4 as Research Findings before implementation.
