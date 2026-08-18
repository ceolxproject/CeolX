# M8-T2 · In-App Venue Subscription States

| Field          | Value                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| **Milestone**  | M8 — Venue Subscription & Payments                                                                          |
| **Status**     | ✅ Implemented — local only, unmerged                                                                       |
| **Decisions**  | `M8-T0-Subscription-Decisions.md` — **read first.** This task implements D-15, D-16, D-28, D-46, D-57, V-14 |
| **Depends on** | M8-T1 (activation request + token), M8-T3 (status written by webhook)                                       |
| **Blocked by** | Nothing. O-02 and O-07 closed 17/08/2026 (D-57, D-46)                                                       |

---

## Description

Everything a venue sees in `apps/native` about its own subscription. Read-only — the app never writes subscription state and never links to payment (D-16).

---

## Affected apps / packages

| App / package  | Role                                                          |
| -------------- | ------------------------------------------------------------- |
| `apps/native`  | State screens, banners, blocked create actions                |
| `packages/api` | `users.me` already returns `venueProfiles.subscriptionStatus` |

---

## Scope

### 1 · The four states the venue can be in

| Status      | What the venue sees                                                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inactive`  | Activation state: **Activate Profile**, then "check your inbox", with **Resend Email** and **Refresh Status**. No price, no URL, no checkout button                             |
| `trialing`  | Normal app. Trial end date surfaced somewhere calm — the first charge is up to 6 months after sign-up and easy to forget (D-30 covers the email; this is the in-app equivalent) |
| `active`    | Normal app. No subscription messaging at all                                                                                                                                    |
| `past_due`  | Graduated per D-57 — see §3                                                                                                                                                     |
| `cancelled` | Same as `inactive`, minus the trial (D-42)                                                                                                                                      |

### 2 · Status refresh

**Refresh Status** button plus a check on app foreground. Do **not** add the 30-second poll the previous version of this task specified — activation happens on a different device entirely (the venue is on a laptop reading email), so a tight poll burns battery and rate limit for a transition that arrives minutes later at best. The existing `use-update-on-resume` hook already covers the foreground case.

Resend is rate-limited server-side in M8-T1. The button needs a visible cooldown so the user is not told "too many requests" by surprise.

### 3 · Past-due state

Two phases, per D-57.

**Inside the 7-day grace window** — full use of the app, banner only. The grace period exists to absorb an expired card; freezing during it would defeat the purpose.

**After the window expires** — a **holding block over the live map**: the map renders behind it, the account is frozen for normal use, and the block explains what is wrong and how to fix it. Still reachable through it: their own content, profile editing, and fix-payment. T&C wording covers ad removal (D-44).

The map must be genuinely rendered behind the block rather than a screenshot or placeholder — that visual is the whole point of the treatment Sean asked for.

### 4 · Blocked create actions

V-14: an unpaid venue cannot create events or posts. Disable the create actions with a message explaining an active subscription is needed. Nothing is created in a hidden state waiting to go live.

Applies when status is not in `('trialing','active','past_due')` — during grace they can still create, since they are still visible and still paying customers who had a card expire.

### 5 · Remove the interim free-access messaging

`apps/native/components/FreeAccessNotice.tsx` carries an explicit instruction to delete itself and its call sites when subscriptions ship. Six call sites:

- `app/(app)/create/post.tsx:269`
- `components/onboarding/venue/Step3SocialMedia.tsx:27`
- `app/(app)/events/create.tsx:152` (via `showFreeAccessNotice`)
- `components/events/TicketAdsStep.tsx:37,57,216`

Delete the component and the `showFreeAccessNotice` prop threading, not just the call sites.

### 6 · Copy

Per D-46, interim copy is ours — Sean confirmed "TBC by venue" is fine for now and cheap to change later. Write neutral strings, keep **all** of them in one module so a reword is one edit, and never state or imply non-payment. Do not reuse the previous version's placeholder strings; they promise things the current flow does not do.

---

## Acceptance criteria

- [ ] `inactive` venue sees the activation state; tapping **Activate Profile** requests a link and switches to "check your inbox"
- [ ] **Resend Email** works, shows a cooldown, and never surfaces a raw 429
- [ ] **Refresh Status** picks up an activation completed on another device
- [ ] App foreground re-checks status via the existing resume hook; no interval poll anywhere
- [ ] `trialing` venue uses the app normally and can see when the trial ends
- [ ] `active` venue sees no subscription messaging
- [ ] `cancelled` venue sees the activation state with no trial promised
- [ ] Create event and create post are blocked when unpaid, with a clear reason, and available during grace
- [ ] `FreeAccessNotice` and all six call sites removed, including the `showFreeAccessNotice` prop
- [ ] No price, payment URL, or checkout button anywhere in `apps/native` (D-16)
- [ ] Every unpaid-state string lives in one module and none implies non-payment (D-46)
- [ ] Inside grace: banner only, app fully usable
- [ ] After grace: holding block over a live-rendered map; own content, profile edit and fix-payment still reachable

---

## Dependencies

- **Upstream**: M8-T1, M8-T3
- **Downstream**: M8-T5 (shares the on-hold copy)
- **Blocked by**: nothing

---

## Notes

The previous version of this task specified a 30-second poll of `GET /api/v1/users/me`, a `pending_review` holding state for venue-created events, and profile visibility driven by `is_active`. All three are gone: the poll for the reason in §2, `pending_review` because V-14 blocks creation outright rather than queuing it, and `is_active` because D-14 removes the column.
