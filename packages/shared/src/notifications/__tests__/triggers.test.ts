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
      title: 'New booking invite',
      body: 'The Temple Bar invited you to play "Friday Night Trad Session" on Fri 1 May.',
      route: '/bookings/b-123',
    });
  });

  it('V-09 booking request to venue', () => {
    const n = buildNotification(
      NotificationTrigger.BOOKING_REQUEST_TO_VENUE,
      NotificationSurface.PUSH,
      baseVars
    );
    expect(n.title).toBe('New booking request');
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
    ).toBe('Booking Not Accepted');
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

// ─── Email surface is null until M7-T3 ───────────────────────────────────────

describe('buildNotification — email surface', () => {
  it('throws a clear error pointing at the matrix ref until M7-T3 wires copy', () => {
    expect(() =>
      buildNotification(
        NotificationTrigger.BOOKING_INVITE_TO_ARTIST,
        NotificationSurface.EMAIL,
        baseVars
      )
    ).toThrow(/A-09/);
  });
});

// ─── Interpolation guards ────────────────────────────────────────────────────

describe('buildNotification — placeholder safety', () => {
  it('every booking trigger has a {bookingId}-bearing route', () => {
    for (const trigger of Object.values(NotificationTrigger)) {
      const def = NOTIFICATION_TRIGGERS[trigger];
      expect(def.routeTemplate).toContain('{bookingId}');
    }
  });

  it('throws with the missing key name when vars are incomplete', () => {
    expect(() =>
      buildNotification(NotificationTrigger.BOOKING_INVITE_TO_ARTIST, NotificationSurface.PUSH, {
        bookingId: 'b-1',
        // venueName, eventTitle, date all missing
      } as Record<string, string>)
    ).toThrow(/venueName/);
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
