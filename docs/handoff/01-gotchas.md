# Gotchas

High-impact traps distilled from 6 months of debugging. Symptom → Cause → Fix.

> Real app names on disk are `apps/native` and `apps/server` (CLAUDE.md's `apps/mobile`/`apps/api` are aspirational, not current — see `docs/handoff/04-architecture.md`).

## Auth & onboarding

### Deep-link bridge: never unmount the navigator waiting on a loading flag

**Symptom:** reset-password / verify-email links intermittently bounce to sign-in, or land the user permanently on the splash screen instead of the target screen.
**Cause:** `app/_layout.tsx` and `app/(auth)/_layout.tsx` used to `return null` while fonts/session were loading. Since reset-password lives under `(auth)`, that null-return unmounted the whole navigator on a cold-start deep link, racing Expo Router's deep-link restoration — the link got dropped back to the `(auth)` splash anchor. A second, independent bug stacked on top: the HTTPS bridge page fired `ceolx://` through two mechanisms at once (`<meta http-equiv="refresh">` AND a JS redirect); Android delivers both to `onNewIntent`, re-anchoring the splash after the target had already mounted.
**Fix:** keep the navigator mounted always — cover the pre-font window with an overlay instead of `return null`; don't gate the `(auth)` Stack on `isLoading`. The splash relies on `isFocused` alone (no timers, no `useURL` guards — both were patches for the remount race). The bridge fires the custom scheme via exactly one mechanism (`window.location.replace`, not `.href`, and no meta-refresh).
`apps/server/src/routes/deep-link-bridge.ts` · Asana 1215040939202673

### Deep-link bridge: `location.replace()` mid-parse kills every later inline `<script>`

**Symptom:** verify-email desktop fallback never fires — no app open, no server-side confirm POST, card stuck on "Opening CeolX…".
**Cause:** the deep-link fire (`window.location.replace('ceolx://…')`) and the fallback timer lived in two separate `<script>` tags. Calling `location.replace()` during initial HTML parse halts every inline script that comes after it, so the fallback timer was never registered.
**Fix:** merge into one inline script — arm the fallback (`visibilitychange` listener + `setTimeout`) FIRST, then `window.location.replace(deepLink)` as the last statement. A regression test asserts `indexOf('setTimeout(') < indexOf('window.location.replace(')`. Also keep explanatory comments in the TS source, never inside the template literal — comment text ships in the served HTML and can trip string-presence assertions.
`apps/server/src/routes/deep-link-bridge.ts` · `apps/server/src/__tests__/routes/deep-link-bridge.test.ts` · Asana 1215700058851863

### Guest browsing must go through `continueAsGuest()`, never a bare SecureStore write

**Symptom:** "Skip" does nothing (guest bounced back to sign-in), or a logged-out guest hits a "Something went wrong / Retrying your session…" toast loop.
**Cause:** the `(app)/_layout.tsx` guard reads `isGuest` from React state in `auth-context`, not from SecureStore directly — a screen writing the SecureStore key alone leaves state stale until next app launch. Separately, `useMe()` wraps the protected `users.me` query; every call site shares one React Query cache key, so ANY unguarded caller (a tab bar, a screen mounted for guests too) fires a 401 that poisons the shared cache entry for everyone.
**Fix:** guest entry points must call `continueAsGuest()` from `useAuth()` (sets state + SecureStore together), never write `isGuest` directly. `hooks/use-me.ts` guards centrally: `enabled = (opts?.enabled ?? true) && isAuthenticated && !isGuest`. Any new guest-reachable screen must gate protected queries the same way.
`apps/native/contexts/auth-context.tsx` · `apps/native/hooks/use-me.ts` · Asana 1215040939202677

### Logout must clear the query cache, not just the session

**Symptom:** after login → logout → Skip (guest), the guest briefly sees the previous user's artist/venue view. A cold restart fixes it.
**Cause:** `queryClient` is a module-level singleton that outlives `logout()` — `AuthProvider`/`QueryClientProvider` mount once at root and never unmount. `logout()` cleared the BetterAuth session but not the query cache. A **disabled** `useQuery` (guests) still returns its last cached data (`enabled:false` stops fetching, not eviction), so `useMe()` handed back the prior user's cached `currentRole`.
**Fix:** `logout()` calls `queryClient.clear()`. `useMe()` additionally masks data when disabled (`return enabled ? query : { ...query, data: undefined }`) so every consumer is immune, not just the one that was noticed.
`apps/native/utils/trpc.ts` · `apps/native/contexts/auth-context.tsx` · `apps/native/hooks/use-me.ts` · Asana 1216340295233387

### Social signup role only lands via `completeRegistration` — email signup is different

**Symptom:** "signed up as Venue, got Spectator, no Create Event button" — the DB row is genuinely spectator, not a display bug.
**Cause:** email signup passes `currentRole` directly (`additionalFields`, `input: true`). Google/Apple `signIn.social` has no channel to pass `additionalFields` through the OAuth redirect — the user row is created with the column default `'spectator'`, and the chosen role is applied only by a post-session effect reading `pendingRegistration` from SecureStore and calling `users.completeRegistration` (one-shot: no-op once `consentAt` is set — role is fixed per account by design).
**Fix / trap to know:** `AuthProvider` mounts once at app root and never unmounts on logout — a `pendingHandled` ref meant the consume-effect only ran once per app _process_, so a second social signup in the same run silently kept the spectator default. `logout()` now resets `pendingHandled.current = false` and deletes `pendingRegistration`. Also: `signIn.social` is also sign-_up_ — an unknown account auto-creates a spectator row even from the Login screen unless `disableImplicitSignUp: true` is set on both providers, with `requestSignUp: true` sent only on the actual signup path. Accounts created during the old buggy window are stuck at spectator with `consentAt = null` and need manual DB repair (re-login will not fix them).
`packages/auth/src/index.ts` · `apps/native/contexts/auth-context.tsx` · `apps/native/hooks/use-social-auth.ts` · Asana 1214827610421259, 1215188822147991

### Email lookup needs server-side normalization, or verified accounts can't log in

**Symptom:** "verified the account but login still asks to verify" — looks like a plus-addressing bug but isn't.
**Cause:** the `user.email` unique constraint is byte-exact and BetterAuth had no server-side normalization, so a casing difference between signup and login made the lookup miss the verified row. Plus-addressed emails (`a+artist@x.com` vs `a+venue@x.com`) are **intentionally** independent accounts (Artist↔Venue switching isn't supported — separate accounts required), so the `+tag` must never be stripped.
**Fix:** `normalizeEmail` (`.trim().toLowerCase()`, keeps `+tag`) applied in a BetterAuth `hooks.before` for a fixed set of paths (`EMAIL_BODY_PATHS` — sign-up, sign-in, forget-password, send-verification-email). Any new email-keyed auth endpoint must be added to that set or it silently bypasses normalization. Pre-existing DB rows with mixed-case emails need a one-off lowercase migration (with collision check) to close the legacy gap.
`packages/auth/src/normalize-email.ts` · `packages/auth/src/index.ts` · Asana 1215700058851867

### `hasSeenOnboarding` lives in the iOS Keychain — uninstall does not reset it

**Symptom:** delete + reinstall the app on a physical device does not show the Get Started screen again.
**Cause:** `hasSeenOnboarding` is stored in SecureStore (= iOS Keychain), which can survive an app uninstall. The BetterAuth session is Keychain-backed too, so a reinstalled user often stays logged in and is routed straight to the map, past both onboarding gates.
**Fix:** to view Get Started, use a fresh simulator (empty Keychain). To reset on a physical device, you need code running in-app — a dev build with a one-shot `SecureStore.deleteItemAsync('hasSeenOnboarding')` + `logout()`; standalone staging/TestFlight builds cannot be reset externally.
`apps/native/app/(auth)/get-started.tsx` · `apps/native/app/(auth)/index.tsx`

### Location-setup flag must be keyed per user, not device-global

**Symptom:** a brand-new user on a device where a prior account had already completed location setup skips the "Set your location" screen entirely and drops straight to IP fallback (never prompted for GPS permission).
**Cause:** the completion flag was a single device-global Keychain key, written once by any account and never cleared on logout. `LocationPermissionScreen` (the setup step) is the only code path that calls `requestForegroundPermissionsAsync` — skip the step and permission is never requested.
**Fix:** key the flag per user (`ceolx.location-setup-complete.${userId}`); gate hooks take `userId` and hold `checking` when it's undefined. Clear the key on **account deletion**, not on plain logout (clearing on logout would re-prompt returning users every login).
`apps/native/utils/location-setup.ts` · `apps/native/hooks/use-location-setup-gate.ts` · `apps/native/hooks/use-location-permission-prompt.ts` · `apps/native/hooks/use-gps-region.ts`

### Android "Open Email App" needs an intent fallback chain, not a single `CATEGORY_APP_EMAIL` intent

**Symptom:** tapping "Open Email App" on Android throws an error toast and opens nothing, on some devices/OEMs only.
**Cause:** not every mail client / OEM build declares `CATEGORY_APP_EMAIL`; a single `ACTION_MAIN` + `CATEGORY_APP_EMAIL` intent throws `ActivityNotFoundException` on those devices. This is a **native** module (`expo-intent-launcher` + manifest `<queries>`), so it cannot ship via `eas update` OTA — the bug bounced for ~3 weeks because every "fix" shipped OTA and testers kept running old native code.
**Fix:** try `CATEGORY_APP_EMAIL` first, then fall back to directly launching known email packages (Gmail, Outlook, Samsung, Yahoo, Proton, K-9, BlueMail) via `IntentLauncher.openApplication`; the direct-launch step needs `<queries><package>` entries kept in sync in the config plugin. Verify the manifest with `expo config --type introspect`. Any native-surface fix (manifest, intents, permissions) needs a fresh EAS build to actually verify — see Builds & EAS.
`apps/native/utils/open-email-app.ts` · `apps/native/plugins/with-android-email-queries.cjs` · Asana 1215960893303593, 1214826258749461

## Map & discovery

### Discovery feed + Map read from Typesense, not Neon — coordless events vanish

**Symptom:** an event exists and is `active` in the database but never appears on the Map or in the Discovery feed for anyone.
**Cause:** `events.getFeed` and `events.getMap` query a Typesense `events` collection (bbox / geopoint filters), not Postgres directly. Neon is only hit afterward for enrichment. An event that was never synced to Typesense, or synced with bad coordinates, is invisible. `events.create` used to coerce missing coordinates to `'0'` into `NOT NULL` numeric columns — coordless events landed at (0,0), in the Atlantic, and never appeared in an Irish viewport.
**Fix:** creation requires `(lat && lng) || venueId`, resolved server-side by `resolveEventCoordinates` (explicit pin → inherit venue pin → else reject; never silently defaults to 0,0). If Discovery/Map return empty for everyone (not just one event), suspect a dead Typesense cluster before a code bug — both endpoints catch Typesense errors and silently return `{hits:[]}`. Recovery: the `admin.resyncEvents` mutation (ensures the collection + bulk-reindexes) rather than a manual `/collections` curl; the server also calls `ensureEventsCollection()` fire-and-forget on startup.
`packages/api/src/routers/events/helpers.ts` (`resolveEventCoordinates`) · `packages/api/src/services/event-sync.ts` · `packages/api/src/routers/admin/maintenance.ts` (`resyncEvents`) · `apps/server/src/app.ts` · Asana 1215189347038383

### Discovery text search is nationwide by design — default browse is not

**Symptom:** an event more than ~100km from the user's default location is invisible on Discovery browse AND unfindable by typing its name in search — looks like a bug, was closed "working as designed," then reopened.
**Cause:** default browse keeps a 100km geo ring (`MAX_DISTANCE_KM` in `feed-ranking.ts`); this is intentional. But this is a country-scale app, so when a text query is present the geo filter is dropped entirely — search reaches all of Ireland and distance only influences ranking, not inclusion.
**Fix / rule:** if "search finds nothing far away" recurs, check the `geoFilter` conditional in `events/feed.ts` before assuming a radius bug. Two known follow-ups still open: the Map's free-text query is still viewport-bounded with an auto-expand cap at 100km (`MAP_EXPAND_RADIUS_KM = [5, 25, 100]` in `apps/native/hooks/use-map-events.ts`) — only the county dropdown re-centers; and the in-memory ranker weights `0.4*recency + 0.4*distance + 0.2*social`, ignoring Typesense's own text-match score, so a far exact-name match can land on a later page.
`packages/api/src/routers/events/feed.ts` · `packages/api/src/lib/feed-ranking.ts` · `apps/native/hooks/use-map-events.ts` · Asana 1215426207523373

### Android map markers: put `onPress` on `<Marker>`, never on an inner `<Pressable>`

**Symptom:** a custom map pin's tap handler works perfectly on iOS and does nothing on Android.
**Cause:** on Android, `react-native-maps` flattens a `<Marker>`'s custom child view to a static bitmap for the Google Maps SDK, so an inner `<Pressable>`/`TouchableOpacity` never receives touches. On iOS (Apple Maps) the child stays a live subview, so the same code works there.
**Fix:** put the tap handler on the `Marker`'s own `onPress` prop, not an inner pressable. No native-module change — ships OTA via `eas update`.
`apps/native/components/MapEventMarker.tsx` · `apps/native/components/MapClusterMarker.tsx` (reference implementation) · Asana 1215453288289175

### Blank Android map pins are a Fabric + clustering-library mount bug, not an image-timing bug

**Symptom:** Android pins render their category badge and border but the image inside stays blank — looks like a slow-loading image but doesn't fix with longer timeouts.
**Cause:** `newArchEnabled=true` (Fabric) + `react-native-maps` custom-child markers + `react-native-map-clustering@4.0.0` (unmaintained, pure JS, pre-Fabric). The clustering library re-creates marker children on every region change; under Fabric each re-attach throws a mount error (`addViewAt: cannot insert view … View already has a parent`), and the async `<Image>` never composites before `tracksViewChanges` freezes the snapshot. No image-decode or OOM errors appear — this is a mount-churn bug, unrelated to the `tracksViewChanges` timing issue below even though both affect the same pins.
**Fix paths:** OTA-able mitigation — drop the clustering wrapper and import `MapView` straight from `react-native-maps` (stops the churn, loses zoom-out cluster badges, which CLAUDE.md marks as a finalized feature). Durable fix needs a native rebuild — upgrade `react-native-maps` and swap to a Fabric-compatible clustering library. Diagnose with `adb logcat -c; <pan/zoom>; adb logcat -d | grep -E "addViewAt: cannot insert|ViewAttacherGroup"`.
`apps/native/app/(app)/(tabs)/map/index.tsx` · Asana 1215453288289175

### Custom map markers must settle `tracksViewChanges` per-marker after their image loads

**Symptom:** map pins feel sluggish/janky, or a pin shows completely blank on first load until you navigate away and back.
**Cause:** `tracksViewChanges={true}` re-rasterizes a marker every frame (smooth, expensive); `false` freezes a snapshot once. Freezing at mount (before the remote image downloads) captures a blank pin; never re-enabling for the selected pin makes it track forever and feel janky. Freezing synchronously on the image's `onLoad` is still too early on Android for the local mock fallback image, whose `onLoad` fires before the native bitmap actually composites.
**Fix:** each pin owns its own `tracksViewChanges` state — starts `true`, flips `false` on a **deferred** timer (~250ms) after the image's `onLoad`, plus a mount fallback timer (~1000ms) in case `onLoad` never fires, and re-enables for ~500ms on selection change (cached images don't re-fire `onLoad`, so a timer is the only settle signal). All freeze triggers funnel through one `scheduleFreeze(delay)` sharing a single timer ref. A bare `<Marker>` with no custom child needs none of this. Only verifiable on a real device.
`apps/native/components/MapEventMarker.tsx` · `apps/native/components/MapClusterMarker.tsx` · Asana 1215278396247528, 1215453288289175

### IP geolocation fallback: prefer Vercel's geo headers over ipapi.co

**Symptom:** "IP fallback works sometimes, fails sometimes" — intermittency tracks recent traffic, not any particular input.
**Cause:** `GET /location/ip` proxied every lookup through the ipapi.co free tier, which rate-limits **per caller IP** — since the call is server-side, all users share one egress IP and exhaust the quota fast, so ipapi.co returns 429 and the server silently drops the user to the Ireland default.
**Fix:** the server runs on Vercel, whose edge injects `x-vercel-ip-latitude` / `x-vercel-ip-longitude` / `x-vercel-ip-city` / `x-vercel-ip-country-region` on every request for free with no rate limit — read those first (guard against empty-string coords, since `Number('')===0` would geolocate to null island). ipapi.co stays only as a local-dev fallback when the headers are absent.
`apps/server/src/routes/location.ts` · Asana 1215955442479699

## Media/posts/feed

### Media/video upload must stream via `expo-file-system`, not `fetch().blob()`

**Symptom:** post creation with a video or large image fails on Android with a bare "Network request failed"; iOS is unaffected, so it looks intermittent.
**Cause:** the old upload path did `const blob = await (await fetch(uri)).blob()` — loading the entire file into JS memory — which reliably OOMs on Android for large files.
**Fix:** stream from the file URI with `expo-file-system/legacy`'s `createUploadTask(url, uri, { httpMethod:'PUT', uploadType: FileSystemUploadType.BINARY_CONTENT, headers })`, keeping memory flat and giving real progress. The S3 PUT must send the exact signed `Content-Type` header; the Mux PUT sends none. The video size cap (`MAX_VIDEO_BYTES = 100MB`) lives once in shared — a stale local 500MB constant previously let oversized videos slip past the UI guard and die in the old blob path. Guards fire twice (pick-time toast + upload-time defense-in-depth) because `expo-image-picker` sometimes omits `fileSize`.
`packages/shared/src/validators/uploads.ts` · `apps/native/hooks/use-video-upload.ts` · Asana 1216260009179370

### Deleting a post needs a shared tombstone Set — `mergePaginatedEvents` can't express removals

**Symptom:** deleting a post as its creator leaves it visible (with a dead action menu) on the feed and profile Posts tab until the app restarts.
**Cause:** the feed/profile hooks render from local `accumulated` state, not React Query `data` directly, so invalidating the query cache alone doesn't remove an already-rendered row. `mergePaginatedEvents` (used for events) handles in-place **edits** via a page-0 replace but has no path for a **removal** at offset>0 — append-only merge can't express "this row is gone."
**Fix:** a shared tombstone `Set` in the query cache (`['deletedPostIds']`, staleTime/gcTime Infinity, `structuralSharing:false` since a Set isn't a plain object). `markPostDeleted` must return a **new** Set — mutating in place keeps the same reference and React Query skips the re-render. Every list hook filters `accumulated` through the shared tombstone before rendering, so one delete re-renders every surface at once, any offset, no scroll reset. A future post-list surface is covered automatically as long as it uses the shared filter.
`apps/native/hooks/use-deleted-posts.ts` · Asana 1215648551893069

### Paginated event-list hooks shadow the query cache — in-place edits go stale until restart

**Symptom:** editing an event's cover image, title, or date (keeping the list's length and order unchanged) shows a success toast, but the old value is still shown in list views until the app restarts.
**Cause:** `use-my-events`, `use-saved-events`, `use-confirmed-events`, `use-feed-events` all keep a local `accumulatedEvents` state for infinite scroll that shadows the React Query cache. The original sync only copied fresh data in when the list's length or first-item id changed, so a same-shape in-place edit reached the cache but was never rendered — and pull-to-refresh missed it too, since two hook instances share one cache and the rendering instance's guard still dropped the update.
**Fix:** the shared pure helper `mergePaginatedEvents` — offset 0 always returns the incoming page, offset>0 appends once, else returns null. Any new accumulating/paginated list hook must use it, never a hand-rolled length/first-id guard.
`apps/native/hooks/merge-paginated-events.ts` · Asana 1215616249996652

### Reels-style post video needs its own FlatList — do not convert the shared `.map()` list

**Symptom:** n/a (design note, not a bug) — relevant if you're asked to add viewport-gated autoplay to another posts surface.
**Cause:** `PostsList.tsx` is a plain `.map()` shared by four screens, three of which nest it inside a `ScrollView` with header content; converting it to a `FlatList` for viewport autoplay would trip nested-VirtualizedList breakage.
**Fix:** the Discover Posts tab uses a dedicated `FeedPostsList.tsx` (a real FlatList with `onViewableItemsChanged`, 60% threshold, first-viewable-video-wins) while `PostsList` stays map-based everywhere else (tap-to-play only). `PostCard`/`PostVideo` take an optional `active?: boolean` — undefined on non-feed surfaces means tap-to-play. No new native dependency; reuses `expo-video`, so this is OTA-shippable.
`apps/native/components/posts/FeedPostsList.tsx` · `apps/native/components/posts/PostsList.tsx` · `apps/native/components/posts/PostVideo.tsx` · Asana 1215360225016098

## Notifications & deep-linking

### Notification `routeTemplate` must use fully-qualified Expo Router group paths

**Symptom:** tapping a push notification or an inbox item shows "Page Not Found" instead of navigating to the target screen.
**Cause:** the app's routes are Expo Router **Typed Routes** navigated everywhere with fully-qualified group paths (e.g. `/(app)/(tabs)/discover/event/:id`). A bare path like `/events/:id` has no matching screen and falls through to `+not-found`. The route is decided server-side at notification-creation time and persisted on the row — the client can't assume it matches the current route tree.
**Fix:** new triggers must use `/(app)/(tabs)/...` form in `routeTemplate`. `resolveNotificationRoute(route): Href` remaps legacy/bare/unknown routes to a real screen (fallback = discover, never a 404), which also recovers already-persisted bad rows without a DB migration. Both tap surfaces — the in-app inbox and the FCM push handler (foreground/background/cold-start) — must route through this same resolver; adding a new screen target means extending the resolver too.
`packages/shared/src/notifications/triggers.ts` · `apps/native/lib/notification-route.ts` · `apps/native/app/(app)/notifications.tsx` · `apps/native/hooks/use-fcm-registration.ts` · Asana 1215279003641211

### Notification copy lives in `@CeolX/shared`, never inline in a router

**Symptom:** none yet observed as a live bug — this is a standing rule to prevent one: push/email copy silently drifting from the PM-audited notification matrix.
**Cause:** inline title/body strings in a router make copy changes invisible to review and impossible to keep in lockstep across surfaces (push, in-app, and email all need to render the same trigger).
**Fix:** every notification trigger's title/body/persona/route comes from a typed builder function in `packages/shared/src/notifications/`, keyed to the M7-T0 Notifications Matrix row IDs (e.g. A-09, V-09). Routers and webhook handlers call the builder — they never write the strings inline. If the matrix doesn't have a row yet for a new trigger, add one and flag it for Pratiksha's audit.
`packages/shared/src/notifications/triggers.ts` · `docs/project-management/M7-Notifications-Emails/M7-T0-Notifications-Matrix.xlsx`

## Events & bookings

### `status='archived'` uniquely means creator-deleted — filter it out of every new listing query

**Symptom:** a deleted event still appears on a venue/artist profile, in a collection, or anywhere else that lists events.
**Cause:** the user-facing "Delete" button maps to the `events.archive` mutation, which is the **only** writer of `status='archived'` — there is no auto-archive cron. A naturally-past event stays `status='active'` with an elapsed `dateStart`; "Past Events" is purely a date filter, not a status. So `'archived'` literally means "the creator deleted this," not "this event happened already" (contrary to older PRD wording).
**Fix:** any new event-listing query must filter to `status='active'` (or at minimum exclude `archived`) — never `inArray(status, ['active','archived'])`. This bit twice: venue/artist profile queries were including archived events as "past," and a collection's owner-view query returned all statuses so an owner still saw their own deleted events inside collection management.
`packages/api/src/routers/venues.ts` · `packages/api/src/routers/artists.ts` · `packages/api/src/routers/collections.ts` · `packages/api/src/__tests__/collection-byid-archived.test.ts` · Asana 1216029058657584

### Clearing an optional field on Edit Event needs client `null` + a `.nullable()` schema — not `undefined`

**Symptom:** clearing an optional field (ticket price/link, ad title/description) on Edit Event shows a success toast, but the old value comes right back.
**Cause:** a three-link chain all assumed `undefined` means "don't touch this field": the client built cleared fields as `undefined` (dropped over the wire), the shared Zod schema only had `.optional()` (not `.nullable()`, so even a `null` would have been rejected), and the server's `update` builder only sets a field `if (updateData.X !== undefined)` — an absent key leaves the old DB value untouched. Setting a _new_ value always worked; only clearing failed.
**Fix:** the four affected fields became `.optional().nullable()` in the schema, and the client sends `null` (not `undefined`) for a cleared field (`x.trim() || null`). Still unfixed at last check and same bug class if reported: `venueAddress`, `collectionId`, `coverImage` in the same payload still use `|| undefined`.
`packages/shared/src/validators/events.ts` · `apps/native/hooks/use-event-form.ts` · `packages/api/src/routers/events/crud.ts` · `packages/api/src/__tests__/event-venue-approval.test.ts` · Asana 1216070978559447

### Event-form cross-field rules must exist in both the per-step validator and the shared Zod schema

**Symptom:** a validation error (e.g. end time before start time) only surfaces after tapping Submit, and lands the user on the wrong wizard step instead of the field that's actually wrong.
**Cause:** the event wizard has two validation layers — a per-field/step system driving live UX and the "Continue" gate, and the shared `createEventSchema` Zod refine as the final submit-time check. A cross-field rule placed only in the Zod schema can never surface inline, because the step gates never evaluate it; the schema's error also keyed to a field the UI doesn't render (`dateEnd`, which has no picker — it defaults to `dateStart`), and `handleSubmit` hardcoded navigation to step 1 regardless of which step actually owned the failing field.
**Fix:** mirror any cross-field rule into the per-field system (`fieldError`, `validateStepN`), keyed to a field the step actually renders, and keep the Zod refine as server-side defense only. `handleSubmit`'s Zod fallback uses a `FIELD_STEP` map to navigate to the earliest failing step, remapping schema keys to their display field where they differ (`dateEnd` → `endTime`).
`apps/native/hooks/use-event-form.ts` · `apps/native/hooks/use-event-form.utils.ts` · `packages/shared/src/validators/events.ts`

### Booking accept/apply/resend on a past event must be explicitly guarded — `isEventPast`, not status

**Symptom:** a booking or performance request could be accepted for an event whose date had already passed.
**Cause:** a past event keeps `status='active'` (only creator-deletion and admin-removal change status), so any guard that only checks for archived/removed status never catches it.
**Fix:** all three booking entry points (`bookings.update` accept, `bookings.requestToPerform`, `bookings.resend`) throw a BAD_REQUEST via `isEventPast(event.dateStart.toISOString())` — reject/withdraw/cancel stay allowed so stale pending rows can still be cleared. `isEventPast` lives once in shared and is `dateStart`-based (ignores `dateEnd`, matching the codebase's Collections "upcoming" semantics). **Test gotcha:** `packages/api` fixtures hard-code event dates that can silently be in the past relative to the real wall clock — any new `isEventPast`/`Date.now()`-based guard can flip previously-green "happy path" accept tests red. Pin the clock in `beforeEach` with `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime(<before the fixture date>)`, and restore in `afterEach`. The pre-commit `vitest related` hook pulls in sibling suites, so run the full `@CeolX/api` project suite when adding a new time-based guard.
`packages/shared/src/utils/date.ts` (`isEventPast`) · `packages/api/src/routers/bookings.ts` · `packages/api/src/__tests__/bookings.test.ts` · Asana 1216289483780968

### Any toggle mutation (save/join/follow) must patch the `byId` detail cache, not just list caches

**Symptom:** reopening a saved event from the Saved tab shows an empty bookmark; unsaving from the detail screen needs an extra tap to register.
**Cause:** two stacked bugs. The save mutation optimistically patched and invalidated only the feed and saved-events list queries, never `events.byId` — so the detail screen's cache stayed stale after a save. Separately, the detail view did `const [isSaved] = useState(event.isSaved)` — a derived-state-from-props anti-pattern that seeds once on mount and never re-syncs on refetch, so even a correct background refetch couldn't fix the icon, and the wrong baseline made every subsequent tap off-by-one.
**Fix:** shared helpers patch the feed cache AND the `byId` cache together on `onMutate`/`onError`/`onSettled`; the detail view derives `isSaved = event.isSaved` directly from the query, no `useState`. Rule: any toggle mutation affecting a detail screen must patch/invalidate the `byId` cache too, and detail views must never snapshot toggle state into local state — the query cache is the single source of truth.
`apps/native/hooks/save-event-cache.ts` · `apps/native/components/event-detail/EventDetailView.tsx` · Asana 1216024548331967

### Collections show upcoming events only — exclude both past-active and deleted-archived, and check the filter layer

**Symptom:** a past or deleted event still appears inside a Collection.
**Cause:** two independent leaks. "Upcoming" (`dateStart >= now`, matching the discovery feed's own date filter — `dateEnd` is deliberately ignored so a festival drops off the moment it starts) had no date filter at all in `collections.byId`. And the "Explore the collection" related-events preview on the event-detail screen is built by a **separate** query inside `events.byId` (not `collections.byId`) that only filtered `status=ACTIVE`, missing the date check.
**Fix:** `collections.byId` filters in **JS** after the fetch (the `byId` tests mock `db.query.collections.findFirst` to return a static array, so a SQL-level filter would be invisible to them — a fake-test trap). The `relatedEvents` preview inside `events.byId`, by contrast, filters in **SQL** because it has a `limit: 5` — a JS post-filter there would let past rows eat the 5 slots before being dropped, so there's deliberately no unit test for that one (writing a mock-DB test for it would itself be a fake test). If asked to change collection visibility rules, check both call sites, not just `collections.byId`.
`packages/api/src/routers/collections.ts` · `packages/api/src/routers/events/crud.ts` · `packages/api/src/__tests__/collection-byid-upcoming.test.ts` · Asana 1216029058776470, 1216297161493463

### Following count and Following list can silently disagree — SQL `WHERE` divergence is invisible to mock-DB tests

**Symptom:** profile shows "Following 6" but the Following list only renders 5 rows.
**Cause:** the list (`follows.getFollowing`) filters per-row to followees with an _active_ artist or venue profile and excludes self-follows; the count sites were raw `count(*)`, so they overcounted deleted/downgraded/inactive-subscription/legacy self-follow rows. `packages/api` tests fully mock the DB boundary (canned `[{count:N}]` results), so a SQL `WHERE` clause difference between the count and the list is invisible to unit tests — a mock-based "count excludes inactive" test would pass on the broken code too.
**Fix:** both count sites now apply the same EXISTS-based active-profile filter the list uses. Followers intentionally stays a raw count (its list already renders every follower unfiltered, so they already match). Verify any follow-count SQL change against a real DB, not vitest — there's no pglite/pg-mem test infra for this. See also DB & data-modeling for the shared root cause (`status='archived'` visibility rule).
`packages/api/src/routers/_profile-helpers.ts` · `packages/api/src/routers/follows.ts` (or the router owning `getFollowing`) · Asana 1216029059011258

### `KeyboardAvoidingView behavior="height"` inside a Modal flickers on Android — use `"padding"` everywhere

**Symptom:** a Modal-based picker with a text input (collection picker, invite picker) flickers and blocks input when the keyboard opens — reproduces on some Android devices/OS versions and not others, so it gets closed as unreproducible and then reopens.
**Cause:** an RN `<Modal>` is a separate native window subject to the activity's `windowSoftInputMode="adjustResize"`. When the keyboard opens, the OS resizes the window AND `behavior="height"` shrinks the KAV child by the keyboard height — the double-correction over-shoots and the layout oscillates. `autoFocus` on the input makes it fire immediately and worsens it.
**Fix:** use `behavior="padding"` on both platforms (not `iOS ? 'padding' : 'height'`) for any Modal-based picker with a text input, and avoid `autoFocus`. `InviteArtistPicker` is the proven-good reference implementation.
`apps/native/components/events/CollectionPicker.tsx` · `apps/native/components/events/InviteArtistPicker.tsx` · Asana 1215453204049374

### Avatars have two source columns — `user.image` (OAuth-only) vs profile `profileImageUrl` (uploaded)

**Symptom:** a venue or artist who signed up by email and uploaded a profile picture shows the placeholder avatar on event detail, booking cards, or collaborator lists — while the same accounts on social login (which have `user.image`) render fine.
**Cause:** `user.image` (BetterAuth) is only populated for Google/Apple social logins; the actually-uploaded profile picture lives in `artist_profiles.profile_image_url` / `venue_profiles.profile_image_url`. Several routers read `user.image` directly instead of the profile column, even though the full profile row was already loaded.
**Fix:** always resolve via `resolveProfileImageUrl(profileRow, userImage)` (uploaded pic wins, OAuth image is the fallback) or `hydrateAuthors` for posts — never `user.image` alone. This exact bug recurred in a second router months after the first fix (`bookings.ts`'s four `BookingSummary` build sites), so when fixing this class of bug, grep the whole API for `.image ?? undefined` / `imageMap.get` rather than trusting the first fix caught every site.
`packages/api/src/routers/events/helpers.ts` (`resolveProfileImageUrl`) · `packages/api/src/routers/posts/hydrate.ts` · `packages/api/src/routers/bookings.ts` · Asana 1215429148917917, 1215717732246912

### Artist search matches stage name OR account name, and requires auth

**Symptom:** an artist registered under their real name with a different stage/band name is unfindable in the Invite Artist picker when a venue searches by stage name (or vice versa).
**Cause:** three name touchpoints (account `user.name`, onboarding `stage_name`, profile display) used to be fully disconnected.
**Fix:** onboarding pre-fills `stageName` from `user.name` once (not a live sync — overridable for a band, and renaming the account later does not rewrite the profile). `artists.search` matches `stage_name` OR `user.name` and returns both so the UI can show `"Tune Bomb · Vivek"` when they differ. `artists.search` was also changed from a public to a `protectedProcedure` — it exposes personal data (account name), so only authenticated venues can use it. Venue onboarding intentionally does not get the same pre-fill (business name ≠ person name).
`packages/api/src/routers/artists.ts` · `apps/native/hooks/use-artist-onboarding.utils.ts` · Asana (PR #90, 2026-06-03)

### Venue location is a mandatory map pin — never a free-text address field

**Symptom:** n/a (design constraint) — relevant if asked to "simplify" venue location to a text field, or if event creation's inline map logic diverges from venue onboarding's.
**Cause:** the map, event creation, and navigation/directions all consume `lat`/`lng` directly; a typed address alone can't drive any of them. The address string shown to users is only a display label _derived from_ the pin (search result or reverse geocode, falling back to a coordinate string so the NOT-NULL `address` column is always satisfied).
**Fix:** use the shared `LocationPicker` component (search + draggable marker + geocode/reverse-geocode, Ireland default 53.1424/-7.6921) for venue onboarding and profile edit. `venue_profiles.lat/lng` are Drizzle `numeric` columns and come back from the DB as **strings** — convert at the API boundary (`users.me` does `Number(profile.lat)`). Venues onboarded before this change have NULL coordinates and start unpinned on edit.
`apps/native/components/LocationPicker.tsx` · Asana 1215189503785055

## Email

### Most of the notification matrix's emails were never implemented — check the matrix before assuming Postmark is broken

**Symptom:** a specific notification-triggered email (booking invite, GDPR notice, subscription-failure notice) is never received, with nothing in the logs pointing to a delivery failure.
**Cause:** the M7-T0 matrix specs 38 V1 emails, but the only build task (M7-T3) implemented just 6: verification, password-reset, venue-activation, payment-confirmation, event-approved, event-rejected. The `EmailTemplate` union is constrained to those 6, so nothing else can be dispatched — this is a scope gap, not a delivery bug.
**Fix / how to extend:** there are two dispatch paths — auth emails (verification/reset) fire synchronously inside BetterAuth via `sendVerificationEmail`/`sendPasswordResetEmail`; everything else goes through `publishJob('email.send')` → QStash → `handleEmailSend`. Booking rows already call `ctx.dispatchNotification`, which currently only fans out to push + inbox — adding email there (publish `email.send` when `trigger.email !== null`) plus filling the reserved `email` copy in `triggers.ts` closes most of the gap with zero router edits. Email-only rows (payment-failed, GDPR) must NOT go through `dispatchNotification`, since it always writes an inbox row too. Precondition for any email to send at all: `POSTMARK_API_TOKEN` set and `POSTMARK_FROM_ADDRESS` a Postmark-verified sender — if unset and `env !== "production"`, the transport silently routes to `localhost:1025` SMTP. Remaining scope is tracked in `docs/project-management/M7-Notifications-Emails/M7-T4-Remaining-Matrix-Emails.md`.
`packages/email/src/types.ts` · `packages/shared/src/notifications/triggers.ts` · `apps/server/src/services/notifications-dispatcher.ts` · `apps/server/src/jobs/handlers/email.ts` · Asana 1215700058851994

### A "built and tested" invite-email feature can still be dead — check which procedure the UI actually calls

**Symptom:** an external (non-platform) artist invited to an event never receives the invite email, with no errors anywhere.
**Cause:** the token-generation and email-send logic was built inside `bookings.inviteExternal`, which has **zero callers** in the native or admin app. The event form actually submits external invitees through `unregisteredCollaborators[]` inside `events.create`/`events.update` — a completely separate code path that saved the DB row but never generated a token or sent an email.
**Fix:** the token + email logic was ported into the `unregisteredCollaborators` branches of `events.create`/`events.update`. `events.update` must only email **newly-added** invitees — the form resubmits the full invite list on every edit, so the diff-by-email-against-existing-rows step (preserving existing tokens) is load-bearing; without it, every edit would re-spam every previously-invited person. Emails are canonicalized to lowercase to match the signup claim flow. `bookings.inviteExternal` is left in place, still tested, and still dead — don't assume "has a test" means "is reachable." When a feature is reported broken despite being "built and tested," check whether the procedure carrying the logic is the one the UI calls.
`packages/api/src/routers/events/crud.ts` · `packages/api/src/__tests__/event-invite-email.test.ts` · Asana 1215700058851994 (M7-T4, A-14)

## Builds & EAS

### `fingerprint.config.cjs` must be `.cjs`, not `.js`, or the version-skip config silently becomes `{}`

**Symptom:** every `pnpm release` version bump drifts the EAS fingerprint / `runtimeVersion` hash, orphaning already-installed field binaries from future OTA updates — even though a skip config exists to prevent exactly this.
**Cause:** `apps/native/package.json` has `"type": "module"`, so a `fingerprint.config.js` file is ESM. `@expo/fingerprint`'s config loader does `try { require(configFile) } catch { rawConfig = {} }` — `require()` of an ESM file throws `ERR_REQUIRE_ESM`, which is silently swallowed, and the intended `sourceSkips` (which strip `version`/`versionCode`/`buildNumber` from the hash) never apply.
**Fix:** the file must be `apps/native/fingerprint.config.cjs` (CommonJS, so `require()` works). With the skip correctly applied, reading `version` via `require('./package.json')` in `app.config.js` is safe. Verify with `pnpm mobile:release-check` / `eas fingerprint:compare` per environment before releasing — it tells you OTA-compatible vs new-binary-required. Keep this file, `app.config.js`, and `apps/native/scripts/*.cjs` in the ESLint ignore list.
`apps/native/fingerprint.config.cjs` · `apps/native/app.config.js`

### EAS build "frozen-lockfile exited with code 1" can be a Node-version floor, not a lockfile problem

**Symptom:** `pnpm build:dev:android` (or any EAS build) fails during dependency install with `pnpm install --frozen-lockfile exited with non-zero code: 1`, even though the same frozen install passes locally.
**Cause:** bumping the `packageManager` field's pnpm version (e.g. to `pnpm@11.8.0`) is honored by EAS via corepack, but a newer pnpm can require a higher Node floor than the EAS build image ships by default (pnpm 11.8 needs Node ≥22.13) — the child pnpm process crashes with `ERR_UNKNOWN_BUILTIN_MODULE` before it ever evaluates the lockfile. It passes locally only because the local machine happens to run a Node version above the floor.
**Fix:** whenever bumping the `packageManager` pnpm version, check its Node floor and pin a matching `"node"` per build profile in `apps/native/eas.json`. To get the real underlying error (not the misleading "frozen-lockfile" wrapper text), fetch `eas build:view <id> --json` → `logFiles[0]` — the log is brotli-compressed and needs `zlib.brotliDecompressSync` to read.
`apps/native/eas.json`

### `pnpm install --frozen-lockfile` after any lockfile change, before chasing a fingerprint mismatch

**Symptom:** EAS reports a `runtimeVersion` fingerprint mismatch with no `app.config.js` changes in sight; the diff is dominated by `.pnpm/<package>@<version>_<hashA>/` vs `_<hashB>/` swaps of the _same_ package/version.
**Cause:** EAS's fingerprint hashes the physical `node_modules/.pnpm/<hash>/` directory paths, which encode a content hash of the resolved peer-deps tuple. EAS always runs `pnpm install --frozen-lockfile` against the committed lockfile; if local `node_modules` was installed against an older lockfile, the local directory names differ from what EAS produces, even though lint/types/tests/runtime all still pass locally.
**Fix:** run `pnpm install --frozen-lockfile` (the exact command EAS runs) before investigating anything else, then re-verify with `npx @expo/fingerprint fingerprint:generate` from `apps/native/`. Don't blame `app.config.js` when the diff signature is "same package, different `.pnpm` hash directory."
`apps/native/pnpm-lock.yaml`

### `@t3-oss/env-core`'s `runtimeEnv` must enumerate each `EXPO_PUBLIC_*` key statically

**Symptom:** an `EXPO_PUBLIC_*` variable is confirmed present in the EAS build logs, yet the production app throws "Invalid environment variables" or silently behaves as if the variable were unset — searching the bundled JS for the value returns nothing, even though a different, direct `process.env.X` access elsewhere in the code _does_ have its value inlined.
**Cause:** babel-preset-expo's inline-env-vars transform only rewrites **static** `process.env.EXPO_PUBLIC_X` references at build time. `@t3-oss/env-core` reads `runtimeEnv[key]` dynamically inside `createEnv`, which babel can't follow — if `runtimeEnv` is passed `process.env` directly, every value is `{}` at runtime in the bundle and the validator sees everything as undefined.
**Fix:** `packages/env/src/native.ts` must list each variable explicitly as `EXPO_PUBLIC_X: process.env.EXPO_PUBLIC_X` in `runtimeEnv`. When adding a new `EXPO_PUBLIC_*` var, update both the schema and this `runtimeEnv` object — forgetting the latter leaves the value undefined at runtime even though it's set correctly in EAS. This is specific to the native (Metro-bundled) env; `packages/env/src/web.ts` (Vite) and `packages/env/src/server.ts` (real Node `process.env`) are unaffected.
`packages/env/src/native.ts`

### EAS Cloud builds never see local `.env.*` files — `EXPO_PUBLIC_*` vars must come from `eas.json`/EAS dashboard

**Symptom:** an EAS-built app crashes at JS startup on-device with `[Error: Invalid environment variables]`, even though the corresponding `.env.staging`/`.env.production` file looks correct locally.
**Cause:** the plaintext `.env.*` files are gitignored (encrypted via envx into `.env.*.gpg`), so EAS Cloud builds — which build from GitHub source only — never see them. Compounding this, EAS sets `NODE_ENV=production` for **every** build profile (staging, production, preview), and Expo's env auto-loader only picks `.env.{NODE_ENV}` — so `.env.staging` would never load even if it existed on the build machine. `APP_VARIANT=staging` only switches the bundle ID, not which env file loads.
**Fix:** required `EXPO_PUBLIC_*` vars must come from the `eas.json` profile's `env` block (fine for non-secrets, since it's committed) or EAS dashboard env vars (`eas env:create --environment <preview|production>` — note the `staging` profile has no `environment` key and defaults to `preview`). When renaming or adding an `EXPO_PUBLIC_*` var, update both the local `.env.*` files (for `pnpm dev`) and the EAS-side source, or the next build crashes silently on launch.
`apps/native/eas.json` · `packages/env/src/native.ts`

### `metro.config.cjs` must keep `EXPO_NO_METRO_WORKSPACE_ROOT` pinned, without disabling hierarchical lookup

**Symptom:** `expo export:embed --eager` (and therefore Gradle's release bundle task, which calls the same command internally) crashes with `invariant(parentNode === this.#rootNode, 'Unexpectedly escaped traversal')`.
**Cause:** Expo SDK 55's default `getMetroServerRoot` points `server.unstable_serverRoot` at the pnpm workspace root rather than the app's project root; Metro's path-normalization then walks past its own root node while resolving the entry file inside a pnpm monorepo, tripping an internal invariant. This is unrelated to workspace symlinks, which was an earlier (wrong) diagnosis.
**Fix:** keep four pieces together in `metro.config.cjs`: `process.env.EXPO_NO_METRO_WORKSPACE_ROOT = '1'` set **before** `getDefaultConfig(__dirname)`; manual `watchFolders`/`resolver.nodeModulesPaths` pointing at both the project and workspace roots; do **not** set `disableHierarchicalLookup` (pnpm's isolated `node_modules/.pnpm/<hash>/node_modules/` layout needs the walk-up to resolve peer deps); and the `isEagerEmbed` bypass that skips the Sentry Metro serializer during `export:embed` (a separate crash in `@sentry/react-native`'s debug-id injection). Removing any one of the four silently breaks EAS builds while `expo start` keeps working, which delays discovery.
`apps/native/metro.config.cjs`

### FCM on iOS needs `use_modular_headers!` injected into the Podfile on every prebuild

**Symptom:** `pod install` (or a fresh `expo prebuild`) fails with `"The Swift pod FirebaseCoreInternal depends upon GoogleUtilities, which does not define modules."`
**Cause:** `@react-native-firebase/app` pulls in the Swift `FirebaseCoreInternal`, which depends on the non-modular Objective-C `GoogleUtilities` pod. Static-library iOS builds need module maps for Swift to import that dependency, and CocoaPods doesn't generate them by default.
**Fix:** a `withDangerousMod` config plugin injects `use_modular_headers!` into `ios/Podfile` right after `use_expo_modules!`; it's idempotent (marker-comment guarded) and survives `prebuild --clean`. If iOS pod install starts failing again with a similar Swift/non-modular error, check first that this plugin is still registered and that its marker comment is actually present in the generated Podfile. Note: `use_frameworks! :linkage => :static` was tried as an alternative and rejected — it broke the prebuilt React-Core xcframework (see the FCM revert note below).
`apps/native/plugins/with-modular-headers.cjs` · `apps/native/app.config.js`

### FCM is fully active on `development`/production — do not resurrect the old revert branch

**Symptom:** `pnpm -F native ios` fails with `"include of non-modular header inside framework module 'RNFBApp...'"`.
**Cause:** `@react-native-firebase` needs `use_frameworks! :linkage => :static`, but this RN version ships `React-Core` as a prebuilt xcframework (`RCT_USE_PREBUILT_RNCORE=1`), which isn't modular-header compatible — it can't be imported from a framework module. A partial FCM revert was once prepared on a branch to work around this but **was never merged**; `development` and production run the full FCM push stack (inbox + per-user state + QStash-fanned push + token cleanup).
**Fix:** if this exact iOS build error recurs, add `ios.buildReactNativeFromSource: true` to the `expo-build-properties` plugin block, which forces React-Core to compile from source as a proper modular framework (slower first pod install, ~5–10 min). Do not propose reverting FCM — it's load-bearing for moderation, bookings, and event notifications, all live in production.
`apps/native/app.config.js`

### "Add to Calendar" and other native-module features ship only via a fresh EAS build, never OTA

**Symptom:** a feature that touches a native module (calendar write access, an Android intent, a new native SDK) appears to "not be fixed" for testers even after multiple `eas update` pushes.
**Cause:** `eas update` (OTA) only ships JS/asset changes. "Add to Calendar" was rewritten from a web deep link to native `expo-calendar` (permission request → resolve/create a writable calendar → `createEventAsync`), which needs the `expo-calendar` config plugin, iOS usage strings (including the iOS 17 full-access key), and Android `READ_CALENDAR`/`WRITE_CALENDAR` permissions — none of which an OTA update can deliver, since they require a new native binary.
**Fix:** any change that touches a config plugin, native permission, or native module requires a fresh EAS build (bumping the fingerprint/runtimeVersion), not an OTA push. Same class of issue as the Android email-intent gotcha above — if a native-surface bug "won't die" after repeated OTA pushes, verify a real build actually shipped before debugging the code further.
`apps/native/hooks/use-add-to-calendar.ts` · `apps/native/app.config.js`

### `server#check-types` is a known-red gate — the real type gate is `turbo build`, and its cache can hide errors

**Symptom:** a genuine TypeScript exhaustiveness error (e.g. a new enum value not handled in a `Record<T, ...>`) ships through review because `pnpm --filter server check-types` reported PASS.
**Cause:** `server#check-types` (`tsc -b`) is already red on `development` — every `.tsx` email template under `packages/email` throws `TS2875` because the server's tsconfig resolves the wrong JSX runtime when type-checking `hono/jsx` templates from outside `packages/email`. So this check can never be trusted as a green/red signal. Separately, `tsc -b`'s incremental build cache (`.tsbuildinfo`) can report PASS locally while a clean build actually fails.
**Fix:** treat `turbo build` (tsdown/rolldown — bundles, does not full-type-check) as the real pre-push/CI gate, and know it does NOT catch exhaustiveness errors either — a missing case in a discriminated union can slip through both. To force a true type check, delete `*.tsbuildinfo` and run `pnpm exec turbo run check-types --filter=server --force`, then grep for the specific error code you're chasing (unrelated `TS2875` noise will still be there). The server's package name is `server`, not `@CeolX/server` — `turbo --filter=@CeolX/server` matches zero packages and exits non-zero (looks like failure, isn't); `pnpm --filter` is more lenient but `turbo --filter` is strict.
`apps/server` (package name `server`) · `packages/email`

### Validating a staging build locally: pass `-scheme CeolXStaging` explicitly

**Symptom:** a local pre-flight iOS build reports `** BUILD SUCCEEDED **` even though the actual app target was never compiled.
**Cause:** `xcodebuild -list` returns schemes alphabetically, and for the staging workspace `schemes[0]` is `AppAuth` — a transitive pod, not the app. Building "the first scheme" gives a false-positive green build.
**Fix:** always pass `-scheme CeolXStaging` explicitly against `ios/CeolXStaging.xcworkspace`, with `CODE_SIGNING_ALLOWED=NO` for a no-credentials simulator build. On Android, `APP_VARIANT=staging npx expo prebuild --platform android --clean && cd android && ./gradlew :app:assembleDebug` validates config plugins and native linking without release signing. This validates native compile/link only — it does not exercise release-config signing, R8/minify, or iOS device codesigning.
`apps/native` (workspace: `ios/CeolXStaging.xcworkspace`, scheme: `CeolXStaging`)

## Deploy & infra

### Vercel is connected to the `client` remote only — push staging/main to both remotes

**Symptom:** after pushing `staging` or `main`, `vercel ls` still shows the old deployment as latest — the push appears to silently do nothing.
**Cause:** the repo has two GitHub remotes — `raftlabs` (agency working copy, where PRs and review happen) and `client` (client-owned repo). Vercel is connected only to `client`; pushes to `raftlabs` alone never trigger a webhook, so no deployment is created.
**Fix:** when pushing `staging` or `main` (the only two branches Vercel builds), push to both: `git push raftlabs staging && git push client staging`. Feature/fix branches only need `raftlabs` — Vercel's `ignoreCommand` skips non-staging/main branches anyway.
`apps/server/vercel.json`

### Hono on Vercel: `export default app` directly — `handle()` from `hono/vercel` silently breaks routing

**Symptom:** every route 404s except the exact path the Vercel rewrite target points at (e.g. only `/api` works; `/health`, `/trpc/*` all 404).
**Cause:** Vercel picks its serverless runtime mode based on the shape of the default export. `handle()` from `hono/vercel` wraps the Hono app in a Node-style `(req, res)` adapter, which forces Vercel's **legacy Node runtime** — in that mode, `Request.url` is _replaced_ with the rewrite destination on every request, so Hono only ever sees the rewrite target path, never the caller-facing path. Exporting the Hono app directly (a fetch-handler shape) makes Vercel use the modern Web-Standard runtime, where `Request.url` is preserved across rewrites.
**Fix:** the Vercel entry point must be a single re-export of the Hono app default (`export default app`), never wrapped in `handle()`. This is the Raftlabs convention across projects, not CeolX-specific, but the official Hono docs lean on `handle()` because their canonical example is Next.js — don't follow that example for a plain Vercel function.
`apps/server/src/vercel-entry.ts`

### `.env.*.gpg` merge conflicts must be resolved by re-encrypting plaintext, never by merging ciphertext

**Symptom:** every PR that touches env vars on two branches conflicts on `.env.*.gpg`, even when the underlying plaintext values don't actually conflict.
**Cause:** envx encryption is non-deterministic, so ciphertext diverges between branches even for identical plaintext — a line-level merge of the `.gpg` file is meaningless.
**Fix:** decrypt to the correct local plaintext, then re-encrypt for one specific environment only: `npx envx encrypt -e staging --overwrite` (never `--all`, which would clobber prod). Before trusting "local is correct," key-diff the variable **names** in local plaintext against both `git show :2:...gpg` (ours) and `:3:...gpg` (theirs) — decrypting each side separately — because encryption hides silently-dropped variables from a normal `git status`/diff view. This caught a real incident where a merge silently dropped `GOOGLE_OAUTH_IOS_CLIENT_ID`. Separately: JSON config files like `eas.json` auto-merge silently when a branch restructures keys (e.g. `submit.staging-testflight` → `submit.staging`), which can drop a value (`ascAppId`) with zero conflict markers — always value-check restructured config sections, not just `git status`.
`apps/server/.env.staging.gpg` (and `.env.production.gpg`)

### QStash's 7-day delay cap means long-delayed jobs must use a cron sweep, not a single delayed publish

**Symptom:** a 30-day-delayed job (e.g. GDPR account-anonymization) fails on first submission, then a retry of the same request reports success — but the erasure job never actually runs 30 days later.
**Cause:** QStash's `delay` option is capped at 7 days on the free plan; a `publishJob(..., { delay: '30d' })` call is rejected and throws. The request handler had already committed the DB write for "deletion requested" before the failed publish, so a retry hits an idempotency guard, silently skips the (still-failing) publish, and reports false success — a DB write followed by a fallible external call, gated by an idempotency check between them, makes a partial failure look like a full success on retry.
**Fix:** for any job delayed longer than the plan's cap, don't use a single delayed `publishJob` at all — stamp a `*_scheduled_for` timestamp on the request (no external call on the request path) and process it with a **daily QStash cron sweep** over that timestamp column. New crons are registered in `setup-crons.ts`; re-register after any deploy that adds one. (Note: the `jobs:setup-crons` script the file's doc-comment references does not currently exist in `apps/server/package.json` — use `pnpm --filter server exec tsx src/jobs/setup-crons.ts` until it's added. See 03-ops-runbooks.md § QStash long-delay jobs.)
`apps/server/src/jobs/setup-crons.ts` · Asana 1215276188230541

### Play requires an app-bundle, and "version code already used" means the code didn't bump — not a build-format bug

**Symptom:** `eas submit` to Google Play's internal testing track fails with `Version code N has already been used`.
**Cause:** the `staging` profile had no `autoIncrement`, and `eas.json` uses `appVersionSource: "remote"`, so every build reused the same remote Android `versionCode` (stuck at 1). Play permanently burns a `versionCode` once uploaded, even for a draft or deleted release, so any resubmission under the same code is rejected — this is unrelated to APK vs AAB (Play requires AAB / `buildType: "app-bundle"` for new apps regardless; switching to APK was a real misdiagnosis that was reverted).
**Fix:** `"autoIncrement": true` on the Android staging profile so EAS bumps the remote `versionCode` on every build. `versionCode` (Play's dedup key, an int) is baked in at **build** time, not submit time — fixing this requires a new build, then submit; resubmitting the old artifact under the same code will fail again. Check the current remote code with `eas build:version:get --platform android --profile staging`; it's independent of the marketing `version`/`versionName` string bumped by `pnpm release`.
`apps/native/eas.json`

### Google Play re-signs the app — Maps/Sign-In must authorize against the Play App Signing SHA, not the EAS upload key

**Symptom:** a staging Android build shows a blank map and/or Google Sign-In fails with `DEVELOPER_ERROR` (code 10) — after already registering "the SHA" in the Maps API key and Firebase console.
**Cause:** Play distributes an app-bundle through **Play App Signing**, which re-signs the uploaded `.aab` before it reaches devices. The installed app therefore carries the **Play App Signing certificate**, not the EAS upload key's certificate — but Google APIs (Maps SDK, Sign-In) authorize on (package name + the signing SHA of the app _as installed_), so registering the upload-key SHA (the only one visible locally, e.g. via `keytool -printcert -jarfile app.aab`) does nothing. The correct SHA is visible **only** in Play Console → Test and release → Setup → App integrity → App signing key certificate.
**Fix:** the Play App Signing SHA (per build variant) must be registered in three separate places: the Maps API key's Android restriction list (package + SHA-1), Firebase Console's app fingerprints (SHA-1 and SHA-256, for Sign-In), and the server's `assetlinks.json` (`ANDROID_SHA256_CERT_FINGERPRINT` env var, for App Links). Double-check the package name string carefully when adding these — a correct SHA registered under a typo'd package name fails just as silently as a wrong SHA. None of these three fixes need an app rebuild or OTA (they're server-side Google config); an already-installed build starts working after ~5 minutes propagation plus a force-quit/reopen. Debug with `adb logcat | grep -iE "Google Maps|Authorization"`, which prints the exact package + SHA the SDK expected.
`apps/native/google-services.staging.json` · Asana (Play App Signing checklist)

### A blank Android map is NOT evidence of a SHA problem — the SDK's error is a template

**Symptom:** blank map, and logcat prints `Authorization failure … Ensure that the following Android Key exists: <cert_fingerprint>;<package_name>`. Reads unambiguously like the SHA entry above.
**Cause:** that block is the **only** message the Maps SDK emits for _any_ key-level rejection — API not enabled, billing unlinked, key restriction mismatch. It always prints a fingerprint and a package because those are its template fields, not because the certificate is what failed. On 03/08/2026 this cost an hour: the real cause was `Maps SDK for Android` never being enabled on the `CeolXApp` project, and the map stayed black through a correctly-registered Play App Signing SHA _and_ through Application restrictions being removed entirely.
**Fix:** bisect before touching any SHA. Set the key's Application restrictions to **None**, wait 5 minutes, force-stop and relaunch. Still failing → the certificate was never involved; check API enablement and billing. Now working → it genuinely is the package + SHA row. Faster still, while restrictions are None, `curl` the key against Geocoding — a `200` proves key, project and billing are healthy and narrows the fault to a single API, which the SDK's own message will never tell you.
`docs/ops/google-cloud-api-keys.md` §2, §5, §6 · incident log in that file

### Neon staging auto-migrate CI: never run `db:migrate` through turbo, and it only appears in Actions once it's on `main`

**Symptom (two distinct failures):** either the CI job for a new DB-migration workflow hangs forever with no timeout, or a brand-new `.github/workflows/*.yml` file never shows up in the Actions tab at all after being pushed to `staging`.
**Cause:** `turbo.json` marks `db:migrate` as `persistent: true` (intended for local watch/studio mode) — invoking it through turbo in CI means the process never exits. Separately, GitHub only _lists_ workflow files that exist on the **default branch** (`main` here, even though feature PRs target `development`), and only creates a run/commit-stamp when a trigger actually matches — a first push that only adds the workflow file to `staging` satisfies neither condition.
**Fix:** bypass turbo entirely for the CI migration step — `pnpm --filter @CeolX/db exec drizzle-kit migrate` — and use `migrate` (applies committed SQL deterministically via `__drizzle_migrations`), never `push` (live-diffs and can drop data on a shared DB). Land any new workflow file on `main` as well as `staging`, and add a `workflow_dispatch` trigger for a manual "Run workflow" button (which also reads its definition from the default branch). The `STAGING_DATABASE_URL` secret must be the Neon **direct/unpooled** connection string, and must be set on the `client` remote repo — GitHub Actions read secrets from the repo that runs them.
`.github/workflows/db-migrate-staging.yml`

### Shared post links depend on three separate pieces of live infrastructure being correctly wired

> **Domain note:** the source memory for this feature says `ceolx.ie`, but the live repo (`apps/admin/vercel.json`, `apps/server/src/routes/app-links.ts`, `post-share.ts`) uses **`ceolx.com`** throughout (matching CLAUDE.md's `ceolx.com/subscribe`). This entry uses the on-disk `ceolx.com`; `⚠️ confirm with Priya/Pratiksha that no `.ie` domain/DNS still needs cleanup` (same open item as 04-architecture.md).

**Symptom:** a shared post link (`https://ceolx.com/post/<uuid>`) does nothing when tapped, or opens a browser tab instead of the app, on one environment but not another.
**Cause:** the feature spans a non-obvious domain split — `ceolx.com` root is the **admin** Vite SPA, while `api.ceolx.com` is the **server** (Hono); the admin's `vercel.json` rewrites `/post/*` and `/.well-known/*` (and `/event/*`, `/invite/*`) to the server as a **proxy rewrite** (not a redirect — Apple's AASA verification requires the URL to stay on `ceolx.com`). Universal Links / App Links only verify correctly when all three of these agree: the `api.ceolx.com` custom domain is actually live (not a `*.vercel.app` URL), the Android SHA-256 fingerprint published in `assetlinks.json` matches the _installed_ build's actual signing cert (see the Play App Signing gotcha above — same failure class), and Vercel's deployment-protection SSO wall is off for the environment being crawled (Apple's AASA fetch and public `/post` hits both get blocked by it otherwise).
**Fix:** for staging, the app doesn't rely on the admin's rewrite at all — `EXPO_PUBLIC_SHARE_BASE_URL` points the native share links and the `app.config.js`-derived `associatedDomains`/`intentFilters` straight at the staging server's own Vercel URL (`https://api-staging.ceolx.com`), which serves `/post` and `/.well-known` itself. When debugging "links don't work" on a specific environment, check in order: is the target domain actually live and is deployment protection off, does the SHA-256 in `assetlinks.json` match the installed build's real signing cert, and (dev builds only) is `applinks:ceolx.com?mode=developer` set — a plain TestFlight/store build needs the real `.well-known` files, not developer mode.
`apps/admin/vercel.json` · `apps/server/src/routes/app-links.ts` · `apps/server/src/routes/post-share.ts` · Asana 1215494138226011

## DB & data-modeling

### A fresh Neon branch can't `drizzle-kit migrate` from empty — use `push --force` + stamp

**Symptom:** initializing a brand-new Neon branch (e.g. standing up prod for the first time) and running `drizzle-kit migrate` fails partway through with a Postgres 42704 "constraint does not exist" error, leaving the database empty (drizzle rolls back the whole failed run).
**Cause:** one migration in the 21-file history (`0002_tearful_sue_storm.sql`) does `DROP TABLE "users" CASCADE` — which auto-drops every `*_users_id_fk` constraint — and then explicitly tries to drop one of those same constraints again. This sequence only ever ran successfully as an _incremental_ step against an already-populated dev/staging database; it was never replayed from a truly empty database before.
**Fix, for a genuinely fresh DB only:** (1) enable `cube` and `earthdistance` Postgres extensions first — required for the `events_spatial_idx` GIST index, and not created by any migration; (2) run `drizzle-kit push --force` against the schema directly, using the Neon **direct (non-pooler) endpoint** (strip `-pooler` from the host — the pooler can hang `migrate`/`push` on the spinner); (3) manually stamp the `drizzle.__drizzle_migrations` table with all 21 migration hashes (via drizzle's own `readMigrationFiles`) so that the staging CI's `migrate` step treats history as already-applied and becomes a no-op going forward. This procedure is for standing up a brand-new environment only — routine schema changes on dev/staging/prod still go through normal generated migrations plus the CI migrate workflow (see Deploy & infra above).
`packages/db/src/migrations/0002_tearful_sue_storm.sql` · `packages/db/drizzle.config.ts`

### Following-count SQL divergence — see Events & bookings

The Following-count-vs-list mismatch (raw `count(*)` vs. the list's active-profile filter) is the same "hide the same rows everywhere" defect class as `status='archived'` visibility — full entry is under **Events & bookings → Following count vs list filter**. The DB-specific lesson: `packages/api` tests mock the DB boundary entirely, so a SQL `WHERE`-clause difference between two query sites is invisible to vitest; verify any count/list-parity fix against a real database.

### Neon staging CI migration mechanics — see Deploy & infra

The staging auto-migrate GitHub Action (turbo's `persistent: true` trap, `migrate` vs `push`, default-branch workflow visibility) is filed in full under **Deploy & infra → Neon staging auto-migrate CI**, since it's primarily a CI/deploy concern; it is cross-referenced here because the underlying trap — a schema change behaving differently on a fresh DB than on an incrementally-migrated one — is a data-modeling issue as much as an ops one.
