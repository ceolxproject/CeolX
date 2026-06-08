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
  artistName: string;
  artistImage?: string;
  venueId: string;
  venueName: string;
  venueImage?: string;
  /** Inviting artist — populated only for artist_to_artist rows. */
  inviterArtistId?: string;
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
  eventCoverImage?: string;
  eventCategory: string;
  eventDateStart: string;
  eventDateEnd?: string;
  eventVenueAddress?: string;
  createdAt: string;
  updatedAt: string;
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
