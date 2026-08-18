import { TRPCError } from '@trpc/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VENUE_PUBLISH_BLOCKED_MESSAGE } from '@CeolX/shared';

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
      // The client renders this exact sentence next to the disabled button. It was a
      // second identical literal here until 18/08/2026, and had already been edited on
      // one side only.
      expect((err as TRPCError).message).toBe(VENUE_PUBLISH_BLOCKED_MESSAGE);
    }
  });

  it('sends the venue to their profile, never back to their inbox', () => {
    // A venue told only "forbidden" has no idea what to do next, so the copy has to name
    // the cause and somewhere to act. It must NOT name the inbox: anyone reading this is
    // by definition someone the activation email failed to reach — it expired after 45
    // minutes (D-17), went to spam, or was never opened — so "check your email" is a dead
    // end. The profile can always mint a fresh link.
    expect(VENUE_PUBLISH_BLOCKED_MESSAGE).toMatch(/subscription/i);
    expect(VENUE_PUBLISH_BLOCKED_MESSAGE).toMatch(/profile/i);
    expect(VENUE_PUBLISH_BLOCKED_MESSAGE).not.toMatch(/email|inbox/i);
  });
});
