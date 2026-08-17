# M7-T0 · CeolX Notifications Matrix (Comprehensive Trigger Inventory)

| Field         | Value                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Milestone** | M7 — Notifications & Emails (planning reference)                                                                                           |
| **Status**    | ✅ Done — used as the trigger source-of-truth for M7-T1/T2/T3 (PRs #48–#50)                                                                |
| **Purpose**   | Single source of truth for every notification trigger across CeolX, organised by persona. Feeds the implementation of M7-T1 / T2 / T3.     |
| **Owner**     | Priya Yadav                                                                                                                                |
| **Audit by**  | Pratiksha Patil (PM)                                                                                                                       |
| **Scope**     | V1 launch (all milestones M1–M12). Triggers labelled ⏳ V2 are out of scope for launch but listed so they are accounted for in the schema. |

---

## How to read this document

Each persona has its own table plus a shared "Universal" section for saved-event triggers that apply regardless of persona. Columns:

| Column      | Meaning                                                                 |
| ----------- | ----------------------------------------------------------------------- |
| **#**       | Row reference (e.g. `S-03` = Spectator row 3, `U-01` = Universal row 1) |
| **Trigger** | The event that causes the notification                                  |
| **Push**    | FCM push notification variant (M7-T1)                                   |
| **In-App**  | Row in the Notification Centre inbox (M7-T2)                            |
| **Email**   | Postmark transactional email (M7-T3)                                    |
| **Route**   | Deep-link path the tap handler navigates to (push + in-app)             |
| **Source**  | Milestone / task that originates the trigger                            |

Legend for the Push / In-App / Email cells:

| Symbol | Meaning                                                       |
| ------ | ------------------------------------------------------------- |
| ✅     | Sent in V1                                                    |
| —      | Not sent (intentional — e.g. spam avoidance or wrong channel) |
| ⏳     | Deferred to V2 (schema supports it but no dispatch in V1)     |

Copy conventions used in the titles / bodies follow M7-T1 R6 — see Section 9.

---

## 1 · Spectator (End User)

Fans discovering events. No public profile → nobody can follow them → no "new follower" row. Spectators _can_ save events; those notifications live in Section 5 (Universal).

| #    | Trigger                                               | Push | In-App | Email | Route                     | Source        |
| ---- | ----------------------------------------------------- | ---- | ------ | ----- | ------------------------- | ------------- |
| S-01 | Sign-up — email verification                          | —    | —      | ✅    | `/verify-email?token=…`   | M2-T1         |
| S-02 | Password reset requested                              | —    | —      | ✅    | `/reset-password?token=…` | M2-T3         |
| S-03 | New event posted by a followed Artist                 | ⏳   | ⏳     | —     | `/events/:id`             | M3-T4 / M6-T3 |
| S-04 | New event posted by a followed Venue                  | ⏳   | ⏳     | —     | `/events/:id`             | M3-T4 / M6-T3 |
| S-05 | New post from a followed Artist / Venue (feed update) | ⏳   | ⏳     | —     | `/posts/:id`              | M6-T4         |
| S-06 | GDPR — account deletion complete                      | —    | —      | ✅    | —                         | M11-T1        |
| S-07 | GDPR — data export ready for download                 | —    | —      | ✅    | `ceolx.com/export/:token` | M11-T1        |
| S-08 | Inactive account warning (24-month dormancy)          | —    | —      | ✅    | —                         | M11-T1        |

**Spectator V1 summary:** 0 push, 0 in-app, 5 email (auth + GDPR). All saved-event notifications are shared with Artist/Venue — see Section 5.

---

## 2 · Artist

**Free persona (updated 17/08/2026).** Artist no longer pays — see `M8-Venue-Subscription/M8-T0-Subscription-Decisions.md` D-01/D-03. Rows A-03 through A-08 below are **withdrawn**; there is no Artist subscription and therefore no Artist billing email. All booking triggers apply in both directions (Artist-initiated requests and Venue-initiated invitations).

One **new** Artist trigger arrives from M8-T5: an artist whose event is linked to a venue must be told when that venue's profile goes on hold, so the artist chases the venue. Added as A-20 below.

| #    | Trigger                                                                | Push | In-App | Email | Route                     | Source        |
| ---- | ---------------------------------------------------------------------- | ---- | ------ | ----- | ------------------------- | ------------- |
| A-01 | Sign-up — email verification                                           | —    | —      | ✅    | `/verify-email?token=…`   | M2-T1         |
| A-02 | Password reset                                                         | —    | —      | ✅    | `/reset-password?token=…` | M2-T3         |
| A-03 | ~~Artist activation email~~ — **withdrawn 17/08/2026, Artist is free** | —    | —      | —     | —                         | —             |
| A-04 | ~~Artist activation resend~~ — **withdrawn**                           | —    | —      | —     | —                         | —             |
| A-05 | ~~Artist subscription activated~~ — **withdrawn**                      | —    | —      | —     | —                         | —             |
| A-06 | ~~Artist subscription renewed~~ — **withdrawn**                        | —    | —      | —     | —                         | —             |
| A-07 | ~~Artist payment failed~~ — **withdrawn**                              | —    | —      | —     | —                         | —             |
| A-08 | ~~Artist subscription cancelled~~ — **withdrawn**                      | —    | —      | —     | —                         | —             |
| A-09 | Booking invitation received — Venue invited Artist to an event         | ✅   | ✅     | ✅    | `/bookings/:id`           | M5-T1         |
| A-10 | Booking accepted — Artist's application to a Venue event was accepted  | ✅   | ✅     | ✅    | `/bookings/:id`           | M5-T2         |
| A-11 | Booking rejected — Venue declined the Artist's application             | ✅   | ✅     | ✅    | `/bookings/:id`           | M5-T2         |
| A-12 | Booking cancelled — counter-party cancelled an accepted booking        | ✅   | ✅     | ✅    | `/bookings/:id`           | M5-T3         |
| A-13 | Added as confirmed Collaborator on a Venue's event                     | ✅   | ✅     | —     | `/events/:id`             | M4-T1         |
| A-14 | Invited as outside-platform collaborator (recipient has no account)    | —    | —      | ✅    | `ceolx.com/invite/:token` | M4-T1 / M7-T3 |
| A-15 | Event removed by admin (Artist is creator) — with reason               | ✅   | ✅     | ✅    | `/events/:id`             | M4-T3         |
| A-16 | Event resubmitted successfully (creator edited + saved)                | ✅   | ✅     | —     | `/events/:id`             | M4-T3         |
| A-17 | New follower on Artist profile                                         | ⏳   | ⏳     | —     | `/profile/followers`      | M6-T3         |
| A-18 | GDPR — account deletion complete                                       | —    | —      | ✅    | —                         | M11-T1        |
| A-19 | GDPR — data export ready                                               | —    | —      | ✅    | `ceolx.com/export/:token` | M11-T1        |
| A-20 | Linked venue's profile went on hold — your event stays visible         | ✅   | ✅     | —     | `/events/:id`             | M8-T5         |

**Artist V1 summary:** 9 push + 9 in-app + 16 email. Every booking state change now produces an email fallback alongside push/in-app.

---

## 3 · Venue / Business

Paid persona (higher tier). Receives booking requests from Artists and invites Artists to its own events.

| #    | Trigger                                                             | Push | In-App | Email | Route                     | Source        |
| ---- | ------------------------------------------------------------------- | ---- | ------ | ----- | ------------------------- | ------------- |
| V-01 | Sign-up — email verification                                        | —    | —      | ✅    | `/verify-email?token=…`   | M2-T1         |
| V-02 | Password reset                                                      | —    | —      | ✅    | `/reset-password?token=…` | M2-T3         |
| V-03 | Venue persona selected — activation email (Stripe subscribe link)   | —    | —      | ✅    | `ceolx.com/subscribe`     | M7-T3 / M2-T4 |
| V-04 | Activation email resent (user-initiated from in-app pending screen) | —    | —      | ✅    | `ceolx.com/subscribe`     | M8-T2         |
| V-05 | Subscription activated (first successful payment)                   | ✅   | ✅     | ✅    | `/profile`                | M8-T1 / M8-T2 |
| V-06 | Subscription renewed (recurring payment)                            | ✅   | ✅     | ✅    | `/profile`                | M8-T3         |
| V-07 | Payment failed (`past_due`)                                         | —    | —      | ✅    | `ceolx.com/account`       | M8-T3 R2.1    |
| V-08 | Subscription cancelled                                              | —    | —      | ✅    | `ceolx.com/account`       | M8-T3 R3.1    |
| V-09 | Booking request received — Artist applied to Venue's event          | ✅   | ✅     | ✅    | `/bookings/:id`           | M5-T2         |
| V-10 | Booking accepted — Artist accepted Venue's invitation               | ✅   | ✅     | ✅    | `/bookings/:id`           | M5-T1         |
| V-11 | Booking rejected — Artist declined Venue's invitation               | ✅   | ✅     | ✅    | `/bookings/:id`           | M5-T1         |
| V-12 | Booking cancelled — counter-party cancelled an accepted booking     | ✅   | ✅     | ✅    | `/bookings/:id`           | M5-T3         |
| V-13 | Pending Artist cancelled their application before Venue responded   | ✅   | ✅     | ✅    | `/bookings/:id`           | M5-T2         |
| V-14 | Event removed by admin (Venue is creator) — with reason             | ✅   | ✅     | ✅    | `/events/:id`             | M4-T3         |
| V-15 | Event resubmitted successfully                                      | ✅   | ✅     | —     | `/events/:id`             | M4-T3         |
| V-16 | New follower on Venue profile                                       | ⏳   | ⏳     | —     | `/profile/followers`      | M6-T3         |
| V-17 | GDPR — account deletion complete                                    | —    | —      | ✅    | —                         | M11-T1        |
| V-18 | GDPR — data export ready                                            | —    | —      | ✅    | `ceolx.com/export/:token` | M11-T1        |

**Venue V1 summary:** 9 push + 9 in-app + 16 email. Same shape as Artist; the activation / payment email _copy_ differs per persona but template structure is shared.

---

## 4 · Super Admin

Single internal account. Web dashboard only → **no push** channel. Events are reviewed by the admin browsing the dashboard, not via real-time alerts.

| #    | Trigger                                            | Push | In-App | Email | Route                     | Source |
| ---- | -------------------------------------------------- | ---- | ------ | ----- | ------------------------- | ------ |
| X-01 | Admin password reset                               | —    | —      | ✅    | `/reset-password?token=…` | M9-T1  |
| X-02 | New event created (feeds Content Review dashboard) | —    | ✅     | —     | `/admin/events`           | M9-T2  |

**Super Admin V1 summary:** 0 push, 1 in-app, 1 email.

---

## 5 · Universal — Saved-event notifications

**Applies to any persona that saved an event** (Spectator, Artist, or Venue). In V1 every user can "save" an event to their favourites list. The triggers below fire based on the relationship between the user and the saved event, regardless of which persona the user holds.

> ⚠ **Implementation dependency:** save-event functionality is not yet scoped as a task. Before M7-T1 starts, a new task (likely `M4-T5 Save Events to Favourites`) must be created covering: `saved_events` join table (`user_id`, `event_id`, `saved_at`), Save button on Event Detail, scheduled reminder job (QStash via M1-T13), cascade logic for removal / details change.

| #    | Trigger                                                               | Push | In-App | Email | Route         | Source              |
| ---- | --------------------------------------------------------------------- | ---- | ------ | ----- | ------------- | ------------------- |
| U-01 | Saved event reminder — 2 days before start                            | ✅   | ✅     | —     | `/events/:id` | NEW (M4-T5 prereq)  |
| U-02 | Saved event reminder — 1 day before start                             | ✅   | ✅     | —     | `/events/:id` | NEW (M4-T5 prereq)  |
| U-03 | Saved event removed by admin (cascade from creator's event take-down) | ✅   | ✅     | —     | `/events/:id` | M4-T3 + new cascade |
| U-04 | Saved event details changed by creator (date, venue, or cancellation) | ✅   | ✅     | —     | `/events/:id` | M4-T1 + new cascade |

**Universal V1 summary:** 4 push + 4 in-app + 0 email.

Route target `/events/:id` opens Event Detail where the user can see the updated info or unsave. Persona on the FCM payload is the user's current `current_role` at the time of dispatch — the tap handler does not need to auto-switch because all personas can view any event.

---

## 6 · Aggregate counts (V1 only, ⏳ excluded)

Each row represents one persona's notification row definition. Totals add up to all V1 trigger rows across the matrix.

| Section     | Push   | In-App | Email  |
| ----------- | ------ | ------ | ------ |
| Spectator   | 0      | 0      | 5      |
| Artist      | 9      | 9      | 16     |
| Venue       | 9      | 9      | 16     |
| Super Admin | 0      | 1      | 1      |
| Universal   | 4      | 4      | 0      |
| **Total**   | **22** | **23** | **38** |

**Postmark template count (estimated V1):** ~14 distinct templates. Many triggers reuse templates via model variables (e.g. Artist and Venue subscription emails share one template with a `{{persona}}` variable; activation-email + activation-resent reuse the same template; booking emails use one template per state with a `{{recipientRole}}` variable).

Rough V1 template list:

1. Email verification
2. Password reset
3. Persona activation (shared Artist + Venue)
4. Subscription payment confirmation (activated + renewed)
5. Payment failed
6. Subscription cancelled
7. Booking — invitation / request received
8. Booking — accepted
9. Booking — rejected
10. Booking — cancelled
11. Outside-platform collaborator invite
12. Event removed (with reason)
13. GDPR — account deletion confirmation
14. GDPR — data export ready
15. Inactive account warning
16. Admin password reset (separate sender domain)

---

## 7 · Resolutions from PM audit round 1 (2026-04-18)

These were the open questions flagged in rev 1. All resolved by Priya pending Pratiksha's sign-off.

| Ref | Question                                           | Decision                                                                                          |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Q1  | Send a welcome / consent-receipt email at sign-up? | **No.** Consent is logged in DB. No welcome email shipped in V1.                                  |
| Q2  | Is spectator save/RSVP in V1 scope?                | **Yes — universal.** All three mobile personas can save any event. Drives Section 5.              |
| Q3  | Event reminder timing for saved events?            | **2 days before + 1 day before start.** Implemented as QStash scheduled jobs.                     |
| Q4  | Do booking notifications need an email fallback?   | **Yes — all booking state changes get email** in addition to push + in-app. See A-09–12 / V-9–13. |
| Q5  | Ship a user-facing "Report this event" flow in V1? | **No.** Admin is the only moderator; admin browses the content review dashboard directly.         |

### New dependency flagged by these decisions

- **M4-T5 Save Events to Favourites** — not yet scoped. Covers the `saved_events` table, Save button UX, scheduled reminder jobs, and cascade handlers for events that change or get removed. Must be written before M7-T1 can dispatch U-01 / U-02 / U-03 / U-04.

---

## 8 · Cross-references — which milestone unlocks which trigger group

Useful when scheduling M7 work against other milestone progress.

| Trigger group                                    | Blocked until                                 |
| ------------------------------------------------ | --------------------------------------------- |
| Auth emails (S-01/02, A-01/02, V-01/02)          | M2-T1 / M2-T3 complete                        |
| Persona activation emails (V-03/04)              | M2-T4 + M8-T1 + M8-T6 complete                |
| Subscription lifecycle (V-05 → V-08)             | M8-T1, M8-T3, M8-T6 complete                  |
| Venue-on-hold notice to linked artists (A-20)    | M8-T5 complete                                |
| Booking notifications (A-09 → A-12, V-09 → V-13) | M5-T1, M5-T2, M5-T3 complete                  |
| Collaborator notifications (A-13, A-14)          | M4-T1 complete                                |
| Event moderation (A-15/16, V-14/15)              | M4-T3 + M9-T2 complete                        |
| Follow notifications (S-03–05, A-17, V-16)       | M6-T3 complete **and** V2 release decision    |
| Saved-event notifications (U-01 → U-04)          | NEW task M4-T5 complete + M1-T13 QStash ready |
| GDPR emails (S-06/07/08, A-18/19, V-17/18)       | M11-T1 complete                               |
| Admin email (X-01)                               | M9-T1 complete                                |

---

## 9 · Copy convention for all templates

All push + in-app titles must follow M7-T1 R6:

- Confirmation titles end with ` ✓` (e.g. `Booking Accepted ✓`, `Payment Received ✓`)
- Rejection / removal titles are neutral, not punitive (e.g. `Booking Not Accepted`, `Your event needs revision`)
- Body lines ≤ 120 characters, include the concrete subject (event title, artist name) so the row is meaningful without tapping
- Persona label (`artist | venue | spectator`) always set on the payload — drives the tap handler's auto-switch (M7-T1 R4.1)
- For Universal (saved-event) rows: persona = user's `current_role` at dispatch time; no auto-switch needed since Event Detail is visible to all personas

Email subject lines follow M7-T3 R2.1 / R3.1 / etc. — see that task for the full copy spec.

---

## 10 · Revision log

| Date       | Author      | Change                                                                                                                                                                                                          |
| ---------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-18 | Priya Yadav | Initial draft — comprehensive inventory for PM audit                                                                                                                                                            |
| 2026-04-18 | Priya Yadav | Rev 2 — applied decisions Q1–Q5: dropped welcome email + report flow, added universal save-event section with 2d/1d reminders, added email variants to all booking state changes. Flagged new M4-T5 dependency. |
