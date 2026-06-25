import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserRole } from '@CeolX/shared';
import { EventStatus } from '@CeolX/shared';

// Asana 1216029058776470 — Collections should surface ONLY upcoming events.
// An `active` event whose date has already passed ("natural past") must not appear
// in a collection for ANY persona — owner or public viewer. This is separate from
// the archived/deleted exclusion (collection-byid-archived.test.ts): a past event
// is still status='active', it has simply slipped behind `now`.

const { mockDb, mockCollectionsFindFirst, mockVenueProfilesFindFirst } = vi.hoisted(() => {
  const mockCollectionsFindFirst = vi.fn();
  const mockVenueProfilesFindFirst = vi.fn();
  const mockDb: Record<string, unknown> = {
    query: {
      collections: { findFirst: mockCollectionsFindFirst },
      venueProfiles: { findFirst: mockVenueProfilesFindFirst },
    },
  };
  return { mockDb, mockCollectionsFindFirst, mockVenueProfilesFindFirst };
});

vi.mock('@CeolX/db', () => ({ db: mockDb }));
vi.mock('@CeolX/db/schema/events', () => ({ collections: { id: 'id', createdBy: 'created_by' } }));
vi.mock('@CeolX/db/schema/users', () => ({ venueProfiles: { id: 'id', userId: 'user_id' } }));

import type { Context } from '../context';
import { t } from '../index';
import { collectionsRouter } from '../routers/collections';

const createCaller = t.createCallerFactory(collectionsRouter);

const OWNER_USER_ID = 'venue-user-123';
const OWNER_PROFILE_ID = 'venue-profile-123';
const COLLECTION_ID = 'c0000000-0000-4000-a000-000000000001';

// Pin "now" so past/upcoming are deterministic regardless of when the suite runs.
const NOW = new Date('2026-06-25T12:00:00Z');

function ctx(role: UserRole, userId: string): Context {
  return {
    userId,
    currentRole: role,
    session: { user: { id: userId, currentRole: role, email: 'x@y.z', emailVerified: true } },
  } as unknown as Context;
}

const UPCOMING_EVENT = {
  id: 'e0000000-0000-4000-a000-00000000aaaa',
  title: 'Future Trad Session',
  dateStart: new Date('2026-07-10T20:00:00Z'), // after NOW
  coverImage: null,
  status: EventStatus.ACTIVE,
  category: 'Open Trad Sessions',
  venueAddress: null,
};
const PAST_EVENT = {
  id: 'e0000000-0000-4000-a000-00000000bbbb',
  title: 'Last Month Gig',
  dateStart: new Date('2026-05-20T20:00:00Z'), // before NOW
  coverImage: null,
  status: EventStatus.ACTIVE, // still active — only the date has passed
  category: 'Open Trad Sessions',
  venueAddress: null,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  mockCollectionsFindFirst.mockResolvedValue({
    id: COLLECTION_ID,
    name: 'Friday Nights',
    description: null,
    logo: null,
    createdBy: OWNER_PROFILE_ID,
    createdAt: new Date('2026-06-01T00:00:00Z'),
    events: [UPCOMING_EVENT, PAST_EVENT],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('collections.byId — past events are never visible', () => {
  it('hides past (active-but-elapsed) events from the owner', async () => {
    mockVenueProfilesFindFirst.mockResolvedValue({ id: OWNER_PROFILE_ID });

    const caller = createCaller(ctx('venue' as UserRole, OWNER_USER_ID));
    const result = await caller.byId({ id: COLLECTION_ID });

    const ids = result.events.map((e) => e.id);
    expect(ids).toContain(UPCOMING_EVENT.id);
    expect(ids).not.toContain(PAST_EVENT.id);
    expect(result.eventCount).toBe(1);
  });

  it('hides past events from a non-owner viewing the public collection', async () => {
    mockVenueProfilesFindFirst.mockResolvedValue(null);

    const caller = createCaller(ctx('spectator' as UserRole, 'someone-else'));
    const result = await caller.byId({ id: COLLECTION_ID });

    const ids = result.events.map((e) => e.id);
    expect(ids).toContain(UPCOMING_EVENT.id);
    expect(ids).not.toContain(PAST_EVENT.id);
    expect(result.eventCount).toBe(1);
  });
});
