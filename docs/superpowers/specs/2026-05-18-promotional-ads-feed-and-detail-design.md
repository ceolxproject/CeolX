# Promotional Ads — Discover Feed & Event Detail

**Date:** 2026-05-18
**Author:** Priya Yadav
**Asana:** [Promotional Ads — Render on Discover Feed & Event Detail](https://app.asana.com/1/1194107417268910/project/1210959953917909/task/1214891201533191)
**Figma:** [Design | Ceolx — node 1-9861](https://www.figma.com/design/sIBHy8w0VESlY7O9eEGZos/Design-%7C-Ceolx?node-id=1-9861)

---

## Problem

Venues fill in `adTitle` (100 char) + `adDescription` (50 char) when creating an event. The values are persisted on the `events` row but never queried back — no surface in the app renders them. From the venue's perspective the ad silently goes missing after creation.

This spec covers the read paths and UI to surface those ads to users.

## Scope (V1)

Two surfaces:

1. **Discover Feed** — render eligible ads pinned at the top of the feed, stacked vertically when multiple are eligible.
2. **Event Detail screen** — render an inline `Offers` block below the location/venue section, only if the event has an ad.

## Out of scope (V1)

- Dedicated `promotional_ads` table (ads stay on the events row).
- Impression / click analytics.
- Distance / persona / geographic targeting beyond the time window.
- Paid ad tiers or boosted placement.
- Server-side per-user dismissed state.

## Eligibility rules

An ad is eligible for the **Discover Feed** when **all** are true:

- `events.status = 'active'`
- `events.ad_title IS NOT NULL` AND `length(trim(ad_title)) > 0`
- `events.date_start` is in the window `[now() + 30 minutes, now() + 2 hours]`
- The user has not previously dismissed this ad on this device

An ad is eligible for the **Event Detail Offers block** when:

- The event's `adTitle` is non-empty
- The event's `status = 'active'`

(No time-window filter on the detail surface — the user is already looking at the event.)

**Scoping invariant:** the detail screen only ever shows the ad that belongs to _this event_. Ads are stored as columns on the `events` row, so by construction the Offers block reads `event.adTitle` / `event.adDescription` from the same row the detail page is rendering. There is no cross-event ad surfacing on this screen — no recommendation, no nearby-event ad, no global ad list. If a user opens event A's detail page, they only ever see event A's ad (or nothing).

## Architecture

```
Discover Feed                            Event Detail
─────────────                            ─────────────
<AdStack>                                <OfferBlock>
  ├─ tRPC: events.feedAds                 ├─ reads from existing events.byId
  ├─ filters out dismissed-ad-ids (MMKV)  ├─ renders if adTitle present
  ├─ renders <AdCard/> × N                └─ no buttons, no dismiss
  └─ pinned above the events FlatList
```

No new DB tables. No migrations.

## Data layer

### New tRPC procedure: `events.feedAds`

Location: new file `packages/api/src/routers/events/feed-ads.ts`, exported and merged into the existing `eventsRouter`. Keeps the file focused and easy to delete if ads ever move to their own table.

**Input:** none in V1. Schema lives in `packages/shared/src/validators/ads.ts` so future filters (city, persona, etc.) have a place to land without ad-hoc growth.

**Query:**

```sql
SELECT
  events.id,
  events.ad_title,
  events.ad_description,
  events.title,
  events.cover_image,
  venue_profiles.name AS venue_name
FROM events
LEFT JOIN venue_profiles ON venue_profiles.id = events.venue_id
WHERE events.status = 'active'
  AND events.ad_title IS NOT NULL
  AND length(trim(events.ad_title)) > 0
  AND events.date_start BETWEEN (now() + interval '30 minutes')
                             AND (now() + interval '2 hours')
ORDER BY events.date_start ASC
LIMIT 20;
```

**Index check:** the existing `events_status_date_idx` (`status, date_start`) covers the filter + sort. No new index needed.

**Response shape (per row):**

```ts
type FeedAd = {
  id: string; // events.id — also used as dismiss key
  eventId: string; // same as id; explicit field for clarity at call site
  adTitle: string; // headline
  adDescription: string | null;
  eventTitle: string; // bolded portion in the headline
  coverImage: string | null;
  venueName: string | null;
};
```

### Event Detail — no new endpoint

`events.byId` already returns `adTitle` and `adDescription`. The detail screen reads them off the existing response and renders `<OfferBlock>` conditionally.

## Native components

All paths under `apps/native/`.

| Component       | Type              | Path                                      | Responsibility                                                                                                                                    |
| --------------- | ----------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AdCard`        | Pure presentation | `components/ads/AdCard.tsx`               | Renders one white card per Figma. Props: `{ id, adTitle, eventTitle, coverImage, onDismiss(id), onPress(id) }`. No data, no storage.              |
| `AdStack`       | Data + behaviour  | `components/ads/AdStack.tsx`              | Owns the `events.feedAds` query. Reads dismissed-ad-ids from MMKV, filters them out, renders the stack. Returns `null` if filtered list is empty. |
| `OfferBlock`    | Pure presentation | `components/events/detail/OfferBlock.tsx` | Inline block on event detail. Props: `{ title, description }`. Renders only if `title` is non-empty.                                              |
| `dismissed-ads` | Storage helper    | `lib/storage/dismissed-ads.ts`            | `getDismissedAdIds(): Promise<string[]>`, `dismissAd(id: string): Promise<void>`. `expo-secure-store`-backed (async API).                         |

### Wiring

- `apps/native/app/(app)/(tabs)/discover/index.tsx` — render `<AdStack />` as the `ListHeaderComponent` of the events `FlatList`, so it scrolls with the list rather than floating above it.
- `apps/native/app/(app)/(tabs)/discover/event/[eventId].tsx` — render `<OfferBlock title={event.adTitle} description={event.adDescription} />` below the existing location section.
- `apps/native/app/(app)/(tabs)/map/event/[eventId].tsx` — same `<OfferBlock>` insertion (map route reuses the detail layout).

## Dismiss persistence

- **Store:** `expo-secure-store` (already used in the app — see `apps/native/lib/auth-client.ts` and `apps/native/hooks/use-location-permission-prompt.ts`). No new dependency.
- **Key:** `dismissed-ad-ids`
- **Value:** JSON-serialised `string[]` of event IDs (the dismissed ad is identified by the event row it lives on).
- **Cap:** 50 entries (FIFO eviction). 50 × 36-char UUIDs ≈ 1.8 KB — well under SecureStore's per-item limit on iOS. Prevents unbounded growth.
- **Scope:** per-device only. No server write, no cross-device sync.
- **Lifetime:** forever. Once dismissed, never shown to that device again on this device.

## Headline composition

Backend returns `adTitle` and `eventTitle` as two separate strings. Frontend composes the headline in JSX with two `<Text>` spans:

```tsx
<Text>
  <Text>{adTitle} on </Text>
  <Text className="font-bold">"{eventTitle}"</Text>
</Text>
```

This keeps the bold portion robust against quotes or special characters in either string.

## UI specs (per Figma 1-9861)

**Feed card (`AdCard`):**

- White background, 12px radius, soft shadow `rgba(0,0,0,0.16) 0 0 8px`.
- 16px horizontal padding, 16px vertical padding.
- Top row: 35×35 rounded (4px) thumbnail (from `coverImage` — fallback to a tinted placeholder) + headline block (16px Urbanist Medium for `adTitle`, bold for the quoted event title; 11px Urbanist Light subtitle showing `eventTitle`).
- Bottom row: two buttons, 40px tall, 100px radius.
  - **DISMISS** — outline, black border, 12px Urbanist Bold uppercase, 2px letter spacing.
  - **VIEW DETAILS** — filled `#6155F5`, white text, same typography.
- 12px gap between buttons.

**Detail Offers block (`OfferBlock`):**

- Section heading: `Offers` (small caps, gray-3, 12px, matching other detail-page section headers).
- Body card: visually identical to the feed `AdCard` (white background, 12px radius, soft shadow, 35×35 rounded thumbnail with gray fallback, bold-quoted headline `{adTitle} on "{eventTitle}"`, light 11px event-title subtitle), but **no DISMISS / VIEW DETAILS buttons** — the user is already on the event detail page.
- Position: between the description/location row and the Performing Artists section divider.

## Acceptance criteria

- Spectator opens Discover Feed → sees ads for events starting in 30 min – 2 hrs, stacked at the top.
- Spectator taps **DISMISS** → that ad is gone immediately and never reappears on the same device.
- Spectator taps **VIEW DETAILS** → navigates to the event detail screen for that event.
- Spectator opens an event detail page → `Offers` block visible if and only if **that event's** `adTitle` is non-empty and the event is active. No other event's ad ever appears on this screen.
- No eligible ads → Discover feed renders normally with no empty banner / no gap.
- iOS + Android render identically (Tailwind via uniwind already gives us this).
- All personas (Spectator, Artist, Venue) see ads — no persona branching.

## Testing

- **Unit:** `dismissed-ads.ts` — add / read / cap behaviour.
- **Unit:** `AdCard` snapshot + Dismiss / Press callbacks fire with the right id.
- **Unit:** `AdStack` filters out dismissed ids before rendering.
- **API:** `events.feedAds` query — fixture rows just inside / outside the 30 min and 2 h window; assert correct inclusion / exclusion. Status filter (active vs removed). Empty ad_title exclusion.
- **Manual:** seed a venue event with `adTitle` and `date_start = now() + 45 min`; open the app; verify ad shows on feed and on the event detail page.

## Risks & mitigations

- **Empty thumbnail:** events can be created without `coverImage`. Mitigation: fallback placeholder tile in `AdCard`.
- **Clock skew between client and server:** the 30 min – 2 hr window is server-evaluated, so client clock drift is irrelevant. Good.
- **SecureStore key collision:** namespaced as `dismissed-ad-ids`, distinct from any other key in the app.
- **Long ad titles wrapping awkwardly:** `adTitle` is capped at 100 chars. The card layout truncates to 2 lines with ellipsis as a defensive fallback.

## Open questions

None blocking V1. The PRD line about "5-15 km of your event" in the form helper text remains aspirational; we revisit once we have impression analytics in V2.
