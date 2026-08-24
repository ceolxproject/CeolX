# M11-T4 · PostHog Product Analytics (Mobile)

| Field          | Value                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| **Milestone**  | M11 — Analytics & GDPR                                                                                      |
| **Status**     | 📝 Draft story — blocked on GDPR sign-off + PostHog key (see §10)                                           |
| **Depends on** | M2 (auth + personas), M4 (events), M5 (bookings), M11-T1 (GDPR — closed; session replay reopens it)         |
| **Asana**      | [1216903169745967](https://app.asana.com/1/1194107417268910/project/1210959953917909/task/1216903169745967) |
| **PRD Ref**    | No dedicated section yet — to be added under Analytics                                                      |

---

## Why this document exists

Asana story `1216903169745967` ("Plan & Integrate PostHog Analytics for V1") has **zero `[AC]` subtasks**
and bundles a second, unrelated feature. It fails Definition-of-Ready, so it cannot be planned or built
against as written.

This is the replacement story, drafted against the **live Feature Template v0.5**
(Asana GID `1216778429401199`) for the PM to review and create. §Header–§10 are the PM's sections,
filled here as a proposal; §11–12 are the dev planning pass.

> Distinct from **M11-T2** (admin KPI dashboard) and **M11-T3** (per-event creator analytics), which are
> in-product features showing data to users. This task is internal team instrumentation — third-party
> product analytics for the CeolX team, not a user-facing screen.

---

## Meta

- **Feature:** PostHog product analytics (mobile)
- **Status:** draft
- **PM:** Pratiksha Patil
- **Feature doc:** `prd/CeolX_PRD_v1.6.docx` (no dedicated section yet — add under Analytics)

---

## Header

- **STORY:** Instrument the mobile app with PostHog product analytics
- **Surface(s):** `apps/native` only (iOS + Android, parity). Admin dashboard and server are out.
- **Actor / role:** All mobile personas — spectator, artist, venue — plus unauthenticated guests.
- **Allowed / blocked:** Analytics runs for every app user including guests. Guest and logged-out
  events must carry **no** user identifiers. A logged-out device must never be attributed to the
  previous account.
- **Priority:** P1 — **Type:** new feature
- **Depends on / related:** Blocks nothing. Related: M11-T1 GDPR Compliance (1213823931823446, closed —
  session replay reopens it); M8-T1/T2 Stripe (stubbed, gates the conversion funnel).
- **Touches these modules:** app root layout, auth context (identify/reset), expo-router navigation,
  `packages/env` native schema, `packages/shared` constants. Session replay adds a native module, so
  a new dev-client + distribution build is needed before testers see replay data (routine here — the
  app already uses `expo-dev-client` with committed `ios/`/`android/`).

## 1 · What this is / why

- **Story:** As the CeolX product team, we want per-screen and per-funnel behavioural data from the
  mobile app, so that after launch we can find where users drop off instead of guessing.
- **Why now:** V1 launches into the Irish festival season with under 1,000 users. That window is the
  only chance to observe first-run behaviour at a scale small enough to read individually. With no
  instrumentation we learn nothing from it.
- **How it works:** The app initialises PostHog at root with a project key from env. Screen views are
  captured on every expo-router navigation; touches are autocaptured. On an authenticated session the
  user is identified by their user id; on logout the identity is reset. A fixed set of named funnel
  events is emitted at the signup, discovery, creation, and booking steps. Session replay records
  sessions with text inputs masked and auth/payment screens excluded entirely.
- **Done when:** The team can open PostHog and answer: how many users who open the app finish signup,
  which onboarding step loses the most, how often the map returns nothing, and how many artists ever
  create an event — and can watch a replay of a session that dropped off.

## 2 · Design & flow reference

- **Designs:** None — no user-facing UI ships in this story.
- **Where it sits in the wider flow:** Cross-cutting. Observes existing flows; changes none of them.

## 3 · Scope

**Build:**

1. `posthog-react-native` + required Expo peers wired into `apps/native`, EU Cloud host.
2. `EXPO_PUBLIC_POSTHOG_KEY` + `EXPO_PUBLIC_POSTHOG_HOST` in `packages/env/src/native.ts`, listed
   explicitly in `runtimeEnv` (Metro only inlines static `EXPO_PUBLIC_*` reads — see the existing
   comment in that file).
3. Manual screen tracking for expo-router (autocapture's `captureScreens` does not work with it).
4. `identify()` on authenticated session; `reset()` on logout.
5. Session replay via `@posthog/react-native-plugin`: text inputs masked, images unmasked, sandboxed
   views masked; auth, profile-edit and change-password screens excluded via `ph-no-capture`.
6. A fixed event list (below) emitted from the real call sites.
7. Event names as constants in `packages/shared` — no inline string literals.

**Do NOT build:**

- Stripe / subscription-conversion events — M8-T1 and M8-T2 are stubs
  (`packages/api/src/routers/stripe.ts:9`, `apps/server/src/routes/webhooks.ts:14`). Deferred to M8.
- Server-side tracking (`posthog-node`) — deferred to M8 with the Stripe capture.
- Admin dashboard or `ceolx.com/subscribe` page tracking. When the subscribe page is instrumented at
  M8 it uses `posthog-js`, not this SDK, and brings two web-only concerns that do not apply to native:
  the strict CSP needs `api_host` in `script-src` or the recorder silently fails to load, and ad
  blockers block the ingestion host (the usual fix is reverse-proxying PostHog through `ceolx.com`).
- Forced update + maintenance mode via Firebase Remote Config — **split into its own story.**
- PostHog feature flags, A/B tests, surveys, error tracking (Sentry already owns errors).
- Any change to the existing in-app Artist/Venue event analytics feature (M11-T3) — unrelated.
- Any new user-facing UI, including a consent toggle (see §10).

## 4 · Scenarios (Gherkin)

**Scenario: A signup funnel drop-off becomes visible**

- GIVEN a new user opens the app for the first time
- WHEN they pick a persona, submit signup, but never verify their email
- THEN PostHog shows `signup_started` and `signup_submitted` for that person and no `signup_completed`
- AND the session appears in replay with the email field masked

**Scenario: Logging out does not contaminate the next user**

- GIVEN user A is signed in and identified
- WHEN A logs out and user B signs in on the same device
- THEN B's events are attributed to B's user id, never A's

**Scenario: An empty map is recorded as friction**

- GIVEN a user pans to an area of Ireland with no events
- WHEN the silent radius expansion runs 5km → 25km → 100km and still finds nothing
- THEN one `map_empty_state_shown` event records the final radius reached

**Scenario: The app works with analytics unconfigured**

- GIVEN `EXPO_PUBLIC_POSTHOG_KEY` is unset (Expo Go, or a fresh clone)
- WHEN the app launches
- THEN it boots and behaves normally, sends nothing, and does not crash or spam the console

## 5 · Business rules & logic

- Events are sent in staging and production only. Never in `__DEV__`.
- A missing or empty key disables the SDK entirely rather than failing.
- `identify()` is called **only** for an authenticated session, keyed on `user.id`. Never for guests.
- `reset()` is called on every logout path — including the session-expiry backstop in
  `auth-context.tsx`, not just the manual logout button.
- Event properties never contain email addresses, names, passwords, or free-text the user typed.
  Ids, enums, counts and booleans only.
- Screen names collapse dynamic ids (`/events/[eventId]`, not `/events/abc-123`) so the screen list
  stays readable and carries no record ids.
- Every event name comes from the shared constants module.
- **Recording is unmasked** — `maskAllTextInputs`, `maskAllImages` and `maskAllSandboxedViews` are all
  `false` (decision 28/07/2026). The screen is recorded as-is.
- **Passwords are the one exception.** `AppTextField` has an eye toggle that renders the password as
  plaintext, which screenshot-mode replay would capture. The input is wrapped in `PostHogMaskView`
  when `secureTextEntry` is set, so the password is redacted in the recording without touching any
  other field. This is required by the "never send passwords" rule, not a reversal of the unmasked
  decision.
- **Masking is applied on-device, before upload, and is therefore not retroactive.** A build shipped
  with wrong masking permanently stores unmasked personal data for every session it recorded; fixing
  the config later does not clean those recordings. Consequence: replay is gated behind
  `EXPO_PUBLIC_POSTHOG_REPLAY` and stays `false` until the recordings have been eyeballed on a
  non-production project.

**Event list (the whole set — nothing beyond this ships).** Trimmed from 17 to 10 during
implementation: `map_viewed`, `event_detail_viewed` and `event_create_started` were dropped as
duplicates of automatic screen tracking, and `subscription_notice_shown` / `activation_email_resent`
were dropped because no such UI exists (venues are on interim free access; Stripe is stubbed). The
reasoning is recorded in `apps/native/lib/analytics.ts` next to the constants.

| Event                       | Fires when                                          | Properties                                            | Wired in                      |
| --------------------------- | --------------------------------------------------- | ----------------------------------------------------- | ----------------------------- |
| `signup_started`            | Persona chosen on who-are-you                       | `role`                                                | `who-are-you.tsx`             |
| `signup_submitted`          | Signup form or social signup submitted              | `role`, `method` (email/google/apple)                 | `sign-up.tsx` (both paths)    |
| `email_verification_opened` | Verify-email screen reached                         | —                                                     | `verify-email.tsx`            |
| `signup_completed`          | `completeRegistration` succeeds                     | `role`, `marketing_consent`                           | `verify-email.tsx` + auth-ctx |
| `onboarding_step_completed` | Each validated artist/venue onboarding step advance | `role`, `step`                                        | both onboarding hooks         |
| `guest_mode_entered`        | "Skip" tapped                                       | —                                                     | `auth-context.tsx`            |
| `map_empty_state_shown`     | 5→25→100km expansion exhausts with 0 results        | `final_radius_km`                                     | `use-map-events.ts`           |
| `search_performed`          | Settled search query returns                        | `has_results`, `filter_type`                          | `use-feed-events.ts`          |
| `event_created`             | Create succeeds                                     | `category`, `has_cover_image`, `invited_artist_count` | `use-event-form.ts`           |
| `artist_invite_sent`        | Event created with ≥1 invite                        | `is_platform_artist`                                  | `use-event-form.ts`           |
| `performance_request_sent`  | Artist requests to perform                          | `event_id`                                            | `use-request-to-perform.ts`   |
| `booking_responded`         | Invite/request accepted, rejected or cancelled      | `decision`, `direction`                               | `BookingDetailScreen.tsx`     |

Plus automatic `$screen` on every expo-router navigation (ids collapsed) and autocaptured touches.

### Batch 2 — added 06/08/2026

Driven by the first launch-week read of production data (28/07–06/08). What that read
exposed: no way to know _what_ people search for, no follow or save signal at all, and
share counts that could not be attributed to a single event or post.

| Event                 | Fires when                                | Properties                         | Wired in                  |
| --------------------- | ----------------------------------------- | ---------------------------------- | ------------------------- |
| `search_performed`    | (existing) now also carries the term      | + `term` (normalised)              | `use-feed-events.ts`      |
| `profile_followed`    | Follow or unfollow succeeds               | `followed`                         | `use-follow.ts`           |
| `event_saved`         | Save or unsave succeeds                   | `saved`                            | `use-save-event.ts`       |
| `post_created`        | Post create succeeds                      | `media_type`                       | `use-create-post.ts`      |
| `add_to_calendar`     | Calendar write succeeds (not on denial)   | `event_id`                         | `EventDetailView.tsx`     |
| `ticket_link_clicked` | External ticket link tapped               | `event_id`                         | `StickyBottomBar.tsx`     |
| `notification_opened` | Push tapped (foreground/background/cold)  | `persona`, `route` (collapsed)     | `use-fcm-registration.ts` |
| `guest_gate_hit`      | A guest hits an auth-only action          | `prompt`                           | `use-guest-gate.ts`       |
| `content_shared`      | (existing) now attributable to the record | + `content_id` (null for profiles) | `utils/share.ts`          |

`ticket_link_clicked` deliberately duplicates the `events.ticket_clicks` counter: the
counter serves the creator's own analytics screen, the event makes the tap joinable to a
funnel. No other per-record counter is duplicated — views and likes stay database-only
(`event_views`, `events.view_count`, `posts.like_count`), so "most-viewed event" and
"most-liked post" are SQL questions, not analytics ones.

`content_id` is null for profile shares on purpose: the only handle the caller has there
is the username, and a username is a personal identifier.

### Screen-name collapsing — fixed 06/08/2026

The original `collapseRoute` regex only caught opaque ids, so short slugs passed straight
through and each became its own screen row. `/u/nxnw`, `/u/kateheneghan`,
`/artist/seed_artist` and `/venue/demo_venue_test` were all live in the production project
— usernames in analytics, which AC 10 forbids. Fixed by also collapsing any segment whose
parent has only a dynamic child in `app/(app)/` (`u`, `artist`, `venue`, `event`, `events`,
`post`, `bookings`), excluding the two real static children (`create`, `edit`).

`signup_completed` has two call sites because `completeRegistration` has two paths — verify-email
consumes `pendingRegistration` on the email flow, auth-context picks it up only if that failed. They
are mutually exclusive, so it cannot double-fire; instrumenting only one would have silently lost the
entire email signup flow.

## 6 · Possible data & entities

- **Entities touched:** None. No schema change, no migration.
- **CRUD:** None.
- **New or changed fields:** None in the database. Two new env vars only.

## 7 · Edge cases (WEESLD)

- **Waiting:** None — initialisation is non-blocking and must never delay first render or gate the
  navigator (the root layout keeps the navigator mounted at all times by design; see the comment in
  `apps/native/app/_layout.tsx` about cold-start deep-link restoration).
- **Empty:** Key unset → SDK disabled, app fully functional, nothing sent.
- **Error:** Network failure or PostHog unreachable → events queue and retry per SDK defaults; a
  permanent failure is silent to the user. No error UI ships in this story, because analytics failing
  is never the user's problem to solve.
- **Success:** No user-visible confirmation — this feature is invisible by design.
- **Limits:** PostHog free tier is 1M events and 5k replays per month; at under 1,000 launch users
  this is not expected to bind. Replay throttling stays at SDK defaults.
- **Default values:** Host defaults to EU Cloud. Autocapture: touches on, screens off (handled
  manually). Masking: text inputs and sandboxed views masked, images unmasked.

## 8 · UI/UX, copy & i18n

- **User-facing copy:** None.
- **i18n:** None — no strings ship. (English-only in V1 regardless.)
- **Accessibility / responsive:** No UI, so no impact. `ph-no-capture` must not alter layout.

## 9 · Side effects

- **Emails:** None.
- **Push / in-app notifications:** None.
- **Background jobs & cache:** None. The SDK batches and flushes on its own schedule.
- **Analytics events:** The table in §5 — that is the deliverable.

## 10 · Open questions & TBCs — STOP if any unresolved

- **[Unresolved]** Senior-engineer review of the five plain questions (session recording scope,
  consent, what to track, what must never be sent, retention). Answered below as working assumptions;
  still to be confirmed. (owner: Divy Parekh, needed by: before replay is enabled in production)
- **[Resolved]** Session recording scope: record everything from app open to close, unmasked, for all
  users including guests. (by Divy Parekh, 28/07/2026)
- **[Resolved]** Consent: analytics does need consent, and the privacy policy accepted at sign-up
  (`consentAt`) is sufficient — no separate opt-in toggle. (by Divy Parekh, 28/07/2026)
- **[Resolved]** Pre-signup events: allowed. They fire anonymously and `identify()` merges the
  anonymous person into the real user, so the signup funnel joins up. (by Divy Parekh, 28/07/2026)
- **[Resolved]** Never send: passwords. Other data may be sent. Implemented as unmasked recording with
  `PostHogMaskView` on secure inputs only. (by Divy Parekh, 28/07/2026)
- **[Resolved]** Retention: data lives as long as the account; deleting the account deletes the
  analytics data. **Implemented 06/08/2026** — `applyAnonymization` (the single erasure path shared
  by the per-user handler and the daily sweep) now calls `deletePostHogPerson`, which posts to
  `persons/bulk_delete` with `delete_events` **and** `delete_recordings`. Recordings are stored
  apart from events, so both flags are required for this to be erasure rather than half of it.
  Non-blocking by design: a PostHog outage logs an error and local erasure still completes.
  Needs `POSTHOG_PERSONAL_API_KEY` + `POSTHOG_PROJECT_ID` set per environment.
  (by Divy Parekh, 28/07/2026; built 06/08/2026)
- **[Resolved]** Search terms **are** captured, normalised (lowercased, whitespace-collapsed,
  capped at 80 chars). This supersedes AC 10's "the search term is never sent" — that rule made
  "what are people searching for" unanswerable, which is the question the search data exists to
  answer. Scope is the county / artist / category search box; no free-text field about the user is
  captured. (by Divy Parekh, 06/08/2026)
- **[Resolved]** Staging and production must not share a PostHog project. Both currently write to
  project 234026 with one key, so every query needs an `$app_namespace` filter and the PostHog UI
  shows blended numbers by default. Production keeps 234026 (preserving launch history); staging
  moves to its own project via the EAS **preview** environment's `EXPO_PUBLIC_POSTHOG_KEY`. This
  also makes "replay in production only" a per-project setting rather than a code branch.
  (by Divy Parekh, 06/08/2026)
- **[Unresolved]** PostHog project API key value. Project exists and region is confirmed EU — the
  `EXPO_PUBLIC_POSTHOG_KEY` value still needs handing over for the staging and production env files.
  (owner: Divy Parekh, needed by: before this story starts)
- **[Unresolved]** Due date on the original story is 29/07, one day after drafting. Needs a realistic
  date — the driver is the GDPR sign-off below, plus a native rebuild for replay.
  (owner: Pratiksha Patil, needed by: at grooming)
- **[Resolved]** PostHog region: **EU Cloud** — `EXPO_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com`.
  (by Divy Parekh, 28/07/2026)
- **[Resolved]** Surfaces: mobile only. (decision: server + admin deferred; with Stripe stubbed the
  only off-device event left is email-verified, which does not justify `posthog-node` and its
  serverless flush handling. By Divy Parekh, 28/07/2026)
- **[Resolved]** Stripe conversion events: out of scope. (decision: added when M8 ships the feature,
  by Divy Parekh, 28/07/2026)
- **[Resolved]** Forced update + maintenance mode via Firebase Remote Config: split to its own story.
  (decision: not analytics, different SDK and config surface, own ACs. By Divy Parekh, 28/07/2026)
- **[Resolved]** Masking policy: **none** — record the screen as-is, all three `maskAll*` options
  `false`. Passwords are masked at the input via `PostHogMaskView` because the eye toggle in
  `AppTextField` renders them as plaintext. Screens are no longer excluded wholesale; masking the one
  sensitive input is more precise than dropping four whole screens from the recording.
  (by Divy Parekh, 28/07/2026 — supersedes the earlier text-masked policy)

## 11 · Technical notes (dev planning pass)

- **Feasibility:**
  - **Analytics is pure JS.** `posthog-react-native` itself contains no native code — events, screen
    tracking and identify work with no build change.
  - **Session replay is a separate native plugin.** Verified against the published package, not
    assumed: `@posthog/react-native-plugin@2.2.3` ships an `ios/` directory (Swift +
    `posthog-react-native-plugin.podspec`) and an `android/` directory (Kotlin + Gradle). Required
    version is `>= 2.0.1` for `posthog-react-native` 4.47.0+; older SDKs use the legacy
    `posthog-react-native-session-replay` package instead. Replay records in **screenshot mode** on
    React Native and that is not configurable.
    → Practical cost here: a pod install + native rebuild + redistribute the dev client. That is
    routine for this repo (`expo-dev-client` is already a dependency and `ios/`/`android/` are
    committed), so it is **not** a workflow change — just a build the team already knows how to do.
  - **Replay has two switches and needs both.** The client flag is necessary but not sufficient —
    "Record user sessions" must also be enabled in PostHog Project Settings. With the project toggle
    off, the flags response says no, the recorder never starts, and **there is no client-side error
    at all**. Confirmed the same way on a prior RaftLabs `posthog-js` project: this is the number-one
    cause of "replay isn't working". Check the project setting first, always.
  - **Do not assume a client flag enables anything.** On the web SDK, `autocapture: true` and
    `disable_session_recording: false` are already defaults — writing them documents intent, it does
    not turn anything on. Treat the RN equivalents the same way: the server-side project toggle is the
    real gate.
  - **Masking is not retroactive** (see §5). On RN, screenshot mode means masked regions are redacted
    pixels rather than withheld strings — but the timing is identical: redaction happens on-device
    before upload, so anything captured unmasked stays unmasked forever.
  - `autocapture.captureScreens` does not work with expo-router (it targets React Navigation v6 and
    below). Screen views must be captured manually from `usePathname()` in an effect.
  - `posthog-react-native` needs `expo-application` and `expo-localization` added.
    `expo-file-system` (~55.0.19) and `expo-device` (^55.0.16) are already dependencies.
    Documented install for Expo:
    `npx expo install posthog-react-native expo-file-system expo-application expo-device expo-localization @posthog/react-native-plugin`
  - Exact `sessionReplayConfig` masking key names are **not** reliably documented on the public docs
    page (the masking table is truncated there, and the published config reference covers the browser
    SDK). Read them off the installed package's TypeScript types at implementation rather than
    trusting a remembered name. The ACs below are written against behaviour, not key names, so this
    does not block them.
  - PostHog must initialise without gating first render. The root layout deliberately keeps the
    navigator mounted at all times to protect cold-start deep-link restoration (Asana 1215040939202673) — that invariant must not be broken.
- **Data & contracts:** No API contract. Event schema is the §5 table.
- **Reuse this:** `apps/native/app/_layout.tsx` provider stack (Sentry's init is the pattern to follow
  for env-gated third-party setup); `apps/native/contexts/auth-context.tsx` for identify/reset — note
  `logout()` there is already the single teardown path used by both the manual logout and the
  session-expiry backstop, so `reset()` belongs in it once; `packages/env/src/native.ts` for the
  explicit-`runtimeEnv` requirement; `packages/shared/src/constants.ts` for the event-name constants.
- **Boundaries:**
  - May touch: `apps/native/app/_layout.tsx`, `apps/native/contexts/auth-context.tsx`,
    `apps/native/package.json`, `packages/env/src/native.ts`, `packages/shared/src/`, plus the
    specific call sites in the §5 table, and a new `apps/native/lib/analytics.ts`.
  - Must NOT touch: `packages/db`, `packages/api` routers, `apps/server`, `apps/admin`, the M11-T3
    event-analytics feature, or any business logic. Instrumentation is additive — if a call site needs
    refactoring to emit an event, stop and confirm first.
- **Constraints:** EU Cloud host for an Irish client. Disabled when `__DEV__` or the key is unset.
  No PII in event properties. No new user-facing strings.
- **Logic record:** Masking and exclusion policy is recorded in §10 [Resolved]. Screen-name collapsing
  rule is in §5.

## 12 · Build & verify (dev planning pass)

**Tasks (in order):**

0. **Ship 1 needs no native build.** `@posthog/react-native-plugin` is only required when
   `EXPO_PUBLIC_POSTHOG_REPLAY=true`; with replay off the whole integration is pure JS — no pod
   install, no new dev client. Install the plugin at step 8, not step 1.
1. Add deps + env vars (`packages/env/src/native.ts` with explicit `runtimeEnv` entries).
2. Event-name constants in `packages/shared`.
3. `apps/native/lib/analytics.ts` — typed capture helper over the constants.
4. Provider + env-gated init in the root layout; autocapture `captureScreens: false`,
   `captureTouches: true`.
5. Manual screen tracking hook (`usePathname`, id-collapsing).
6. identify/reset in `auth-context.tsx`.
7. Emit the §5 events at their real call sites. **Steps 1–7 need no native build** — they can ship and
   be verified independently of replay.
8. Add `@posthog/react-native-plugin`, enable "Record user sessions" in PostHog Project Settings,
   configure masking, and apply `ph-no-capture` to the excluded screens.
9. New dev-client + distribution build; verify events and one masked replay land in the PostHog project.

**Commands:**

```
pnpm check-types
pnpm lint
pnpm -F native test
```

**Verified when:** `pnpm check-types` and `pnpm lint` are green, the native suite passes, and in the
PostHog project: the signup funnel renders end to end, one replay is visible with the email field
masked, and no replay exists for any auth screen.

**Replay release gate (because masking is not retroactive — §5):** point the first replay-enabled build
at a **non-production** PostHog project, record a full signup + profile-edit + create-event pass on a
real device, and inspect the stored recordings by eye. Only once no email, name, address or password is
legible in stored frames does replay get enabled against the production project. Getting this wrong
cannot be corrected after the fact.

## References

- Original story: https://app.asana.com/1/1194107417268910/project/1210959953917909/task/1216903169745967
- M11-T1 GDPR Compliance: https://app.asana.com/1/1194107417268910/project/1210959953917909/task/1213823931823446
- PostHog React Native docs: https://posthog.com/docs/libraries/react-native
- `CLAUDE.md` — GDPR rules, map radius-expansion behaviour, persona model

---

## Acceptance criteria — create these as `[AC]` subtasks

1. `[AC] Happy path - PostHog initialises with the env key against the EU host, and events from a real device appear in the project`
2. `[AC] Screen tracking - every expo-router navigation emits exactly one screen event, with dynamic ids collapsed to the route pattern`
3. `[AC] Identify - an authenticated session identifies on user.id; guests are never identified`
4. `[AC] Reset on logout - reset() runs on both the manual logout and the session-expiry backstop, so the next account is not attributed to the previous user`
5. `[AC] Signup funnel - signup_started, signup_submitted, email_verification_opened, onboarding_step_completed and signup_completed each fire once, with the documented properties`
6. `[AC] Discovery + creation events - map_empty_state_shown carries the final expansion radius; search, event_detail_viewed, event_created and artist_invite_sent fire with documented properties`
7. `[AC] Booking events - performance_request_sent and booking_responded fire with decision and direction`
8. `[AC] Replay is unmasked - the recording shows the screen as-is, verified by inspecting stored recordings on a non-production project, not by reading the config`
9. `[AC] Passwords never captured - with the eye toggle ON, the password is still redacted in the stored recording on both iOS and Android`
10. `[AC] No PII in properties - no event property contains an email, name, password or user-typed free text (the search term is never sent, only whether it found results)`
11. `[AC] Disabled in dev - nothing is sent when __DEV__ is true`
12. `[AC] Empty / first-time state - with the key unset the app boots and functions normally, sends nothing, and does not crash`
13. `[AC] Permission boundary - guest and logged-out events carry no user identifiers`
14. `[AC] Limits - every event name is referenced from the shared constants module; no inline event-name literals exist in apps/native`
15. `[AC] i18n - none; no user-facing strings ship in this story`

---

# Split-off story stub — for the PM to expand

**STORY:** Add forced update and maintenance mode via Firebase Remote Config

**Why it is separate:** Requested by Rohan in the notes on 1216903169745967 ("take loyaltypass as
reference"). It is not analytics — different SDK (`@react-native-firebase/remote-config`), different
surface (a blocking gate at app launch), its own failure modes and its own ACs. Bundling it makes both
halves unauditable at scope-guard.

**Note for grooming:** `@react-native-firebase/app` ^23.0.0 is already a dependency, so the Firebase
groundwork exists. It needs its own ACs covering: blocking vs soft-prompt behaviour, minimum-version
comparison rule, store-link handling per platform, maintenance-mode copy, and the fail-open behaviour
when Remote Config cannot be fetched (never lock users out of a working app because a config fetch
failed).
