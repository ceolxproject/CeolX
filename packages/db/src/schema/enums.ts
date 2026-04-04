import { pgEnum } from 'drizzle-orm/pg-core';

import {
  USER_ROLES,
  EVENT_STATUSES,
  BOOKING_STATUSES,
  BOOKING_DIRECTIONS,
  SUBSCRIPTION_STATUSES,
  PLATFORMS,
} from '@CeolX/shared';

export const userRoleEnum = pgEnum('user_role', USER_ROLES);
export const eventStatusEnum = pgEnum('event_status', EVENT_STATUSES);
export const bookingStatusEnum = pgEnum('booking_status', BOOKING_STATUSES);
export const bookingDirectionEnum = pgEnum('booking_direction', BOOKING_DIRECTIONS);
export const subscriptionStatusEnum = pgEnum('subscription_status', SUBSCRIPTION_STATUSES);

// media_type, platform, and notification_type are db-internal — not needed in shared
export const mediaTypeEnum = pgEnum('media_type', ['image', 'video', 'audio', 'text']);
export const platformEnum = pgEnum('platform', PLATFORMS);
export const notificationTypeEnum = pgEnum('notification_type', [
  'event_approved',
  'event_rejected',
  'booking_invitation',
  'booking_update',
  'artist_message',
  'venue_message',
]);
