import { pgEnum } from 'drizzle-orm/pg-core';

// User persona/role
export const userRoleEnum = pgEnum('user_role', ['spectator', 'artist', 'venue', 'super_admin']);

// Event lifecycle
export const eventStatusEnum = pgEnum('event_status', [
  'draft',
  'pending_review',
  'rejected',
  'active',
  'archived',
]);

// Booking between Artist and Venue
export const bookingStatusEnum = pgEnum('booking_status', [
  'pending',
  'accepted',
  'rejected',
  'cancelled',
]);

// Who initiated the booking
export const bookingDirectionEnum = pgEnum('booking_direction', [
  'venue_to_artist',
  'artist_to_venue',
]);

// Venue subscription via Stripe
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'inactive',
  'active',
  'past_due',
  'cancelled',
]);

// Media asset types
export const mediaTypeEnum = pgEnum('media_type', ['image', 'video', 'audio', 'text']);

// Push/in-app notification types
export const notificationTypeEnum = pgEnum('notification_type', [
  'event_approved',
  'event_rejected',
  'booking_invitation',
  'booking_update',
  'artist_message',
  'venue_message',
]);
