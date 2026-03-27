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
  isGigOpportunity: boolean;
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
  venueId: string;
  eventId?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Notification payload shape ---

export interface NotificationPayload {
  title: string;
  body: string;
  persona: string; // artist | venue | spectator
  route: string; // deep link route e.g. /events/123
  data?: Record<string, string>;
}
