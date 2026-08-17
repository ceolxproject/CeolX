# M8-T5 · Unpaid-Venue Content Visibility

| Field          | Value                                                                                                                 |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Milestone**  | M8 — Venue Subscription & Payments                                                                                    |
| **Status**     | 🔲 To Do                                                                                                              |
| **Decisions**  | `M8-T0-Subscription-Decisions.md` **Section 9** — read first. This task implements D-52…D-59 and the V-01…V-14 matrix |
| **Depends on** | M8-T1 (visibility predicate), M8-T3 (status is accurate)                                                              |
| **Blocked by** | Nothing. O-01, O-03, O-04 and O-07 closed 17/08/2026 (D-56, D-58, D-59, D-46)                                         |

---

## Description

Apply the Section 9 matrix. This is the largest task in M8 and the one most likely to ship with holes, because **there is no single visibility flag** — each surface has its own rule and each is a separate call site. One missed query means an unpaid venue is either fully visible or fully gone.

Replaces the old M8-T5 (Artist checkout), deleted because Artist is free (D-01).

---

## Why this is a whole task

The venue visibility gate is currently switched off across the entire codebase, deliberately, under Asana 1215489113550392. `_profile-helpers.ts:76` ends `return true; // venue: gate disabled`, and the same de-gating exists in `discovery.suggestVenues`, `venues.list`, `events/map.ts`, `events/feed.ts`, `events/saved.ts`, `posts/feed.ts`, `posts/hydrate.ts` and `events/feed-ads.ts`.

Not one query filters on venue subscription state today. Nothing needs unpicking — and nothing exists.

The breadcrumbs left in those files assume the gate returns to a single boolean. **It cannot.** Sean's answers produced five different outcomes across surfaces: profile hidden, own events placeholder-ed, posts visible, artist events visible, picker entry visible-but-unselectable.

---

## Scope — one section per surface

Reference `M8-T0` Section 9.2 for the rule. Do not restate rules here.

### V-01 / V-02 · Venue profile and share link

`_profile-helpers.ts` returns a three-way state from M8-T1. Render the **on hold** state — never a neutral "not available", which reads as our bug and defeats D-52.

`apps/server/src/routes/profile-share.ts:83` currently gates artists only (`profile.isActive !== true → notFound()`). The venue branch needs the same treatment, returning on-hold rather than 404, so a shared `ceolx.com/u/<handle>` link matches the in-app screen.

### V-03 · Venue's own upcoming events

Off map and feed. Saved events and direct links get the **"TBC by venue"** placeholder instead of a vanished event — a spectator who saved a gig must not simply lose it.

Touches `events/map.ts`, `events/feed.ts`, `events/saved.ts`. See §"The creator-dependent filter" below.

### V-05 / V-06 · Artist events

Manual-location artist events are untouched (no link to the venue exists). Artist events **formally linked** to an unpaid venue stay visible, and the artist is notified their venue is on hold.

The venue block on such an event renders on-hold rather than linking to a hidden profile.

The notification is a new trigger — add it to `M7-T0-Notifications-Matrix.md` rather than inventing one here.

### V-07 · Venue posts

Stay visible. No filter to add — but tapping the author lands on the on-hold profile from V-01, so verify that path renders correctly rather than erroring.

### V-09 · Artist's venue picker

`venues.list` already returns every venue unfiltered. The change is **additive**: expose the subscription state so the picker can badge the entry, make it unselectable, and offer the manual-address CTA (D-52, V-05).

Without that CTA the artist hits a dead end and D-52 inverts — we trade "CeolX didn't list the venue" for "CeolX listed one I can't use and offered nothing".

### V-11 · Feed ads

One filter in `fetchFeedAds` (`events/feed-ads.ts`), which currently joins `venueProfiles` with no subscription condition.

### V-08 · Collections

Hidden, following the events inside them (D-59).

### V-10 · Spectator search

Hidden from `discovery.suggestVenues` (D-58).

Note the deliberate asymmetry: `venues.list` (artist picker) keeps unpaid venues **listed**, while `discovery.suggestVenues` (spectator) **excludes** them — two opposite rules over the same rows. Leave a comment at both call sites saying so, or someone will later "fix" the inconsistency and break one of them.

### V-12 / V-13 · Bookings

Untouched (D-56). Accepted bookings stay, and pending invitations **stay actionable** — the artist can still accept.

There is no code to write here, which is the point: verify by test that a venue going unpaid changes nothing in the bookings tab for either party, so the behaviour is pinned and cannot regress.

---

## The creator-dependent filter

V-03 hides venue-created events while V-06 keeps artist-created ones. **"Is this event hidden" therefore depends on who created it.**

Map and feed read from Typesense. The event document (`creator_id`, `venue_name`, `venue_address`, `status` — `packages/api/src/services/event-sync.ts`) carries neither venue subscription state nor `venue_id`.

Per **D-54: post-filter after Typesense returns. Do not index the subscription state.** Indexing it means a fan-out job re-indexing every one of a venue's events on each subscription change, and a consistency window where a venue that just paid is still invisible. Map caps at 50 pins and feed pages are small, so a `venue_id → status` lookup over the returned ids is cheap and always correct.

Over-fetch slightly so filtering does not produce short pages, and record D-55's ceiling in a `ponytail:` comment at the call site.

---

## Acceptance criteria

- [ ] Unpaid venue profile renders **on hold** in-app and via the share link — never a 404 or "unavailable"
- [ ] Venue's upcoming events are off map and feed
- [ ] A spectator who saved one of those events sees the "TBC by venue" placeholder, not a missing item
- [ ] Artist events with a manual location are completely unaffected
- [ ] Artist events linked to an unpaid venue **stay visible**; the venue block shows on-hold
- [ ] The linked artist is notified their venue is on hold; the trigger is recorded in `M7-T0`
- [ ] Venue posts stay in the feed, and tapping the author reaches the on-hold profile without error
- [ ] Venue appears in the artist picker, badged, **unselectable**, with a working manual-address CTA
- [ ] Feed ads exclude unpaid venues
- [ ] Everything above reverses automatically when payment resumes — verified by moving a venue `past_due` → hidden → `active` and confirming no manual step and no re-index
- [ ] Map and feed do not return short pages after filtering
- [ ] No venue subscription field was added to the Typesense schema
- [ ] Collections hidden with their events
- [ ] Unpaid venues absent from spectator search but still listed in the artist picker, with a comment at both call sites explaining the asymmetry
- [ ] A venue going unpaid changes nothing in either party's bookings tab, pinned by test
- [ ] Every unpaid-state string lives in one module (D-46)

---

## Dependencies

- **Upstream**: M8-T1, M8-T3
- **Related**: M7-T0 (new artist notification trigger), M8-T2 (shares on-hold copy)
- **Blocked by**: nothing

---

## Notes

**A consequence worth recording so it is not reopened as a bug later.** V-06 and V-07 together mean an unpaid venue keeps real presence on the platform through artist events and its own feed posts. The "closes the loophole" argument in the original proposal no longer applies. Sean chose this deliberately — artist social pressure is the intended collection mechanism.

**Test the reverse direction as carefully as the forward one.** Hiding correctly and restoring incorrectly is the failure mode that generates support tickets from paying customers.
