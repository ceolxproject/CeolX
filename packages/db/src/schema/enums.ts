import { pgEnum } from 'drizzle-orm/pg-core';

import {
  USER_ROLES,
  EVENT_STATUSES,
  BOOKING_STATUSES,
  BOOKING_DIRECTIONS,
  SUBSCRIPTION_STATUSES,
  BILLING_INTERVALS,
  TICKET_CURRENCIES,
  PLATFORMS,
  SOCIAL_PLATFORMS,
} from '@CeolX/shared';

export const userRoleEnum = pgEnum('user_role', USER_ROLES);
export const eventStatusEnum = pgEnum('event_status', EVENT_STATUSES);
export const ticketCurrencyEnum = pgEnum('ticket_currency', TICKET_CURRENCIES);
export const bookingStatusEnum = pgEnum('booking_status', BOOKING_STATUSES);
export const bookingDirectionEnum = pgEnum('booking_direction', BOOKING_DIRECTIONS);
export const subscriptionStatusEnum = pgEnum('subscription_status', SUBSCRIPTION_STATUSES);
// Billing interval, not a tier — the Lite/Pro tier model was dropped (M8-T0 D-07).
// A pg enum rather than a varchar so the database rejects an unknown interval
// outright instead of trusting every writer to validate first.
export const billingIntervalEnum = pgEnum('billing_interval', BILLING_INTERVALS);

// media_type, platform, and notification_type are db-internal — not needed in shared
export const mediaTypeEnum = pgEnum('media_type', ['image', 'video', 'audio', 'text']);
export const platformEnum = pgEnum('platform', PLATFORMS);
export const socialPlatformEnum = pgEnum('social_platform', SOCIAL_PLATFORMS);
export const notificationTypeEnum = pgEnum('notification_type', [
  'event_approved',
  'event_rejected',
  'booking_invitation',
  'booking_update',
  'artist_message',
  'venue_message',
]);
