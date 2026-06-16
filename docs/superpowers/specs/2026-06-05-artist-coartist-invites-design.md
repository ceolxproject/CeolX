# Artist invites co-artists on the event form

**Date:** 2026-06-05
**Asana:** [Add artist invite in artist event creation form](https://app.asana.com/1/1194107417268910/project/1209289934155843/task/1215353107121385) (1215353107121385)
**Status:** Design approved (pending spec review)

## Problem

The "Invite Artists" field on the event form is shown only to Venues. An Artist creating
an event has no way to add co-performers. The task asks for parity: an artist should be
able to invite other artists (platform members **and** outside-platform people by name +
email) "the same way the venue can add multiple artists."

This is **not** a UI-only change. The invite/booking system is hard-modeled as
Artist ↔ Venue:

- `bookings.venue_id` is `NOT NULL` and FKs `venue_profiles`. An artist↔artist invite has
  no venue.
- `BookingDirection` only has `venue_to_artist` / `artist_to_venue`.
- The platform-invite block in `events.create` / `events.update` is gated behind
  `&& isVenue` and looks up the creator's `venue_profiles` row — for an artist that row
  doesn't exist, so the invites are **silently dropped**.
- "Pending vs confirmed" for a collaborator is derived from the linked booking's status; an
  `event_collaborators` row with `booking_id = NULL` is treated as **already confirmed**.
  So we cannot model artist invites without a booking — that would auto-confirm them,
  violating the consent rule (Asana 1215188774775403).

## Decisions (locked with the user)

1. **Scope:** full parity — platform-artist invites backed by bookings, with pending →
   accept consent. (Not external-only, not a separate table.)
2. **Visibility is purely additive.** Co-artist invites never change the event's live/held
   status. The event's visibility is still governed solely by the existing venue-tagging
   rule (artist tagging a registered venue → held at `pending_review`). A co-artist
   accepting only adds them as a confirmed collaborator.
3. **Data model:** extend the existing `bookings` table (Approach A), not a generalized
   rewrite (B) and not a separate invites table (C).

## Data model

`packages/db/src/schema/bookings.ts`

```
bookings
  artist_id          NOT NULL   → invited / recipient artist (meaning unchanged)
  inviter_artist_id  NULL  (NEW) → inviting artist; set only for artist_to_artist rows
  venue_id           NULL  (CHANGED from NOT NULL) → NULL for artist_to_artist rows
  direction          enum += 'artist_to_artist'
```

Migration (Drizzle + raw SQL for enum + constraint):

- `ALTER TABLE bookings ALTER COLUMN venue_id DROP NOT NULL;`
- `ALTER TABLE bookings ADD COLUMN inviter_artist_id uuid REFERENCES artist_profiles(id) ON DELETE cascade;`
- `ALTER TYPE booking_direction ADD VALUE 'artist_to_artist';` (must run in its own
  statement / outside a transaction block — Postgres restriction on new enum values).
- `CREATE INDEX bookings_inviter_status_idx ON bookings (inviter_artist_id, status);`
- **CHECK constraint** to enforce the per-direction invariant at the DB:
  ```sql
  ALTER TABLE bookings ADD CONSTRAINT bookings_participants_chk CHECK (
    (direction IN ('venue_to_artist','artist_to_venue') AND venue_id IS NOT NULL AND inviter_artist_id IS NULL)
    OR
    (direction = 'artist_to_artist' AND venue_id IS NULL AND inviter_artist_id IS NOT NULL)
  );
  ```

`event_collaborators` is **unchanged**. An invited co-artist gets a row with
`artistProfileId = invitedUserId` + `bookingId`, identical to the venue→artist path. So
event-detail collaborator display and `confirmedEvents` work with **zero changes** once the
booking is accepted.

## Enums & validators (`packages/shared`)

- `enums.ts`: `BOOKING_DIRECTIONS` += `'artist_to_artist'`; add
  `BookingDirection.ARTIST_TO_ARTIST`.
- `createEventSchema` / `updateEventSchema`: no shape change — they already carry
  `platformInvites: string[]` and `unregisteredCollaborators: {name,email}[]`. The
  venue-only restriction lived in the router, never the schema.

## Backend — `events.create` / `events.update` (`packages/api/src/routers/events/crud.ts`)

Replace the `&& isVenue` gate on the platform-invite block with a role branch:

- **Venue creator** → existing `VENUE_TO_ARTIST` path, unchanged.
- **Artist creator** → resolve the creator's `artist_profiles.id`, then for each invited
  artist insert a booking:
  ```
  { artistId: invitedProfileId, inviterArtistId: creatorProfileId, venueId: null,
    eventId, status: PENDING, direction: ARTIST_TO_ARTIST }
  ```
  plus an `event_collaborators` row `{ eventId, artistProfileId: invitedUserId, bookingId }`,
  plus a `BOOKING_INVITE_TO_COARTIST` dispatch to the invited artist.

Guards added (both create and update):

- **No self-invite:** drop the creator's own user id / profile id from `platformInvites`
  before inserting.
- **Dedup:** skip invited artists who already have an active (`pending`/`accepted`) booking
  or collaborator row on the event — mirrors the existing `existingArtistUserIds` filter in
  `update`.

Event status logic is **untouched** (purely-additive decision). The artist→registered-venue
hold path and its `ARTIST_TO_VENUE` request are unaffected and coexist with co-artist
invites on the same event.

## Backend — `bookings.update` (`packages/api/src/routers/bookings.ts`)

The accept/reject state machine becomes participation-based:

- Resolve the caller against `booking.inviterArtist.userId` and `booking.artist.userId`
  (and venue as before). For `artist_to_artist`: **sender = inviter**, **recipient =
  invited artist**.
- `isRecipient` / `isSender` get an `artist_to_artist` branch.
- The notification counter-party + `resolveBookingUpdateTrigger` handle the
  `artist_to_artist` branch (see triggers below).
- The `pending_review → active` status flip **stays guarded on `ARTIST_TO_VENUE` only**, so
  a co-artist accept never touches event visibility. ✔ matches decision 2.
- Side effect on reject/cancel (delete `event_collaborators` by `bookingId`) is already
  direction-agnostic — works unchanged.

## Backend — `bookings.list` Sent/Received (`bookings.ts`)

Tabs are currently `role × direction`. New rule for an **artist** caller:

- **Sent** = `(artist_to_venue AND artist_id = me)` OR `(artist_to_artist AND inviter_artist_id = me)`
- **Received** = `(venue_to_artist AND artist_id = me)` OR `(artist_to_artist AND artist_id = me)`

Venue tabs unchanged. Implemented by OR-ing the artist-to-artist predicate into each tab's
`conditions` when `profileType === ARTIST`.

`byId` auth: a caller is a party if they are the venue user, the artist user, **or** (new)
the inviter artist user.

## API response shape — `BookingSummary` (`packages/shared/src/types.ts`)

Today every row assumes a venue counterpart (`venueName`, `venueImage`). For
`artist_to_artist` there is no venue. Add optional inviter fields; keep `venueId`/`venueName`
present but allowed to be empty for a2a rows (existing list mapping already uses `?? ''`
fallbacks, so this is backwards-compatible):

```ts
// added (optional) — populated only for artist_to_artist rows
inviterArtistId?: string;
inviterArtistName?: string;
inviterArtistImage?: string;
```

`list` / `byId` / `create` populate inviter + invited names for a2a rows.

**Null-safety:** every `booking.venue.*` access in the `list` / `byId` / `update` mappings
must become null-guarded (`booking.venue?.venueName ?? ''`), because the `venue` relation is
`null` for `artist_to_artist` rows. This is the main regression risk of making `venue_id`
nullable and must be covered in the affected-mapping changes.

## Client — Requests card (`apps/native/components/requests/RequestCard.tsx`, `RequestActions.tsx`)

`RequestCard` currently computes the counterpart as
`userRole === VENUE ? artistName : venueName` (`RequestCard.tsx:45`) — which collapses when
both parties are artists. Update the counterpart resolution:

- For `artist_to_artist`: the other party is the **co-artist** — if I am the invited artist
  (`artist_id = me`) show the inviter (`inviterArtistName`/`inviterArtistImage`); if I am the
  inviter show the invited (`artistName`/`artistImage`).
- `isSentByUser` gets an a2a branch: sent if `inviter_artist_id = me`.
- `RequestActions` button gating (accept/reject vs withdraw/cancel) keys off
  `isSentByUser` / recipient — extend the same way.
- The "CONTACT VENUE/ARTIST" affordance reads "CONTACT ARTIST" for a2a.

## Client — event form (`apps/native/components/events/BasicDetailsStep.tsx`, `InviteArtistPicker.tsx`)

- Remove the `isVenue` gate around `<InviteArtistPicker>` (`BasicDetailsStep.tsx:191`). Keep
  `CollectionPicker` venue-only.
- Pass the current user's artist profile id (and/or user id) into `InviteArtistPicker` so the
  search results exclude **self** (defense in depth alongside the backend guard).
- The field label/hint are already role-neutral ("Invite Artists… platform or outside").
- `create.tsx` / `edit/[eventId].tsx` already pass `platformInvites` /
  `unregisteredCollaborators` for any role — no change beyond what `BasicDetailsStep`
  forwards.

## Notifications (`packages/shared/src/notifications/triggers.ts`)

Five new triggers, mirroring the venue↔artist set, all `persona: 'artist'`, route
`/(app)/(tabs)/bookings/{bookingId}`, using a `{coArtistName}` var:

| Trigger                                 | Fires when                         | Recipient       |
| --------------------------------------- | ---------------------------------- | --------------- |
| `BOOKING_INVITE_TO_COARTIST`            | inviter sends invite               | invited artist  |
| `BOOKING_COARTIST_ACCEPTED_TO_INVITER`  | invited accepts                    | inviter         |
| `BOOKING_COARTIST_REJECTED_TO_INVITER`  | invited rejects                    | inviter         |
| `BOOKING_COARTIST_WITHDRAWN_TO_INVITEE` | inviter withdraws pending          | invited artist  |
| `BOOKING_COARTIST_CANCELLED`            | either cancels an accepted booking | the other party |

`resolveBookingUpdateTrigger` returns these for `direction === ARTIST_TO_ARTIST`. Copy is
drafted to match the existing tone; final copy can be tuned with Pratiksha (notification
matrix owner) but is not a blocker for V1.

## Testing

- **Shared:** validator round-trips; new `artist_to_artist` direction in enum lists.
- **`events.create` (artist):** platform invite → one `artist_to_artist` booking +
  collaborator + `BOOKING_INVITE_TO_COARTIST`; self-invite excluded; duplicate invite
  deduped; event status unchanged (active/held independent of invites).
- **`bookings.update`:** invited artist accept/reject; inviter withdraw/cancel; auth
  (non-party rejected, inviter is a party); counter-party notification correct; event status
  **not** flipped for a2a accept.
- **`bookings.list`:** artist Sent includes a2a rows where I'm inviter; Received includes
  a2a rows where I'm invited; venue tabs unaffected.
- **DB:** CHECK constraint rejects a malformed row (e.g. a2a with a venue_id).

## Out of scope (V1)

- Invite chains — only the event **creator** invites; the invited co-artist cannot re-invite
  others (they can't edit the event form).
- Pre-filling already-sent platform invites into the **edit** form (`platformInvites: []`
  stays; existing invites are managed via Requests). Pre-existing limitation, carried over.
- The standalone venue-only `bookings.inviteExternal` endpoint stays venue-only; artist
  external invites flow through the form's `unregisteredCollaborators` array.

## Affected files (summary)

| File                                                   | Change                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------- |
| `packages/db/src/schema/bookings.ts`                   | nullable `venue_id`, `inviter_artist_id`, index, relation, CHECK |
| `packages/db/migrations/*`                             | new migration (enum value, column, constraint)                   |
| `packages/shared/src/enums.ts`                         | `artist_to_artist` direction                                     |
| `packages/shared/src/types.ts`                         | optional inviter fields on `BookingSummary`                      |
| `packages/shared/src/notifications/triggers.ts`        | 5 new triggers + copy                                            |
| `packages/api/src/routers/events/crud.ts`              | role-branch platform invites; self/dedup guards                  |
| `packages/api/src/routers/bookings.ts`                 | `update` auth/flip, `list` tabs, `byId` auth, summary mapping    |
| `apps/native/components/events/BasicDetailsStep.tsx`   | ungate picker; pass self id                                      |
| `apps/native/components/events/InviteArtistPicker.tsx` | exclude self from results                                        |
| `apps/native/components/requests/RequestCard.tsx`      | a2a counterpart resolution                                       |
| `apps/native/components/requests/RequestActions.tsx`   | a2a sender/recipient button gating                               |
