import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted Drizzle mocks ───────────────────────────────────────────────────

const { mockUpdateSet, mockUpdateWhere, mockUpdate, mockEventsFindFirst, mockSelect, mockDb } =
  vi.hoisted(() => {
    const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
    const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
    const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

    const mockEventsFindFirst = vi.fn();

    // Generic select chain that resolves to [] for any rollup query.
    const mockSelect = vi.fn(() => {
      const groupBy = vi.fn(() => ({
        orderBy: vi.fn().mockResolvedValue([]),
        then: (cb: (v: unknown[]) => void) => cb([]),
      }));
      const where = vi.fn(() => ({
        groupBy,
        then: (cb: (v: unknown[]) => void) => cb([]),
      }));
      const leftJoin = vi.fn(() => ({
        leftJoin: vi.fn(() => ({ where })),
        where,
      }));
      const from = vi.fn(() => ({
        where,
        leftJoin,
      }));
      return { from };
    });

    return {
      mockUpdateSet,
      mockUpdateWhere,
      mockUpdate,
      mockEventsFindFirst,
      mockSelect,
      mockDb: {
        update: mockUpdate,
        select: mockSelect,
        query: { events: { findFirst: mockEventsFindFirst } },
      },
    };
  });

vi.mock('@CeolX/db', () => ({ db: mockDb }));
vi.mock('@CeolX/db/schema/auth', () => ({ user: { id: 'id', image: 'image' } }));
vi.mock('@CeolX/db/schema/bookings', () => ({
  bookings: { eventId: 'event_id', status: 'status' },
}));
vi.mock('@CeolX/db/schema/users', () => ({
  artistProfiles: { userId: 'user_id', stageName: 'stage_name' },
}));
vi.mock('@CeolX/db/schema/events', () => ({
  events: { id: 'id', ticketClicks: 'ticket_clicks' },
  eventViews: { eventId: 'event_id', viewedAt: 'viewed_at' },
  savedEvents: { eventId: 'event_id' },
  eventCollaborators: {
    eventId: 'event_id',
    artistProfileId: 'artist_profile_id',
    invitedEmail: 'invited_email',
  },
}));

import type { Context } from '../context';
import { router, t } from '../index';
import {
  analytics,
  clearAnalyticsCache,
  computeAcceptanceRate,
  computeClickRate,
  computeEngagementRate,
  padDailyViews,
  trackTicketClick,
} from '../routers/events/analytics';

const testRouter = router({ events: router({ trackTicketClick, analytics }) });
const createCaller = t.createCallerFactory(testRouter);

const CREATOR_ID = 'creator-1';
const OTHER_USER_ID = 'other-user';

function authedCaller(userId: string) {
  return createCaller({
    session: {
      user: {
        id: userId,
        name: 'Test',
        email: 'test@ceolx.test',
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        currentRole: 'artist',
        consentAt: new Date(),
        marketingConsent: false,
        lastLoginAt: null,
        flaggedInactive: false,
      },
      session: {
        id: 'session-1',
        token: 'tok',
        expiresAt: new Date(Date.now() + 86_400_000),
        createdAt: new Date(),
        updatedAt: new Date(),
        userId,
        ipAddress: null,
        userAgent: null,
      },
    },
    dispatchNotification: vi.fn(async () => {}),
    scheduleAccountAnonymize: vi.fn(async () => {}),
  } as unknown as Context);
}

function fakeEventRow(eventId: string) {
  return {
    id: eventId,
    title: 'Bodhrán Buzz',
    coverImage: null,
    dateStart: new Date('2026-08-02T17:30:00Z'),
    dateEnd: null,
    venueAddress: "Gielty's, Dooagh",
    category: 'Open Trad Sessions',
    status: 'active',
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-01T00:00:00Z'),
    viewCount: 100,
    ticketClicks: 26,
    ticketLink: 'https://example.com/tickets',
    createdBy: CREATOR_ID,
  };
}

function anonCaller() {
  return createCaller({
    session: null,
    dispatchNotification: vi.fn(async () => {}),
    scheduleAccountAnonymize: vi.fn(async () => {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── trackTicketClick ────────────────────────────────────────────────────────

describe('events.trackTicketClick', () => {
  const eventId = crypto.randomUUID();

  it('is callable without authentication (public procedure)', async () => {
    const caller = anonCaller();
    await expect(caller.events.trackTicketClick({ id: eventId })).resolves.toEqual({
      tracked: true,
    });
  });

  it('issues an atomic increment of events.ticket_clicks for the given id', async () => {
    const caller = anonCaller();
    await caller.events.trackTicketClick({ id: eventId });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdateSet).toHaveBeenCalledTimes(1);

    // The set() call uses an SQL fragment to do the atomic increment, so we
    // assert structurally rather than by exact value.
    const setArg = mockUpdateSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg).toBeDefined();
    expect(setArg).toHaveProperty('ticketClicks');

    expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid eventId input via Zod', async () => {
    const caller = anonCaller();
    await expect(caller.events.trackTicketClick({ id: 'not-a-uuid' })).rejects.toThrow();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

// ─── Pure helpers ────────────────────────────────────────────────────────────

describe('computeEngagementRate', () => {
  it('returns 0 when there are no views (avoids divide-by-zero)', () => {
    expect(computeEngagementRate(10, 0)).toBe(0);
  });

  it('returns 0 when there are no saves', () => {
    expect(computeEngagementRate(0, 100)).toBe(0);
  });

  it('returns saves/views as a percentage rounded to 2 decimal places', () => {
    expect(computeEngagementRate(1, 3)).toBe(33.33);
    expect(computeEngagementRate(2, 5)).toBe(40);
    expect(computeEngagementRate(89, 1243)).toBe(7.16);
  });
});

describe('computeAcceptanceRate', () => {
  it('returns null when there are no bookings (avoids fake 0%)', () => {
    expect(
      computeAcceptanceRate({ pending: 0, accepted: 0, rejected: 0, cancelled: 0 }, 0)
    ).toBeNull();
  });

  it('returns accepted/total as a percentage', () => {
    expect(computeAcceptanceRate({ pending: 2, accepted: 8, rejected: 1, cancelled: 1 }, 12)).toBe(
      66.67
    );
  });

  it('returns 100 when all bookings are accepted', () => {
    expect(computeAcceptanceRate({ pending: 0, accepted: 5, rejected: 0, cancelled: 0 }, 5)).toBe(
      100
    );
  });
});

describe('computeClickRate', () => {
  it('returns null when the event has no ticket link', () => {
    expect(computeClickRate(50, 100, false)).toBeNull();
  });

  it('returns 0 when ticket link exists but no views', () => {
    expect(computeClickRate(0, 0, true)).toBe(0);
  });

  it('returns clicks/views as a percentage', () => {
    expect(computeClickRate(312, 1200, true)).toBe(26);
  });
});

describe('padDailyViews', () => {
  it('returns exactly N entries even when no views exist', () => {
    const padded = padDailyViews([], 14);
    expect(padded).toHaveLength(14);
    expect(padded.every((b) => b.count === 0)).toBe(true);
  });

  it('returns entries in chronological order ending today (UTC)', () => {
    const padded = padDailyViews([], 3);
    const dates = padded.map((b) => b.date);
    const [d0, d1, d2] = dates;
    expect(d0).toBeDefined();
    expect(d1).toBeDefined();
    expect(d2).toBeDefined();
    if (d0 && d1 && d2) {
      expect(d0 < d1).toBe(true);
      expect(d1 < d2).toBe(true);
    }

    const [todayUtc] = new Date().toISOString().split('T');
    expect(d2).toBe(todayUtc);
  });

  it('merges supplied bucket counts into the matching dates', () => {
    const [todayUtc] = new Date().toISOString().split('T');
    if (!todayUtc) throw new Error('unexpected ISO format');
    const padded = padDailyViews([{ day: todayUtc, count: 42 }], 7);
    expect(padded.find((b) => b.date === todayUtc)?.count).toBe(42);
    // Other days remain zero
    expect(padded.filter((b) => b.count === 0)).toHaveLength(6);
  });
});

// ─── analytics procedure ─────────────────────────────────────────────────────

describe('events.analytics', () => {
  const eventId = crypto.randomUUID();

  beforeEach(() => {
    clearAnalyticsCache();
  });

  it('returns NOT_FOUND when the event does not exist', async () => {
    mockEventsFindFirst.mockResolvedValueOnce(null);
    const caller = authedCaller(CREATOR_ID);

    await expect(caller.events.analytics({ id: eventId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('returns FORBIDDEN when the caller is not the event creator', async () => {
    mockEventsFindFirst.mockResolvedValueOnce(fakeEventRow(eventId));
    const caller = authedCaller(OTHER_USER_ID);

    await expect(caller.events.analytics({ id: eventId })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('returns the analytics payload with derived rates when caller is the owner', async () => {
    mockEventsFindFirst.mockResolvedValueOnce(fakeEventRow(eventId));
    const caller = authedCaller(CREATOR_ID);

    const data = await caller.events.analytics({ id: eventId });

    expect(data.event.id).toBe(eventId);
    expect(data.views.total).toBe(100);
    expect(data.views.daily).toHaveLength(14);
    expect(data.saves.total).toBe(0); // no rollup data in mocks
    expect(data.engagement.rate).toBe(0); // 0 saves / 100 views
    expect(data.ticketClicks.total).toBe(26);
    expect(data.ticketClicks.clickRate).toBe(26); // 26 / 100 * 100
    expect(data.bookings.total).toBe(0);
    expect(data.bookings.acceptanceRate).toBeNull();
    expect(data.performers.confirmed).toEqual([]);
    expect(data.performers.invitedCount).toBe(0);
    expect(typeof data.cachedAt).toBe('string');
    expect(typeof data.cacheExpiresAt).toBe('string');
  });

  it('returns the cached payload on a second call within the TTL (no extra DB round trips)', async () => {
    mockEventsFindFirst.mockResolvedValueOnce(fakeEventRow(eventId));
    const caller = authedCaller(CREATOR_ID);

    const first = await caller.events.analytics({ id: eventId });

    // The owner check still runs, but the heavy rollup queries should not.
    const selectCallCountBeforeSecond = mockSelect.mock.calls.length;
    mockEventsFindFirst.mockResolvedValueOnce(fakeEventRow(eventId));

    const second = await caller.events.analytics({ id: eventId });

    expect(second).toBe(first); // identical reference from cache
    expect(mockSelect.mock.calls.length).toBe(selectCallCountBeforeSecond);
  });
});
