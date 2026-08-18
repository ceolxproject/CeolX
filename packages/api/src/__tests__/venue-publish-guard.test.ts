import { TRPCError } from '@trpc/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSelectLimit, mockOnHoldVenueIds } = vi.hoisted(() => ({
  mockSelectLimit: vi.fn(),
  mockOnHoldVenueIds: vi.fn(),
}));

vi.mock('@CeolX/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: mockSelectLimit })) })),
    })),
  },
}));
vi.mock('../services/venue-gate', () => ({ onHoldVenueIds: mockOnHoldVenueIds }));

import { assertVenueMayPublish } from '../routers/_venue-publish-guard';

beforeEach(() => {
  vi.clearAllMocks();
  mockSelectLimit.mockResolvedValue([{ id: 'venue-1' }]);
  mockOnHoldVenueIds.mockResolvedValue(new Set<string>());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('assertVenueMayPublish (V-14)', () => {
  it('blocks a venue whose subscription is on hold', async () => {
    mockOnHoldVenueIds.mockResolvedValue(new Set(['venue-1']));

    // Enforced server-side on purpose: the disabled button in the app is
    // presentation, and a direct tRPC call would sail straight past it.
    await expect(assertVenueMayPublish('user-1', 'venue')).rejects.toBeInstanceOf(TRPCError);
    await expect(assertVenueMayPublish('user-1', 'venue')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('allows a venue in good standing', async () => {
    await expect(assertVenueMayPublish('user-1', 'venue')).resolves.toBeUndefined();
  });

  it('allows a venue inside the grace window', async () => {
    // The gate service already excludes past_due-within-grace, so this asserts the
    // guard defers to it rather than adding a second, stricter rule of its own.
    mockOnHoldVenueIds.mockResolvedValue(new Set<string>());
    await expect(assertVenueMayPublish('user-1', 'venue')).resolves.toBeUndefined();
  });

  it.each(['artist', 'spectator', 'admin', null, undefined])(
    'no-ops for role %s without querying anything',
    async (role) => {
      // Artists are free (D-01) and have no billing state to gate on. Running the
      // venue lookup for them would be wasted work on the hot event-create path.
      await expect(assertVenueMayPublish('user-1', role)).resolves.toBeUndefined();
      expect(mockSelectLimit).not.toHaveBeenCalled();
      expect(mockOnHoldVenueIds).not.toHaveBeenCalled();
    }
  );

  it('no-ops when the venue has no profile row', async () => {
    mockSelectLimit.mockResolvedValue([]);
    await expect(assertVenueMayPublish('user-1', 'venue')).resolves.toBeUndefined();
    expect(mockOnHoldVenueIds).not.toHaveBeenCalled();
  });

  it('names reactivation in the refusal, rather than just refusing', async () => {
    mockOnHoldVenueIds.mockResolvedValue(new Set(['venue-1']));
    try {
      await assertVenueMayPublish('user-1', 'venue');
      expect.unreachable('expected a FORBIDDEN error');
    } catch (err) {
      // A venue told only "forbidden" has no idea what to do next.
      expect((err as TRPCError).message).toMatch(/subscription/i);
      expect((err as TRPCError).message).toMatch(/email/i);
    }
  });
});
