import { describe, expect, it } from 'vitest';

import {
  buildNotification,
  formatNotificationDate,
  NOTIFICATION_TRIGGERS,
  NotificationSurface,
  NotificationTrigger,
} from '../index.js';

const baseVars = {
  bookingId: 'b-123',
  artistName: 'Celtic Thunder',
  venueName: 'The Temple Bar',
  eventTitle: 'Friday Night Trad Session',
  date: 'Fri 1 May',
};

// ─── Push copy locks (anchored to M7-T0 matrix XLSX) ─────────────────────────

describe('buildNotification — push surface (matrix copy)', () => {
  it('A-09 booking invite to artist', () => {
    expect(
      buildNotification(
        NotificationTrigger.BOOKING_INVITE_TO_ARTIST,
        NotificationSurface.PUSH,
        baseVars
      )
    ).toEqual({
      type: 'booking_invitation',
      persona: 'artist',
      title: 'New performance invite',
      body: 'The Temple Bar invited you to play "Friday Night Trad Session" on Fri 1 May.',
      route: '/(app)/(tabs)/bookings/b-123',
    });
  });

  it('V-09 booking request to venue', () => {
    const n = buildNotification(
      NotificationTrigger.BOOKING_REQUEST_TO_VENUE,
      NotificationSurface.PUSH,
      baseVars
    );
    expect(n.title).toBe('New performance request');
    expect(n.body).toBe('Celtic Thunder applied for "Friday Night Trad Session" on Fri 1 May.');
    expect(n.persona).toBe('venue');
  });

  it('A-10 / V-10 booking accepted', () => {
    expect(
      buildNotification(
        NotificationTrigger.BOOKING_ACCEPTED_TO_ARTIST,
        NotificationSurface.PUSH,
        baseVars
      ).body
    ).toBe(
      'The Temple Bar accepted your application for "Friday Night Trad Session" on Fri 1 May.'
    );
    expect(
      buildNotification(
        NotificationTrigger.BOOKING_ACCEPTED_TO_VENUE,
        NotificationSurface.PUSH,
        baseVars
      ).body
    ).toBe('Celtic Thunder accepted your invite for "Friday Night Trad Session" on Fri 1 May.');
  });

  it('A-11 / V-11 booking rejected (different titles per recipient)', () => {
    expect(
      buildNotification(
        NotificationTrigger.BOOKING_REJECTED_TO_ARTIST,
        NotificationSurface.PUSH,
        baseVars
      ).title
    ).toBe('Performance Request Declined');
    expect(
      buildNotification(
        NotificationTrigger.BOOKING_REJECTED_TO_VENUE,
        NotificationSurface.PUSH,
        baseVars
      ).title
    ).toBe('Invitation Declined');
  });

  it('V-13 application withdrawn (push body uses no date)', () => {
    expect(
      buildNotification(
        NotificationTrigger.BOOKING_WITHDRAWN_TO_VENUE,
        NotificationSurface.PUSH,
        baseVars
      ).body
    ).toBe('Celtic Thunder withdrew their application for "Friday Night Trad Session".');
  });

  it('A-12 / V-12 booking cancelled', () => {
    expect(
      buildNotification(
        NotificationTrigger.BOOKING_CANCELLED_TO_ARTIST,
        NotificationSurface.PUSH,
        baseVars
      ).body
    ).toBe('The Temple Bar cancelled "Friday Night Trad Session" on Fri 1 May.');
    expect(
      buildNotification(
        NotificationTrigger.BOOKING_CANCELLED_TO_VENUE,
        NotificationSurface.PUSH,
        baseVars
      ).body
    ).toBe('Celtic Thunder cancelled "Friday Night Trad Session" on Fri 1 May.');
  });
});

// ─── In-app copy is its own variant per matrix ───────────────────────────────

describe('buildNotification — inApp surface diverges from push', () => {
  it('A-15 push body includes the removal reason', () => {
    expect(
      buildNotification(
        NotificationTrigger.EVENT_REMOVED_BY_ADMIN_TO_ARTIST,
        NotificationSurface.PUSH,
        { eventId: 'e-1', eventTitle: 'Friday Night Trad', reason: 'duplicate listing' }
      ).body
    ).toBe('Moderation removed "Friday Night Trad". Reason: duplicate listing.');
  });

  it('A-16 / V-15 resubmit confirmation uses the trailing ✓ glyph', () => {
    expect(
      buildNotification(NotificationTrigger.EVENT_RESUBMITTED_TO_ARTIST, NotificationSurface.PUSH, {
        eventId: 'e-1',
        eventTitle: 'Friday Night Trad',
      }).title
    ).toBe('Event Resubmitted ✓');
    expect(
      buildNotification(NotificationTrigger.EVENT_RESUBMITTED_TO_VENUE, NotificationSurface.PUSH, {
        eventId: 'e-1',
        eventTitle: 'Friday Night Trad',
      }).title
    ).toBe('Event Resubmitted ✓');
  });

  it('admin restore — both personas, event-detail route, "live again" copy', () => {
    const toArtist = buildNotification(
      NotificationTrigger.EVENT_RESTORED_BY_ADMIN_TO_ARTIST,
      NotificationSurface.PUSH,
      { eventId: 'e-1', eventTitle: 'Friday Night Trad' }
    );
    expect(toArtist.type).toBe('event_restored');
    expect(toArtist.persona).toBe('artist');
    expect(toArtist.route).toBe('/(app)/(tabs)/discover/event/e-1');
    expect(toArtist.title).toBe('Your event is live again');
    expect(toArtist.body).toBe('Moderation restored "Friday Night Trad" — it\'s back on CeolX.');

    expect(
      buildNotification(
        NotificationTrigger.EVENT_RESTORED_BY_ADMIN_TO_VENUE,
        NotificationSurface.PUSH,
        {
          eventId: 'e-1',
          eventTitle: 'Friday Night Trad',
        }
      ).persona
    ).toBe('venue');
  });

  it('U-03 saver cascade — push tells the saver the event is gone, route /feed', () => {
    const built = buildNotification(
      NotificationTrigger.SAVED_EVENT_REMOVED_TO_SAVERS,
      NotificationSurface.PUSH,
      { eventId: 'e-1', eventTitle: 'Friday Night Trad' }
    );
    expect(built.persona).toBe('spectator');
    expect(built.route).toBe('/(app)/(tabs)/discover');
    expect(built.title).toBe('A saved event was removed');
    expect(built.body).toBe(
      '"Friday Night Trad" was removed by moderation and is no longer on CeolX.'
    );
  });

  it('A-17 / V-16 creator-delete — both personas, route to the feed, only needs {eventTitle}', () => {
    const toArtist = buildNotification(
      NotificationTrigger.EVENT_DELETED_BY_CREATOR_TO_ARTIST,
      NotificationSurface.PUSH,
      { eventTitle: 'Friday Night Trad' }
    );
    expect(toArtist.persona).toBe('artist');
    expect(toArtist.type).toBe('event_deleted');
    expect(toArtist.route).toBe('/(app)/(tabs)/discover');
    expect(toArtist.body).toBe(
      'The organiser deleted "Friday Night Trad" — it\'s no longer on CeolX.'
    );

    const toVenue = buildNotification(
      NotificationTrigger.EVENT_DELETED_BY_CREATOR_TO_VENUE,
      NotificationSurface.IN_APP,
      { eventTitle: 'Friday Night Trad' }
    );
    expect(toVenue.persona).toBe('venue');
    expect(toVenue.body).toBe(
      '"Friday Night Trad" hosted at your venue was deleted by the organiser.'
    );
  });

  it('A-09 inApp adds "Respond before it expires"', () => {
    expect(
      buildNotification(
        NotificationTrigger.BOOKING_INVITE_TO_ARTIST,
        NotificationSurface.IN_APP,
        baseVars
      ).body
    ).toBe(
      'The Temple Bar invited you to play "Friday Night Trad Session" on Fri 1 May. Respond before it expires.'
    );
  });

  it('V-09 inApp adds "Review and respond"', () => {
    expect(
      buildNotification(
        NotificationTrigger.BOOKING_REQUEST_TO_VENUE,
        NotificationSurface.IN_APP,
        baseVars
      ).body
    ).toBe(
      'Celtic Thunder applied for "Friday Night Trad Session" on Fri 1 May. Review and respond.'
    );
  });
});

// ─── Email surface — booking lifecycle wired in M7-T4 PR1 ────────────────────

describe('buildNotification — email surface', () => {
  it('A-09 invite-to-artist email carries subject + body (matrix copy)', () => {
    const n = buildNotification(
      NotificationTrigger.BOOKING_INVITE_TO_ARTIST,
      NotificationSurface.EMAIL,
      baseVars
    );
    expect(n.title).toBe('You\'ve been invited to play "Friday Night Trad Session"');
    expect(n.body).toBe(
      'The Temple Bar invited you to perform at "Friday Night Trad Session" on Fri 1 May.'
    );
    expect(n.route).toBe('/(app)/(tabs)/bookings/b-123');
    expect(n.persona).toBe('artist');
  });

  it('V-09 booking-request-to-venue email is populated', () => {
    const n = buildNotification(
      NotificationTrigger.BOOKING_REQUEST_TO_VENUE,
      NotificationSurface.EMAIL,
      baseVars
    );
    expect(n.title).toBe('New performance request — "Friday Night Trad Session"');
    expect(n.body).toContain('Celtic Thunder applied to play');
  });

  it('still throws for triggers with no email copy (e.g. co-artist invite)', () => {
    expect(() =>
      buildNotification(NotificationTrigger.BOOKING_INVITE_TO_COARTIST, NotificationSurface.EMAIL, {
        bookingId: 'b1',
        coArtistName: 'Tune Bomb',
        eventTitle: 'Trad Night',
        date: 'Fri 6 Jun',
      })
    ).toThrow(/A-09a/);
  });
});

// ─── Interpolation guards ────────────────────────────────────────────────────

describe('buildNotification — placeholder safety', () => {
  const BOOKING_FLOW_TRIGGERS = [
    NotificationTrigger.BOOKING_INVITE_TO_ARTIST,
    NotificationTrigger.BOOKING_REQUEST_TO_VENUE,
    NotificationTrigger.BOOKING_ACCEPTED_TO_ARTIST,
    NotificationTrigger.BOOKING_ACCEPTED_TO_VENUE,
    NotificationTrigger.BOOKING_REJECTED_TO_ARTIST,
    NotificationTrigger.BOOKING_REJECTED_TO_VENUE,
    NotificationTrigger.BOOKING_WITHDRAWN_TO_VENUE,
    NotificationTrigger.BOOKING_WITHDRAWN_TO_ARTIST,
    NotificationTrigger.BOOKING_CANCELLED_TO_ARTIST,
    NotificationTrigger.BOOKING_CANCELLED_TO_VENUE,
    NotificationTrigger.BOOKING_INVITE_TO_COARTIST,
    NotificationTrigger.BOOKING_COARTIST_ACCEPTED_TO_INVITER,
    NotificationTrigger.BOOKING_COARTIST_REJECTED_TO_INVITER,
    NotificationTrigger.BOOKING_COARTIST_WITHDRAWN_TO_INVITEE,
    NotificationTrigger.BOOKING_COARTIST_CANCELLED,
  ];

  it('every booking-flow trigger has a {bookingId}-bearing route', () => {
    for (const trigger of BOOKING_FLOW_TRIGGERS) {
      const def = NOTIFICATION_TRIGGERS[trigger];
      expect(def.routeTemplate).toContain('{bookingId}');
    }
  });

  it('event-scoped triggers (collaborator add, hosted-at-venue, moderation) route to the discover event screen', () => {
    expect(
      NOTIFICATION_TRIGGERS[NotificationTrigger.ADDED_AS_COLLABORATOR_TO_ARTIST].routeTemplate
    ).toBe('/(app)/(tabs)/discover/event/{eventId}');
    expect(
      NOTIFICATION_TRIGGERS[NotificationTrigger.EVENT_HOSTED_AT_VENUE_TO_VENUE].routeTemplate
    ).toBe('/(app)/(tabs)/discover/event/{eventId}');
    expect(
      NOTIFICATION_TRIGGERS[NotificationTrigger.EVENT_REMOVED_BY_ADMIN_TO_ARTIST].routeTemplate
    ).toBe('/(app)/(tabs)/discover/event/{eventId}');
    expect(
      NOTIFICATION_TRIGGERS[NotificationTrigger.EVENT_RESUBMITTED_TO_VENUE].routeTemplate
    ).toBe('/(app)/(tabs)/discover/event/{eventId}');
  });

  it('throws with the missing key name when vars are incomplete', () => {
    expect(() =>
      buildNotification(NotificationTrigger.BOOKING_INVITE_TO_ARTIST, NotificationSurface.PUSH, {
        bookingId: 'b-1',
        // venueName, eventTitle, date all missing
      })
    ).toThrow(/venueName/);
  });
});

// ─── Artist↔artist booking triggers ─────────────────────────────────────────

describe('artist↔artist booking triggers', () => {
  const vars = {
    bookingId: 'b1',
    coArtistName: 'Tune Bomb',
    eventTitle: 'Trad Night',
    date: 'Fri 6 Jun',
  };

  it('builds the co-artist invite push with the inviter name', () => {
    const n = buildNotification(
      NotificationTrigger.BOOKING_INVITE_TO_COARTIST,
      NotificationSurface.PUSH,
      vars
    );
    expect(n.body).toContain('Tune Bomb');
    expect(n.route).toBe('/(app)/(tabs)/bookings/b1');
    expect(n.persona).toBe('artist');
  });

  it('builds accepted / rejected / withdrawn / cancelled to-artist copy', () => {
    for (const trigger of [
      NotificationTrigger.BOOKING_COARTIST_ACCEPTED_TO_INVITER,
      NotificationTrigger.BOOKING_COARTIST_REJECTED_TO_INVITER,
      NotificationTrigger.BOOKING_COARTIST_WITHDRAWN_TO_INVITEE,
      NotificationTrigger.BOOKING_COARTIST_CANCELLED,
    ]) {
      const n = buildNotification(trigger, NotificationSurface.IN_APP, vars);
      expect(n.body).toContain('Tune Bomb');
      expect(n.persona).toBe('artist');
    }
  });
});

// ─── Collaboration interest (Share Interest, off-matrix) ─────────────────────

describe('buildNotification — collaboration interest', () => {
  it('artist → venue carries the artist name and routes to the artist profile', () => {
    const n = buildNotification(
      NotificationTrigger.COLLAB_INTEREST_TO_VENUE,
      NotificationSurface.PUSH,
      { artistName: 'Celtic Thunder', artistUserId: 'artist-user-1' }
    );
    expect(n).toEqual({
      type: 'collaboration_interest',
      persona: 'venue',
      title: 'New collaboration interest',
      body: 'Celtic Thunder is interested in collaborating with you. View their profile and plan your next event.',
      route: '/(app)/artist/artist-user-1',
    });
  });

  it('venue → artist carries the venue name and routes to the venue profile', () => {
    const n = buildNotification(
      NotificationTrigger.COLLAB_INTEREST_TO_ARTIST,
      NotificationSurface.IN_APP,
      { venueName: 'The Temple Bar', venueUserId: 'venue-user-1' }
    );
    expect(n.type).toBe('collaboration_interest');
    expect(n.persona).toBe('artist');
    expect(n.body).toBe(
      'The Temple Bar is interested in collaborating with you. View their profile and explore a possible performance.'
    );
    expect(n.route).toBe('/(app)/venue/venue-user-1');
  });

  it('throws when a required name var is missing', () => {
    expect(() =>
      buildNotification(NotificationTrigger.COLLAB_INTEREST_TO_VENUE, NotificationSurface.PUSH, {
        artistUserId: 'artist-user-1',
      })
    ).toThrow(/artistName/);
  });
});

// ─── Onboarding welcome (ONB-01, off-matrix) ─────────────────────────────────

describe('buildNotification — USER_WELCOME', () => {
  it('push + inApp share the same copy, route to Discover, persona spectator, no vars needed', () => {
    for (const surface of [NotificationSurface.PUSH, NotificationSurface.IN_APP]) {
      const n = buildNotification(NotificationTrigger.USER_WELCOME, surface, {});
      expect(n).toEqual({
        type: 'welcome',
        persona: 'spectator',
        title: 'Welcome to CeolX 🎶',
        body: "You're in! Explore live music, artists, and venues happening near you.",
        route: '/(app)/(tabs)/discover',
      });
    }
  });

  it('has no email copy — a dedicated welcome template is sent directly instead', () => {
    expect(NOTIFICATION_TRIGGERS[NotificationTrigger.USER_WELCOME].email).toBeNull();
    expect(() =>
      buildNotification(NotificationTrigger.USER_WELCOME, NotificationSurface.EMAIL, {})
    ).toThrow(/ONB-01/);
  });
});

// ─── Date formatter ──────────────────────────────────────────────────────────

describe('formatNotificationDate', () => {
  it('renders Europe/Dublin local date as "EEE d MMM" (timezone-stable)', () => {
    expect(formatNotificationDate(new Date('2026-05-01T20:00:00Z'))).toBe('Fri 1 May');
  });

  it('rolls into next day when UTC late-evening crosses Dublin midnight', () => {
    expect(formatNotificationDate(new Date('2026-05-01T23:30:00Z'))).toBe('Sat 2 May');
  });
});
