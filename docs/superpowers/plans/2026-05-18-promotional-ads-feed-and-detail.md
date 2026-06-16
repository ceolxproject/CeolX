# Promotional Ads — Discover Feed & Event Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the `adTitle`/`adDescription` venues already write at event creation. Show eligible ads pinned at the top of the Discover Feed (events starting in 30 min – 2 hrs) and as an inline `Offers` block on the Event Detail screen.

**Architecture:** No DB migration. New tRPC procedure `events.feedAds` queries the existing `events` table with a time-window filter. Native renders a new `<AdStack>` (data + dismiss persistence via `expo-secure-store`) at the top of the Discover feed and a new `<OfferBlock>` inside `EventDetailView` for whatever event the user is currently viewing.

**Tech Stack:** Hono + tRPC + Drizzle + Vitest (backend). Expo Router + uniwind Tailwind + heroui-native + expo-secure-store + Vitest (native).

**Spec:** [`docs/superpowers/specs/2026-05-18-promotional-ads-feed-and-detail-design.md`](../specs/2026-05-18-promotional-ads-feed-and-detail-design.md)

**Asana:** [Task 1214891201533191](https://app.asana.com/1/1194107417268910/project/1210959953917909/task/1214891201533191)

**Branch:** `feature/promotional-ads-feed-detail` (off `development`)

---

### Task 0: Set up branch

**Files:** none.

- [ ] **Step 1: Fetch latest development**

```bash
git fetch origin
git checkout development
git pull origin development
```

- [ ] **Step 2: Create the feature branch**

```bash
git checkout -b feature/promotional-ads-feed-detail
```

Expected: `Switched to a new branch 'feature/promotional-ads-feed-detail'`

---

### Task 1: Shared validator for `events.feedAds` input

The procedure takes no input today, but we give the schema a home so future filters (city, persona) land in one place rather than re-growing inline.

**Files:**

- Create: `packages/shared/src/validators/ads.ts`
- Modify: `packages/shared/src/validators/index.ts`

- [ ] **Step 1: Write the validator file**

```ts
// packages/shared/src/validators/ads.ts
import { z } from 'zod';

/**
 * Input for `events.feedAds`. Empty in V1 — exists so future filters
 * (city, persona, etc.) have a defined home instead of ad-hoc growth.
 */
export const feedAdsInputSchema = z.object({}).optional();

export type FeedAdsInput = z.infer<typeof feedAdsInputSchema>;
```

- [ ] **Step 2: Export from the validators barrel**

Edit `packages/shared/src/validators/index.ts` — add this line in alphabetical order:

```ts
export * from './ads.js';
```

- [ ] **Step 3: Verify the package builds**

Run: `pnpm --filter @CeolX/shared build`
Expected: build succeeds, no TS errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/validators/ads.ts packages/shared/src/validators/index.ts
git commit -m "✨ feat(shared): add feedads input validator"
```

---

### Task 2: Backend — `events.feedAds` procedure (failing test first)

**Files:**

- Create: `packages/api/src/routers/events/feed-ads.ts`
- Create: `packages/api/src/__tests__/feed-ads.test.ts`
- Modify: `packages/api/src/routers/events/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/api/src/__tests__/feed-ads.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted db mock ─────────────────────────────────────────────────────────
const { mockSelect, mockWhere } = vi.hoisted(() => {
  const mockWhere = vi.fn(() => ({
    orderBy: vi.fn(() => ({
      limit: vi.fn(() => Promise.resolve([])),
    })),
  }));
  const mockSelect = vi.fn(() => ({
    from: vi.fn(() => ({
      leftJoin: vi.fn(() => ({
        where: mockWhere,
      })),
    })),
  }));
  return { mockSelect, mockWhere };
});

vi.mock('@CeolX/db', () => ({
  db: { select: mockSelect },
}));

vi.mock('@CeolX/db/schema/events', () => ({
  events: {
    id: 'id',
    adTitle: 'ad_title',
    adDescription: 'ad_description',
    title: 'title',
    coverImage: 'cover_image',
    dateStart: 'date_start',
    status: 'status',
    venueId: 'venue_id',
  },
}));

vi.mock('@CeolX/db/schema/users', () => ({
  venueProfiles: { id: 'id', name: 'name' },
}));

import { fetchFeedAds } from '../routers/events/feed-ads';

describe('fetchFeedAds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns rows from the query unchanged', async () => {
    const fixture = [
      {
        id: 'evt-1',
        adTitle: 'Flat 50% Off',
        adDescription: 'Tonight only',
        eventTitle: 'The Bodhrán Buzz',
        coverImage: 'https://cdn/x.jpg',
        venueName: 'Gielty’s',
      },
    ];
    mockWhere.mockReturnValueOnce({
      orderBy: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve(fixture)) })),
    });

    const result = await fetchFeedAds();

    expect(result).toEqual(fixture);
  });

  it('returns empty array when no eligible ads', async () => {
    const result = await fetchFeedAds();
    expect(result).toEqual([]);
  });

  it('builds a where clause that filters status, ad presence, and date window', async () => {
    await fetchFeedAds();
    // The where clause is opaque to the test (drizzle SQL builders),
    // but we can at least assert it was called once per invocation.
    expect(mockWhere).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `pnpm --filter @CeolX/api test feed-ads`
Expected: `Cannot find module '../routers/events/feed-ads'` (file doesn't exist yet).

- [ ] **Step 3: Implement `feed-ads.ts`**

Create `packages/api/src/routers/events/feed-ads.ts`:

```ts
import { and, eq, gte, isNotNull, lte, sql } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { events } from '@CeolX/db/schema/events';
import { venueProfiles } from '@CeolX/db/schema/users';
import { feedAdsInputSchema } from '@CeolX/shared/validators';

import { publicProcedure } from '../../index';

const WINDOW_START_MIN = 30;
const WINDOW_END_MIN = 120;
const FEED_AD_LIMIT = 20;

export type FeedAd = {
  id: string;
  adTitle: string;
  adDescription: string | null;
  eventTitle: string;
  coverImage: string | null;
  venueName: string | null;
};

/**
 * Pure data fetcher — unit-testable without the tRPC wrapper.
 * Returns ads attached to events whose start time falls in the
 * [now + 30 min, now + 2 h] window.
 */
export async function fetchFeedAds(): Promise<FeedAd[]> {
  const rows = await db
    .select({
      id: events.id,
      adTitle: events.adTitle,
      adDescription: events.adDescription,
      eventTitle: events.title,
      coverImage: events.coverImage,
      venueName: venueProfiles.name,
    })
    .from(events)
    .leftJoin(venueProfiles, eq(venueProfiles.id, events.venueId))
    .where(
      and(
        eq(events.status, 'active'),
        isNotNull(events.adTitle),
        sql`length(trim(${events.adTitle})) > 0`,
        gte(events.dateStart, sql`now() + (${WINDOW_START_MIN} || ' minutes')::interval`),
        lte(events.dateStart, sql`now() + (${WINDOW_END_MIN} || ' minutes')::interval`)
      )
    )
    .orderBy(events.dateStart)
    .limit(FEED_AD_LIMIT);

  return rows.map((r) => ({
    id: r.id,
    adTitle: r.adTitle ?? '',
    adDescription: r.adDescription,
    eventTitle: r.eventTitle,
    coverImage: r.coverImage,
    venueName: r.venueName,
  }));
}

export const feedAds = publicProcedure.input(feedAdsInputSchema).query(async () => {
  return fetchFeedAds();
});
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm --filter @CeolX/api test feed-ads`
Expected: 3 passing.

- [ ] **Step 5: Register the procedure on the router**

Edit `packages/api/src/routers/events/index.ts`:

```ts
import { router } from '../../index';

import { analytics, trackTicketClick } from './analytics';
import { archive, byId, create, getMyEvents, update } from './crud';
import { feedAds } from './feed-ads';
import { getFeed } from './feed';
import { getMap } from './map';
import { getPresignedUrl, getSavedEvents, save, unsave } from './saved';

export const eventsRouter = router({
  getMap,
  getFeed,
  feedAds,
  byId,
  create,
  update,
  archive,
  save,
  unsave,
  getMyEvents,
  getSavedEvents,
  getPresignedUrl,
  analytics,
  trackTicketClick,
});
```

- [ ] **Step 6: Type-check api**

Run: `pnpm --filter @CeolX/api check-types`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/routers/events/feed-ads.ts \
        packages/api/src/routers/events/index.ts \
        packages/api/src/__tests__/feed-ads.test.ts
git commit -m "✨ feat(api): add events.feedads procedure for promotional ads"
```

---

### Task 3: Native — SecureStore helper for dismissed ad ids

The helper is plain async functions (no React). That keeps it testable without a renderer and reusable from both `AdStack` (read) and `AdCard`'s dismiss callback (write).

**Files:**

- Create: `apps/native/lib/storage/dismissed-ads.ts`
- Create: `apps/native/lib/storage/__tests__/dismissed-ads.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/native/lib/storage/__tests__/dismissed-ads.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockSet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn(),
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: mockGet,
  setItemAsync: mockSet,
}));

import { dismissAd, DISMISSED_ADS_KEY, getDismissedAdIds } from '../dismissed-ads';

describe('dismissed-ads storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty array when SecureStore has no value', async () => {
    mockGet.mockResolvedValueOnce(null);
    expect(await getDismissedAdIds()).toEqual([]);
  });

  it('returns the parsed array when SecureStore has a value', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify(['a', 'b']));
    expect(await getDismissedAdIds()).toEqual(['a', 'b']);
  });

  it('returns [] and does not throw when stored value is malformed', async () => {
    mockGet.mockResolvedValueOnce('not-json');
    expect(await getDismissedAdIds()).toEqual([]);
  });

  it('appends a new id to existing ids', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify(['a']));
    await dismissAd('b');
    expect(mockSet).toHaveBeenCalledWith(DISMISSED_ADS_KEY, JSON.stringify(['a', 'b']));
  });

  it('does not duplicate when dismissing an already-dismissed id', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify(['a']));
    await dismissAd('a');
    expect(mockSet).toHaveBeenCalledWith(DISMISSED_ADS_KEY, JSON.stringify(['a']));
  });

  it('drops the oldest id when the cap of 50 is exceeded', async () => {
    const existing = Array.from({ length: 50 }, (_, i) => `id-${i}`);
    mockGet.mockResolvedValueOnce(JSON.stringify(existing));
    await dismissAd('new');
    const expected = [...existing.slice(1), 'new'];
    expect(mockSet).toHaveBeenCalledWith(DISMISSED_ADS_KEY, JSON.stringify(expected));
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `pnpm --filter native test dismissed-ads`
Expected: `Cannot find module '../dismissed-ads'`.

- [ ] **Step 3: Implement the helper**

Create `apps/native/lib/storage/dismissed-ads.ts`:

```ts
import * as SecureStore from 'expo-secure-store';

export const DISMISSED_ADS_KEY = 'dismissed-ad-ids';
const MAX_DISMISSED = 50;

export async function getDismissedAdIds(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(DISMISSED_ADS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function dismissAd(id: string): Promise<void> {
  const existing = await getDismissedAdIds();
  if (existing.includes(id)) return;
  const next =
    existing.length >= MAX_DISMISSED
      ? [...existing.slice(existing.length - MAX_DISMISSED + 1), id]
      : [...existing, id];
  await SecureStore.setItemAsync(DISMISSED_ADS_KEY, JSON.stringify(next));
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm --filter native test dismissed-ads`
Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/native/lib/storage/dismissed-ads.ts \
        apps/native/lib/storage/__tests__/dismissed-ads.test.ts
git commit -m "✨ feat(native): add dismissed-ads securestore helper"
```

---

### Task 4: Native — `AdCard` pure presentation component

Follows the Figma 1-9861 layout: white card, 35×35 thumbnail, bold-quoted headline, two buttons. No data, no storage — props in, callbacks out.

**Files:**

- Create: `apps/native/components/ads/AdCard.tsx`
- Create: `apps/native/components/ads/__tests__/AdCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/native/components/ads/__tests__/AdCard.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Image: 'Image',
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
}));

import { AdCard } from '../AdCard';

describe('AdCard', () => {
  const baseProps = {
    id: 'evt-1',
    adTitle: 'Flat 50% Off',
    eventTitle: 'The Bodhrán Buzz',
    coverImage: null,
    onDismiss: vi.fn(),
    onPress: vi.fn(),
  };

  it('renders without crashing', () => {
    const el = AdCard(baseProps);
    expect(el).toBeTruthy();
  });

  it('passes the ad id to onDismiss when the dismiss handler fires', () => {
    const onDismiss = vi.fn();
    const node: any = AdCard({ ...baseProps, onDismiss });
    // Find the dismiss button by its accessibility label
    const dismissBtn = findByA11yLabel(node, 'Dismiss ad');
    expect(dismissBtn).toBeDefined();
    dismissBtn.props.onPress();
    expect(onDismiss).toHaveBeenCalledWith('evt-1');
  });

  it('passes the ad id to onPress when view details is tapped', () => {
    const onPress = vi.fn();
    const node: any = AdCard({ ...baseProps, onPress });
    const viewBtn = findByA11yLabel(node, 'View ad details');
    viewBtn.props.onPress();
    expect(onPress).toHaveBeenCalledWith('evt-1');
  });
});

function findByA11yLabel(node: any, label: string): any {
  if (!node) return undefined;
  if (node.props?.accessibilityLabel === label) return node;
  const children = Array.isArray(node.props?.children)
    ? node.props.children.flat()
    : [node.props?.children];
  for (const child of children) {
    const found = findByA11yLabel(child, label);
    if (found) return found;
  }
  return undefined;
}
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `pnpm --filter native test AdCard`
Expected: `Cannot find module '../AdCard'`.

- [ ] **Step 3: Implement `AdCard`**

Create `apps/native/components/ads/AdCard.tsx`:

```tsx
import { Image, Pressable, Text, View } from 'react-native';

export type AdCardProps = {
  id: string;
  adTitle: string;
  eventTitle: string;
  coverImage: string | null;
  onDismiss: (id: string) => void;
  onPress: (id: string) => void;
};

export function AdCard({ id, adTitle, eventTitle, coverImage, onDismiss, onPress }: AdCardProps) {
  return (
    <View
      className="mx-5 rounded-xl bg-white px-4 py-4"
      style={{ shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 8 }}
    >
      <View className="flex-row items-center gap-3">
        {coverImage ? (
          <Image source={{ uri: coverImage }} className="h-[35px] w-[35px] rounded" />
        ) : (
          <View className="h-[35px] w-[35px] rounded bg-[#d9d9d9]" />
        )}
        <View className="flex-1">
          <Text className="text-base font-medium text-black font-urbanist">
            <Text>{adTitle} on </Text>
            <Text className="font-bold">&ldquo;{eventTitle}&rdquo;</Text>
          </Text>
          <Text className="text-[11px] font-light text-black font-urbanist">{eventTitle}</Text>
        </View>
      </View>

      <View className="mt-4 flex-row gap-3">
        <Pressable
          accessibilityLabel="Dismiss ad"
          onPress={() => onDismiss(id)}
          className="flex-1 items-center justify-center rounded-full border border-black py-3"
        >
          <Text className="text-xs font-bold uppercase tracking-[2px] text-black font-urbanist">
            DISMISS
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="View ad details"
          onPress={() => onPress(id)}
          className="flex-1 items-center justify-center rounded-full bg-[#6155F5] py-3"
        >
          <Text className="text-xs font-bold uppercase tracking-[2px] text-white font-urbanist">
            VIEW DETAILS
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm --filter native test AdCard`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/native/components/ads/AdCard.tsx \
        apps/native/components/ads/__tests__/AdCard.test.tsx
git commit -m "✨ feat(native): add adcard component for promotional ads"
```

---

### Task 5: Native — `AdStack` (query + dismiss persistence)

Owns the data: queries `events.feedAds` via the existing tRPC client, reads dismissed ids from SecureStore on mount, filters them out, renders the stack. Returns `null` when there's nothing eligible (no empty placeholder taking up vertical space in the feed).

**Files:**

- Create: `apps/native/components/ads/AdStack.tsx`

- [ ] **Step 1: Implement `AdStack`**

The project uses TanStack Query v5 with `createTRPCOptionsProxy` (see `apps/native/utils/trpc.ts` and `apps/native/hooks/use-feed-events.ts:39` for the canonical pattern: `trpc.events.X.queryOptions(input)` passed into `useQuery`).

Create `apps/native/components/ads/AdStack.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { trpc } from '@/utils/trpc';
import { dismissAd, getDismissedAdIds } from '@/lib/storage/dismissed-ads';

import { AdCard } from './AdCard';

export function AdStack() {
  const router = useRouter();
  const { data: ads } = useQuery({
    ...trpc.events.feedAds.queryOptions(undefined),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const [dismissedIds, setDismissedIds] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDismissedAdIds().then((ids) => {
      if (!cancelled) setDismissedIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDismiss = useCallback(async (id: string) => {
    await dismissAd(id);
    setDismissedIds((prev) => (prev ? Array.from(new Set([...prev, id])) : [id]));
  }, []);

  const handlePress = useCallback(
    (id: string) => {
      router.push(`/(app)/(tabs)/discover/event/${id}`);
    },
    [router]
  );

  // Don't render anything until we know what's been dismissed locally —
  // otherwise an ad would briefly flash before being filtered out.
  if (!ads || dismissedIds === null) return null;

  const visible = ads.filter((ad) => !dismissedIds.includes(ad.id));
  if (visible.length === 0) return null;

  return (
    <View className="gap-3 pb-2">
      {visible.map((ad) => (
        <AdCard
          key={ad.id}
          id={ad.id}
          adTitle={ad.adTitle}
          eventTitle={ad.eventTitle}
          coverImage={ad.coverImage}
          onDismiss={handleDismiss}
          onPress={handlePress}
        />
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Type-check native**

Run: `pnpm --filter native check-types`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/native/components/ads/AdStack.tsx
git commit -m "✨ feat(native): add adstack with query and dismiss persistence"
```

---

### Task 6: Wire `<AdStack />` into Discover Feed

**Files:**

- Modify: `apps/native/app/(app)/(tabs)/discover/index.tsx`

- [ ] **Step 1: Add the import and use it as `ListHeaderComponent`**

Open `apps/native/app/(app)/(tabs)/discover/index.tsx`. Add this import alongside the others:

```ts
import { AdStack } from '@/components/ads/AdStack';
```

Then update the `FlatList` (around line 209) to add a `ListHeaderComponent` prop. The list is rendered inside the `activeSegment === 0` branch — only attach the ad stack there:

```tsx
<FlatList
  data={events}
  keyExtractor={(item) => item.id}
  style={{ flex: 1, backgroundColor: '#080808' }}
  renderItem={renderEvent}
  ListHeaderComponent={<AdStack />}
  onEndReached={() => {
    if (hasNextPage) loadMore();
  }}
  /* …rest unchanged… */
/>
```

- [ ] **Step 2: Type-check native**

Run: `pnpm --filter native check-types`
Expected: no errors.

- [ ] **Step 3: Manual smoke test (optional but recommended at this point)**

Start the dev client, sign in, seed (or pick) a venue event with `adTitle` set and `dateStart` ~ 45 minutes from now. Open the Discover tab. The ad should appear above the event cards. Tap `DISMISS`. The ad disappears. Reload — still gone.

- [ ] **Step 4: Commit**

```bash
git add apps/native/app/\(app\)/\(tabs\)/discover/index.tsx
git commit -m "✨ feat(native): render adstack at top of discover feed"
```

---

### Task 7: Native — `OfferBlock` for Event Detail (failing test first)

Pure presentation. No buttons, no dismiss — just a section heading and a content card. Renders only when `title` is non-empty so the call site can pass props unconditionally.

**Files:**

- Create: `apps/native/components/event-detail/OfferBlock.tsx`
- Create: `apps/native/components/event-detail/__tests__/OfferBlock.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/native/components/event-detail/__tests__/OfferBlock.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Text: 'Text',
  View: 'View',
}));

import { OfferBlock } from '../OfferBlock';

describe('OfferBlock', () => {
  it('renders null when title is empty', () => {
    expect(OfferBlock({ title: '', description: 'x' })).toBeNull();
  });

  it('renders null when title is null', () => {
    expect(OfferBlock({ title: null, description: 'x' })).toBeNull();
  });

  it('renders a section element when title is non-empty', () => {
    const node = OfferBlock({ title: 'Flat 50% Off', description: 'Tonight only' });
    expect(node).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `pnpm --filter native test OfferBlock`
Expected: `Cannot find module '../OfferBlock'`.

- [ ] **Step 3: Implement `OfferBlock`**

Create `apps/native/components/event-detail/OfferBlock.tsx`:

```tsx
import { Text, View } from 'react-native';

export type OfferBlockProps = {
  title: string | null | undefined;
  description: string | null | undefined;
};

export function OfferBlock({ title, description }: OfferBlockProps) {
  if (!title || title.trim().length === 0) return null;

  return (
    <View className="mt-6 px-4">
      <Text className="text-xs font-bold uppercase tracking-wider text-gray-3 font-urbanist mb-2">
        Offers
      </Text>
      <View className="rounded-xl bg-white px-4 py-4">
        <Text className="text-base font-semibold text-black font-urbanist">{title}</Text>
        {description ? (
          <Text className="mt-1 text-sm text-black/70 font-urbanist">{description}</Text>
        ) : null}
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm --filter native test OfferBlock`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/native/components/event-detail/OfferBlock.tsx \
        apps/native/components/event-detail/__tests__/OfferBlock.test.tsx
git commit -m "✨ feat(native): add offerblock component for event detail"
```

---

### Task 8: Wire `<OfferBlock />` below location in `EventDetailView`

`event.adTitle` and `event.adDescription` are already on `EventDetailData` (see `apps/native/types/event-detail.ts:49-50`) and already returned by `events.byId`. We just need to render the block.

**Files:**

- Modify: `apps/native/components/event-detail/EventDetailView.tsx`

- [ ] **Step 1: Add the import**

Open `apps/native/components/event-detail/EventDetailView.tsx`. Add this import next to the other `event-detail` imports:

```ts
import { OfferBlock } from './OfferBlock';
```

- [ ] **Step 2: Render the block directly below the LocationMapPreview block**

Replace this section (around line 214–223):

```tsx
        {/* Location Map */}
        <SectionDivider className="mx-4" />
        <View className="px-4">
          <LocationMapPreview
            lat={event.lat}
            lng={event.lng}
            venueAddress={event.venueAddress ?? undefined}
            distanceKm={distanceKm}
          />
        </View>
```

with:

```tsx
        {/* Location Map */}
        <SectionDivider className="mx-4" />
        <View className="px-4">
          <LocationMapPreview
            lat={event.lat}
            lng={event.lng}
            venueAddress={event.venueAddress ?? undefined}
            distanceKm={distanceKm}
          />
        </View>

        {/* Offers — only this event's own ad, if it has one */}
        <OfferBlock title={event.adTitle} description={event.adDescription} />
```

- [ ] **Step 3: Type-check native**

Run: `pnpm --filter native check-types`
Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Open the dev client, open the same venue event used in Task 6. Scroll past the location section. The `Offers` block should be visible with the ad title and description. Open a different event that has _no_ ad — no Offers section visible.

- [ ] **Step 5: Commit**

```bash
git add apps/native/components/event-detail/EventDetailView.tsx
git commit -m "✨ feat(native): render offerblock below location on event detail"
```

---

### Task 9: Open the pull request

**Files:** none.

- [ ] **Step 1: Run all tests one last time**

Run: `pnpm --filter @CeolX/api test && pnpm --filter native test`
Expected: all green.

- [ ] **Step 2: Push the branch**

```bash
git push -u origin feature/promotional-ads-feed-detail
```

- [ ] **Step 3: Open the PR against `development`**

```bash
gh pr create --base development --title "feat: render promotional ads on discover feed and event detail" --body "$(cat <<'EOF'
## Summary

- New tRPC procedure `events.feedAds` queries events with `ad_title` set whose `date_start` falls in [now+30min, now+2h] and `status='active'`.
- New `<AdStack />` renders eligible ads as a stack at the top of the Discover feed. Per-device dismiss via expo-secure-store (cap 50).
- New `<OfferBlock />` renders the event's own ad below the location section on the event detail screen.
- No schema migration — ads continue to live on `events.ad_title` / `events.ad_description`.

Closes Asana task 1214891201533191.

## Test plan

- [ ] Unit: \`pnpm --filter @CeolX/api test feed-ads\` passes
- [ ] Unit: \`pnpm --filter native test dismissed-ads AdCard OfferBlock\` passes
- [ ] Manual: seed venue event with ad_title set + date_start 45min from now → ad visible on Discover feed
- [ ] Manual: tap DISMISS → ad disappears and stays gone after reload
- [ ] Manual: open that event's detail page → Offers section visible below location
- [ ] Manual: open an event with no ad_title → no Offers section on detail page
EOF
)"
```

---

## Spec coverage check

| Spec section                                            | Covered by                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------ |
| Eligibility — feed (30 min – 2 hrs, active, ad present) | Task 2                                                       |
| Eligibility — detail (event's own ad only)              | Task 7 + Task 8 (`OfferBlock` reads from the same event row) |
| `events.feedAds` procedure                              | Task 2                                                       |
| Response shape `FeedAd`                                 | Task 2                                                       |
| `AdCard` (Figma 1-9861 layout)                          | Task 4                                                       |
| `AdStack` data + dismiss filtering                      | Task 5                                                       |
| `OfferBlock` no buttons / no dismiss                    | Task 7                                                       |
| SecureStore key, cap 50, FIFO                           | Task 3                                                       |
| Headline composition (bold quoted event title)          | Task 4                                                       |
| Wiring into Discover feed                               | Task 6                                                       |
| Wiring below location on detail                         | Task 8                                                       |
| Tests for query, storage, components                    | Tasks 2, 3, 4, 7                                             |
| Manual acceptance criteria                              | Task 9 PR test plan                                          |
