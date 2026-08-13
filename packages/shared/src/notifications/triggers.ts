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
  BOOKING_INVITE_TO_COARTIST: 'booking_invite_to_coartist',
  BOOKING_COARTIST_ACCEPTED_TO_INVITER: 'booking_coartist_accepted_to_inviter',
  BOOKING_COARTIST_REJECTED_TO_INVITER: 'booking_coartist_rejected_to_inviter',
  BOOKING_COARTIST_WITHDRAWN_TO_INVITEE: 'booking_coartist_withdrawn_to_invitee',
  BOOKING_COARTIST_CANCELLED: 'booking_coartist_cancelled',
  ADDED_AS_COLLABORATOR_TO_ARTIST: 'added_as_collaborator_to_artist',
  EVENT_HOSTED_AT_VENUE_TO_VENUE: 'event_hosted_at_venue_to_venue',
  EVENT_REMOVED_BY_ADMIN_TO_ARTIST: 'event_removed_by_admin_to_artist',
  EVENT_REMOVED_BY_ADMIN_TO_VENUE: 'event_removed_by_admin_to_venue',
  EVENT_RESUBMITTED_TO_ARTIST: 'event_resubmitted_to_artist',
  EVENT_RESUBMITTED_TO_VENUE: 'event_resubmitted_to_venue',
  EVENT_RESTORED_BY_ADMIN_TO_ARTIST: 'event_restored_by_admin_to_artist',
  EVENT_RESTORED_BY_ADMIN_TO_VENUE: 'event_restored_by_admin_to_venue',
  // Creator deleted (soft-archived) their own event — tell the linked
  // counterparty (the other side of an invite/request booking).
  EVENT_DELETED_BY_CREATOR_TO_ARTIST: 'event_deleted_by_creator_to_artist',
  EVENT_DELETED_BY_CREATOR_TO_VENUE: 'event_deleted_by_creator_to_venue',
  SAVED_EVENT_REMOVED_TO_SAVERS: 'saved_event_removed_to_savers',
  // Share Interest — lightweight artist↔venue collaboration discovery, not
  // tied to any event. The route points to the SENDER's profile so the
  // recipient can tap through and view who's interested.
  COLLAB_INTEREST_TO_VENUE: 'collab_interest_to_venue',
  COLLAB_INTEREST_TO_ARTIST: 'collab_interest_to_artist',
  // Off-matrix — Onboarding. Sent once to every new account: in-app + email at
  // the first authenticated session, push on first device-token registration.
  // Flag for Pratiksha's matrix audit (ONB-01).
  USER_WELCOME: 'user_welcome',
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

/**
 * Stable persisted value written to `notifications.type` (varchar(100) in the
 * DB — kept un-enumerated there so milestones add types without a migration).
 * Closed here at the type level so a typo (`'welcom'`) is a compile error.
 * Many triggers map to the same `type` (e.g. all the cancel variants share
 * `'booking_cancelled'`); this is the deduplicated set in use.
 */
export type NotificationType =
  | 'booking_accepted'
  | 'booking_cancelled'
  | 'booking_invitation'
  | 'booking_rejected'
  | 'booking_request'
  | 'booking_withdrawn'
  | 'collaboration_interest'
  | 'collaborator_added'
  | 'event_deleted'
  | 'event_hosted_at_venue'
  | 'event_removed'
  | 'event_restored'
  | 'event_resubmitted'
  | 'saved_event_removed'
  | 'welcome';

export interface TriggerDefinition {
  matrixRef: string;
  type: NotificationType;
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
    routeTemplate: '/(app)/(tabs)/bookings/{bookingId}',
    push: {
      title: 'New performance invite',
      body: '{venueName} invited you to play "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'New performance invite',
      body: '{venueName} invited you to play "{eventTitle}" on {date}. Respond before it expires.',
    },
    email: {
      title: 'You\'ve been invited to play "{eventTitle}"',
      body: '{venueName} invited you to perform at "{eventTitle}" on {date}.',
    },
  },
  [NotificationTrigger.BOOKING_REQUEST_TO_VENUE]: {
    matrixRef: 'V-09',
    type: 'booking_request',
    persona: 'venue',
    routeTemplate: '/(app)/(tabs)/bookings/{bookingId}',
    push: {
      title: 'New performance request',
      body: '{artistName} applied for "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'New performance request',
      body: '{artistName} applied for "{eventTitle}" on {date}. Review and respond.',
    },
    email: {
      title: 'New performance request — "{eventTitle}"',
      body: '{artistName} applied to play "{eventTitle}" on {date}.',
    },
  },
  [NotificationTrigger.BOOKING_ACCEPTED_TO_ARTIST]: {
    matrixRef: 'A-10',
    type: 'booking_accepted',
    persona: 'artist',
    routeTemplate: '/(app)/(tabs)/bookings/{bookingId}',
    push: {
      title: 'Performance Confirmed ✓',
      body: '{venueName} accepted your application for "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'Performance Confirmed ✓',
      body: 'You\'re confirmed for "{eventTitle}" at {venueName} on {date}.',
    },
    email: {
      title: 'Performance confirmed — "{eventTitle}"',
      body: '{venueName} accepted your application for "{eventTitle}" on {date}.',
    },
  },
  [NotificationTrigger.BOOKING_ACCEPTED_TO_VENUE]: {
    matrixRef: 'V-10',
    type: 'booking_accepted',
    persona: 'venue',
    routeTemplate: '/(app)/(tabs)/bookings/{bookingId}',
    push: {
      title: 'Performance Confirmed ✓',
      body: '{artistName} accepted your invite for "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'Performance Confirmed ✓',
      body: '{artistName} is confirmed for "{eventTitle}" on {date}.',
    },
    email: {
      title: 'Artist confirmed — "{eventTitle}"',
      body: '{artistName} accepted your invitation to play "{eventTitle}" on {date}.',
    },
  },
  [NotificationTrigger.BOOKING_REJECTED_TO_ARTIST]: {
    matrixRef: 'A-11',
    type: 'booking_rejected',
    persona: 'artist',
    routeTemplate: '/(app)/(tabs)/bookings/{bookingId}',
    push: {
      title: 'Performance Request Declined',
      body: '{venueName} has passed on your application for "{eventTitle}".',
    },
    inApp: {
      title: 'Performance Request Declined',
      body: '{venueName} has passed on your application for "{eventTitle}" on {date}.',
    },
    email: {
      title: 'Update on your performance request',
      body: '{venueName} has decided not to move ahead with your application for "{eventTitle}" on {date}.',
    },
  },
  [NotificationTrigger.BOOKING_REJECTED_TO_VENUE]: {
    matrixRef: 'V-11',
    type: 'booking_rejected',
    persona: 'venue',
    routeTemplate: '/(app)/(tabs)/bookings/{bookingId}',
    push: {
      title: 'Invitation Declined',
      body: '{artistName} can\'t make "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'Invitation Declined',
      body: '{artistName} declined your invitation for "{eventTitle}" on {date}.',
    },
    email: {
      title: 'Update on your performance invite',
      body: '{artistName} won\'t be able to play "{eventTitle}" on {date}.',
    },
  },
  [NotificationTrigger.BOOKING_WITHDRAWN_TO_VENUE]: {
    matrixRef: 'V-13',
    type: 'booking_withdrawn',
    persona: 'venue',
    routeTemplate: '/(app)/(tabs)/bookings/{bookingId}',
    push: {
      title: 'Application Withdrawn',
      body: '{artistName} withdrew their application for "{eventTitle}".',
    },
    inApp: {
      title: 'Application Withdrawn',
      body: '{artistName} withdrew their application for "{eventTitle}" on {date}.',
    },
    email: {
      title: 'Application withdrawn — "{eventTitle}"',
      body: '{artistName} withdrew their application for "{eventTitle}" on {date}. The slot is open again.',
    },
  },
  // No matrix row for the inverse — Venue withdrawing a pending invitation —
  // mirror V-13 phrasing. Flag for Pratiksha's matrix audit.
  [NotificationTrigger.BOOKING_WITHDRAWN_TO_ARTIST]: {
    matrixRef: 'V-13-mirror',
    type: 'booking_withdrawn',
    persona: 'artist',
    routeTemplate: '/(app)/(tabs)/bookings/{bookingId}',
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
    routeTemplate: '/(app)/(tabs)/bookings/{bookingId}',
    push: {
      title: 'Performance Cancelled',
      body: '{venueName} cancelled "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'Performance Cancelled',
      body: '{venueName} cancelled your confirmed performance for "{eventTitle}" on {date}.',
    },
    email: {
      title: '"{eventTitle}" — performance cancelled',
      body: '{venueName} cancelled the confirmed performance for "{eventTitle}" on {date}.',
    },
  },
  [NotificationTrigger.BOOKING_CANCELLED_TO_VENUE]: {
    matrixRef: 'V-12',
    type: 'booking_cancelled',
    persona: 'venue',
    routeTemplate: '/(app)/(tabs)/bookings/{bookingId}',
    push: {
      title: 'Performance Cancelled',
      body: '{artistName} cancelled "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'Performance Cancelled',
      body: '{artistName} cancelled the confirmed performance for "{eventTitle}" on {date}.',
    },
    email: {
      title: '"{eventTitle}" — performance cancelled',
      body: '{artistName} cancelled the confirmed performance for "{eventTitle}" on {date}.',
    },
  },
  // Artist↔artist booking triggers (A-09a…A-13a). The single {coArtistName}
  // placeholder is always "the OTHER co-artist, from the recipient's
  // perspective": the inviter's name when notifying the invitee
  // (BOOKING_INVITE_TO_COARTIST), and the invitee's name when notifying the
  // inviter (accepted/rejected/cancelled). The bookings.update dispatcher sets
  // it accordingly, so callers never decide which name to pass.
  [NotificationTrigger.BOOKING_INVITE_TO_COARTIST]: {
    matrixRef: 'A-09a',
    type: 'booking_invitation',
    persona: 'artist',
    routeTemplate: '/(app)/(tabs)/bookings/{bookingId}',
    push: {
      title: 'New Collab Invite',
      body: '{coArtistName} invited you to play "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'New Collab Invite',
      body: '{coArtistName} invited you to play "{eventTitle}" on {date}. Respond before it expires.',
    },
    email: null,
  },
  [NotificationTrigger.BOOKING_COARTIST_ACCEPTED_TO_INVITER]: {
    matrixRef: 'A-10a',
    type: 'booking_accepted',
    persona: 'artist',
    routeTemplate: '/(app)/(tabs)/bookings/{bookingId}',
    push: {
      title: 'Collab Accepted ✓',
      body: '{coArtistName} accepted your invite for "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'Collab Accepted ✓',
      body: '{coArtistName} is confirmed for "{eventTitle}" on {date}.',
    },
    email: null,
  },
  [NotificationTrigger.BOOKING_COARTIST_REJECTED_TO_INVITER]: {
    matrixRef: 'A-11a',
    type: 'booking_rejected',
    persona: 'artist',
    routeTemplate: '/(app)/(tabs)/bookings/{bookingId}',
    push: {
      title: 'Collab Declined',
      body: '{coArtistName} declined your invite for "{eventTitle}".',
    },
    inApp: {
      title: 'Collab Declined',
      body: '{coArtistName} declined your invite for "{eventTitle}" on {date}.',
    },
    email: null,
  },
  [NotificationTrigger.BOOKING_COARTIST_WITHDRAWN_TO_INVITEE]: {
    matrixRef: 'A-13a',
    type: 'booking_withdrawn',
    persona: 'artist',
    routeTemplate: '/(app)/(tabs)/bookings/{bookingId}',
    push: {
      title: 'Invite Withdrawn',
      body: '{coArtistName} withdrew the invite for "{eventTitle}".',
    },
    inApp: {
      title: 'Invite Withdrawn',
      body: '{coArtistName} withdrew the invite for "{eventTitle}" on {date}.',
    },
    email: null,
  },
  [NotificationTrigger.BOOKING_COARTIST_CANCELLED]: {
    matrixRef: 'A-12a',
    type: 'booking_cancelled',
    persona: 'artist',
    routeTemplate: '/(app)/(tabs)/bookings/{bookingId}',
    push: {
      title: 'Collab Cancelled',
      body: '{coArtistName} cancelled the collab for "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'Collab Cancelled',
      body: '{coArtistName} cancelled the collab for "{eventTitle}" on {date}.',
    },
    email: null,
  },
  // A-13 — Artist auto-added as a confirmed collaborator on a Venue event
  // (no accept/reject step). Routes to the event itself.
  [NotificationTrigger.ADDED_AS_COLLABORATOR_TO_ARTIST]: {
    matrixRef: 'A-13',
    type: 'collaborator_added',
    persona: 'artist',
    routeTemplate: '/(app)/(tabs)/discover/event/{eventId}',
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
    routeTemplate: '/(app)/(tabs)/discover/event/{eventId}',
    push: {
      title: 'New event at your venue/festival',
      body: '{artistName} created "{eventTitle}" at your venue/festival on {date}.',
    },
    inApp: {
      title: 'New event at your venue/festival',
      body: '{artistName} scheduled "{eventTitle}" at your venue/festival on {date}.',
    },
    email: null,
  },
  // A-15 — Admin removed an Artist creator's event with a reason.
  // No caller today — admin moderation is M9-T2 (admin.ts is a stub).
  [NotificationTrigger.EVENT_REMOVED_BY_ADMIN_TO_ARTIST]: {
    matrixRef: 'A-15',
    type: 'event_removed',
    persona: 'artist',
    routeTemplate: '/(app)/(tabs)/discover/event/{eventId}',
    push: {
      title: 'Your event needs revision',
      body: 'Moderation removed "{eventTitle}". Reason: {reason}.',
    },
    inApp: {
      title: 'Your event needs revision',
      body: 'We\'ve removed "{eventTitle}" pending edits. Reason: {reason}. Update and resubmit.',
    },
    email: null,
  },
  // V-14 — Admin removed a Venue creator's event with a reason.
  // No caller today — admin moderation is M9-T2 (admin.ts is a stub).
  [NotificationTrigger.EVENT_REMOVED_BY_ADMIN_TO_VENUE]: {
    matrixRef: 'V-14',
    type: 'event_removed',
    persona: 'venue',
    routeTemplate: '/(app)/(tabs)/discover/event/{eventId}',
    push: {
      title: 'Your event needs revision',
      body: 'Moderation removed "{eventTitle}". Reason: {reason}.',
    },
    inApp: {
      title: 'Your event needs revision',
      body: 'We\'ve removed "{eventTitle}" pending edits. Reason: {reason}.',
    },
    email: null,
  },
  // A-16 — Confirmation back to the Artist that their resubmitted event is live.
  [NotificationTrigger.EVENT_RESUBMITTED_TO_ARTIST]: {
    matrixRef: 'A-16',
    type: 'event_resubmitted',
    persona: 'artist',
    routeTemplate: '/(app)/(tabs)/discover/event/{eventId}',
    push: {
      title: 'Event Resubmitted ✓',
      body: '"{eventTitle}" is back live after your edits.',
    },
    inApp: {
      title: 'Event Resubmitted ✓',
      body: 'Your updated event "{eventTitle}" is back live on CeolX.',
    },
    email: null,
  },
  // V-15 — Same confirmation for Venue creators.
  [NotificationTrigger.EVENT_RESUBMITTED_TO_VENUE]: {
    matrixRef: 'V-15',
    type: 'event_resubmitted',
    persona: 'venue',
    routeTemplate: '/(app)/(tabs)/discover/event/{eventId}',
    push: {
      title: 'Event Resubmitted ✓',
      body: '"{eventTitle}" is back live after your edits.',
    },
    inApp: {
      title: 'Event Resubmitted ✓',
      body: 'Your updated event "{eventTitle}" is back live on CeolX.',
    },
    email: null,
  },
  // Off-matrix — Admin restored a removed event; tell the Artist creator their
  // event is live again. Routes to the detail page (status is back to active,
  // so the page resolves). Flag for Pratiksha's matrix audit (Asana 1216066930532455).
  [NotificationTrigger.EVENT_RESTORED_BY_ADMIN_TO_ARTIST]: {
    matrixRef: 'off-matrix-event-restored',
    type: 'event_restored',
    persona: 'artist',
    routeTemplate: '/(app)/(tabs)/discover/event/{eventId}',
    push: {
      title: 'Your event is live again',
      body: 'Moderation restored "{eventTitle}" — it\'s back on CeolX.',
    },
    inApp: {
      title: 'Your event is live again',
      body: '"{eventTitle}" has been restored and is visible on CeolX again.',
    },
    email: null,
  },
  // Off-matrix — Same restore confirmation for Venue creators.
  [NotificationTrigger.EVENT_RESTORED_BY_ADMIN_TO_VENUE]: {
    matrixRef: 'off-matrix-event-restored',
    type: 'event_restored',
    persona: 'venue',
    routeTemplate: '/(app)/(tabs)/discover/event/{eventId}',
    push: {
      title: 'Your event is live again',
      body: 'Moderation restored "{eventTitle}" — it\'s back on CeolX.',
    },
    inApp: {
      title: 'Your event is live again',
      body: '"{eventTitle}" has been restored and is visible on CeolX again.',
    },
    email: null,
  },
  // A-17 — Creator deleted their event; tell the linked Artist (confirmed or
  // invited via a pending/accepted booking). Routes to the feed because the
  // event is archived and its detail page 404s for non-creators.
  // NOTE: provisional matrix row — confirm A-17/V-16 IDs with Pratiksha
  // (Asana 1215489535915818).
  [NotificationTrigger.EVENT_DELETED_BY_CREATOR_TO_ARTIST]: {
    matrixRef: 'A-17',
    type: 'event_deleted',
    persona: 'artist',
    routeTemplate: '/(app)/(tabs)/discover',
    push: {
      title: 'Event cancelled',
      body: 'The organiser deleted "{eventTitle}" — it\'s no longer on CeolX.',
    },
    inApp: {
      title: 'Event cancelled',
      body: '"{eventTitle}" was deleted by the organiser, so your involvement has ended.',
    },
    email: null,
  },
  // V-16 — Same, told to the linked Venue (e.g. an Artist deleted an event
  // hosted at their venue).
  [NotificationTrigger.EVENT_DELETED_BY_CREATOR_TO_VENUE]: {
    matrixRef: 'V-16',
    type: 'event_deleted',
    persona: 'venue',
    routeTemplate: '/(app)/(tabs)/discover',
    push: {
      title: 'Event cancelled',
      body: 'The organiser deleted "{eventTitle}" — it\'s no longer on CeolX.',
    },
    inApp: {
      title: 'Event cancelled',
      body: '"{eventTitle}" hosted at your venue/festival was deleted by the organiser.',
    },
    email: null,
  },
  // U-03 — Universal: every user who saved an event is told when an admin
  // removes it. Fans out per-saver from the admin.removeEvent mutation.
  // Routes to the discover feed because the original event link is a dead end
  // once removed.
  [NotificationTrigger.SAVED_EVENT_REMOVED_TO_SAVERS]: {
    matrixRef: 'U-03',
    type: 'saved_event_removed',
    persona: 'spectator',
    routeTemplate: '/(app)/(tabs)/discover',
    push: {
      title: 'A saved event was removed',
      body: '"{eventTitle}" was removed by moderation and is no longer on CeolX.',
    },
    inApp: {
      title: 'A saved event was removed',
      body: '"{eventTitle}" was removed by moderation. Browse the feed for similar events.',
    },
    email: null,
  },
  // Off-matrix — Share Interest. An artist signalled interest in a venue.
  // Routes to the artist's profile ({artistUserId}). Flag for Pratiksha's
  // matrix audit (note: off-matrix-collaboration-interest).
  [NotificationTrigger.COLLAB_INTEREST_TO_VENUE]: {
    matrixRef: 'off-matrix-collaboration-interest',
    type: 'collaboration_interest',
    persona: 'venue',
    routeTemplate: '/(app)/artist/{artistUserId}',
    push: {
      title: 'New collaboration interest',
      body: '{artistName} is interested in collaborating with you. View their profile and plan your next event.',
    },
    inApp: {
      title: 'New collaboration interest',
      body: '{artistName} is interested in collaborating with you. View their profile and plan your next event.',
    },
    email: null,
  },
  // Off-matrix — Share Interest. A venue signalled interest in an artist.
  // Routes to the venue's profile ({venueUserId}).
  [NotificationTrigger.COLLAB_INTEREST_TO_ARTIST]: {
    matrixRef: 'off-matrix-collaboration-interest',
    type: 'collaboration_interest',
    persona: 'artist',
    routeTemplate: '/(app)/venue/{venueUserId}',
    push: {
      title: 'New collaboration interest',
      body: '{venueName} is interested in collaborating with you. View their profile and explore a possible performance.',
    },
    inApp: {
      title: 'New collaboration interest',
      body: '{venueName} is interested in collaborating with you. View their profile and explore a possible performance.',
    },
    email: null,
  },
  // Off-matrix — Onboarding welcome. Fired once per new account: in-app + email
  // at the first authenticated session (packages/auth login-hook), push at the
  // first device-token registration (device-tokens router). `email: null` — a
  // dedicated rich `welcome` Postmark template is sent directly at the source,
  // not the generic notification email this dispatcher would otherwise build.
  [NotificationTrigger.USER_WELCOME]: {
    matrixRef: 'ONB-01',
    type: 'welcome',
    persona: 'spectator',
    routeTemplate: '/(app)/(tabs)/discover',
    push: {
      title: 'Welcome to CeolX 🎶',
      body: "You're in! Explore live music, artists, and venues happening near you.",
    },
    inApp: {
      title: 'Welcome to CeolX 🎶',
      body: "You're in! Explore live music, artists, and venues happening near you.",
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
