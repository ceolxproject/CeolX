# CeolX FCM Re-Implementation — Mentor Pattern (Hybrid Transport)

**Date:** 2026-05-05
**Branch (proposed):** `feature/m7-t1-fcm-mentor-pattern`
**Base:** `development`
**Replaces / supersedes:** PR #55 (revert) and the 2026-04-29 plan's Option C
**Target PR:** new PR against `development`; PR #55 will be closed unmerged after this lands

---

## Context

PR #51 (merged 2026-04-27) shipped FCM using `@react-native-firebase/messaging` directly. The iOS build broke on RN 0.83 because `/messaging` requires `use_frameworks! :linkage => :static`, which is incompatible with RN 0.83's prebuilt React-Core xcframework. PR #55 was opened to revert FCM entirely; it is currently OPEN and not merged.

**Root-cause refinement (vs the 2026-04-29 plan).** The existing plan claimed any `@react-native-firebase/*` package on RN 0.83 triggers the static-frameworks conflict, so it recommended keeping `/messaging` + adding `buildReactNativeFromSource: true`. But the Mentor monorepo uses `@react-native-firebase/app` (alone) without static frameworks at all. The conflict is specifically driven by `/messaging`'s native module — `/app` does not need static linkage. **Dropping `/messaging` and dropping `useFrameworks: 'static'` resolves the build conflict without `buildReactNativeFromSource: true`.**

**Why we still keep `@react-native-firebase/app`.** It loads the Firebase iOS native SDK at app startup, which is what makes `expo-notifications.getDevicePushTokenAsync()` return an FCM registration token on iOS instead of a raw APNs device token. Without it, the server would need dual transport (firebase-admin + an APNs library). Out of scope for V1.

**Decisions (already confirmed).**

1. Server transport: **hybrid** — 1 QStash job per dispatch (instead of N jobs per token), `sendEach` inside the handler. Keeps QStash retry safety AND Mentor's batched fan-out efficiency.
2. Mobile RNFB scope: drop `/messaging`, keep `/app`, add `expo-notifications` + `expo-device`.
3. Schema delta: add `is_active` (soft-deactivate) + `last_used_at`. Skip `device_name` and the `list` endpoint (no UI needs them in V1).

---

## Plan at a glance

| Layer            | Goal                                                                            | Files                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Mobile           | Swap RNFB/messaging → expo-notifications. Drop static frameworks.               | `apps/native/{package.json, app.config.ts, hooks/use-fcm-registration.ts, lib/fcm-permission.ts}`                      |
| Server lib       | `isFirebaseConfigured()` silent guard; externalize firebase-admin in tsdown.    | `apps/server/{src/lib/firebase-admin.ts, tsdown.config.ts, .env.example}`                                              |
| Server transport | Per-user push job + `sendEach` batching + soft-deactivate cleanup.              | `apps/server/src/{jobs/types.ts, jobs/handlers/notification.ts, services/notifications-dispatcher.ts}`                 |
| DB               | Add `is_active` + `last_used_at` + indexes. Migration.                          | `packages/db/src/schema/notifications.ts` + new migration                                                              |
| Router           | Soft-deactivate semantics. Add `refresh` + `deactivateAll`. Tighten validators. | `packages/api/src/routers/device-tokens.ts`, `packages/shared/src/validators/device-tokens.ts`                         |
| Tests            | Cover new endpoints + sendEach handler + cleanup loop.                          | `packages/api/src/__tests__/device-tokens.test.ts`, new `apps/server/src/jobs/handlers/__tests__/notification.test.ts` |

---

## Layer 1 — Mobile (the actual iOS-build unblock)

### `apps/native/package.json`

- **Remove:** `@react-native-firebase/messaging` (^23.0.0)
- **Remove:** `expo-build-properties` (~55.0.13) — no longer needed once static frameworks goes
- **Keep:** `@react-native-firebase/app` (^23.0.0) — provides Firebase iOS SDK to expo-notifications
- **Add:** `expo-notifications` (latest matching SDK 55)
- **Add:** `expo-device` (latest matching SDK 55)

### `apps/native/app.config.ts`

- **Remove from `plugins`:**
  - `'@react-native-firebase/messaging'` (line 88)
  - The entire `['expo-build-properties', { ios: { useFrameworks: 'static' } }]` block (lines 89–94)
- **Add to `plugins`:**
  - `'expo-notifications'` (use defaults; channel customization deferred to V1.5)
- **Keep:**
  - `'@react-native-firebase/app'` (line 87)
  - `googleServicesFile` settings on `ios` and `android` blocks (lines 22, 47) — fine as-is, they're not commented (memory note about lines 23/47 being commented is stale; verified they're active)

### `apps/native/lib/fcm-permission.ts` — rewrite

Single API via expo-notifications. Removes the dual-platform branching:

```ts
import * as Notifications from 'expo-notifications';

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return status === 'granted';
}
```

Note: expo-notifications handles the Android 13+ `POST_NOTIFICATIONS` runtime prompt internally — no manual `PermissionsAndroid` call needed.

### `apps/native/hooks/use-fcm-registration.ts` — rewrite

Same effect topology (auth-gated, foreground listener, tap handler, cold-start), just swap the underlying API:

| Old (RNFB/messaging)                      | New (expo-notifications)                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `messaging().getToken()`                  | `(await Notifications.getDevicePushTokenAsync()).data` — returns FCM token because RNFB/app provides the iOS Firebase SDK |
| `messaging().onMessage(cb)`               | `Notifications.addNotificationReceivedListener(cb)`                                                                       |
| `messaging().onNotificationOpenedApp(cb)` | `Notifications.addNotificationResponseReceivedListener(cb)`                                                               |
| `messaging().getInitialNotification()`    | `Notifications.getLastNotificationResponseAsync()`                                                                        |
| `messaging().onTokenRefresh(cb)`          | **Dropped** — expo-notifications has no equivalent. FCM tokens rarely rotate; per-launch re-registration covers it.       |

**Set the foreground notification handler** at module import:

```ts
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
```

(The old SDK 50 fields `shouldShowAlert` are deprecated; SDK 55 uses `shouldShowBanner` + `shouldShowList`. Verify against Context7 before final commit.)

**Persona/route deep-link logic stays unchanged.** The data payload `{ persona, route }` arrives via `response.notification.request.content.data` for tap handlers; `notification.request.content.data` for foreground listener. Reuse `navigateFromRemoteData()`.

### `apps/native/app/(app)/_layout.tsx`

No changes — `useFcmRegistration()` still imports the same hook.

### iOS / Android native config

- `GoogleService-Info.plist` and `google-services.json` already exist (per audit). No changes.
- After the package.json + app.config.ts changes: run `pnpm expo prebuild --clean -p ios && pnpm expo prebuild --clean -p android` locally to regenerate native folders without static frameworks.

---

## Layer 2 — Server lib hardening

### `apps/server/src/lib/firebase-admin.ts` — extend with silent-no-op guard

```ts
let initFailed = false;

export function isFirebaseConfigured(): boolean {
  return Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
}

export function getMessaging(): Messaging | null {
  if (!isFirebaseConfigured() || initFailed) return null;
  try {
    return getMessagingFromAdmin(getApp());
  } catch (err) {
    initFailed = true;
    console.error('[firebase] init failed:', err);
    return null;
  }
}
```

Existing `getApp()` keeps the `getApps()` double-guard. Throwing is replaced by silent null returns so the server boots in dev/test/CI without creds.

### `apps/server/tsdown.config.ts`

Add an explicit `external` array so firebase-admin's native deps don't get bundled:

```ts
export default defineConfig({
  entry: './src/index.ts',
  format: 'esm',
  outDir: './dist',
  clean: true,
  noExternal: [/@CeolX\/.*/],
  external: ['firebase-admin', 'firebase-admin/app', 'firebase-admin/messaging'],
});
```

### `apps/server/.env.example`

Replace the current 3-field FIREBASE\_\* listing (which doesn't match the code) with the actual 2-field shape:

```
FIREBASE_PROJECT_ID=ceolx-dev
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

---

## Layer 3 — Server transport (hybrid: 1 job per dispatch, sendEach inside)

### `apps/server/src/jobs/types.ts`

Replace `notificationPushSchema` (currently per-token) with per-user shape:

```ts
export const notificationPushSchema = z.object({
  userId: z.string(),
  title: z.string(),
  body: z.string(),
  persona: z.enum(['spectator', 'artist', 'venue']),
  route: z.string(),
  data: z.record(z.string(), z.string()).optional(),
});
```

### `apps/server/src/services/notifications-dispatcher.ts`

Replace the `Promise.all(tokens.map(...))` per-token fan-out with a single per-user job:

```ts
const push = buildNotification(input.trigger, NotificationSurface.PUSH, input.vars);
await deps.publishJob('notification.push', {
  userId: input.recipientUserId,
  title: push.title,
  body: push.body,
  persona: push.persona,
  route: push.route,
});
```

Drop the upfront `select fcmToken from device_tokens` query — token lookup moves into the handler.

### `apps/server/src/jobs/handlers/notification.ts` — rewrite `handleNotificationPush`

```ts
export async function handleNotificationPush(payload) {
  const messaging = getMessaging();
  if (!messaging) return; // dev/CI no-op when unconfigured

  const tokens = await db
    .select({ id: deviceTokens.id, fcmToken: deviceTokens.fcmToken })
    .from(deviceTokens)
    .where(and(eq(deviceTokens.userId, payload.userId), eq(deviceTokens.isActive, true)));
  if (tokens.length === 0) return;

  const messages = tokens.map((t) => ({
    token: t.fcmToken,
    notification: { title: payload.title, body: payload.body },
    data: {
      persona: payload.persona,
      route: payload.route,
      ...(payload.data ?? {}),
    },
    android: {
      priority: 'high' as const,
      notification: { channelId: 'default', sound: 'default' },
    },
    apns: { payload: { aps: { sound: 'default', badge: 1 } } },
  }));

  const response = await messaging.sendEach(messages);

  const stale: string[] = [];
  response.responses.forEach((r, i) => {
    if (r.error && TERMINAL_TOKEN_ERROR_CODES.has(r.error.code)) {
      stale.push(tokens[i]!.id);
    }
  });
  if (stale.length > 0) {
    await db
      .update(deviceTokens)
      .set({ isActive: false, updatedAt: new Date() })
      .where(inArray(deviceTokens.id, stale));
  }
}
```

Soft-deactivate replaces the previous hard-delete. Dead tokens stay in the table for diagnostics; they just don't get sent to.

`handleNotificationBatch` stub stays as-is (out of V1 scope).

---

## Layer 4 — DB schema + migration

### `packages/db/src/schema/notifications.ts`

Extend `deviceTokens` table:

```ts
isActive: boolean('is_active').default(true).notNull(),
lastUsedAt: timestamp('last_used_at'),
```

Add indexes:

```ts
index('device_tokens_user_active_idx').on(t.userId, t.isActive),
index('device_tokens_updated_at_idx').on(t.updatedAt),
```

### New migration in `packages/db/src/migrations/`

- Generate via `pnpm -F @CeolX/db generate` after schema edit.
- Backfill: existing rows get `is_active = true` (default), `last_used_at = NULL`. Production has no FCM data yet — all rows are dev/test fixtures.

---

## Layer 5 — tRPC router + validators

### `packages/shared/src/validators/device-tokens.ts`

- Tighten `tokenSchema`: change `z.string().min(1)` → `z.string().min(50)` (FCM tokens are ~152 chars; min(50) catches obvious bad inputs without false rejections).
- Add `refreshDeviceTokenSchema` (same shape as register).
- Keep `unregisterDeviceTokenSchema` (just the token).

### `packages/api/src/routers/device-tokens.ts`

- **`register`** (existing — extend):
  - Look up existing row by `(userId, fcmToken)`.
  - If found for current user → set `isActive=true`, `lastUsedAt=now()`, `updatedAt=now()`.
  - If found for a _different_ user (device handed off) → reassign to current user, reactivate.
  - If not found → insert.
- **`refresh`** (NEW): touch `lastUsedAt` + `isActive=true` for `(userId, fcmToken)`. Insert if missing.
- **`unregister`** (existing — change semantics): change from hard delete to `set isActive=false`.
- **`deactivateAll`** (NEW): `set isActive=false where userId = ctx.user.id`.
- **No `list`** — defer to a future "where am I logged in" UI task.

### Mobile call-sites

- Login / app launch → `client.deviceTokens.refresh.mutate({ token, platform })`
- Logout (this device) → `client.deviceTokens.unregister.mutate({ token })`
- Hard logout / account deletion → `client.deviceTokens.deactivateAll.mutate()`

---

## Layer 6 — Tests

### `packages/api/src/__tests__/device-tokens.test.ts`

Add:

- `refresh` — touches lastUsedAt + reactivates a soft-deactivated token; inserts when missing
- `register` — reassigns token from another user
- `unregister` — soft-deactivates (no longer hard-deletes); is idempotent
- `deactivateAll` — flips all of the user's tokens
- Validator: rejects token shorter than 50 chars

### `apps/server/src/jobs/handlers/__tests__/notification.test.ts` (NEW)

- `handleNotificationPush` — single user, multiple active tokens → calls `sendEach` with N messages, all platform shapes correct
- Skips when `getMessaging()` returns null (no creds)
- Skips when user has zero active tokens
- On terminal token error → flips `isActive=false` on the offending row (NOT deleted)
- On non-terminal error → re-throws so QStash retries
- Persona + route are present in the FCM `data` field

Mock `firebase-admin/messaging.sendEach` to return scripted responses. Use existing test DB.

---

## Out of scope (deferred to V1.5 / V2 backlog)

- `list` endpoint and `device_name` column (no UI consumes them yet)
- 4-locale push template matrix (CeolX is English-only per CLAUDE.md)
- Quiet hours and frequency limits (no marketing notifications in V1)
- Notification audit table (rate limit not needed)
- Web push (admin app uses inbox, not real-time)
- Mobile token-refresh listener (expo-notifications has no equivalent; per-launch refresh suffices)
- 3-field FIREBASE\_\* env split (current JSON-blob format works fine; only `.env.example` needed correcting)
- `buildReactNativeFromSource: true` (not needed once `/messaging` and static frameworks are gone)

---

## Verification

### Phase 6 — automated

```
pnpm lint
pnpm check-types
pnpm test:coverage   # 80%+ threshold; new tests must cover dispatcher + handler + router
pnpm build           # confirm tsdown emits a bundle that doesn't blow up at import
```

On `apps/native`: `pnpm -F native lint && pnpm -F native check-types`.

### Phase 6b — manual mobile (no Playwright; native task)

1. `pnpm expo prebuild --clean -p ios` — must succeed without static-frameworks errors
2. `pnpm -F native ios` (physical device or simulator) — boots without RNFB/messaging linker errors
3. Repeat with `-p android` + `pnpm -F native android`
4. End-to-end push:
   - Sign in on device, allow notifications
   - Verify token row in DB: `SELECT user_id, platform, is_active, last_used_at FROM device_tokens`
   - From admin or seed script, trigger a `BOOKING_INVITE_TO_ARTIST`
   - Confirm system push notification arrives with correct title + body
   - Tap push → app deep-links to `/bookings/:id`
5. Stale-token cleanup:
   - In Firebase Console, manually invalidate a token (or delete in DB and re-register a junk token)
   - Trigger a send → confirm `is_active` flips to `false` in `device_tokens`

### Phase 7 — PR

- Push branch
- Open PR titled `✨ feat(native,server): swap fcm to expo-notifications + mentor patterns`
- Reference PR #51 (replaces) and PR #55 (closes — no longer needed)
- Body: link to this plan, list the 6 layers, link to manual verification screenshots
- Close PR #55 unmerged after this PR merges

---

## Critical files (full list, in commit order)

1. **DB migration** — `packages/db/src/schema/notifications.ts` + new migration file
2. **Validators** — `packages/shared/src/validators/device-tokens.ts`
3. **Router** — `packages/api/src/routers/device-tokens.ts`
4. **Router tests** — `packages/api/src/__tests__/device-tokens.test.ts`
5. **Server lib** — `apps/server/src/lib/firebase-admin.ts`
6. **Bundler config** — `apps/server/tsdown.config.ts`
7. **Env example** — `apps/server/.env.example`
8. **Job schema** — `apps/server/src/jobs/types.ts`
9. **Job handler** — `apps/server/src/jobs/handlers/notification.ts`
10. **Handler tests** — `apps/server/src/jobs/handlers/__tests__/notification.test.ts` (new)
11. **Dispatcher** — `apps/server/src/services/notifications-dispatcher.ts`
12. **Mobile package** — `apps/native/package.json`
13. **Mobile config** — `apps/native/app.config.ts`
14. **Mobile permission lib** — `apps/native/lib/fcm-permission.ts`
15. **Mobile hook** — `apps/native/hooks/use-fcm-registration.ts`

Suggested commit grouping (TDD-friendly):

1. `🔧 chore(server): externalize firebase-admin in tsdown + align .env.example` (low-risk infra)
2. `📦 feat(db): soft-deactivate columns on device_tokens (is_active, last_used_at)` (schema + migration)
3. `✅ test(api-pkg): cover refresh, deactivateAll, soft-deactivate, reassign` (tests first per TDD)
4. `✨ feat(api-pkg): add refresh + deactivateAll endpoints; soft-deactivate semantics` (router)
5. `✨ feat(server): isFirebaseConfigured guard; per-user push job + sendEach batching` (server lib + handler + dispatcher + types)
6. `✅ test(server): cover sendEach handler + stale-token cleanup loop` (handler tests)
7. `✨ feat(native): swap FCM transport to expo-notifications, drop @react-native-firebase/messaging + static frameworks` (mobile)

---

## Risks

| Risk                                                                       | Likelihood                                                 | Mitigation                                                                            |
| -------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `getDevicePushTokenAsync()` returns APNs token instead of FCM token on iOS | Low — RNFB/app loads the Firebase iOS SDK                  | Verify on real iOS device during Phase 6b; confirm token starts with FCM-style prefix |
| Dropping static frameworks breaks something other than RNFB/messaging      | Low — Mentor runs without it                               | Rerun full prebuild + iOS build; if any other plugin needs it, add the explicit dep   |
| expo-notifications setNotificationHandler API differs in SDK 55            | Medium — API was renamed for SDK 53+                       | Verify via Context7 before commit; Context7 has up-to-date Expo docs                  |
| `lastUsedAt` migration on a heavy table                                    | Low — V1 has zero production push data; column is nullable | No backfill needed; migration is additive                                             |
| sendEach response ordering doesn't map to input array                      | Verified by firebase-admin docs (it does)                  | Index-based pairing is documented behavior; assert in handler test                    |
