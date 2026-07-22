import type {
  UserRole,
  EventStatus,
  EventCategory,
  BookingStatus,
  BookingDirection,
  VenueSubscriptionStatus,
} from './enums.js';

// --- User ---

export interface User {
  userId: string;
  currentRole: UserRole;
  email: string;
  emailVerified: boolean;
}

// --- Geo types ---

export interface BoundingBox {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

// --- Pagination ---

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// --- API Response envelope ---

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code: string;
  message: string;
  statusCode: number;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// --- Domain types (lightweight, for client use) ---

export interface EventSummary {
  id: string;
  title: string;
  description: string;
  dateStart: string; // ISO 8601
  dateEnd?: string; // ISO 8601
  lat: number;
  lng: number;
  venueAddress?: string;
  category: EventCategory;
  status: EventStatus;
  coverImageUrl?: string;
  ticketLink?: string;
  createdAt: string;
}

export interface ArtistSummary {
  id: string;
  displayName: string;
  bio?: string;
  genres: EventCategory[];
  profileImageUrl?: string;
  location?: string;
}

export interface VenueSummary {
  id: string;
  name: string;
  description?: string;
  address: string;
  lat: number;
  lng: number;
  subscriptionStatus: VenueSubscriptionStatus;
  profileImageUrl?: string;
}

export interface BookingSummary {
  id: string;
  status: BookingStatus;
  direction: BookingDirection;
  artistId: string;
  // User (account) id behind the artist profile — used to open their public
  // profile (the /artist/[userId] route resolves by userId) e.g. from Contact.
  artistUserId: string;
  artistName: string;
  artistImage?: string;
  venueId: string;
  venueUserId: string;
  venueName: string;
  venueImage?: string;
  /** Inviting artist — populated only for artist_to_artist rows. */
  inviterArtistId?: string;
  // User (account) id behind the inviting artist's profile — used to open their
  // public profile via the /artist/[userId] route from the accepted-invite
  // "CONTACT ARTIST" button.
  inviterArtistUserId?: string;
  inviterArtistName?: string;
  inviterArtistImage?: string;
  /**
   * Whether the viewer initiated this booking. Server-computed per request.
   * Used by the Requests card/actions for artist_to_artist rows where role +
   * direction alone cannot distinguish sender from recipient. Undefined for
   * venue↔artist rows (the card falls back to role/direction).
   */
  viewerIsSender?: boolean;
  eventId: string;
  eventTitle: string;
  eventDescription?: string;
  eventCoverImage?: string;
  eventCategory: string;
  eventDateStart: string;
  eventDateEnd?: string;
  eventVenueAddress?: string;
  /**
   * Current lifecycle status of the linked event. When the event has been
   * deleted (archived) or taken down (removed), collaboration/request cards
   * render a disabled "no longer available" state instead of live actions.
   * Falls back to `archived` when the event row is missing (orphaned booking),
   * which fails safe by disabling the card. Asana 1215700058852004.
   */
  eventStatus: EventStatus;
  createdAt: string;
  updatedAt: string;
  /**
   * How many booking attempts this card represents for the same (event,
   * direction, artist, counterparty). A withdraw→re-request leaves the old
   * (cancelled) row behind and inserts a new one; `bookings.list` collapses them
   * into a single card and reports the attempt count so the UI can show
   * "Requested N times" instead of a separate card per attempt.
   * Asana 1215700058851996 (Issue 1). 1 for a single attempt.
   */
  requestCount: number;
  /**
   * ISO timestamp of the most recent attempt in this card's group (the
   * representative row's createdAt). Drives the "Last requested on …" line.
   */
  lastRequestedAt: string;
}

// --- Feed types ---

export interface FeedEvent {
  id: string;
  title: string;
  dateStart: string; // ISO 8601
  dateEnd?: string; // ISO 8601
  lat: number;
  lng: number;
  venueAddress?: string;
  category: EventCategory;
  coverImageUrl?: string;
  createdAt: string; // ISO 8601 — used for recency display
  creatorName: string; // artist stageName or venue venueName
  creatorId: string; // user ID of event creator
  isFollowedCreator: boolean;
  isSaved: boolean;
  distanceKm?: number; // computed server-side from user location
  joinedCount: number; // count of users who saved this event
  score: number; // algorithmic ranking score (0-1)
  collectionName?: string; // name of the collection this event belongs to, if any
}

export interface FeedResponse {
  events: FeedEvent[];
  hasNextPage: boolean;
  totalCount: number;
}

// --- Notification payload shape ---

export interface NotificationPayload {
  title: string;
  body: string;
  persona: string; // artist | venue | spectator
  route: string; // deep link route e.g. /(app)/(tabs)/discover/event/123
  data?: Record<string, string>;
}
