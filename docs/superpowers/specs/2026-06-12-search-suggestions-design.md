# Search Autocomplete Suggestions — Design

**Date:** 2026-06-12
**Author:** Priya Yadav
**Status:** Approved (design)
**Related:** Asana 1215616249996643 — [P2][Functional/UX] Search Does Not Display Real-Time Suggestions While Typing

## Problem

The Discover search box does not surface predictive suggestions while typing. It is
a filter-as-you-type on the active tab only (`useFeedEvents.onSearch` /
`useFeedPosts.onSearch`). Users must type a full query and submit before seeing
anything, and there is no cross-entity hint (artist / venue / event names).

## Decisions (locked)

1. **Mechanic = autocomplete, NOT navigation.** A suggestion is a _keyword hint_.
   Tapping a row fills the search box with that name and runs the existing search
   for the active tab. No per-entity routing.
2. **Entity scope = Events + Artists + Venues** (Posts deferred as a suggestion
   _source_ — posts remain searchable via the existing caption/author filter).
3. **Suggestions appear on both tabs, groups tailored per tab:**
   - **Events tab:** `ARTISTS` · `VENUES` · `EVENTS`
   - **Posts tab:** `ARTISTS` · `VENUES`
     (Events are not a meaningful suggestion on the Posts tab.)
4. **Backend = hybrid.** Events via existing Typesense `events` collection
   (typo-tolerant + ranked). Artists/venues via Postgres `ILIKE`, mirroring
   `posts/feed.ts buildSearchFilter` and `bookings.searchArtists`.
5. **Visibility filters carry into suggestions:** artists `isActive = true`,
   venues `subscriptionStatus = 'active'`. Never suggest a hidden profile.
6. **Layout = cmdk/shadcn grouped command palette**, replicated natively
   (shadcn `Command` is web-only). Uppercase group header + name row + optional
   sub-line (genre / town / date), per the reference mockup.

## Coherence (suggestion source must match what search can find)

| Tab        | Tap runs           | Already matches author/creator name?                         |
| ---------- | ------------------ | ------------------------------------------------------------ |
| **Events** | events feed search | **No** → fix: add `creator_name` to `query_by`               |
| **Posts**  | posts feed search  | **Yes** → `buildSearchFilter` resolves stage/venue/user name |

Without the `creator_name` fix, tapping an artist suggestion on the Events tab
would return zero events — the feature would look broken on the entity we just added.

## Architecture

### Backend

**New validator** — `packages/shared/src/validators/discovery.ts`

```ts
export const suggestSchema = z.object({
  q: z.string().trim().min(1).max(100),
  scope: z.enum(['events', 'posts']).default('events'),
});
```

Exported from the validators index (single source of truth).

**New router** — `packages/api/src/routers/discovery.ts`, registered as
`discovery` in `routers/index.ts`.

`discovery.suggest` (`protectedProcedure`, input `suggestSchema`):

- Always queries (concurrently, `Promise.all`):
  - **artists** — `db.select(stageName, genres).from(artistProfiles)`
    `where ilike(stageName, %q%) AND isActive`, limit 5
  - **venues** — `db.select(venueName, town?).from(venueProfiles)`
    `where ilike(venueName, %q%) AND subscriptionStatus = 'active'`, limit 5
- Only when `scope === 'events'`:
  - **events** — Typesense `events` search, `query_by: 'title'`,
    `filter_by: status:=active`, `per_page: 5`; map distinct `title` (with
    `date_start` as sub-line). Degrades to `[]` on Typesense outage (same
    `.catch` pattern as `getFeed`).
- Returns:
  ```ts
  { artists: Suggestion[]; venues: Suggestion[]; events: Suggestion[] }
  // Suggestion = { label: string; sublabel?: string }
  // events: [] when scope === 'posts'
  ```

**Coherence fix** — `events/feed.ts`: `query_by: 'title,category,venue_address'`
→ `'title,category,venue_address,creator_name'`.

### Frontend

**`apps/native/hooks/use-search-suggestions.ts`**

- Input: `{ query: string; scope: 'events' | 'posts'; enabled: boolean }`.
- Debounce `query` ~250ms (`useDebouncedValue`), call
  `trpc.discovery.suggest.queryOptions({ q, scope })`.
- `enabled: enabled && debounced.length >= 1`.
- Returns `{ artists, venues, events, isLoading, isEmpty }`.

**`apps/native/components/SearchSuggestions.tsx`**

- Props: `{ artists, venues, events, isLoading, onSelect(label), onDismiss }`.
- Grouped list: uppercase header (`ARTISTS` / `VENUES` / `EVENTS`) + rows
  (`label`, muted `sublabel`). Tailwind/uniwind `className` only (no
  `StyleSheet.create`). Renders nothing when all groups empty and not loading.
- Absolute overlay positioned under the search bar.

**`apps/native/app/(app)/(tabs)/discover/index.tsx`**

- Track `searchFocused` (TextInput `onFocus`/`onBlur`, blur delayed so a row tap
  registers first).
- Render `<SearchSuggestions>` when `searchFocused && searchText.length >= 1`.
- `scope = activeSegment === 0 ? 'events' : 'posts'`.
- `onSelect(label)` → `setSearchText(label)` + `handleSearchChange(label)` +
  dismiss + `Keyboard.dismiss()`.

## Data flow

```
type → debounce(250) → discovery.suggest({ q, scope }) → { artists, venues, events }
     → grouped dropdown → tap row → fill box + run active-tab search → dismiss
```

## Edge / error states

- Blank `q` → no dropdown.
- Loading first results → subtle spinner row.
- No matches → render nothing (do not block the list).
- Dismiss on select, blur, or submit.
- Typesense outage → events group empty, artists/venues still returned.

## Testing

- **Hook** (`use-search-suggestions.test.ts`): debounces; disabled when
  `enabled=false` or empty query; passes `scope` through. (Mirrors
  `use-place-search.test.ts`.)
- **Procedure** (`discovery.suggest`): groups artists/venues/events; respects
  limits; filters `isActive` / active subscription; omits events for
  `scope='posts'`; Typesense outage → events `[]`.
- **Validator**: `suggestSchema` trims, enforces min/max, defaults scope.

## Out of scope (V1)

- Posts as a suggestion source (kept as in-tab caption/author filter).
- Indexing artists/venues in Typesense (DB `ILIKE` is sufficient at <1000-user scale).
- Navigating directly to an entity from a suggestion (autocomplete only).
