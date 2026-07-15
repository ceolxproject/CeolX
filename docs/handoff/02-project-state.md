# Project State

Where the build actually is, what's half-finished, and what's blocked on someone outside engineering. Read this after `01-gotchas.md` — it tells you *what* is done; the gotchas file tells you what will bite you while touching it.

## Milestone status

Full task-level detail lives in [`docs/project-management/PROGRESS.md`](../project-management/PROGRESS.md) (the live tracker — source of truth for status) and [`docs/project-management/CeolX_Milestones.md`](../project-management/CeolX_Milestones.md) (the original scope/plan doc — useful for *why*, but several details are superseded; see note below). This table is a compact summary, not a restatement.

| Milestone | Status | Note |
|---|---|---|
| M1 — Project Setup & Infrastructure | done | All 13 tasks shipped (Turborepo, DB infra, tRPC/Hono scaffold, RN+Expo, admin scaffold, Postmark, rate limiting, CORS, Sentry, shared package). |
| M1.5 — Database Schema Design | done | All 7 schema tasks shipped, migrations + seed data applied. |
| M1.6 — Design System & Shared Packages | done | Tailwind v4 tokens, ShadCN theme, shared components (web + native), Zod validators, tRPC error utils. |
| M2 — Authentication & Persona System | done | Email/password, Google + Apple sign-in, forgot password, persona onboarding, RBAC, sessions, privacy/terms acceptance. |
| M3 — Map & Discovery | done | Viewport query, location fallback chain, clustering + search, algorithmic feed. |
| M4 — Event System | done | Create/edit, detail screen, moderation flow, my-events + collections. Note: moderation model has since changed from pre-publish approval to post-publication review — see CLAUDE.md "Event Moderation" section, which supersedes the original M4-T3/M9-T2 approve/reject-before-live design in `CeolX_Milestones.md`. |
| M5 — Booking Flow (Artist ↔ Venue) | done | Venue-initiated, artist-initiated, cancel flow + state machine. |
| M6 — Profiles & Social | done | Artist + Venue profiles, follow system, posts & promotional content. |
| M7 — Push Notifications & Emails | in-progress | M7-T1 (FCM push, PR #50), M7-T2 (inbox, PR #49), M7-T3 (6 core transactional emails, PR #48) are done. M7-T4 (remaining matrix emails) is partially done — see "Unfinished / half-built" below. |
| M8 — Venue Subscription & Payments | not started | All 4 tasks (`M8-T1`–`M8-T4`: Stripe web checkout, webhook handler, in-app pending-activation UI, subscription management portal) are open. |
| M9 — Super Admin Dashboard | done | Admin auth/dashboard (PR #53), event moderation queue (PR #57). |
| M10 — Media (S3, CloudFront, Mux) | done | Upload pipeline shipped (PR #60). |
| M11 — Analytics & GDPR | in-progress | GDPR erasure + inactive-account cron (PR #52), admin analytics/KPI (PR #56), per-event analytics (PR #54) are done. M11-T1.5 (consent/privacy/cookie/location audit, split out of T1) is still open. |
| M12 — QA & Launch Prep | not started | Testing/QA, App Store submission, production deployment all open. |

## Unfinished / half-built

- **Email matrix scope gap** — `M7-T0` (the notification matrix spec) defines 38 V1 emails; `M7-T3` (the only email *build* task, PR #48) shipped only 6 (verification, password-reset, venue-activation, payment-confirmation, event-approved, event-rejected). The `EmailTemplate` union in `packages/email/src/types.ts` is constrained to those 6, so nothing else can dispatch yet. Two follow-up PRs have since landed against `M7-T4` (PR #136 — booking-lifecycle emails; PR #137 — outside-platform invite, `A-14`); PR3 (subscription-lifecycle, gated on M8/Stripe) and PR4 (GDPR/inactivity/admin reset) are still open. Full remaining scope and PR breakdown: [`docs/project-management/M7-Notifications-Emails/M7-T4-Remaining-Matrix-Emails.md`](../project-management/M7-Notifications-Emails/M7-T4-Remaining-Matrix-Emails.md) (confirmed present on disk). Important constraint for whoever picks this up: email-only rows (payment-failed, GDPR notices) must **not** be routed through `makeDispatchNotification` in `apps/server/src/services/notifications-dispatcher.ts` (confirmed present) — it always writes an inbox row alongside push, which is wrong for email-only triggers.
- **Orphaned `bookings.inviteExternal` procedure** — `packages/api/src/routers/bookings.ts` (confirmed: `inviteExternal` defined at line 1145, using `inviteExternalArtistSchema`) has a fully built and tested external-artist-invite-email flow, but it has zero callers in `apps/native` or `apps/admin`. The UI actually submits external invitees through `events.create` / `events.update`'s `unregisteredCollaborators` field, handled in `packages/api/src/routers/events/crud.ts` (confirmed: `unregisteredCollaborators` branches at lines ~659 and ~1070–1094). The token-generation and email-sending logic was ported into that path separately; `bookings.inviteExternal` remains dead code — tested, but not wired to anything a user can trigger. Don't assume "has tests" means "is live."
- **FCM push stack status correction** — the FCM push notification stack (token registration, dispatch, deep-link routing) is **fully live** on `development` and production. A partial-revert branch, `fix/m7-t1-fcm-revert`, was prepared during an iOS build investigation (a `React-Core-prebuilt` / modular-headers conflict with `@react-native-firebase`) but was **never merged**. Do not reintroduce that revert or treat FCM as disabled — `apps/server/src/services/notifications-dispatcher.ts` and `apps/server/src/jobs/handlers/notification.ts` are the live production path. If the same iOS pod-install error resurfaces, the fix is `ios.buildReactNativeFromSource: true` in the `expo-build-properties` plugin block, not a revert.
- **`is_gig_opportunity` deprecated** — `packages/db/src/schema/events.ts` line 65 keeps the column as nullable with an explicit `// DEPRECATED — nullable, no longer written` comment (confirmed on disk). It is no longer written by any create/edit path; any event can now receive artist performance requests, not just ones flagged as a "gig opportunity." Historical rows may still carry a value — do not branch new logic on it.
- **`ADDED_AS_COLLABORATOR_TO_ARTIST` notification trigger — kept but unused** — still defined in `packages/shared/src/notifications/triggers.ts` (line 386, confirmed) and covered by `packages/shared/src/notifications/__tests__/triggers.test.ts`, but the direct/auto-confirmed "Collaborator" field that used to fire it was removed from the event form on 31/05/2026 (Asana 1215188774775403 — see CLAUDE.md "Event form field distinctions"). Every artist link now flows through Invite Artist → pending booking → acceptance, which fires a different trigger. This one is flagged for Pratiksha to decide whether to formally retire it from the notification matrix or repurpose it.

## Open items awaiting client input

Reproduced from `CLAUDE.md`'s "Open Items" table — these are blocked on the client or Pratiksha, not on engineering:

| # | Item | Owner |
|---|---|---|
| 1 | Default event categories — pre-seeded values? | Client to provide |
| 2 | Venue subscription — feature gating between Lite and Pro tiers | Client post-launch |
| 3 | Promotional ads — frequency cap and targeting rules | Pratiksha to confirm |
| 4 | UI design approval — Feed vs Map home screen layout | Pratiksha / client sign-off |
| 5 | Notification trigger list — full client sign-off | Priya to share draft |
| 6 | Venue pre-seeding — will client provide registered venues list? | Client to confirm |
