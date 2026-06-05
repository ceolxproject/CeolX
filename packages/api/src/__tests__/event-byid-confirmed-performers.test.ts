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

import {
  isConfirmedPerformer,
  isExternalInvitee,
  toUnregisteredCollaborators,
} from '../routers/events/crud';

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

describe('isExternalInvitee', () => {
  it('counts an outside-platform invitee (name, no account, no venue)', () => {
    expect(
      isExternalInvitee({ artistProfileId: null, venueProfileId: null, invitedName: 'The Dubs' })
    ).toBe(true);
  });

  it('excludes a platform artist (has artistProfileId)', () => {
    expect(
      isExternalInvitee({ artistProfileId: 'user-1', venueProfileId: null, invitedName: null })
    ).toBe(false);
  });

  it('excludes a venue-participant row (has venueProfileId)', () => {
    expect(
      isExternalInvitee({ artistProfileId: null, venueProfileId: 'venue-1', invitedName: null })
    ).toBe(false);
  });

  it('excludes a row with no name (nothing to display)', () => {
    expect(
      isExternalInvitee({ artistProfileId: null, venueProfileId: null, invitedName: null })
    ).toBe(false);
  });
});

describe('toUnregisteredCollaborators', () => {
  it('returns name/email for genuine outside-platform invitees', () => {
    expect(
      toUnregisteredCollaborators([
        {
          artistProfileId: null,
          venueProfileId: null,
          invitedName: 'The Dubs',
          invitedEmail: 'dubs@example.com',
        },
      ])
    ).toEqual([{ name: 'The Dubs', email: 'dubs@example.com' }]);
  });

  it('excludes account-less venue-participant rows (no invitedName) so no empty entries leak', () => {
    // A venue-created event inserts a participant row: artistProfileId null,
    // venueProfileId set, invitedName/invitedEmail null. The loose `!artistProfileId`
    // filter used to map this to { name: '', email: '' }, which failed the edit
    // form's `name.min(1)` rule → "Too small expected string to have >=1".
    expect(
      toUnregisteredCollaborators([
        {
          artistProfileId: null,
          venueProfileId: 'venue-1',
          invitedName: null,
          invitedEmail: null,
        },
      ])
    ).toEqual([]);
  });

  it('excludes platform artists (have an artistProfileId)', () => {
    expect(
      toUnregisteredCollaborators([
        {
          artistProfileId: 'user-1',
          venueProfileId: null,
          invitedName: null,
          invitedEmail: null,
        },
      ])
    ).toEqual([]);
  });

  it('keeps only the external invitees from a mixed row set', () => {
    expect(
      toUnregisteredCollaborators([
        { artistProfileId: 'user-1', venueProfileId: null, invitedName: null, invitedEmail: null },
        { artistProfileId: null, venueProfileId: 'venue-1', invitedName: null, invitedEmail: null },
        {
          artistProfileId: null,
          venueProfileId: null,
          invitedName: 'Mary Black',
          invitedEmail: 'mary@example.com',
        },
      ])
    ).toEqual([{ name: 'Mary Black', email: 'mary@example.com' }]);
  });
});
