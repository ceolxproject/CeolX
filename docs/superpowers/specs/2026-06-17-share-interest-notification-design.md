# Share Interest — Artist ↔ Venue collaboration interest notification

**Date:** 2026-06-17
**Asana:** [1215700058851992](https://app.asana.com/1/1194107417268910/project/1210959953917909/task/1215700058851992) — `[Functional Gap] Share Interest action does not notify the other user`
**Author:** Priya Yadav

## Problem

The "Share Interest" action on the Venue profile (and the equivalent "Invite" button on
the Artist profile) only shows a "Coming soon" alert. Tapping it does nothing meaningful.
The button is meant to support lightweight artist ↔ venue collaboration discovery: an
artist signals interest in a venue, or a venue in an artist, and the other party is
notified so they can view the sender's profile and follow up.

## Goal

When an artist taps **Share Interest** on a venue profile, the venue receives a
notification. When a venue taps **Share Interest** on an artist profile, the artist
receives a notification. The notification carries the sender's name, persona, and a deep
link to the **sender's profile**.

Notification copy (from the task):

- Artist → Venue: _"{artistName} is interested in collaborating with you. View their profile and plan your next event."_
- Venue → Artist: _"{venueName} is interested in collaborating with you. View their profile and explore a possible performance."_

## Scope

This is a standalone "expression of interest" **not tied to any event** — distinct from
the event-anchored booking/invite flow (M5). It fires a single notification (inbox row +
FCM push) and logs the interest for cooldown purposes.

### Decisions (from brainstorming)

- The Artist-profile secondary button is **renamed `Invite` → `Share Interest`** so both
  directions are symmetric. (There is no event context on a profile, so the old "Invite"
  label could not drive the event-booking invite flow anyway.)
- A **24h cooldown** prevents a sender from spamming the same recipient, mirroring the
  existing booking-resend cooldown (`RESEND_COOLDOWN_MS`).
- Only **artist ↔ venue** may send: an artist viewing a venue, or a venue viewing an
  artist. Spectators and same-persona viewers (artist→artist, venue→venue) never see the
  button, and the server rejects them defensively.

### Out of scope (YAGNI)

- No email surface (email copy stays `null` until M7-T3 Postmark).
- No dedicated "interest received" list/screen — the standard notification inbox row is
  the surface.
- No un-send / withdraw of an interest.
- No change to the event-anchored booking/invite flow.

## Data model

New append-log table — `packages/db/src/schema/collaboration.ts`:

```
collaboration_interests
  id                uuid pk default gen_random_uuid()
  sender_user_id    text not null  → users.id (on delete cascade)
  recipient_user_id text not null  → users.id (on delete cascade)
  created_at        timestamp not null default now()

  index collaboration_interests_pair_idx on (sender_user_id, recipient_user_id)
```

- Append-only: every accepted Share-Interest writes one row. The most recent row for a
  `(sender, recipient)` pair drives the cooldown check.
- `text` user-id columns match BetterAuth's `user.id` type (same as the other profile
  tables).
- Exported from `packages/db/src/schema/index.ts`.
- Drizzle migration generated via `drizzle-kit generate` and committed. Staging CI runs
  `drizzle-kit migrate` on push (see `project_db_migrate_ci_neon_staging`).

## Notification triggers

Add to `packages/shared/src/notifications/triggers.ts`. Both `type: 'collaboration_interest'`,
both off the PM matrix (flag for Pratiksha — note `off-matrix-collaboration-interest`).

| Trigger                     | persona  | routeTemplate                  | push/inApp body                                                                                               |
| --------------------------- | -------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `COLLAB_INTEREST_TO_VENUE`  | `venue`  | `/(app)/artist/{artistUserId}` | "{artistName} is interested in collaborating with you. View their profile and plan your next event."          |
| `COLLAB_INTEREST_TO_ARTIST` | `artist` | `/(app)/venue/{venueUserId}`   | "{venueName} is interested in collaborating with you. View their profile and explore a possible performance." |

- Titles: "New collaboration interest" (both surfaces).
- The route resolves through `resolveNotificationRoute` unchanged — it trusts any
  `/(app)/...` path as-is, and `/(app)/artist/{userId}` / `/(app)/venue/{userId}` are
  existing screens whose param is a **userId**.
- `email: null` for both.

## Backend

New router `packages/api/src/routers/collaboration.ts`, registered as `collaboration` in
`packages/api/src/routers/index.ts`.

Shared input validator `shareInterestSchema` in
`packages/shared/src/validators/collaboration.ts`:

```ts
export const shareInterestSchema = z.object({ recipientUserId: z.string().min(1) });
```

### `collaboration.shareInterest` — `creatorProcedure` mutation

`creatorProcedure` enforces the sender is an artist or venue (admin bypasses; an admin has
no profile and is handled by step 3). Steps:

1. **Reject self** — `input.recipientUserId === ctx.userId` → `BAD_REQUEST`.
2. **Resolve sender profile** by `ctx.currentRole`:
   - artist → `artistProfiles` by `userId`, name = `stageName`
   - venue → `venueProfiles` by `userId`, name = `venueName`
   - not found (e.g. admin / incomplete profile) → `BAD_REQUEST`.
3. **Resolve recipient role** — `users.currentRole` for `recipientUserId`.
   Reject unless it is the **opposite** persona:
   - sender artist ⇒ recipient must be `venue`
   - sender venue ⇒ recipient must be `artist`
   - else `BAD_REQUEST` ("Share Interest is only between artists and venues.")
     Confirm the recipient profile row exists (defensive).
4. **Cooldown** — latest `collaboration_interests` row for `(sender, recipient)`; if
   `now - created_at < RESEND_COOLDOWN_MS` → `TOO_MANY_REQUESTS`
   ("You've already shared interest recently.").
5. **Insert** one `collaboration_interests` row.
6. **Dispatch** via `ctx.dispatchNotification`:
   - artist → venue: `COLLAB_INTEREST_TO_VENUE`, `recipientUserId`,
     vars `{ artistName, artistUserId: ctx.userId }`
   - venue → artist: `COLLAB_INTEREST_TO_ARTIST`, `recipientUserId`,
     vars `{ venueName, venueUserId: ctx.userId }`
7. Return `{ ok: true }`.

Errors surface as standard tRPC codes; the dispatcher already no-ops the push job when the
recipient has no device tokens (inbox row is still written).

## Client

New hook `apps/native/hooks/use-share-interest.ts` wrapping
`trpc.collaboration.shareInterest`:

- success → `Alert.alert('Interest shared', 'They\'ll be notified.')`
- `TOO_MANY_REQUESTS` → `Alert.alert('Already sent', 'You\'ve already shared interest recently.')`
- other error → generic failure alert.

Both profile screens read the viewer role from `useMe()` and gate the secondary CTA:

- `apps/native/app/(app)/artist/[artistId].tsx` — label `Share Interest`; render the
  `secondaryCta` only when `!isOwner && me?.currentRole === 'venue'`; `onPress` →
  `shareInterest({ recipientUserId: profile.userId })`.
- `apps/native/app/(app)/venue/[venueId].tsx` — label `Share Interest` (unchanged); render
  the `secondaryCta` only when `!isOwner && me?.currentRole === 'artist'`; `onPress` →
  `shareInterest({ recipientUserId: profile.userId })`.

Gating by viewer role auto-hides the button for spectators and same-persona viewers, so the
"Coming soon" alerts are removed entirely.

## Testing

Server (`packages/api`, mirroring the `bookings` router tests — inject `db` +
`dispatchNotification` `vi.fn()`):

- artist → venue dispatches `COLLAB_INTEREST_TO_VENUE` with `{ artistName, artistUserId }`.
- venue → artist dispatches `COLLAB_INTEREST_TO_ARTIST` with `{ venueName, venueUserId }`.
- rejects self-interest.
- rejects recipient of the same / non-opposite persona (e.g. spectator, artist→artist).
- cooldown: second call within `RESEND_COOLDOWN_MS` throws `TOO_MANY_REQUESTS`; a call
  after the window succeeds (control `Date.now`).
- a row is inserted on success.

Shared (`packages/shared`):

- `buildNotification` for both new triggers interpolates copy + route correctly and throws
  on a missing var.

## Files touched

- `packages/db/src/schema/collaboration.ts` (new) + `schema/index.ts` export
- `packages/db/migrations/*` (generated)
- `packages/shared/src/notifications/triggers.ts` (2 triggers)
- `packages/shared/src/validators/collaboration.ts` (new) + validators index export
- `packages/api/src/routers/collaboration.ts` (new) + `routers/index.ts` registration
- `apps/native/hooks/use-share-interest.ts` (new)
- `apps/native/app/(app)/artist/[artistId].tsx`
- `apps/native/app/(app)/venue/[venueId].tsx`
- tests in `packages/api` and `packages/shared`
