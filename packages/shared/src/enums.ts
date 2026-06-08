// User persona/role — imported by packages/db to build pgEnum("user_role")
export const USER_ROLES = ['spectator', 'artist', 'venue', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const UserRole = {
  SPECTATOR: 'spectator',
  ARTIST: 'artist',
  VENUE: 'venue',
  ADMIN: 'admin',
} as const satisfies Record<string, UserRole>;

// Event lifecycle states — imported by packages/db to build pgEnum("event_status")
export const EVENT_STATUSES = [
  'draft',
  'pending_review',
  'rejected',
  'active',
  'archived',
  'removed',
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];
export const EventStatus = {
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  REJECTED: 'rejected',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  REMOVED: 'removed',
} as const satisfies Record<string, EventStatus>;

// Booking state machine — imported by packages/db to build pgEnum("booking_status")
export const BOOKING_STATUSES = ['pending', 'accepted', 'rejected', 'cancelled'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export const BookingStatus = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
} as const satisfies Record<string, BookingStatus>;

// Booking direction — imported by packages/db to build pgEnum("booking_direction")
export const BOOKING_DIRECTIONS = [
  'venue_to_artist',
  'artist_to_venue',
  'artist_to_artist',
] as const;
export type BookingDirection = (typeof BOOKING_DIRECTIONS)[number];
export const BookingDirection = {
  VENUE_TO_ARTIST: 'venue_to_artist',
  ARTIST_TO_VENUE: 'artist_to_venue',
  ARTIST_TO_ARTIST: 'artist_to_artist',
} as const satisfies Record<string, BookingDirection>;

// Venue subscription via Stripe — imported by packages/db to build pgEnum("subscription_status")
export const SUBSCRIPTION_STATUSES = ['inactive', 'active', 'past_due', 'cancelled'] as const;
export type VenueSubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export const SubscriptionStatus = {
  INACTIVE: 'inactive',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELLED: 'cancelled',
} as const satisfies Record<string, VenueSubscriptionStatus>;

// Irish music event categories (pre-seeded, subject to client sign-off)
export const EVENT_CATEGORIES = [
  'Traditional',
  'Contemporary',
  'Fusion',
  'Celtic',
  'Folk',
  'Session',
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

// 32 counties of Ireland (Republic + Northern Ireland)
export const IRISH_COUNTIES = [
  'Antrim',
  'Armagh',
  'Carlow',
  'Cavan',
  'Clare',
  'Cork',
  'Derry',
  'Donegal',
  'Down',
  'Dublin',
  'Fermanagh',
  'Galway',
  'Kerry',
  'Kildare',
  'Kilkenny',
  'Laois',
  'Leitrim',
  'Limerick',
  'Longford',
  'Louth',
  'Mayo',
  'Meath',
  'Monaghan',
  'Offaly',
  'Roscommon',
  'Sligo',
  'Tipperary',
  'Tyrone',
  'Waterford',
  'Westmeath',
  'Wexford',
  'Wicklow',
] as const;
export type IrishCounty = (typeof IRISH_COUNTIES)[number];

// Notification persona targeting
export const NOTIFICATION_PERSONAS = ['artist', 'venue', 'spectator'] as const;
export type NotificationPersona = (typeof NOTIFICATION_PERSONAS)[number];

// Device platform — used in device_tokens.platform
export const PLATFORMS = ['ios', 'android'] as const;
export type Platform = (typeof PLATFORMS)[number];

// Social link platforms — used in profile_social_links.platform
// Imported by packages/db to build pgEnum("social_platform") and by validators for runtime checks.
export const SOCIAL_PLATFORMS = [
  'INSTAGRAM',
  'FACEBOOK',
  'TIKTOK',
  'YOUTUBE',
  'WEBSITE',
  'TWITTER',
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
