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
//
// Mirrors Stripe's own subscription statuses rather than collapsing them (M8-T0 D-11):
// a translation layer means our DB and the Stripe dashboard disagree mid-incident.
// `trialing` sits before `active` deliberately — the generated migration emits
// `ADD VALUE 'trialing' BEFORE 'active'`, keeping the pg enum in lifecycle order.
// Note we spell it `cancelled`; Stripe sends `canceled`. One mapping owns that (D-12).
export const SUBSCRIPTION_STATUSES = [
  'inactive',
  'trialing',
  'active',
  'past_due',
  'cancelled',
] as const;
export type VenueSubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export const SubscriptionStatus = {
  INACTIVE: 'inactive',
  TRIALING: 'trialing',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELLED: 'cancelled',
} as const satisfies Record<string, VenueSubscriptionStatus>;

// Venue subscription billing interval (M8-T0 D-04). One product, two intervals —
// these are NOT tiers; the Lite/Pro tier model was dropped (D-07).
//
// This is the value that travels on the wire and lands in
// `venue_subscriptions.plan`. A Stripe Price ID is deliberately never accepted
// from a client or a URL: the id is resolved server-side from
// STRIPE_PRICE_MONTHLY / STRIPE_PRICE_ANNUAL, so a crafted activation link
// cannot point checkout at an arbitrary Price (D-08).
export const BILLING_INTERVALS = ['monthly', 'annual'] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];
export const BillingInterval = {
  MONTHLY: 'monthly',
  ANNUAL: 'annual',
} as const satisfies Record<string, BillingInterval>;

// Ticket price currencies offered on the event form. EUR is the default — CeolX
// is Irish-first — but events are also listed in the UK and the US.
export const TICKET_CURRENCIES = ['EUR', 'GBP', 'USD'] as const;
export type TicketCurrency = (typeof TICKET_CURRENCIES)[number];
export const DEFAULT_TICKET_CURRENCY: TicketCurrency = 'EUR';

// Irish music event categories (finalised — client-provided list, Figma node 1:3817)
export const EVENT_CATEGORIES = [
  'Concerts',
  'Gigs',
  'Karaoke',
  'Open Mic Nights',
  'Festivals',
  'Recital',
  'DJ Sets / Club Nights',
  'Jam Sessions',
  'Tribute / Cover Band Shows',
  'Workshops',
  'Open Trad Sessions',
  'Lessons',
  'Outdoor',
  'Others',
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
