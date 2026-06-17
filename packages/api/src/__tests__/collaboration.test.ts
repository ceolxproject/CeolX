import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationTrigger, SHARE_INTEREST_COOLDOWN_MS } from '@CeolX/shared';
import type { UserRole } from '@CeolX/shared';

// ─── Hoisted mocks ───────────────────────────────────────────────────────────

const {
  mockArtistsFindFirst,
  mockVenuesFindFirst,
  mockInterestsFindFirst,
  mockInsertValues,
  mockDb,
} = vi.hoisted(() => {
  const mockArtistsFindFirst = vi.fn();
  const mockVenuesFindFirst = vi.fn();
  const mockInterestsFindFirst = vi.fn();
  const mockInsertValues = vi.fn(() => Promise.resolve());

  const mockDb = {
    query: {
      artistProfiles: { findFirst: mockArtistsFindFirst },
      venueProfiles: { findFirst: mockVenuesFindFirst },
      collaborationInterests: { findFirst: mockInterestsFindFirst },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
  };

  return {
    mockArtistsFindFirst,
    mockVenuesFindFirst,
    mockInterestsFindFirst,
    mockInsertValues,
    mockDb,
  };
});

vi.mock('@CeolX/db', () => ({ db: mockDb }));

vi.mock('@CeolX/db/schema/users', () => ({
  artistProfiles: { id: 'id', userId: 'user_id', stageName: 'stage_name' },
  venueProfiles: { id: 'id', userId: 'user_id', venueName: 'venue_name' },
}));

vi.mock('@CeolX/db/schema/collaboration', () => ({
  collaborationInterests: {
    id: 'id',
    senderUserId: 'sender_user_id',
    recipientUserId: 'recipient_user_id',
    createdAt: 'created_at',
  },
}));

import type { Context } from '../context';
import { t, router } from '../index';
import { collaborationRouter } from '../routers/collaboration';

const testRouter = router({ collaboration: collaborationRouter });
const createCaller = t.createCallerFactory(testRouter);

// ─── Context + helpers ───────────────────────────────────────────────────────

const mockDispatchNotification = vi.fn(async () => {});

function authedContext(role: UserRole, userId: string): Context {
  return {
    session: { user: { id: userId, currentRole: role }, session: { id: 's' } },
    dispatchNotification: mockDispatchNotification,
  } as unknown as Context;
}

async function expectTRPCError(promise: Promise<unknown>, code: TRPCError['code']): Promise<void> {
  try {
    await promise;
    throw new Error(`Expected a TRPCError with code ${code} but the call succeeded`);
  } catch (err) {
    if (!(err instanceof TRPCError)) throw err;
    expect(err.code).toBe(code);
  }
}

const ARTIST_USER_ID = 'artist-user-1';
const VENUE_USER_ID = 'venue-user-1';

beforeEach(() => {
  vi.clearAllMocks();
  mockInterestsFindFirst.mockResolvedValue(undefined); // no prior interest by default
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('collaboration.shareInterest', () => {
  it('artist → venue dispatches COLLAB_INTEREST_TO_VENUE with the artist name + id', async () => {
    mockArtistsFindFirst.mockResolvedValue({ userId: ARTIST_USER_ID, stageName: 'Celtic Thunder' });
    mockVenuesFindFirst.mockResolvedValue({ userId: VENUE_USER_ID, venueName: 'The Temple Bar' });

    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    const result = await caller.collaboration.shareInterest({ recipientUserId: VENUE_USER_ID });

    expect(result).toEqual({ ok: true });
    expect(mockInsertValues).toHaveBeenCalledWith({
      senderUserId: ARTIST_USER_ID,
      recipientUserId: VENUE_USER_ID,
    });
    expect(mockDispatchNotification).toHaveBeenCalledWith({
      trigger: NotificationTrigger.COLLAB_INTEREST_TO_VENUE,
      recipientUserId: VENUE_USER_ID,
      vars: { artistName: 'Celtic Thunder', artistUserId: ARTIST_USER_ID },
    });
  });

  it('venue → artist dispatches COLLAB_INTEREST_TO_ARTIST with the venue name + id', async () => {
    mockVenuesFindFirst.mockResolvedValue({ userId: VENUE_USER_ID, venueName: 'The Temple Bar' });
    mockArtistsFindFirst.mockResolvedValue({ userId: ARTIST_USER_ID, stageName: 'Celtic Thunder' });

    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    const result = await caller.collaboration.shareInterest({ recipientUserId: ARTIST_USER_ID });

    expect(result).toEqual({ ok: true });
    expect(mockDispatchNotification).toHaveBeenCalledWith({
      trigger: NotificationTrigger.COLLAB_INTEREST_TO_ARTIST,
      recipientUserId: ARTIST_USER_ID,
      vars: { venueName: 'The Temple Bar', venueUserId: VENUE_USER_ID },
    });
  });

  it('rejects sharing interest with yourself', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    await expectTRPCError(
      caller.collaboration.shareInterest({ recipientUserId: ARTIST_USER_ID }),
      'BAD_REQUEST'
    );
    expect(mockDispatchNotification).not.toHaveBeenCalled();
  });

  it('rejects when the recipient is not the opposite persona', async () => {
    // Artist sender, but recipient has no venue profile (e.g. spectator / artist).
    mockArtistsFindFirst.mockResolvedValue({ userId: ARTIST_USER_ID, stageName: 'Celtic Thunder' });
    mockVenuesFindFirst.mockResolvedValue(undefined);

    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    await expectTRPCError(
      caller.collaboration.shareInterest({ recipientUserId: 'spectator-user-1' }),
      'BAD_REQUEST'
    );
    expect(mockDispatchNotification).not.toHaveBeenCalled();
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it('blocks a second interest to the same recipient within the cooldown window', async () => {
    mockArtistsFindFirst.mockResolvedValue({ userId: ARTIST_USER_ID, stageName: 'Celtic Thunder' });
    mockVenuesFindFirst.mockResolvedValue({ userId: VENUE_USER_ID, venueName: 'The Temple Bar' });
    mockInterestsFindFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 1000) });

    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    await expectTRPCError(
      caller.collaboration.shareInterest({ recipientUserId: VENUE_USER_ID }),
      'TOO_MANY_REQUESTS'
    );
    expect(mockDispatchNotification).not.toHaveBeenCalled();
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it('allows a fresh interest once the cooldown window has elapsed', async () => {
    mockArtistsFindFirst.mockResolvedValue({ userId: ARTIST_USER_ID, stageName: 'Celtic Thunder' });
    mockVenuesFindFirst.mockResolvedValue({ userId: VENUE_USER_ID, venueName: 'The Temple Bar' });
    mockInterestsFindFirst.mockResolvedValue({
      createdAt: new Date(Date.now() - SHARE_INTEREST_COOLDOWN_MS - 1000),
    });

    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    const result = await caller.collaboration.shareInterest({ recipientUserId: VENUE_USER_ID });

    expect(result).toEqual({ ok: true });
    expect(mockDispatchNotification).toHaveBeenCalledTimes(1);
  });
});
