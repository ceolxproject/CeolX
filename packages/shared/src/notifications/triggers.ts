import type { NotificationPersona } from '../enums.js';

// ─────────────────────────────────────────────────────────────────────────────
// Notification trigger registry — single source of truth for every push,
// in-app, and email row's title/body/persona/route/type. Anchored to the
// M7-T0 Notifications Matrix row IDs (A-09, V-09, A-10, etc.).
//
// Source of truth: docs/project-management/M7-Notifications-Emails/
//   M7-T0-Notifications-Matrix.xlsx (sheets Artist, Venue, Universal).
//
// Architecture
// ============
// One enum of trigger IDs.
// One registry table that, for each trigger, holds:
//   - matrixRef        — A-09, V-10, etc. (PM traceability)
//   - type             — value persisted in notifications.type
//   - persona          — value persisted in notifications.persona
//   - routeTemplate    — deep link with {placeholder} vars
//   - push             — { title, body } for FCM push (or null if not sent)
//   - inApp            — { title, body } for the inbox row (or null)
//   - email            — { subject, body } for Postmark (or null until M7-T3)
//
// All copy strings use {curlyBrace} placeholders. Resolve via
// `buildNotification(trigger, surface, vars)` which interpolates and
// returns a typed `BuiltNotification`. Routers and the dispatcher call
// the helper — never the registry directly — so missing-key errors
// surface at one place.
// ─────────────────────────────────────────────────────────────────────────────

export const NotificationTrigger = {
  BOOKING_INVITE_TO_ARTIST: 'booking_invite_to_artist',
  BOOKING_REQUEST_TO_VENUE: 'booking_request_to_venue',
  BOOKING_ACCEPTED_TO_ARTIST: 'booking_accepted_to_artist',
  BOOKING_ACCEPTED_TO_VENUE: 'booking_accepted_to_venue',
  BOOKING_REJECTED_TO_ARTIST: 'booking_rejected_to_artist',
  BOOKING_REJECTED_TO_VENUE: 'booking_rejected_to_venue',
  BOOKING_WITHDRAWN_TO_VENUE: 'booking_withdrawn_to_venue',
  BOOKING_WITHDRAWN_TO_ARTIST: 'booking_withdrawn_to_artist',
  BOOKING_CANCELLED_TO_ARTIST: 'booking_cancelled_to_artist',
  BOOKING_CANCELLED_TO_VENUE: 'booking_cancelled_to_venue',
  ADDED_AS_COLLABORATOR_TO_ARTIST: 'added_as_collaborator_to_artist',
  EVENT_HOSTED_AT_VENUE_TO_VENUE: 'event_hosted_at_venue_to_venue',
} as const;

export type NotificationTrigger = (typeof NotificationTrigger)[keyof typeof NotificationTrigger];

export const NotificationSurface = {
  PUSH: 'push',
  IN_APP: 'inApp',
  EMAIL: 'email',
} as const;

export type NotificationSurface = (typeof NotificationSurface)[keyof typeof NotificationSurface];

export interface SurfaceCopy {
  /** For push and inApp this is the notification title; for email it is the subject. */
  title: string;
  body: string;
}

export interface TriggerDefinition {
  matrixRef: string;
  type: string;
  persona: NotificationPersona;
  routeTemplate: string;
  push: SurfaceCopy | null;
  inApp: SurfaceCopy | null;
  email: SurfaceCopy | null;
}

// Email copy is `null` here pending M7-T3 (Postmark transactional emails).
// When M7-T3 lands, the same trigger gains an email entry — call sites stay
// stable, only the registry changes.
export const NOTIFICATION_TRIGGERS: Record<NotificationTrigger, TriggerDefinition> = {
  [NotificationTrigger.BOOKING_INVITE_TO_ARTIST]: {
    matrixRef: 'A-09',
    type: 'booking_invitation',
    persona: 'artist',
    routeTemplate: '/bookings/{bookingId}',
    push: {
      title: 'New booking invite',
      body: '{venueName} invited you to play "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'New booking invite',
      body: '{venueName} invited you to play "{eventTitle}" on {date}. Respond before it expires.',
    },
    email: null,
  },
  [NotificationTrigger.BOOKING_REQUEST_TO_VENUE]: {
    matrixRef: 'V-09',
    type: 'booking_request',
    persona: 'venue',
    routeTemplate: '/bookings/{bookingId}',
    push: {
      title: 'New booking request',
      body: '{artistName} applied for "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'New booking request',
      body: '{artistName} applied for "{eventTitle}" on {date}. Review and respond.',
    },
    email: null,
  },
  [NotificationTrigger.BOOKING_ACCEPTED_TO_ARTIST]: {
    matrixRef: 'A-10',
    type: 'booking_accepted',
    persona: 'artist',
    routeTemplate: '/bookings/{bookingId}',
    push: {
      title: 'Booking Accepted ✓',
      body: '{venueName} accepted your application for "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'Booking Accepted ✓',
      body: 'You\'re confirmed for "{eventTitle}" at {venueName} on {date}.',
    },
    email: null,
  },
  [NotificationTrigger.BOOKING_ACCEPTED_TO_VENUE]: {
    matrixRef: 'V-10',
    type: 'booking_accepted',
    persona: 'venue',
    routeTemplate: '/bookings/{bookingId}',
    push: {
      title: 'Booking Accepted ✓',
      body: '{artistName} accepted your invite for "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'Booking Accepted ✓',
      body: '{artistName} is confirmed for "{eventTitle}" on {date}.',
    },
    email: null,
  },
  [NotificationTrigger.BOOKING_REJECTED_TO_ARTIST]: {
    matrixRef: 'A-11',
    type: 'booking_rejected',
    persona: 'artist',
    routeTemplate: '/bookings/{bookingId}',
    push: {
      title: 'Booking Not Accepted',
      body: '{venueName} has passed on your application for "{eventTitle}".',
    },
    inApp: {
      title: 'Booking Not Accepted',
      body: '{venueName} has passed on your application for "{eventTitle}" on {date}.',
    },
    email: null,
  },
  [NotificationTrigger.BOOKING_REJECTED_TO_VENUE]: {
    matrixRef: 'V-11',
    type: 'booking_rejected',
    persona: 'venue',
    routeTemplate: '/bookings/{bookingId}',
    push: {
      title: 'Invitation Declined',
      body: '{artistName} can\'t make "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'Invitation Declined',
      body: '{artistName} declined your invitation for "{eventTitle}" on {date}.',
    },
    email: null,
  },
  [NotificationTrigger.BOOKING_WITHDRAWN_TO_VENUE]: {
    matrixRef: 'V-13',
    type: 'booking_withdrawn',
    persona: 'venue',
    routeTemplate: '/bookings/{bookingId}',
    push: {
      title: 'Application Withdrawn',
      body: '{artistName} withdrew their application for "{eventTitle}".',
    },
    inApp: {
      title: 'Application Withdrawn',
      body: '{artistName} withdrew their application for "{eventTitle}" on {date}.',
    },
    email: null,
  },
  // No matrix row for the inverse — Venue withdrawing a pending invitation —
  // mirror V-13 phrasing. Flag for Pratiksha's matrix audit.
  [NotificationTrigger.BOOKING_WITHDRAWN_TO_ARTIST]: {
    matrixRef: 'V-13-mirror',
    type: 'booking_withdrawn',
    persona: 'artist',
    routeTemplate: '/bookings/{bookingId}',
    push: {
      title: 'Invitation Withdrawn',
      body: '{venueName} withdrew the invitation for "{eventTitle}".',
    },
    inApp: {
      title: 'Invitation Withdrawn',
      body: '{venueName} withdrew the invitation for "{eventTitle}" on {date}.',
    },
    email: null,
  },
  [NotificationTrigger.BOOKING_CANCELLED_TO_ARTIST]: {
    matrixRef: 'A-12',
    type: 'booking_cancelled',
    persona: 'artist',
    routeTemplate: '/bookings/{bookingId}',
    push: {
      title: 'Booking Cancelled',
      body: '{venueName} cancelled "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'Booking Cancelled',
      body: '{venueName} cancelled your confirmed booking for "{eventTitle}" on {date}.',
    },
    email: null,
  },
  [NotificationTrigger.BOOKING_CANCELLED_TO_VENUE]: {
    matrixRef: 'V-12',
    type: 'booking_cancelled',
    persona: 'venue',
    routeTemplate: '/bookings/{bookingId}',
    push: {
      title: 'Booking Cancelled',
      body: '{artistName} cancelled "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'Booking Cancelled',
      body: '{artistName} cancelled the confirmed booking for "{eventTitle}" on {date}.',
    },
    email: null,
  },
  // A-13 — Artist auto-added as a confirmed collaborator on a Venue event
  // (no accept/reject step). Routes to the event itself.
  [NotificationTrigger.ADDED_AS_COLLABORATOR_TO_ARTIST]: {
    matrixRef: 'A-13',
    type: 'collaborator_added',
    persona: 'artist',
    routeTemplate: '/events/{eventId}',
    push: {
      title: 'Added as collaborator',
      body: '{venueName} added you as a collaborator on "{eventTitle}".',
    },
    inApp: {
      title: 'Added as collaborator',
      body: 'You\'re listed as a collaborator on "{eventTitle}" at {venueName} on {date}.',
    },
    email: null,
  },
  // No matrix row — fires when an Artist creates an event at a registered
  // Venue's space (auto-confirms the venue side). Mirrors V-10 phrasing.
  // Flag for Pratiksha's matrix audit.
  [NotificationTrigger.EVENT_HOSTED_AT_VENUE_TO_VENUE]: {
    matrixRef: 'off-matrix-event-hosted',
    type: 'event_hosted_at_venue',
    persona: 'venue',
    routeTemplate: '/events/{eventId}',
    push: {
      title: 'New event at your venue',
      body: '{artistName} created "{eventTitle}" at your venue on {date}.',
    },
    inApp: {
      title: 'New event at your venue',
      body: '{artistName} scheduled "{eventTitle}" at your venue on {date}.',
    },
    email: null,
  },
};

// ─── Interpolation + builder ─────────────────────────────────────────────────

const PLACEHOLDER_RE = /\{(\w+)\}/g;

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(PLACEHOLDER_RE, (_, key: string) => {
    const value = vars[key];
    if (value === undefined) {
      throw new Error(`Missing variable "${key}" for notification template`);
    }
    return value;
  });
}

export interface BuiltNotification {
  type: string;
  title: string;
  body: string;
  route: string;
  persona: NotificationPersona;
}

/**
 * Resolves a trigger + surface + vars to a fully-interpolated notification.
 * Throws if the surface has no copy for this trigger (e.g. asking for email
 * before M7-T3 ships) or if any {placeholder} is missing from `vars`.
 */
export function buildNotification(
  trigger: NotificationTrigger,
  surface: NotificationSurface,
  vars: Record<string, string>
): BuiltNotification {
  const def = NOTIFICATION_TRIGGERS[trigger];
  const copy = def[surface];
  if (!copy) {
    throw new Error(
      `Notification trigger "${trigger}" has no copy for surface "${surface}" (matrix ${def.matrixRef})`
    );
  }
  return {
    type: def.type,
    persona: def.persona,
    title: interpolate(copy.title, vars),
    body: interpolate(copy.body, vars),
    route: interpolate(def.routeTemplate, vars),
  };
}
