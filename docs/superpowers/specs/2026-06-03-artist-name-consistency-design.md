# Artist Name Consistency & Findability — Design

**Date:** 2026-06-03
**Status:** Approved for implementation
**Scope:** Artists only (venues explicitly out of scope)

## Problem

A user's name is captured in three places that are currently disconnected:

1. **Registration** (email/password or social) → `user.name`
2. **Artist onboarding** → `artist_profiles.stage_name` (field labelled "Artist / Band Name", starts **blank**)
3. **Profile / Invite Artist search** → reads `artist_profiles.stage_name` only

Because onboarding starts the name blank and the Invite Artist search matches `stage_name`
only, a person who registers as "Vivek" but sets stage name "Tune Bomb" becomes
**unfindable** when a venue searches "Vivek". The admin users table shows the account
name ("Vivek"); the picker shows the stage name ("Tune Bomb"). They look like two
unrelated people.

This was misreported as a regression from removing the Collaborator field. It is not —
the picker, the `artists.search` endpoint, and the schema are unchanged and correct. The
issue is the name model, not the event form.

## Goal

The registration name should flow into onboarding and the public profile so they start
**identical**, while still allowing an artist/band to deliberately override the public
name. Artists must be **findable by either** their account name or their stage name.

## Decisions (confirmed)

- **Artists only.** Venue onboarding is left as-is — a venue name is a business name and
  is almost always different from the owner's account name, so pre-filling the person's
  name there would be wrong.
- **One-time pre-fill, not live sync.** Registration name pre-fills the onboarding name.
  After that, the account name and the public/stage name are independent (so a band can
  diverge). Renaming the account later does **not** rewrite the public profile.
- **Profile edits the public name only** (`stage_name`). Account name is not edited there.
- **Search matches account name OR stage name**, and the dropdown **displays both**
  (`Tune Bomb · Vivek`) so a search-by-real-name result is not confusing.
- **`artists.search` becomes `protectedProcedure`** (only authenticated venues use it),
  closing anonymous enumeration of artists' real names — a GDPR-relevant tightening since
  the account name is personal data.

## Changes

### 1. Onboarding pre-fill (native) — `apps/native/hooks/use-artist-onboarding.ts`

- Initialise `stageName` from `user.name` instead of `''`, capped at the 100-char
  stage-name limit so the field never starts in an invalid state.
- Pre-fill must **not** clobber a restored draft or in-progress typing. Rule: pre-fill the
  field from `user.name` only when there is **no saved draft** and the field is still
  **untouched and empty**. The existing draft-restore path (`setStageName(saved.stageName ?? '')`)
  continues to win when a draft exists.
- `user.name` may be null (some social signups) → fall back to `''` (current behaviour).

### 2. Search endpoint (api) — `packages/api/src/routers/artists.ts`

- Change `search: publicProcedure` → `search: protectedProcedure`.
- Add `or` to the drizzle-orm import.
- WHERE clause: `or(ilike(artistProfiles.stageName, %q%), ilike(user.name, %q%))`
  (the `user` table is already joined).
- Add `name: user.name` to the selected columns; return it in each artist result.
- Result shape per artist: `{ id, stageName, genre, image, name }`.

### 3. Search row display (native) — `apps/native/components/events/ArtistSearchRow.tsx`

- Add `name: string | null` to the `ArtistResult` type.
- Primary line: `stageName`.
- Secondary line: when `name` is present **and differs** from `stageName`, show the
  account name; keep showing `genre`. Combine as `name · genre` (omit either if absent).

## Out of scope

- Venue onboarding pre-fill.
- Filtering search by `isActive` / subscription status. (Search returns all artist
  profiles today regardless of subscription — pre-existing behaviour. Noted for a future
  decision per the PRD "artist not visible until subscription active" rule; not changed here.)
- Live two-way account-name ↔ stage-name sync.
- Local Mailpit / email-verification visibility issue (separate; unrelated to this change).

## Data / migration

None. Change #2 makes existing artists (e.g. "Tune Bomb", "Echo") findable by their real
names immediately. Change #1 affects future onboardings only.

## Testing

- **API (`packages/api/src/__tests__`):** `artists.search` —
  (a) matches by stage name, (b) matches by account name, (c) returns the `name` field,
  (d) rejects unauthenticated callers (now protected).
- **Native:** verify onboarding pre-fills `stageName` from `user.name`, respects a saved
  draft, and caps at 100 chars. Verify `ArtistSearchRow` renders the account name only
  when it differs from the stage name.

## Edge cases (resolved)

| Edge case                                 | Resolution                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| Spectator/venue named like the query      | `innerJoin artist_profiles` — only users with an artist profile are returned. |
| Null `user.name`                          | `ilike` on null doesn't match; stage-name match still works.                  |
| Pre-fill longer than 100 chars            | Cap pre-filled value at the stage-name max length.                            |
| Draft vs pre-fill race                    | Pre-fill only when no draft and field untouched; draft restore wins.          |
| Real-name privacy on public endpoint      | Endpoint made `protectedProcedure`; display limited to authenticated venues.  |
| Same row matches both name and stage name | Single `artist_profiles` row — no duplicate.                                  |
