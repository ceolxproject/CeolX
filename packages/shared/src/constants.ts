import type { IrishCounty } from './enums';

// Map configuration
export const MAP_MAX_PINS_PER_FETCH = 50;
export const MAP_DEBOUNCE_MS = 400;

// Silent radius expansion for empty map states
export const MAP_EXPAND_RADIUS_KM = [5, 25, 100] as const;

// Ireland geographic centre (fallback when GPS + IP both fail)
export const IRELAND_CENTER_LAT = 53.1424;
export const IRELAND_CENTER_LNG = -7.6921;

// Ireland initial map region (used by MapView initialRegion)
export const IRELAND_INITIAL_REGION = {
  latitude: IRELAND_CENTER_LAT,
  longitude: IRELAND_CENTER_LNG,
  latitudeDelta: 4,
  longitudeDelta: 5,
};

// Event category display labels (display text === stored value; map kept for
// callers that look up by key and for any future short-form overrides).
export const CATEGORY_LABELS: Record<string, string> = {
  Concerts: 'Concerts',
  Gigs: 'Gigs',
  Karaoke: 'Karaoke',
  'Open Mic Nights': 'Open Mic Nights',
  Festivals: 'Festivals',
  Recital: 'Recital',
  'DJ Sets / Club Nights': 'DJ Sets / Club Nights',
  'Jam Sessions': 'Jam Sessions',
  'Tribute / Cover Band Shows': 'Tribute / Cover Band Shows',
  Workshops: 'Workshops',
  'Open Trad Sessions': 'Open Trad Sessions',
  Lessons: 'Lessons',
  Outdoor: 'Outdoor',
  Others: 'Others',
};

// Geographic centre coordinates for each Irish county (Republic + Northern Ireland).
// Uses `satisfies` to enforce that every IrishCounty has an entry — a missing county
// will cause a compile error.
// NOTE: "Derry" is used throughout CeolX as the county name. Officially "Londonderry"
// in some contexts, but "Derry" is the more commonly used name in everyday Irish usage.
export const COUNTY_CENTERS = {
  Antrim: { lat: 54.7, lng: -6.2 },
  Armagh: { lat: 54.35, lng: -6.65 },
  Carlow: { lat: 52.72, lng: -6.93 },
  Cavan: { lat: 53.99, lng: -7.36 },
  Clare: { lat: 52.9, lng: -8.98 },
  Cork: { lat: 51.9, lng: -8.47 },
  Derry: { lat: 54.995, lng: -7.31 },
  Donegal: { lat: 54.655, lng: -8.1 },
  Down: { lat: 54.32, lng: -5.93 },
  Dublin: { lat: 53.3498, lng: -6.2603 },
  Fermanagh: { lat: 54.345, lng: -7.63 },
  Galway: { lat: 53.2707, lng: -9.0568 },
  Kerry: { lat: 52.15, lng: -9.57 },
  Kildare: { lat: 53.158, lng: -6.91 },
  Kilkenny: { lat: 52.654, lng: -7.244 },
  Laois: { lat: 52.994, lng: -7.332 },
  Leitrim: { lat: 54.124, lng: -8.0 },
  Limerick: { lat: 52.668, lng: -8.63 },
  Longford: { lat: 53.727, lng: -7.793 },
  Louth: { lat: 53.925, lng: -6.49 },
  Mayo: { lat: 53.847, lng: -9.3 },
  Meath: { lat: 53.607, lng: -6.656 },
  Monaghan: { lat: 54.249, lng: -6.968 },
  Offaly: { lat: 53.235, lng: -7.712 },
  Roscommon: { lat: 53.627, lng: -8.186 },
  Sligo: { lat: 54.27, lng: -8.47 },
  Tipperary: { lat: 52.473, lng: -8.162 },
  Tyrone: { lat: 54.6, lng: -7.3 },
  Waterford: { lat: 52.259, lng: -7.11 },
  Westmeath: { lat: 53.534, lng: -7.465 },
  Wexford: { lat: 52.336, lng: -6.463 },
  Wicklow: { lat: 52.98, lng: -6.36 },
} satisfies Record<IrishCounty, { lat: number; lng: number }>;

// Event moderation
export const MAX_REJECTION_REASON_LENGTH = 500;

// GDPR
export const INACTIVE_ACCOUNT_FLAG_MONTHS = 24;
export const ACCOUNT_ANONYMIZE_DELAY_DAYS = 30;

// Venue subscription
export const VENUE_SUBSCRIPTION_URL = 'https://ceolx.ie/subscribe';

/** Public CeolX marketing/landing site — used as the CTA for re-engagement emails. */
export const CEOLX_WEB_URL = 'https://ceolx.ie';

// FCM
export const FCM_NOTIFICATION_CLICK_ACTION = 'FLUTTER_NOTIFICATION_CLICK';

// API pagination defaults
export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

// Bookings — minimum wait before a pending invite/request can be resent.
// Anchored on bookings.updatedAt, which for a pending row only moves on
// creation (first send) or a resend, so it reads as "last sent at".
// (Asana 1215700058851990 — anti-spam on resend.)
export const RESEND_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

// Collaboration — "Share Interest" anti-spam cooldown. Blocks re-sending
// interest to the same recipient within this window (M? — Asana 1215700058851992).
export const SHARE_INTEREST_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
