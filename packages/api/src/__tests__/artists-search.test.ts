import * as drizzle from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserRole } from '@CeolX/shared';

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockSelect, mockSelectChain } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockSelectChain: vi.fn(),
}));

vi.mock('@CeolX/db', () => {
  // Thenable chain: every builder method returns the chain; awaiting it pulls
  // the next mockSelectChain() value. Mirrors the pattern in follows.test.ts.
  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      (mockSelectChain() as Promise<unknown>).then(resolve, reject),
  };

  mockSelect.mockImplementation(() => chain);

  return {
    db: {
      select: mockSelect,
    },
  };
});

vi.mock('@CeolX/db/schema/auth', () => ({
  user: { id: 'id', name: 'name', image: 'image', currentRole: 'current_role' },
}));
vi.mock('@CeolX/db/schema/users', () => ({
  artistProfiles: {
    id: 'id',
    userId: 'user_id',
    stageName: 'stage_name',
    genre: 'genre',
    genres: 'genres',
    bio: 'bio',
    location: 'location',
    profileImageUrl: 'profile_image_url',
    coverImageUrl: 'cover_image_url',
    contactEmail: 'contact_email',
    isActive: 'is_active',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
}));
vi.mock('@CeolX/db/schema/events', () => ({
  events: { id: 'id', createdBy: 'created_by', status: 'status' },
  eventCollaborators: { eventId: 'event_id', artistProfileId: 'artist_profile_id' },
}));
vi.mock('@CeolX/db/schema/social', () => ({
  follows: { id: 'id', followerId: 'follower_id', followeeId: 'followee_id' },
}));

// Spy on the predicate builders while keeping real behaviour, so we can assert
// WHICH columns are matched without executing SQL.
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof drizzle>();
  return {
    ...actual,
    ilike: vi.fn((column: unknown, value: unknown) => ({ column, value })),
    or: vi.fn((...conditions: unknown[]) => ({ or: conditions })),
  };
});

import { t } from '../index';
import { artistsRouter } from '../routers/artists';

const createCaller = t.createCallerFactory(artistsRouter);

function authedCaller(userId = 'venue-1') {
  return createCaller({
    session: { user: { id: userId, currentRole: 'venue' as UserRole } },
    userId,
    currentRole: 'venue' as UserRole,
  } as never);
}

function anonCaller() {
  return createCaller({ session: null } as never);
}

describe('artists.search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectChain.mockResolvedValue([]);
  });

  it('rejects unauthenticated callers', async () => {
    await expect(anonCaller().search({ q: 'vivek' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('selects the account name column so the row can show it', async () => {
    await authedCaller().search({ q: 'vivek' });

    const selectedColumns = mockSelect.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(selectedColumns).toHaveProperty('name');
  });

  it('matches on both the stage name and the account name', async () => {
    await authedCaller().search({ q: 'vivek' });

    // The query column is matched on the account name (mocked as 'name'),
    // and the stage-name + account-name predicates are combined with OR.
    // ilike's column arg is typed as Column/SQL; at runtime it's the mocked string.
    const ilikeColumns = vi.mocked(drizzle.ilike).mock.calls.map(([col]) => col as unknown);
    expect(ilikeColumns).toContain('name');
    expect(ilikeColumns).toContain('stage_name');
    expect(drizzle.or).toHaveBeenCalled();
  });

  it('returns the artists under an { artists } key', async () => {
    mockSelectChain.mockResolvedValue([
      { id: 'u1', stageName: 'Tune Bomb', genre: null, image: null, name: 'Vivek' },
    ]);

    const result = await authedCaller().search({ q: 'vivek' });
    expect(result.artists).toHaveLength(1);
    expect(result.artists[0]).toMatchObject({ stageName: 'Tune Bomb', name: 'Vivek' });
  });
});
