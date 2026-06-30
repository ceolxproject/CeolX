import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '@CeolX/shared';

// ─── Hoisted db mock ─────────────────────────────────────────────────────────
const { mockSelectLimit, mockInsertValues, mockUpdate, mockSet, mockWhere, mockDb } = vi.hoisted(
  () => {
    const mockSelectLimit = vi.fn();
    const mockInsertValues = vi.fn(() => Promise.resolve());
    const mockWhere = vi.fn(() => Promise.resolve());
    const mockSet = vi.fn(() => ({ where: mockWhere }));
    const mockUpdate = vi.fn(() => ({ set: mockSet }));

    const mockDb: Record<string, unknown> = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({ where: vi.fn(() => ({ limit: mockSelectLimit })) })),
      })),
      insert: vi.fn(() => ({ values: mockInsertValues })),
      update: mockUpdate,
    };
    mockDb.transaction = vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(mockDb));

    return { mockSelectLimit, mockInsertValues, mockUpdate, mockSet, mockWhere, mockDb };
  }
);

vi.mock('@CeolX/db', () => ({ db: mockDb }));
vi.mock('@CeolX/db/schema/auth', () => ({
  user: { id: 'id', currentRole: 'current_role', email: 'email' },
}));
vi.mock('@CeolX/db/schema/events', () => ({
  eventCollaborators: {
    eventId: 'event_id',
    artistProfileId: 'artist_profile_id',
    invitedEmail: 'invited_email',
    inviteToken: 'invite_token',
    inviteTokenExpiresAt: 'invite_token_expires_at',
  },
}));
vi.mock('@CeolX/db/schema/users', () => ({
  artistProfiles: { id: 'id', userId: 'user_id', stageName: 'stage_name' },
  profileSocialLinks: { userId: 'user_id', platform: 'platform', url: 'url' },
  venueProfiles: { id: 'id', userId: 'user_id' },
}));

import type { Context } from '../context';
import { t, router } from '../index';
import { onboardingRouter } from '../routers/onboarding';

const testRouter = router({ onboarding: onboardingRouter });
const createCaller = t.createCallerFactory(testRouter);

const USER_ID = 'artist-user-1';

function ctx(): Context {
  return {
    session: { user: { id: USER_ID, email: 'invited@example.com' }, session: { id: 's' } },
    dispatchNotification: vi.fn(async () => {}),
  } as unknown as Context;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInsertValues.mockResolvedValue(undefined);
  mockWhere.mockResolvedValue(undefined);
});

describe('onboarding.createArtistProfile — claim outside-platform invites (A-14)', () => {
  it('claims pending invites matching the verified email after creating the profile', async () => {
    // 1st select → user row (artist); 2nd select (inside tx) → no existing profile
    mockSelectLimit
      .mockResolvedValueOnce([{ currentRole: UserRole.ARTIST, email: 'Invited@Example.com' }])
      .mockResolvedValueOnce([]);

    const caller = createCaller(ctx());
    await caller.onboarding.createArtistProfile({ stageName: 'Tune Bomb' });

    // The claim UPDATE targets event_collaborators and links the new profile +
    // consumes the token.
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith({
      artistProfileId: USER_ID,
      inviteToken: null,
      inviteTokenExpiresAt: null,
    });
  });

  it('rejects non-artist users before any write', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ currentRole: UserRole.SPECTATOR, email: 'x@y.z' }]);

    const caller = createCaller(ctx());
    await expect(caller.onboarding.createArtistProfile({ stageName: 'Tune Bomb' })).rejects.toThrow(
      TRPCError
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
