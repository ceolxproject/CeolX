---
type: feature-plan
status: approved
source_type: markdown
source_ref: 'docs/plans/2026-07-17-share-profile-username-design.md (brainstormed design)'
created_at: '2026-07-17'
updated_at: '2026-07-17'
url_format: 'ceolx.com/u/<username> — same mechanics as /event and /post'
---

# Share Profile via Username Handle — Implementation Plan

## Source Snapshot

Artists and venues have no way to share their profile. Events and posts already
share via `ceolx.com/event/<uuid>` and `/post/<uuid>` (universal/app links →
server-rendered OG landing → `ceolx://` deep link). Profiles are addressed
publicly by the raw BetterAuth `user.id` (text) — not shareable-friendly.

This feature adds a permanent, human-readable handle (`@username`) for artists
and venues and a `ceolx.com/@handle` share link that mirrors the existing
event/post pattern. Spectators are excluded (no public profile).

Full design rationale: `docs/plans/2026-07-17-share-profile-username-design.md`.

## Assumption Log

- **URL format is `ceolx.com/u/<username>`** (Alignment Loop, engineer decision):
  same share mechanics as `/event` and `/post`, just a `/u/` slug. The `@`
  option (and its go/no-go link spike) was **dropped** — `/u/` is all-ASCII, so
  no reserved-character risk exists across the three link configs. Root-level
  (bare `ceolx.com/<username>`) was rejected: `ceolx.com` is the admin SPA, so
  root handles would collide with admin/marketing routes and hijack universal
  links. No spike; build proceeds straight through.
- **Venue profiles are currently publicly visible** (subscription gate disabled
  in `venues.ts`, Asana 1215489113550392). The plan mirrors current behavior;
  it does not restore or depend on the subscription rollout.
- **Existing `[artistId]`/`[venueId]` screens resolve by `user.id`**, so the
  redirect shim and share-page deep link target `user.id`, not the profile uuid.
- **`ceolx://event/<id>` custom-scheme deep links already function** into the
  authed `(app)` route group; the profile equivalent works the same way.

## Goal and Success Criteria

**Goal:** An artist or venue can share a permanent `ceolx.com/@handle` link that
opens their profile in-app (installed) or a server-rendered landing page (not
installed), consistent with event/post sharing.

**Success criteria:**

1. New artist/venue sets a unique, permanent `username` during onboarding.
2. Existing artist/venue with no handle is prompted to set one on first Share tap.
3. `ceolx.com/@handle` opens the correct profile screen in the app when installed.
4. `ceolx.com/@handle` renders an OG unfurl + store buttons in a browser/webview.
5. A handle for a non-live/deleted/unknown profile returns the not-found landing.
6. Handles are lowercase, 3–20 chars, `[a-z0-9_]`, contain a letter, not reserved.
7. Spectators never see the Share button and never get a handle.
8. Duplicate handles are impossible (DB unique index).

## Scope and Non-Goals

**In scope:** validator; better-auth username plugin (server + client); 2 user
columns + unique index + migration; `profilesRouter.getByUsername`; shared
visibility helper; onboarding username step (artist + venue); `<UsernamePicker>`;
`use-share-profile` hook + Share button; `@[username].tsx` redirect shim;
`profile-share.ts` server route; deep-link scope widening (3 configs).

**Non-goals (YAGNI):** login-by-username in the UI; spectator handles / hidden
auto-generation; username-change UI or redirect-history table; custom-scheme
profile deep link (`ceolx://@handle`); data migration/backfill script; restoring
the venue subscription gate.

## Resolved Decisions

- **Handle mechanism:** better-auth `username` plugin (server) + `usernameClient()` (native).
  Why: first-party, already the auth stack; gives validation/normalization/availability; DB cost identical to hand-rolled.
  Source: grilled + docs
- **Field home:** `username` + `displayUsername` on the `user` row, both nullable; spectators stay `null`.
  Why: one place, global uniqueness, spans both personas, no spectator handling.
  Source: grilled + codebase
- **URL format:** `ceolx.com/u/<username>` — same share mechanics as `/event`/`/post`, `/u/` slug. No `@`. No spike.
  Why: `/u/` is all-ASCII (no link-config risk) and namespaced so it can't collide with the admin SPA's root routes or hijack universal links; bare root rejected for that reason.
  Source: grilled (Alignment Loop)
- **Editability:** one-time, permanent, with a confirm step; rare fixes via admin DB edit.
  Why: shared links never rot; no edit UI / redirect table needed.
  Source: grilled
- **Backfill:** set-on-first-share for existing profiles; required field for new users in onboarding.
  Why: no migration, no forced modal; both paths converge on `<UsernamePicker>`.
  Source: grilled
- **Visibility:** `getByUsername` reuses the exact `byId` per-type predicate via a shared helper — artist `isActive` (owner-bypass); venue currently open (gate disabled). Share button shows when profile is live.
  Why: mirrors in-app visibility; restoring the venue gate later automatically covers lookup.
  Source: grilled + codebase (venues.ts, Asana 1215489113550392)
- **Resolver home:** new `profilesRouter.getByUsername` registered in `routers/index.ts`.
  Why: username spans artist/venue; no existing `profiles` router; `current_role` disambiguates.
  Source: codebase
- **Case:** lowercase-only validator ⇒ `displayUsername == username`; UI uses `username`.
  Why: user requirement; `displayUsername` kept only because the plugin adds it.
  Source: grilled
- **Reserved handles:** brand + defensive + generic set in a shared `RESERVED` Set.
  Why: impersonation/brand protection at a controlled launch; extensible in code.
  Source: grilled
- **`/is-username-available` endpoint:** kept enabled.
  Why: needed by the live picker; enumeration is a non-issue since profiles are already publicly searchable.
  Source: grilled + docs

## Libraries & Verified APIs

| Library / Package         | Version              | API / Pattern Used                                                                                                    | Verified Via                                                  |
| ------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| better-auth               | 1.5.5 (pnpm catalog) | `username({ minUsernameLength, maxUsernameLength, usernameValidator, usernameNormalization })` server plugin          | context7 `/better-auth/better-auth` docs/plugins/username.mdx |
| better-auth               | 1.5.5                | `usernameClient()` client plugin — exposes `isUsernameAvailable` + `username`/`displayUsername` on `updateUser`       | context7 docs/plugins/username.mdx                            |
| better-auth               | 1.5.5                | `authClient.updateUser({ username, displayUsername })` sets handle post-signup                                        | context7 username.test.ts                                     |
| better-auth               | 1.5.5                | schema fields `username` (unique, returned, nullable) + `displayUsername` (nullable); lowercase normalization default | context7 plugins/username/schema.ts                           |
| better-auth               | 1.5.5                | `disabledPaths: ["/is-username-available"]` exists to block enumeration (we do NOT set it)                            | context7 docs/plugins/username.mdx                            |
| @better-auth/expo         | 1.5.5                | existing `expo()` plugin unchanged                                                                                    | codebase `packages/auth/src/index.ts`                         |
| drizzle-orm / drizzle-kit | kit ^0.31.8          | `text('username').unique()`, `text('display_username')`; `db:generate` → `db:migrate`                                 | codebase `packages/db`                                        |
| @trpc/server              | (repo)               | `publicProcedure.input(z.object({...})).query()` with optional `ctx.session` owner-bypass                             | codebase `artists.ts:42`                                      |
| zod                       | (repo)               | shared `usernameSchema` in `packages/shared/src/validators`                                                           | codebase pattern                                              |
| vitest                    | (repo)               | `t.createCallerFactory` + `vi.mock('@CeolX/db')` chainable mockDb                                                     | codebase `__tests__/onboarding.test.ts`                       |

## Feature Surfaces

| Surface                       | Applies? | Guardrail skill        | Why                                                                                   |
| ----------------------------- | -------- | ---------------------- | ------------------------------------------------------------------------------------- |
| Forms / inputs / validation   | yes      | form-validation        | username field in onboarding + picker; shared Zod schema, live availability           |
| Cross-flow behavior           | yes      | cross-flow-consistency | share pattern must match event/post; onboarding vs first-share converge on one picker |
| Data mapping / labels / DTOs  | yes      | data-mapping           | username↔displayUsername; `getByUsername` DTO; me-shape gains username                |
| Navigation / CTAs / redirects | yes      | navigation-actions     | Share button; `@[username]` redirect shim → existing profile screens; deep links      |
| Auth / permissions / roles    | yes      | backend                | better-auth plugin + schema; visibility gate (owner-bypass); spectator exclusion      |
| Async / network / concurrency | yes      | backend/react          | availability check-then-write race; DB unique backstop                                |
| Billing / trial / state gates | no       | —                      | venue subscription gate is out of scope (currently disabled; mirrored only)           |

## Product Invariants

- A username is globally unique (DB `UNIQUE` index), lowercase, and immutable once set.
- Only artists and venues have a non-null username; spectators are always `null`.
- The Share button and public `/@handle` render iff the profile is live under the
  same predicate `byId` uses (no divergent visibility path).
- A handle never changes, so a shared `/u/<handle>` never points at a different account.
- The `/u/<username>` URL format is all-ASCII and namespaced under `/u/`, so it
  cannot collide with admin/marketing routes or capture the web app into a deep link.

## Cross-Flow Checks

| Concept                   | Existing flows to compare                                                | Required consistency                                                                      |
| ------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Share link generation     | `use-share-event.ts`, `use-share-post.ts`                                | Same `SHARE_BASE_URL`, `Share.share({url})` shape                                         |
| Server share landing      | `event-share.ts`, `post-share.ts`                                        | Reuse `renderSharePage`/`renderNotFoundPage`/`maybeStoreRedirect`/`storeUrls`/`SHARE_CSP` |
| Deep-link scope           | `/post/*`, `/event/*` in 3 configs                                       | Add `/@*` to all three together (app-links glob, intentFilter, vercel)                    |
| Public profile resolution | `artistsRouter.byId`, `venuesRouter.byId`                                | `getByUsername` reuses the same visibility helper + owner-bypass                          |
| Onboarding field add      | `artistOnboardingStep1Schema`, `FIELDS_BY_STEP`, `ArtistOnboardingDraft` | username added to schema + step map + draft + hook state + Step1 UI (artist AND venue)    |

## QA Attack List

| Case                                           | Expected result                                      | Verification                             |
| ---------------------------------------------- | ---------------------------------------------------- | ---------------------------------------- |
| Handle already taken (picker)                  | Inline "taken" error, submit blocked                 | picker unit + `isUsernameAvailable`      |
| Two users race to same handle                  | Second `updateUser` fails on unique index            | integration + DB constraint              |
| Uppercase / spaces / emoji input               | Rejected by `usernameSchema` before submit           | validator unit                           |
| Reserved word (`@ceolx`, `@admin`)             | Rejected "taken"                                     | validator unit                           |
| `@handle` for inactive artist (non-owner)      | Not-found landing / redirect 404                     | `getByUsername` test (session=undefined) |
| Owner views own inactive profile via `@handle` | Resolves (owner-bypass)                              | `getByUsername` test (owner session)     |
| `@handle` for deleted/anonymized account       | Not-found landing                                    | `getByUsername` + route test             |
| Unknown `@handle`                              | Not-found landing, `Cache-Control: no-store`         | route test                               |
| Malformed handle in URL (`/@a`, `/@UPPER`)     | Not-found (format guard) before DB hit               | route test                               |
| Spectator taps anywhere                        | No Share button exists; no picker                    | UI test / manual                         |
| Picker cancelled mid-flow                      | No write, share aborts                               | hook unit                                |
| Share tapped by existing artist, no handle     | Picker opens → confirm → share sheet with `/@handle` | manual dev build                         |
| Offline during availability check              | Graceful error, no false "available"                 | picker error-path                        |
| Universal link on installed app (both OS)      | Opens correct profile screen                         | Step-1 spike + manual                    |
| Link in webview/desktop                        | OG unfurl + store buttons                            | route test + manual                      |

## TDD Plan

- **Public interface under test:** `profilesRouter.getByUsername(input)`; `usernameSchema`; `profile-share.ts` GET `/@:username`.
- **Behaviors to prove first (ordered):**
  1. `usernameSchema` accepts valid, rejects short/long/uppercase/bad-char/no-letter/reserved.
  2. `getByUsername` returns `{role,userId,displayName,image,bio}` for a live artist.
  3. `getByUsername` throws NOT_FOUND for inactive artist when `session=undefined`.
  4. `getByUsername` returns profile for inactive artist when owner session.
  5. `getByUsername` returns venue (current open behavior).
  6. `getByUsername` NOT_FOUND for unknown handle.
  7. `profile-share.ts` renders OG for live handle; not-found for unknown/malformed/not-live.
- **First failing test:** `usernameSchema > rejects "ab" (too short)` — fails because the schema doesn't exist yet.
- **Boundary/system mocks:** `@CeolX/db` chainable mockDb (mirror `onboarding.test.ts`); no network mocks beyond DB.
- **Test-first skipped:** no.

## Implementation Plan

**Step 1 — Shared validator** (`packages/shared/src/validators`).
`usernameSchema` (3–20, `^[a-z0-9_]+$`, `[a-z]` required, `!RESERVED.has`) + the
`RESERVED` Set. Unit tests first (TDD).

**Step 2 — Auth + schema.**
Add `username()` to `packages/auth/src/index.ts` plugins with
`usernameValidator: (u) => usernameSchema.safeParse(u).success`, `minUsernameLength:3`,
`maxUsernameLength:20`. Add `username: text('username').unique()` +
`displayUsername: text('display_username')` to `packages/db/src/schema/auth.ts`.
`pnpm --filter @CeolX/db db:generate` → review SQL → `db:migrate`. Add
`usernameClient()` to the native `authClient`.

**Step 3 — Resolver + visibility helper** (`packages/api`).
Extract the `byId` visibility check into a shared helper (`isProfilePublic(profile, role, sessionUserId)`)
used by `artists.byId`, `venues.byId`, and the new `profilesRouter.getByUsername`.
`getByUsername`: look up user by normalized username → `current_role` → fetch the
matching profile → apply helper → return DTO or throw NOT_FOUND. Register
`profilesRouter` in `routers/index.ts`. Extend `usersRouter.me` to return `username`.
Tests first (TDD).

**Step 4 — Server share route** (`apps/server/src/routes/profile-share.ts`).
Mirror `event-share.ts`: `GET /u/:username`, `maybeStoreRedirect`, `SHARE_CSP`,
replace `UUID_RE` guard with a username-format check, resolve via the same
lookup, render `renderSharePage` (deepLink `ceolx://artist|venue/<userId>`) or
`renderNotFoundPage({ noun:'profile' })`. Mount in server entry. Route test.

**Step 5 — Deep-link scopes (all three together).**
`app-links.ts` `LINK_PATH_GLOBS` += `/u/*`; `app.config.js` intentFilter += third
`data` entry `pathPrefix:'/u'`; `apps/admin/vercel.json` += `/u/:path*` rewrite
**before** the SPA catch-all.

**Step 6 — Native picker + onboarding.**
`<UsernamePicker>` (live `isUsernameAvailable`, `usernameSchema`, confirm-permanent).
Wire into artist + venue onboarding: add username to `artistOnboardingStep1Schema`
/ venue equivalent + `createArtistOnboardingSchema`, `FIELDS_BY_STEP[1]`,
`ArtistOnboardingDraft`, hook state, `Step1BasicInfo.tsx` (both). Server insert in
`onboarding.createArtistProfile`/venue writes `username` via the profile create.

**Step 7 — Share hook + button.**
`apps/native/hooks/use-share-profile.ts` (opens picker if `me.username == null`,
then `Share.share({ url: \`${SHARE_BASE_URL}/u/${username}\` })`). Render the
Share button on the user's own profile screen, gated by the same live predicate.
`apps/native/app/(app)/u/[username].tsx`shim: resolve → redirect to`/artist/[artistId]`or`/venue/[venueId]`.

**Step 8 — Verification pass** (see below).

## Verification Plan

- **Automated (Vitest):** validator unit tests; `getByUsername` caller tests
  (anon/owner × active/inactive artist, venue, deleted, unknown); `profile-share.ts`
  route tests (OG on live, 404 on unknown/malformed/not-live). Run
  `pnpm --filter @CeolX/shared test`, `pnpm --filter @CeolX/api test`, and
  `pnpm --filter @CeolX/server test`.
- **Manual (dev build):** full flow — existing artist with no handle taps Share →
  picker → confirm → share sheet shows `ceolx.com/u/<handle>` → open the link on a
  second device (installed → app opens profile; browser → OG landing + store buttons),
  on both iOS and Android.
- **Migration:** review generated SQL adds two nullable columns + unique index only;
  confirm no data change to existing rows.
- **Regression:** existing event/post share links still resolve (shared
  `renderSharePage`/glob changes are additive).

## Risks and Open Questions

- **`@` across three link configs** — highest risk; Step 1 spike is the gate,
  `/u/` is the ready fallback. Risk-accepted with mitigation.
- **Check-then-write handle race** — DB `UNIQUE` index is the backstop; the picker
  check is UX-only, not the guarantee.
- **Permanent-handle typos** — confirm step mitigates; residual fixes are a rare
  manual admin DB edit (no self-serve edit UI in v1). Accepted.
- **Venue visibility** — plan mirrors the _currently disabled_ gate (venues open).
  When Asana 1215489113550392 restores it, the shared `isProfilePublic` helper
  covers `getByUsername` automatically — no rework here. Flagged, accepted.
- **Deep link into authed `(app)` group** — assumed to work as event/post do;
  confirm during the Step-1 spike that an unauthenticated tap lands correctly
  (login → profile), not a dead end.
