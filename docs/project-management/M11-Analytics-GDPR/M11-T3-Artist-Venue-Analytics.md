# M11-T3 · Per-Event Analytics

| Field          | Value                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| **Milestone**  | M11 — Analytics & GDPR                                                                                        |
| **Status**     | ✅ Done (per-event scope) — overall profile analytics deferred                                                |
| **Depends on** | M2-T4 (personas), M4-T1 (events), M5 (bookings), M6-T1 (Artist profile), M6-T2 (Venue profile), M6-T4 (posts) |
| **PRD Ref**    | Section 6.1 (Artist Features), Section 7.1 (Venue Features — Analytics)                                       |

---

## Pivot Note (Apr 2026)

The original spec scoped **overall profile analytics** (`GET /artists/me/analytics`, `GET /venues/me/analytics`) returning aggregated KPIs across all of a creator's posts/events/bookings/followers. After reviewing the Figma designs ([card](https://www.figma.com/design/sIBHy8w0VESlY7O9eEGZos/Design-%7C-Ceolx?node-id=1-10478) + [analytics screen](https://www.figma.com/design/sIBHy8w0VESlY7O9eEGZos/Design-%7C-Ceolx?node-id=1-10537)), this task pivoted to **per-event analytics** instead — accessed from a kebab menu on each event card in the My Events tab.

**Why the pivot:**

- The data model has clean per-event aggregation (`saved_events.event_id`, `bookings.event_id`, `event_collaborators.event_id`) but messy aggregate-level data: posts have no `event_id` so post engagement can't be attributed to specific events; no event-follower intersection table to compute follower reach.
- The Figma designs show per-event drill-downs, not an overall dashboard.
- Per-event ships sooner and avoids the schema gaps above.

**Out of scope (deferred to future M-task):**

- Profile-level rollup analytics
- Hourly view chart with Today vs Yesterday (Figma showed hourly; we ship daily-for-14-days)
- Real ticket-sales rings (Figma showed 3 rings of "Tickets Sold / Presale / Final Presale" — replaced with engagement metrics because CeolX uses external `ticketLink` and has no purchase data)
- Source attribution (map vs feed vs notification)
- Posts↔event linkage so post likes can be attributed to specific events
- Follower reach intersection

---

## Description

Artists and Venues need visibility into how each of their events is performing so they can make informed decisions about future events and promotions. This task adds a **per-event analytics screen** with view trend, engagement metrics, performers list, and bookings breakdown. Analytics are owner-only — each creator can only view analytics for events they created, enforced server-side via the authenticated session identity. Spectators have no access. The screen is reached from the kebab menu (Edit / Analytics / Delete) on each card in the Profile → Events tab.

---

## Affected Apps / Packages

| App / Package     | Role                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/db`     | New `event_views` table; `events.ticket_clicks` column                                                                                          |
| `packages/api`    | `events.analytics` (owner-only, cached 5 min), `events.trackTicketClick` (public), view increment on `events.byId`                              |
| `packages/shared` | Zod input + response schemas in `event-analytics.ts`                                                                                            |
| `apps/native`     | Kebab menu on `ProfileEventCard`, "X Joined" badge, new analytics screen at `/(app)/events/[eventId]/analytics` with chart and engagement rings |

---

## API (tRPC)

### `events.analytics({ id })` — protected, owner-only

Returns a complete per-event analytics payload. Throws `FORBIDDEN` if the caller is not the event creator. 5-minute in-process cache keyed by event ID.

Response shape (TypeScript inferred from `eventAnalyticsResponseSchema` in `packages/shared/src/validators/event-analytics.ts`):

```ts
{
  event: {
    id, title, coverImage, dateStart, dateEnd, venueAddress,
    category, status, createdAt, updatedAt, hasTicketLink,
  },
  views: {
    total: number,
    daily: Array<{ date: 'YYYY-MM-DD', count: number }>,  // padded to exactly 14 entries
  },
  saves: { total: number },
  engagement: { rate: number },                            // saves/views * 100
  ticketClicks: {
    total: number,
    clickRate: number | null,                              // null if no ticketLink
  },
  bookings: {
    total: number,
    byStatus: { pending, accepted, rejected, cancelled },
    acceptanceRate: number | null,                         // null if no bookings
  },
  performers: {
    confirmed: Array<{ artistProfileId, stageName, profileImageUrl }>,
    invitedCount: number,                                  // outside-platform invites
  },
  cachedAt: string,
  cacheExpiresAt: string,
}
```

### `events.trackTicketClick({ id })` — public

Atomically increments `events.ticket_clicks`. Called from the mobile ticket-link button before opening the external URL. Fire-and-forget; failures are silent.

### `events.byId` — modified

Now records a view side-effect: when `userId !== event.createdBy` and `userId` is present, atomically increments `events.view_count` and inserts a row into `event_views(event_id, user_id, viewed_at)`. Errors are swallowed so a tracking failure never breaks the event load. Anonymous viewers and the creator themselves are not tracked.

---

## Requirements

### View tracking

- R1: `events.view_count` column exists (already in schema pre-task)
- R2: `events.byId` increments `view_count` on each non-creator authenticated view (atomic UPDATE)
- R3: `event_views` log table records each tracked view with `(event_id, user_id, viewed_at)` for daily aggregation

### Per-event analytics

- R4: Owner-only access enforced via session identity (`ctx.userId`); 403 for non-owners
- R5: Total views, total saves, engagement rate (saves/views × 100), 14-day daily view trend
- R6: Performers section: confirmed performers (avatars + stage names) and outside-platform invite count
- R7: Bookings breakdown by status (pending / accepted / rejected / cancelled) with acceptance rate; only shown when total > 0
- R8: Ticket-link click tracking via `trackTicketClick` mutation; click rate = clicks / views × 100; only shown when event has a `ticketLink`

### UI & access control

- R9: Kebab menu (3-dot, brand accent green) on each owner's event card; opens popover with Edit / Analytics / Delete
- R10: Delete uses existing archive flow (`useArchiveEvent` hook + confirmation Alert)
- R11: "X Joined" public save-count badge on each card in the My Events tab (visible when count > 0)
- R12: Per-event analytics screen at `/(app)/events/[eventId]/analytics`; back to profile on dismiss
- R13: Non-owners attempting to navigate to the analytics route see a "You can't view this analytics page" error state with a Go Back button

### Caching & performance

- R14: 5-minute in-process cache for analytics responses (keyed by event ID); cache hit returns identical payload without re-running rollup queries
- R15: All rollup queries use indexed columns (`event_views_event_viewed_at_idx`, `bookings_event_status` via `bookings.eventId`, etc.); no complex CTEs

---

## Acceptance Criteria

- [x] `event_views` table created with composite index on `(event_id, viewed_at)`
- [x] `events.ticket_clicks` integer column added (default 0)
- [x] `events.byId` increments `view_count` and inserts `event_views` row when `userId !== createdBy`; creator viewing own event does NOT increment
- [x] `events.trackTicketClick` procedure exists and increments atomically; mobile ticket-link button calls it before opening the external URL
- [x] `events.analytics` returns 403 when caller is not the event creator
- [x] Analytics payload includes total views, total saves, engagement rate, 14 daily-bucketed view counts, ticket-clicks + click rate (when `ticketLink` set), bookings breakdown + acceptance rate (when bookings exist), confirmed performers, invite count
- [x] Analytics response cached in-memory for 5 minutes keyed by event ID
- [x] Kebab menu (3-dot) on `ProfileEventCard`; menu has Edit / Analytics / Delete
- [x] Delete from kebab triggers existing archive confirmation Alert
- [x] "X Joined" badge appears on My Events cards when save count > 0
- [x] New `events/[eventId]/analytics` screen renders hero card, daily line chart, three engagement rings, performers list (when present), bookings breakdown (when present), context strip
- [x] Analytics screen access denied (Go Back error state) for non-owners
- [x] All tests pass: 23 new tests added (4 view-tracking, 12 helper unit tests, 4 procedure tests, 3 trackTicketClick tests); 188 total api tests + 115 server tests pass
- [x] Lint, type-check, build all green

---

## Dependencies

- **Upstream**: M4-T1 (events schema, view_count column); M5 (bookings); M6-T1/T2 (artist/venue profiles); M6-T4 (posts)
- **Downstream**: M12-T1 (testing — verify accuracy of aggregations); M12-T3 (launch monitoring — baseline engagement metrics)
- **External services**: Neon PostgreSQL (aggregation queries)

---

## Technical Notes

### Helper: `recordEventView` (`packages/api/src/routers/events/view-tracking.ts`)

Atomic best-effort writes invoked from `events.byId`. Skips anonymous viewers and the creator. Try/catch swallows DB errors so analytics failures never break event loads.

### `events.analytics` query (`packages/api/src/routers/events/analytics.ts`)

- Owner check via `event.createdBy !== ctx.userId`
- 5-min in-memory `Map<eventId, { data, expiresAt }>` cache (Redis migration is a 2-line swap if needed at scale)
- Parallel rollup via `Promise.all`: saves count, bookings grouped by status, daily views (`date_trunc('day', viewed_at)` GROUP BY), performers join
- Pure helpers `computeEngagementRate`, `computeAcceptanceRate`, `computeClickRate`, `padDailyViews` are exported and unit-tested

### Mobile chart library — `react-native-gifted-charts`

Picked over Victory Native XL because Victory requires `@shopify/react-native-skia` (~10–15 MB native binary) for one simple line chart. Gifted-charts uses the already-installed `react-native-svg` and ships in a single component call. See PR description for the full Decision Brief.

---

## Common Gotchas

- **Owner check must use session, not URL param**: never accept `creatorId` as input — always use `ctx.userId`. The `events.analytics` procedure loads the event row and compares `createdBy` to the session user.
- **Cache invalidation deferred**: 5-min TTL is acceptable staleness for V1. If a creator wants instant feedback after a new save/view, they can pull-to-refresh (clears React Query cache; server cache will still hold for up to 5 min).
- **`view_count` and `event_views` row count must stay in sync**: both writes happen in the same `Promise.all`. If one fails (network glitch, DB error), the helper's try/catch catches and discards — slight drift is acceptable since we treat `view_count` as the source of truth for the total.
- **Daily view padding**: server returns exactly 14 entries even when there are no views (zero-fill). The mobile chart shows an empty-state card when total is 0.
