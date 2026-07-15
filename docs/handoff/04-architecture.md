# Architecture

Where things live, the rules that keep client/server/copy in sync, and the data flows that aren't obvious from reading one file at a time.

## Monorepo layout

> **CLAUDE.md naming drift:** `CLAUDE.md`'s "Monorepo Structure" table says `apps/mobile`, `apps/api`, and lists `packages/shared` as the only package. That's stale. The actual on-disk layout is below — use this, not the CLAUDE.md table, and flag the doc for a fix next time you touch it. Also note the API layer is **not** a standalone app: `apps/server` is a thin Hono host that mounts routers defined in `packages/api`.

```
apps/
  native/   -- React Native + Expo mobile app (iOS + Android)
  admin/    -- React + Vite + TanStack Router SPA (also hosts ceolx.com/subscribe, /post/*, /.well-known/* rewrites)
  server/   -- Hono app (apps/server/src/app.ts) — HTTP entrypoint, routes, jobs, deployed to Vercel
packages/
  api/      -- tRPC routers (events, bookings, artists, venues, admin, notifications, ...) — the actual API logic
  db/       -- Drizzle schema + pgEnum definitions (packages/db/src/schema/*.ts), migrations
  shared/   -- validators (Zod), enums, notification trigger builders, types, constants — consumed by both native and api
  auth/     -- BetterAuth server config
  cache/    -- caching helpers
  config/   -- shared config (eslint/tsconfig/etc conventions)
  email/    -- Postmark email templates/senders
  env/      -- @t3-oss/env-core typed env schemas per runtime (native/server)
  ui/       -- shared UI primitives (admin-facing)
```

One-line responsibilities:
- **apps/native** — the mobile app; consumes `packages/api` via tRPC client, `packages/shared` for validators/enums/notification routing.
- **apps/admin** — Super Admin dashboard + the public `ceolx.com` marketing/subscribe surface; its `vercel.json` rewrites `/post/*`, `/event/*`, `/invite/*`, `/.well-known/*` to `apps/server`, everything else falls through to the SPA.
- **apps/server** — Hono HTTP host: mounts the `packages/api` tRPC router, serves app-links (`/.well-known/apple-app-site-association`, `assetlinks.json`), post-share OG pages, QStash job handlers, deployed as the `api.ceolx.com` Vercel project.
- **packages/api** — all tRPC router/procedure code (`packages/api/src/routers/*`), grouped by domain (`events/`, `admin/`, `posts/`, `uploads/`, plus flat files like `bookings.ts`, `venues.ts`).
- **packages/db** — Drizzle table definitions and `pgEnum`s (`packages/db/src/schema/*.ts`); enum *values* are actually defined in `packages/shared/src/enums.ts` and imported here, so shared is the true source of truth for status vocab.
- **packages/shared** — Zod validators (`packages/shared/src/validators/`), enums, notification trigger builders (`packages/shared/src/notifications/`), cross-cutting utils (`packages/shared/src/utils/date.ts` etc.) consumed by both native and server/api.

## Source-of-truth rules

**Validators.** `packages/shared/src/validators/` is the single source of truth for user-facing schemas. Both the native client (form validation) and the tRPC `.input()` on the matching `packages/api` router import the same schema — never duplicate inline. Example: `createEventSchema` (`packages/shared/src/validators/events.ts`) is imported by the events router. See CLAUDE.md "Validation architecture" for the full rule and the router migration status.

**Notification copy.** Title, body, persona, and route for every notification trigger come from typed builder functions in `packages/shared/src/notifications/triggers.ts` (plus `deep-link.ts`, `format.ts`, `inactivity-email.ts` alongside it), keyed to the M7-T0 Notifications Matrix row IDs. Routers and webhook handlers call the builder — they never inline title/body strings. Inlining copy lets push and email drift from the PM-audited matrix invisibly. New trigger → add/reuse a builder here, never write strings in a router.

**Event form cross-field rules.** The event creation/edit wizard (`apps/native/hooks/use-event-form.ts`) has two validation layers that must independently encode the same rule:
1. The per-step system (`fieldError(field)` / `validateStepN()`) — drives live inline UX and gates "Continue".
2. The shared Zod schema `createEventSchema` (`packages/shared/src/validators/events.ts`, confirmed: `.refine((data) => !data.dateEnd || data.dateEnd >= data.dateStart, { path: ['dateEnd'] })`) — the final authority, checked in `handleSubmit`.

A rule added only to the Zod schema is invisible until submit, and by default `handleSubmit` maps schema errors back to steps via a `FIELD_STEP` table — a rule that isn't also in `fieldError`/`validateStepN` won't get live UX and may route the user to the wrong step if `FIELD_STEP` isn't updated too. Add new cross-field rules to **both** layers.

## Event lifecycle

Status enum (`packages/shared/src/enums.ts` `EVENT_STATUSES`, backing `packages/db/src/schema/enums.ts` `eventStatusEnum`, confirmed on disk):

```
draft → pending_review → active → archived
                       ↘ removed → (creator edits + resubmits) → active
```

- `rejected` remains in the enum for schema compatibility but is not used in V1 (`packages/db/src/schema/events.ts` comment: "legacy — kept for enum compat, not used in V1").
- `pending_review` holds an artist-created event off the map/feed until the named venue accepts (artist→venue consent flow); venue acceptance flips it to `active`.
- On creation, `status` defaults to `active` (`events.status` column default in the schema) — events go live immediately per the post-publication moderation model (CLAUDE.md "Event Moderation").
- Admin takedown sets `status='removed'` and populates `removalReason`; on creator resubmission, `resubmittedAt` is set and status returns to `active`.

**`status='archived'` uniquely means the creator deleted the event** — the user-facing "Delete" button maps to the `events.archive` tRPC mutation, the *only* writer of `'archived'`. There is **no auto-archive cron**. A naturally-past event stays `status='active'` with a past `dateStart`; "Past Events" is a pure date filter (`dateStart <= now`), not a status. This contradicts the PRD's older "archived = Past Events" wording — the code never uses archived that way.

**Rule:** any new event-listing query must filter to `status='active'` (or at minimum exclude `archived`) — never `inArray(status, ['active', 'archived'])`. An archived (deleted) event must vanish from every read surface for every persona: search/Typesense, profiles, collections, saved lists, notifications. This has been fixed twice after leaking (venue/artist profile past-events queries, collection owner view) — grep for any new event-listing query that doesn't guard status before shipping it.

## Booking state machine

Enum (`packages/shared/src/enums.ts` `BOOKING_STATUSES`, confirmed): `pending`, `accepted`, `rejected`, `cancelled`.

```
Pending → Accepted | Rejected → Cancelled (either party, any time post-acceptance)
```

Enforced at the application layer, not the DB (`packages/db/src/schema/bookings.ts` comment confirms this explicitly). `direction` (`venue_to_artist` | `artist_to_venue`, plus an `artist_to_artist` co-artist-invite variant using `inviterArtistId`) disambiguates who initiated.

**Past-event guard:** because past events stay `status='active'` (see Event lifecycle above), accepting a booking on a past event is not blocked by event status alone. All three booking entry points — `bookings.update` (block `ACCEPTED` transition), `bookings.requestToPerform` (block applying), `bookings.resend` (block re-inviting) — separately call `isEventPast(event.dateStart.toISOString())` (`packages/shared/src/utils/date.ts`, confirmed: `dateStart < now`, ignores `dateEnd`). Reject/withdraw/cancel remain allowed on past events so stale pending rows can still be cleared. Full detail and the test-fixture clock-pinning gotcha are in `01-gotchas.md` § Events & bookings.

## Key data flows & schema traps

**Discovery feed + Map read from Typesense, not Neon.** `events.getFeed` (feed, `packages/api/src/routers/events/feed.ts`) and `events.getMap` (`packages/api/src/routers/events/map.ts`) query a Typesense `events` collection — `getMap` by bbox polygon, `getFeed` by a 100km geopoint radius — and only hit Neon afterward for collection names / saved / follow state. An `active` event in Neon is invisible on both screens unless it was also indexed into Typesense with valid coordinates. Sync happens in `packages/api/src/services/event-sync.ts` (`syncEventToTypesense` on create/update, `bulkSyncEventsToTypesense` for seed/recovery).

Coordless events used to be silently coerced to `(0,0)` (Atlantic Ocean → never in an Irish viewport) because `events.create` defaulted missing coords to `'0'` into `NOT NULL` numeric columns. Fixed via `resolveEventCoordinates` (`packages/api/src/routers/events/helpers.ts`): explicit pin → inherit the venue's pin via `venueId` → else `BAD_REQUEST`; `(0,0)` should never be written again. The DB schema also has explicit lat/lng range CHECK constraints (`packages/db/src/schema/events.ts`).

Recovery path for a dead Typesense cluster: `admin.resyncEvents` (`packages/api/src/routers/admin/maintenance.ts`) re-ensures the collection and runs a full bulk sync — use this instead of manually curling the Typesense `/collections` API after a cluster swap. `apps/server/src/app.ts` also calls `ensureEventsCollection()` fire-and-forget on startup (skipped under test).

**Discovery search is intentionally nationwide.** Default browse (no text query) keeps a 100km geo ring. The moment a text query is present, the geo filter is dropped entirely in `packages/api/src/routers/events/feed.ts` — distance still influences ranking, not inclusion. This is a deliberate design choice ("global search only" for a country-scale app), not a bug — if "search finds nothing far away" resurfaces, check that `geoFilter` conditional before assuming it's broken. The Map view's free-text query is still viewport-bounded (auto-expand caps at 100km); only the map's county dropdown re-centers.

**Notifications are split across two tables.** `notifications` (`packages/db/src/schema/notifications.ts`, confirmed) holds message content (`type`, `title`, `body`, `route`, `persona`) — one row per message. `notification_users` holds per-user delivery state (`isRead`, `readAt`, `archivedAt`) — one row per (notification, user) pair, unique-indexed on that pair. This lets one message fan out to many recipients (saved-event reminders, admin-removal cascades) without duplicating content. **Mark-read, mark-all-read, and archive/delete mutations target `notification_users` only** — never write to `notifications` after creation. Inbox list/unread-count queries JOIN the two tables and project content from one, state from the other; the mobile `NotificationDto` contract hides the join.

**Notification deep-link routes must be fully-qualified Expo Router group paths.** `route` is decided server-side at creation time from `routeTemplate` in `packages/shared/src/notifications/triggers.ts` and persisted on the row. Expo Router here uses Typed Routes with fully-qualified group paths everywhere (e.g. `/(app)/(tabs)/discover/event/:id`) — a bare path (`/events/:id`) has no matching screen and 404s to `+not-found`. Both tap surfaces (in-app inbox `app/(app)/notifications.tsx`, and FCM push tap via `hooks/use-fcm-registration.ts`) must route the persisted `route` string through `apps/native/lib/notification-route.ts` → `resolveNotificationRoute(route): Href` (confirmed on disk), which remaps legacy/bare/unknown routes to a safe fallback (discover) instead of 404ing. New trigger → use a `/(app)/(tabs)/...` path in `routeTemplate`; new screen target → extend `resolveNotificationRoute`.

**Avatars have two source columns — read the wrong one and uploaded pictures vanish.** `user.image` (BetterAuth `user` table) is populated only for Google/Apple social logins; it's null for email signups. The uploaded profile picture lives in `artist_profiles.profile_image_url` / `venue_profiles.profile_image_url`. Correct precedence (uploaded wins, OAuth image is the fallback) is centralized in `resolveProfileImageUrl` (`packages/api/src/routers/events/helpers.ts`, confirmed, re-exported and used by `packages/api/src/routers/bookings.ts` at every `BookingSummary` build site) and `posts/hydrate.ts::hydrateAuthors`. Any new event/post/profile/booking surface that renders an avatar must go through one of these — reading `user.image` alone has caused the same class of bug twice (event detail creator/collaborator images, then separately all four booking-card image sites).

**Venue location is a mandatory map pin, never free text.** `venue_profiles.lat`/`lng` are required `numeric(10,7)` columns captured via the shared `apps/native/components/LocationPicker.tsx` (search + draggable `MapView` marker + geocode/reverse-geocode, Ireland default `53.1424, -7.6921`), reused by venue onboarding and venue profile edit. The venue's address string is only a display label derived from the pin (search result / reverse geocode, falling back to a coordinate string) — never a typed address field. Because Drizzle `numeric` columns come back as strings, the API boundary must coerce (`users.me` returns venue lat/lng as `Number(...)`).

**Domain/deploy layout for shared-post deep links.** `ceolx.com` root is served by **apps/admin** (Vite SPA); `api.ceolx.com` is **apps/server** (Hono) — confirmed via `apps/admin/vercel.json` and `apps/server/src/routes/app-links.ts`/`post-share.ts`. `apps/admin/vercel.json` rewrites `/.well-known/*`, `/post/*`, `/event/*`, and `/invite/*` to `https://api.ceolx.com/...` **before** the SPA catch-all — a rewrite (proxy), not a redirect, which Apple's Universal Links AASA verification requires (the URL must stay on `ceolx.com`). `apps/server/src/routes/app-links.ts` serves `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`; `apps/server/src/routes/post-share.ts` serves per-post OG/Twitter tags plus a `ceolx://post/:id` landing page. `resolveNotificationRoute` also maps `/post/:id` → `/(app)/post/${id}` (that screen lives outside the `(tabs)` group).

⚠️ unverified as of 2026-07-14 — the source memory for this flow (`project_shared_post_deeplink`) consistently describes the domain as `ceolx.ie`; the live repo (`apps/admin/vercel.json`, `apps/server/src/routes/app-links.ts`, `post-share.ts`) uses `ceolx.com` throughout, matching CLAUDE.md's `ceolx.com/subscribe`. This doc uses the on-disk `ceolx.com` as current truth; treat `ceolx.ie` as a stale name from before a rename, but confirm with Priya/Pratiksha that no `.ie` domain registration or DNS config still needs cleanup.
