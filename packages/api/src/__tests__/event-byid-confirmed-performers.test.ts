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

import { BookingDirection, BookingStatus, EventStatus } from '@CeolX/shared';

import {
  diffPlatformInvites,
  isConfirmedPerformer,
  isExternalInvitee,
  isHiddenFromViewer,
  isPendingPlatformInvite,
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

describe('isPendingPlatformInvite', () => {
  // The edit form's "Invite Artists" field is seeded from an event's *pending
  // performer invites* — a venue→artist or artist→artist booking the invitee
  // hasn't accepted yet. An artist→venue consent request is a pending booking
  // too but is NOT a performer invite, so it must be excluded. (Asana 1215912673233456)
  it('counts a pending venue→artist invite', () => {
    expect(
      isPendingPlatformInvite({
        status: BookingStatus.PENDING,
        direction: BookingDirection.VENUE_TO_ARTIST,
      })
    ).toBe(true);
  });

  it('counts a pending artist→artist (co-artist) invite', () => {
    expect(
      isPendingPlatformInvite({
        status: BookingStatus.PENDING,
        direction: BookingDirection.ARTIST_TO_ARTIST,
      })
    ).toBe(true);
  });

  it('excludes a pending artist→venue consent request (not a performer invite)', () => {
    expect(
      isPendingPlatformInvite({
        status: BookingStatus.PENDING,
        direction: BookingDirection.ARTIST_TO_VENUE,
      })
    ).toBe(false);
  });

  it('excludes an accepted invite (no longer pending — shown as a confirmed performer)', () => {
    expect(
      isPendingPlatformInvite({
        status: BookingStatus.ACCEPTED,
        direction: BookingDirection.VENUE_TO_ARTIST,
      })
    ).toBe(false);
  });

  it('excludes a cancelled invite', () => {
    expect(
      isPendingPlatformInvite({
        status: BookingStatus.CANCELLED,
        direction: BookingDirection.VENUE_TO_ARTIST,
      })
    ).toBe(false);
  });
});

describe('diffPlatformInvites', () => {
  // On edit the form sends the full list of platform-artist userIds it shows.
  // The server diffs that against what already exists: additions are submitted
  // artists not yet collaborating; removals are previously-pending invites the
  // creator dropped from the field. Self is never added or removed.
  // (Asana 1215912673233456)
  const SELF = 'me';

  it('adds submitted artists not already collaborating', () => {
    expect(diffPlatformInvites(['a', 'c'], ['a'], ['a'], SELF)).toEqual({
      toAdd: ['c'],
      toRemove: [],
    });
  });

  it('removes a previously-pending invite dropped from the list', () => {
    expect(diffPlatformInvites(['a'], ['a', 'b'], ['a', 'b'], SELF)).toEqual({
      toAdd: [],
      toRemove: ['b'],
    });
  });

  it('removes every pending invite when the list is cleared', () => {
    expect(diffPlatformInvites([], ['a', 'b'], ['a', 'b'], SELF)).toEqual({
      toAdd: [],
      toRemove: ['a', 'b'],
    });
  });

  it('keeps an unchanged invite (neither added nor removed)', () => {
    expect(diffPlatformInvites(['a'], ['a'], ['a'], SELF)).toEqual({ toAdd: [], toRemove: [] });
  });

  it('never adds or removes the creator themselves', () => {
    // Self appears in submitted and is an existing collaborator (artist→venue
    // request row) — it must be ignored on both sides.
    expect(diffPlatformInvites([SELF, 'a'], [SELF], [SELF], SELF)).toEqual({
      toAdd: ['a'],
      toRemove: [],
    });
  });

  it('does not remove an accepted performer (only pending invites are removable)', () => {
    // 'b' accepted (so it is a collaborator but NOT in the pending set) and was
    // dropped from the field — it must NOT be withdrawn here.
    expect(diffPlatformInvites(['a'], ['a', 'b'], ['a'], SELF)).toEqual({
      toAdd: [],
      toRemove: [],
    });
  });
});

describe('isHiddenFromViewer', () => {
  // events.byId is a public endpoint. Archived (creator-deleted) and admin-removed
  // events are pulled from every public surface, so the detail endpoint must hide
  // them from everyone but their creator — who still needs access (resubmit a
  // removed event, review an archived one). Asana 1216029035679712.
  const CREATOR = 'creator-1';
  const OTHER = 'other-2';

  it('shows an active event to a different user', () => {
    expect(isHiddenFromViewer({ status: EventStatus.ACTIVE, createdBy: CREATOR }, OTHER)).toBe(
      false
    );
  });

  it('shows an active event to an anonymous viewer', () => {
    expect(isHiddenFromViewer({ status: EventStatus.ACTIVE, createdBy: CREATOR }, null)).toBe(
      false
    );
  });

  it('hides an admin-removed event from a different user', () => {
    expect(isHiddenFromViewer({ status: EventStatus.REMOVED, createdBy: CREATOR }, OTHER)).toBe(
      true
    );
  });

  it('hides an admin-removed event from an anonymous viewer', () => {
    expect(isHiddenFromViewer({ status: EventStatus.REMOVED, createdBy: CREATOR }, null)).toBe(
      true
    );
  });

  it('still shows an admin-removed event to its creator (so they can resubmit)', () => {
    expect(isHiddenFromViewer({ status: EventStatus.REMOVED, createdBy: CREATOR }, CREATOR)).toBe(
      false
    );
  });

  it('hides an archived event from a different user', () => {
    expect(isHiddenFromViewer({ status: EventStatus.ARCHIVED, createdBy: CREATOR }, OTHER)).toBe(
      true
    );
  });

  it('still shows an archived event to its creator', () => {
    expect(isHiddenFromViewer({ status: EventStatus.ARCHIVED, createdBy: CREATOR }, CREATOR)).toBe(
      false
    );
  });
});
