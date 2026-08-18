import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// users.me now resolves the venue's gate state server-side. The app used to infer it
// from `subscriptionStatus` alone, which ignored VENUE_GATE_ENABLED, the past-due grace
// window and `billing_blocked` — so these assert the field, not a client heuristic.
const { mockSelectLimit, mockOnHoldVenueIds, mockDb } = vi.hoisted(() => {
  const mockSelectLimit = vi.fn();
  const mockOnHoldVenueIds = vi.fn();
  const mockDb: Record<string, unknown> = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: mockSelectLimit })),
        leftJoin: vi.fn(() => ({ where: vi.fn(() => ({ limit: mockSelectLimit })) })),
      })),
    })),
  };
  return { mockSelectLimit, mockOnHoldVenueIds, mockDb };
});

vi.mock('@CeolX/db', () => ({ db: mockDb }));
vi.mock('../services/venue-gate', () => ({ onHoldVenueIds: mockOnHoldVenueIds }));
vi.mock('../routers/_profile-helpers', () => ({
  getFollowerCounts: vi.fn(() => Promise.resolve({ followerCount: 0, followingCount: 0 })),
  getSocialLinksRecord: vi.fn(() => Promise.resolve({})),
  resolveProfileVisibility: vi.fn(),
}));

import type { Context } from '../context';
import { router, t } from '../index';
import { usersRouter } from '../routers/users';

const createCaller = t.createCallerFactory(router({ users: usersRouter }));

const USER_ID = 'venue-user-1';
const VENUE_ID = 'venue-profile-1';

function venueContext(): Context {
  return {
    session: { user: { id: USER_ID, currentRole: 'venue' }, session: { userId: USER_ID } },
    userId: USER_ID,
  } as unknown as Context;
}

/** user row, then the venue profile row — in the order me() reads them. */
function prime(subscriptionStatus: string) {
  mockSelectLimit
    .mockResolvedValueOnce([
      {
        id: USER_ID,
        currentRole: 'venue',
        deletionCancelledAt: null,
        name: 'The Cobblestone',
      },
    ])
    .mockResolvedValueOnce([
      {
        id: VENUE_ID,
        venueName: 'The Cobblestone',
        bio: null,
        address: '77 King St',
        lat: null,
        lng: null,
        county: 'Dublin',
        websiteUrl: null,
        phone: null,
        profileImageUrl: null,
        coverImageUrl: null,
        contactEmail: null,
        subscriptionStatus,
        trialEndsAt: null,
      },
    ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSelectLimit.mockResolvedValue([]);
  mockOnHoldVenueIds.mockResolvedValue(new Set<string>());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('users.me — venue gate state (M8 high #1 and #2)', () => {
  it('reports not-on-hold while the gate is off, even for an inactive venue', async () => {
    // The bug this replaces: every production venue is `inactive`, so inferring from
    // status told all 47 their profile was not live while the gate was off and all of
    // them were in fact fully visible.
    prime('inactive');
    mockOnHoldVenueIds.mockResolvedValue(new Set<string>());

    const res = await createCaller(venueContext()).users.me();

    expect(res?.venueProfile?.onHold).toBe(false);
    expect(res?.venueProfile?.mayPublish).toBe(true);
  });

  it('reports on-hold when the gate says so', async () => {
    prime('inactive');
    mockOnHoldVenueIds.mockResolvedValue(new Set([VENUE_ID]));

    const res = await createCaller(venueContext()).users.me();

    expect(res?.venueProfile?.onHold).toBe(true);
    expect(res?.venueProfile?.mayPublish).toBe(false);
  });

  it('lets a past_due venue inside the grace window keep publishing (V-14)', async () => {
    // The client returned true for ALL past_due while the server blocked once grace
    // lapsed, so a venue eight days down was told it was live and then hit FORBIDDEN.
    // The grace decision now lives in one place and arrives resolved.
    prime('past_due');
    mockOnHoldVenueIds.mockResolvedValue(new Set<string>());

    const res = await createCaller(venueContext()).users.me();

    expect(res?.venueProfile?.mayPublish).toBe(true);
  });

  it('blocks publishing for a past_due venue past its grace window', async () => {
    prime('past_due');
    mockOnHoldVenueIds.mockResolvedValue(new Set([VENUE_ID]));

    const res = await createCaller(venueContext()).users.me();

    expect(res?.venueProfile?.onHold).toBe(true);
    expect(res?.venueProfile?.mayPublish).toBe(false);
  });

  it('asks the gate about this venue only, keyed on the profile id', async () => {
    prime('active');
    await createCaller(venueContext()).users.me();

    expect(mockOnHoldVenueIds).toHaveBeenCalledWith([VENUE_ID]);
  });
});
