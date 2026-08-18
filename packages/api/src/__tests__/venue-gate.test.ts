import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSelectWhere, envState } = vi.hoisted(() => ({
  mockSelectWhere: vi.fn(),
  envState: { VENUE_GATE_ENABLED: 'true' } as Record<string, unknown>,
}));

vi.mock('@CeolX/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({ leftJoin: vi.fn(() => ({ where: mockSelectWhere })) })),
    })),
  },
}));
vi.mock('@CeolX/env/server', () => ({
  get env() {
    return envState;
  },
}));

import {
  filterOutOnHoldVenueItems,
  onHoldVenueIds,
  onHoldVenueUserIds,
} from '../services/venue-gate';

const row = (over: Record<string, unknown> = {}) => ({
  venueId: 'v1',
  userId: 'u1',
  subscriptionStatus: 'inactive',
  pastDueSince: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  envState.VENUE_GATE_ENABLED = 'true';
  mockSelectWhere.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the kill switch (O-08)', () => {
  it('treats every venue as visible while the gate is off, without querying', async () => {
    // This is what makes merging the gate inert: every production venue is still
    // `inactive`, so switching it on before the back-fill would hide all of them.
    envState.VENUE_GATE_ENABLED = 'false';

    expect(await onHoldVenueUserIds(['u1', 'u2'])).toEqual(new Set());
    expect(await onHoldVenueIds(['v1'])).toEqual(new Set());
    expect(mockSelectWhere).not.toHaveBeenCalled();
  });

  it('gates normally once switched on', async () => {
    mockSelectWhere.mockResolvedValue([row()]);
    expect(await onHoldVenueUserIds(['u1'])).toEqual(new Set(['u1']));
  });
});

describe('onHoldVenueUserIds', () => {
  it('keeps a past_due venue visible for as long as Stripe reports it (D-33 revised)', () => {
    // Dunning is Stripe's: past_due means it is still retrying the charge, and its
    // retry schedule cancels when it gives up — which arrives as `cancelled` and is
    // gated by the case above. No dates on our side, so no clock to disagree with.
    return expect(onHoldVenueUserIds(['u1']).then((s) => s.has('u1'))).resolves.toBe(false);
  });

  it('short-circuits on an empty input', async () => {
    expect(await onHoldVenueUserIds([])).toEqual(new Set());
    expect(mockSelectWhere).not.toHaveBeenCalled();
  });

  it.each([
    ['inactive', true],
    ['cancelled', true],
    ['trialing', false],
    ['active', false],
  ])('status %s → on hold: %s', async (status, expected) => {
    mockSelectWhere.mockResolvedValue([row({ subscriptionStatus: status })]);
    const held = await onHoldVenueUserIds(['u1']);
    expect(held.has('u1')).toBe(expected);
  });
});

describe('filterOutOnHoldVenueItems (V-03 vs V-06)', () => {
  const venueEvent = { id: 'e1', creatorId: 'venue-user' };
  const artistEvent = { id: 'e2', creatorId: 'artist-user' };
  const orphanEvent = { id: 'e3', creatorId: null };

  it("drops the venue's OWN events but keeps an artist's at the same venue", async () => {
    // The crux of the whole matrix: Sean overruled hiding artist-created events, so
    // "is this hidden" depends on WHO CREATED IT, not which venue it names.
    mockSelectWhere.mockResolvedValue([
      row({ userId: 'venue-user', subscriptionStatus: 'inactive' }),
    ]);

    const visible = await filterOutOnHoldVenueItems([venueEvent, artistEvent], (e) => e.creatorId);
    expect(visible.map((e) => e.id)).toEqual(['e2']);
  });

  it('keeps everything when no creator is on hold', async () => {
    mockSelectWhere.mockResolvedValue([]);
    const visible = await filterOutOnHoldVenueItems([venueEvent, artistEvent], (e) => e.creatorId);
    expect(visible).toHaveLength(2);
  });

  it('keeps an item with no creator id rather than hiding it', async () => {
    // Failing open: wrongly hiding a paying venue's event is worse than briefly
    // showing an unpaid one, and a null creator is a data problem not a billing one.
    mockSelectWhere.mockResolvedValue([
      row({ userId: 'venue-user', subscriptionStatus: 'inactive' }),
    ]);
    const visible = await filterOutOnHoldVenueItems([venueEvent, orphanEvent], (e) => e.creatorId);
    expect(visible.map((e) => e.id)).toEqual(['e3']);
  });

  it('returns everything untouched while the gate is off', async () => {
    envState.VENUE_GATE_ENABLED = 'false';
    const visible = await filterOutOnHoldVenueItems([venueEvent, artistEvent], (e) => e.creatorId);
    expect(visible).toHaveLength(2);
    expect(mockSelectWhere).not.toHaveBeenCalled();
  });

  it('deduplicates creator ids before querying', async () => {
    mockSelectWhere.mockResolvedValue([]);
    await filterOutOnHoldVenueItems(
      [venueEvent, { id: 'e4', creatorId: 'venue-user' }, { id: 'e5', creatorId: 'venue-user' }],
      (e) => e.creatorId
    );
    // One lookup regardless of how many events share a creator — this is what makes
    // post-filtering cheap enough to prefer over indexing the state (D-54).
    expect(mockSelectWhere).toHaveBeenCalledTimes(1);
  });

  it('short-circuits on an empty list', async () => {
    expect(await filterOutOnHoldVenueItems([], () => null)).toEqual([]);
    expect(mockSelectWhere).not.toHaveBeenCalled();
  });
});

describe('a venue with no billing row at all', () => {
  it('is still gated — the LEFT join must not drop it', async () => {
    // An inner join here would silently treat every never-subscribed venue as
    // visible, which is precisely the population the gate exists for.
    mockSelectWhere.mockResolvedValue([
      { venueId: 'v1', userId: 'u1', subscriptionStatus: 'inactive', pastDueSince: null },
    ]);
    expect((await onHoldVenueIds(['v1'])).has('v1')).toBe(true);
  });
});

describe('gate honours billingBlocked (D-51)', () => {
  it('holds a disputed venue even while Stripe still reports active', async () => {
    // The dispute handler writes `cancelled` but the subscription keeps billing, so
    // the next invoice.paid re-syncs to `active`. Reading status alone put the venue
    // back on the map within one cycle.
    mockSelectWhere.mockResolvedValue([
      row({ subscriptionStatus: 'active', billingBlocked: true }),
    ]);
    expect((await onHoldVenueUserIds(['u1'])).has('u1')).toBe(true);
  });

  it('treats a venue with no billing row as unblocked, not blocked', async () => {
    // LEFT join yields null, which must not read as `true`.
    mockSelectWhere.mockResolvedValue([
      row({ subscriptionStatus: 'active', billingBlocked: null }),
    ]);
    expect((await onHoldVenueUserIds(['u1'])).has('u1')).toBe(false);
  });
});
