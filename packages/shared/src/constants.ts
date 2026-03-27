// Map configuration
export const MAP_MAX_PINS_PER_FETCH = 50;
export const MAP_DEBOUNCE_MS = 400;

// Silent radius expansion for empty map states
export const MAP_EXPAND_RADIUS_KM = [5, 25, 100] as const;

// Ireland geographic centre (fallback when GPS + IP both fail)
export const IRELAND_CENTER_LAT = 53.1424;
export const IRELAND_CENTER_LNG = -7.6921;

// Event moderation
export const MAX_REJECTION_REASON_LENGTH = 500;

// GDPR
export const INACTIVE_ACCOUNT_FLAG_MONTHS = 24;
export const ACCOUNT_ANONYMIZE_DELAY_DAYS = 30;

// Venue subscription
export const VENUE_SUBSCRIPTION_URL = 'https://ceolx.ie/subscribe';

// FCM
export const FCM_NOTIFICATION_CLICK_ACTION = 'FLUTTER_NOTIFICATION_CLICK';

// API pagination defaults
export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;
