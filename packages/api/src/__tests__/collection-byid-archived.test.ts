import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserRole } from '@CeolX/shared';
import { EventStatus } from '@CeolX/shared';

// Asana 1216029058657584 — a creator-deleted event soft-archives to
// status='archived'. A deleted event must disappear from EVERY read surface for
// EVERY persona — including a venue's own collection management screen ("not even
// in collections"). collections.byId is the access-control source of truth, so the
// owner branch must exclude archived events too (non-owners already get ACTIVE-only).

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

function ctx(role: UserRole, userId: string): Context {
  return {
    userId,
    currentRole: role,
    session: { user: { id: userId, currentRole: role, email: 'x@y.z', emailVerified: true } },
  } as unknown as Context;
}

// Now-relative so the test never time-bombs: both events must be *upcoming* for
// isUpcomingEvent to keep them — DELETED_EVENT stays in the future on purpose so
// this proves the status filter (not the date filter) is what hides it.
const DAY = 24 * 60 * 60 * 1000;
const ACTIVE_EVENT = {
  id: 'e0000000-0000-4000-a000-00000000aaaa',
  title: 'Live Trad Session',
  dateStart: new Date(Date.now() + 10 * DAY),
  coverImage: null,
  status: EventStatus.ACTIVE,
  category: 'Open Trad Sessions',
  venueAddress: null,
};
const DELETED_EVENT = {
  id: 'e0000000-0000-4000-a000-00000000dddd',
  title: 'Deleted Gig',
  dateStart: new Date(Date.now() + 11 * DAY),
  coverImage: null,
  status: EventStatus.ARCHIVED,
  category: 'Open Trad Sessions',
  venueAddress: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCollectionsFindFirst.mockResolvedValue({
    id: COLLECTION_ID,
    name: 'Friday Nights',
    description: null,
    logo: null,
    createdBy: OWNER_PROFILE_ID,
    createdAt: new Date('2026-06-01T00:00:00Z'),
    events: [ACTIVE_EVENT, DELETED_EVENT],
  });
});

describe('collections.byId — deleted (archived) events are never visible', () => {
  it('hides archived events from the owner managing their own collection', async () => {
    // Caller is the venue that owns the collection.
    mockVenueProfilesFindFirst.mockResolvedValue({ id: OWNER_PROFILE_ID });

    const caller = createCaller(ctx('venue' as UserRole, OWNER_USER_ID));
    const result = await caller.byId({ id: COLLECTION_ID });

    const ids = result.events.map((e) => e.id);
    expect(ids).toContain(ACTIVE_EVENT.id);
    expect(ids).not.toContain(DELETED_EVENT.id);
    expect(result.eventCount).toBe(1);
  });

  it('hides archived events from a non-owner viewing the public collection', async () => {
    // Caller is not a venue / not the owner.
    mockVenueProfilesFindFirst.mockResolvedValue(null);

    const caller = createCaller(ctx('spectator' as UserRole, 'someone-else'));
    const result = await caller.byId({ id: COLLECTION_ID });

    const ids = result.events.map((e) => e.id);
    expect(ids).toContain(ACTIVE_EVENT.id);
    expect(ids).not.toContain(DELETED_EVENT.id);
    expect(result.eventCount).toBe(1);
  });
});
