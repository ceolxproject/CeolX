# Native global 401 handling + AppState session revalidation

**Date:** 2026-07-16
**App:** `apps/native`
**Related:** Asana "Mentor VS Ceolx Comparison" (1215859494907788) — quick-win #3 (global 401 handler) and scorecard row (AppState↔Query focus bridge). Also removes the unused `@tanstack/react-form` dependency (quick-win #2).

## Problem

A returning user with an expired BetterAuth session can get stuck on a permanent blank screen with a "Retrying your session…" toast, and no path to sign-in. Force-quitting recovers (cold start self-heals), but nothing tells the user that.

### Why it happens

BetterAuth sessions are **7-day rolling** (library defaults — `packages/auth/src/index.ts` sets no top-level `session` config; `better-auth@1.5.5` defaults are `expiresIn: 7d`, `updateAge: 1d`). For a seasonal festival-discovery app, returning after >7 days is a normal usage pattern, not an edge case.

**Cold start is fine.** `authClient.useSession()` revalidates against the server on mount; an expired cookie yields a null session, `user` goes null, and `app/(app)/_layout.tsx:62` redirects to sign-in. `useMe` is `enabled: !!user`, so it never fires.

**Warm resume is the failure.** Trace:

1. App backgrounded 8+ days. On iOS the JS context survives; `useSession`'s in-memory store still holds the user.
2. Nothing revalidates the session on foreground (the missing AppState→focusManager bridge). `user` stays non-null — a **phantom session**.
3. A protected query refetches. `use-unread-badge-count.ts:17` polls `notifications.unreadCount` **every 30s** while signed in, so this fires within 30s of resume with no navigation → **401**.
4. `app/(app)/_layout.tsx:35-39` fires: `appToast.error('Something went wrong', 'Retrying your session…')` then `meRefetch()` → 401 again.
5. `app/(app)/_layout.tsx:66` — `if (user && !isGuest && meError) return null;` → **renders nothing.**

The user is stuck: blank screen, retry toast, no sign-in path.

### Known-bug corroboration

`hooks/use-me.ts:13-18` already documents this exact "'Retrying your session…' toast loop." The fix applied there gated `useMe` on `isAuthenticated && !isGuest`, which closes the **guest** trigger. It cannot close the **expired-session** trigger by construction: `isAuthenticated` is `true` for a phantom user — that is exactly what the gate checks for.

The two "separate" scorecard items are one bug wearing two hats: the missing AppState bridge _creates_ the phantom session; the missing 401 handler _fails to recover_ from it.

## Decisions (locked during brainstorming)

- **Primary fix is the cause, not the symptom.** Revalidate the session on app resume (AppState→focusManager). The phantom user resolves to null and the _existing_ layout guard redirects on its own. The 401 handler is a **backstop**, not the primary mechanism.
- **Backstop scope: queries only, never mutations.** A background-query 401 signs out (the user isn't mid-task; the screen is already dead). A mutation 401 is left to its call site, which already surfaces "Your session has expired." via `getTRPCErrorMessage`. Nothing yanks a half-filled event form out from under a venue.
- **Layering: event seam (Option B).** `queryClient` is a module-level singleton in `utils/trpc.ts`; `logout()` lives inside `AuthProvider` (React context). A module-level `onError` cannot reach context teardown directly. Rejected alternatives:
  - _Module-level handler does its own teardown_ — would duplicate the six deliberate steps of `logout()` (`auth-context.tsx:128-156`), five of which carry a comment explaining the bug they fix. Guarantees drift.
  - _Move `QueryClient` into `AuthProvider`_ — `queryClient` is exported and consumed at module scope by `createTRPCOptionsProxy` plus `auth-context.tsx:43` and test files. Large blast radius, no behavioural gain.

## Components

### 1. Session-expiry event bus — `apps/native/utils/session-events.ts` (new)

Dependency-free module-level emitter. No React, no app imports.

- `onSessionExpired(cb): () => void` — subscribe, returns unsubscribe.
- `emitSessionExpired(): void` — notify subscribers, **de-duped** (see below).
- `resetSessionExpired(): void` — clears the latch; called on fresh sign-in.

**De-dupe latch (load-bearing):** once `session-expired` is emitted, further emits are suppressed until `resetSessionExpired()`. A batched screen with N protected queries all 401 near-simultaneously would otherwise fire N `logout()` calls racing on the same SecureStore keys and `queryClient.clear()`. The bus owns the dedupe because it is the single funnel every 401 passes through — the correct place to enforce "at most once."

### 2. `QueryCache.onError` — `apps/native/utils/trpc.ts` (edit)

Replace the bare `new QueryClient()` (line 14) with one carrying a `QueryCache`:

- `onError(error)` → `getTRPCErrorCode(error)` (reuse from `trpc-error.ts`, no duplicate parsing) → if `'UNAUTHORIZED'`, call `emitSessionExpired()`.
- Queries only. No `MutationCache`.
- Non-tRPC thrown values: no-op, no crash.

### 3. `AuthProvider` subscription — `apps/native/contexts/auth-context.tsx` (edit)

One `useEffect`: `onSessionExpired(() => { void logout(); })`, returns the unsubscribe. Reuses the existing `logout()` verbatim — zero teardown duplicated. Call `resetSessionExpired()` after a successful sign-in / when a valid session appears, so a later expiry can emit again.

### 4. AppState→focusManager bridge — `apps/native/utils/query-focus.ts` (new), consumed via a hook in `app/_layout.tsx`

`query-focus.ts` exports `installAppStateFocusBridge()`: subscribes to `AppState`, and on `'active'` calls `focusManager.setFocused(true)` and refetches the BetterAuth session (`authClient.getSession()` / `useSession` refetch) so a phantom session resolves to null on resume. Returns the `AppState` subscription's `remove` for teardown. `app/_layout.tsx` calls it from a `useEffect` (registered once at the app root, alongside the existing `QueryClientProvider`). Kept in its own file — not inlined — so it is unit-testable with a mocked `AppState`. This is the **primary** fix; components 1–3 are the backstop.

### 5. `_layout` retry-effect guard — `app/(app)/_layout.tsx:35-39` (edit)

The retry effect currently calls `meRefetch()` on any `meError`. Add an early return when `getTRPCErrorCode(meError) === 'UNAUTHORIZED'` — that path is now owned by the bus and is unrecoverable by retry (retrying is what produced the loop). Genuine network errors still retry unchanged.

### 6. Remove unused `@tanstack/react-form` (separate, no design)

Zero source imports repo-wide. Delete from `apps/native/package.json:65`, `apps/admin/package.json:26`, and the catalog entry in `pnpm-workspace.yaml:16`. Run `pnpm install` to update the lockfile.

## Data flow

**Primary — warm resume (common):**

```
app foregrounds
  → AppState 'active' → focusManager.setFocused(true) + authClient session refetch
  → expired cookie → session resolves to null
  → AuthProvider: user → null
  → (app)/_layout.tsx:62  !user && !isGuest → <Redirect href="/(auth)/sign-in" />
```

No toast, no 401, no blank screen. The phantom session never forms.

**Backstop — revoked while foregrounded (password change elsewhere, GDPR sweep):**

```
notifications.unreadCount poll (30s) or any protected query → 401
  → QueryCache.onError → getTRPCErrorCode === 'UNAUTHORIZED' → emitSessionExpired()  (latched)
  → AuthProvider subscription → logout()  (signOut + Google + SecureStore + queryClient.clear)
  → user → null → (app)/_layout.tsx:62 redirects to sign-in
```

**Mutation 401 (unchanged, deliberate):**

```
call site catch → getTRPCErrorMessage → "Your session has expired." toast
  → form state survives, not wired to the bus
```

### Loop-safety (this whole bug is a loop)

1. `queryClient.clear()` inside `logout()` does not _emit_ errors, so it won't re-trigger `onError`. But any query that refetches post-clear before the redirect commits would 401 and re-emit — the **de-dupe latch** collapses that to one `logout()`.
2. The `_layout` retry effect no longer re-drives a 401 (component 5), so it can't feed the loop.

## Guest safety (verified, no regression)

Protected queries are already guest-gated (`use-me.ts:19`, `use-unread-badge-count.ts:12`), so guests don't fire the protected queries that would 401. The backstop cannot misfire for guests.

## Testing (Vitest, `__tests__/*.test.ts`, mocked tRPC — same shape as `use-like-handler.test.ts`)

**`utils/__tests__/session-events.test.ts`** — emitter in isolation, no React:

- subscribe → emit → callback fires once
- de-dupe latch: three emits in a row → callback fires **once**
- `resetSessionExpired()` → next emit fires again
- unsubscribe → later emit does not fire

**`utils/__tests__/query-cache-401.test.ts`** — the `onError` wiring:

- `UNAUTHORIZED` tRPC error → `emitSessionExpired` called
- `FORBIDDEN` / `NOT_FOUND` / network error → **not** called
- non-tRPC thrown value → no crash, not called

**`contexts/__tests__/auth-context-session-expiry.test.tsx`** — the subscription:

- emit `session-expired` → `logout()` runs (assert `authClient.signOut` + `queryClient.clear` called)
- provider unmount → unsubscribed (emit after unmount does not call `logout`)

**AppState bridge** — assert `focusManager.setFocused(true)` on `'active'` and session refetch fired, mocking `AppState`. Lighter coverage; mostly wiring.

**Not tested:** the `(app)/_layout` redirect itself — existing, already-working (`:62`); the change there is a one-line early-return guarded by the same `getTRPCErrorCode` the unit tests cover. Expo Router redirect testing needs heavy harness for little value.

## Out of scope

- Query cache **persistence** (parked; interacts with the deleted-post tombstone Set and needs a `shouldDehydrateQuery` predicate — its own task).
- Re-auth sheet / mutation retry (the "queries sign out, mutations prompt" option was rejected for V1 as too much surface).
- Any change to the six-step `logout()` itself.
