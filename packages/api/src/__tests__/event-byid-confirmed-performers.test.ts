import { describe, expect, it, vi } from 'vitest';

// crud.ts pulls in @CeolX/db (and its env validation) at import time. Stub the
// DB + schema + sync service so importing the helper doesn't trigger env checks.
vi.mock('@CeolX/db', () => ({ db: {} }));
vi.mock('@CeolX/db/schema/auth', () => ({ user: {} }));
vi.mock('@CeolX/db/schema/bookings', () => ({ bookings: {} }));
vi.mock('@CeolX/db/schema/events', () => ({
  eventCollaborators: {},
  events: {},
  savedEvents: {},
}));
vi.mock('@CeolX/db/schema/users', () => ({ artistProfiles: {}, venueProfiles: {} }));
vi.mock('../services/event-sync', () => ({
  syncEventToTypesense: vi.fn(),
  removeEventFromTypesense: vi.fn(),
}));

import { isConfirmedPerformer } from '../routers/events/crud';

const ACCEPTED = new Set(['booking-accepted']);

describe('isConfirmedPerformer', () => {
  it('counts a platform artist with an accepted booking', () => {
    expect(
      isConfirmedPerformer({ artistProfileId: 'user-1', bookingId: 'booking-accepted' }, ACCEPTED)
    ).toBe(true);
  });

  it('hides a platform artist whose booking is still pending', () => {
    expect(
      isConfirmedPerformer({ artistProfileId: 'user-1', bookingId: 'booking-pending' }, ACCEPTED)
    ).toBe(false);
  });

  it('counts a legacy auto-confirmed direct-add (no booking)', () => {
    expect(isConfirmedPerformer({ artistProfileId: 'user-1', bookingId: null }, ACCEPTED)).toBe(
      true
    );
  });

  it('hides an unregistered email invite (no artistProfileId)', () => {
    expect(isConfirmedPerformer({ artistProfileId: null, bookingId: null }, ACCEPTED)).toBe(false);
  });

  it('hides a venue-participant row (no artistProfileId, has booking)', () => {
    expect(
      isConfirmedPerformer({ artistProfileId: null, bookingId: 'booking-accepted' }, ACCEPTED)
    ).toBe(false);
  });
});
