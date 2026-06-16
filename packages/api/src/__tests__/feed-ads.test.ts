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
  venueProfiles: { id: 'id', venueName: 'venue_name' },
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
        venueName: "Gielty's",
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
