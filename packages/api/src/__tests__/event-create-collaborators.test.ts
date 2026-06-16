import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { UserRole } from '@CeolX/shared';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
// The create resolver only needs a transaction that hands back a tx with an
// insert().values().returning() chain. We give it the minimum so a venue create
// with no collaborators reaches a successful insert.

const { mockInsertReturning, mockDb, mockSyncEventToTypesense } = vi.hoisted(() => {
  const mockInsertReturning = vi.fn();
  const mockSyncEventToTypesense = vi.fn(async () => {});

  const mockDb: Record<string, unknown> = {};
  const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }));

  Object.assign(mockDb, {
    query: {
      venueProfiles: { findFirst: vi.fn() },
      artistProfiles: { findFirst: vi.fn() },
      eventCollaborators: { findMany: vi.fn() },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(mockDb)),
  });

  return { mockInsertReturning, mockDb, mockSyncEventToTypesense };
});

vi.mock('@CeolX/db', () => ({ db: mockDb }));

vi.mock('@CeolX/db/schema/auth', () => ({ user: { id: 'id', image: 'image' } }));
vi.mock('@CeolX/db/schema/bookings', () => ({ bookings: { id: 'id' } }));
vi.mock('@CeolX/db/schema/events', () => ({
  events: { id: 'id', title: 'title', createdBy: 'created_by', status: 'status' },
  eventCollaborators: { id: 'id', eventId: 'event_id', artistProfileId: 'artist_profile_id' },
  savedEvents: { id: 'id', eventId: 'event_id', userId: 'user_id' },
}));
vi.mock('@CeolX/db/schema/users', () => ({
  artistProfiles: { id: 'id', userId: 'user_id', stageName: 'stage_name' },
  venueProfiles: { id: 'id', userId: 'user_id', venueName: 'venue_name', lat: 'lat', lng: 'lng' },
}));

vi.mock('../services/event-sync', () => ({
  syncEventToTypesense: mockSyncEventToTypesense,
  removeEventFromTypesense: vi.fn(async () => {}),
}));

import type { Context } from '../context';
import { t, router } from '../index';
import { create } from '../routers/events/crud';

const testRouter = router({ events: router({ create }) });
const createCaller = t.createCallerFactory(testRouter);

const mockDispatchNotification = vi.fn(async () => {});

function authedContext(role: UserRole, userId = 'venue-user-123'): Context {
  return {
    session: {
      user: {
        id: userId,
        name: 'Test User',
        email: 'test@ceolx.test',
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        currentRole: role,
        consentAt: new Date(),
        marketingConsent: false,
        lastLoginAt: null,
        flaggedInactive: false,
      },
      session: {
        id: 'test-session-id',
        token: 'test-token',
        expiresAt: new Date(Date.now() + 86_400_000),
        createdAt: new Date(),
        updatedAt: new Date(),
        userId,
        ipAddress: null,
        userAgent: null,
      },
    },
    dispatchNotification: mockDispatchNotification,
  } as unknown as Context;
}

const VENUE_USER_ID = 'venue-user-123';

const validEventInput = {
  title: 'Friday Night Trad Session',
  description: 'A great traditional Irish music session at the pub.',
  dateStart: new Date('2026-07-01T20:00:00Z').toISOString(),
  lat: 53.3498,
  lng: -6.2603,
  category: 'Open Trad Sessions' as const,
};

const insertedEvent = {
  id: 'c3333333-3333-4333-a333-333333333333',
  title: validEventInput.title,
  createdBy: VENUE_USER_ID,
  status: 'active',
  dateStart: new Date(validEventInput.dateStart),
};

describe('events.create — collaborators are optional', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertReturning.mockResolvedValue([insertedEvent]);
  });

  it('lets a venue create an event with no collaborators', async () => {
    const caller = createCaller(authedContext('venue' as UserRole));

    const result = await caller.events.create(validEventInput);

    expect(result).toMatchObject({ id: insertedEvent.id, title: validEventInput.title });
    expect(mockSyncEventToTypesense).toHaveBeenCalledOnce();
  });
});
