/**
 * Local type definitions for the Event Detail screen.
 * These will be replaced by shared types from @CeolX/shared
 * once the events.byId backend procedure is implemented.
 */

export interface EventDetailArtist {
  id: string;
  stageName: string;
  genre?: string | null;
  profileImageUrl?: string | null;
  eventCount: number;
  /** True for unregistered/external performers (invited by name + email, no platform profile). */
  isExternal?: boolean;
}

export interface EventDetailCreator {
  id: string;
  name: string;
  imageUrl?: string | null;
  type: 'artist' | 'venue';
}

export interface RelatedEvent {
  id: string;
  title: string;
  dateStart: string;
  category: string;
  coverImageUrl?: string | null;
  venueAddress?: string | null;
}

export interface EventDetailData {
  id: string;
  title: string;
  /**
   * Null when the creating venue's subscription is on hold (M8 V-03) — the server
   * withholds the promotional detail rather than 404-ing the event, so the screen can
   * say the venue is on hold instead of implying CeolX lost it (D-52).
   */
  description: string | null;
  /** Creating venue is on hold, so this event's detail is deliberately incomplete. */
  venueOnHold?: boolean;
  dateStart: string;
  dateEnd?: string | null;
  lat: number;
  lng: number;
  venueAddress?: string | null;
  venueId?: string | null;
  venueUserId?: string | null;
  category: string;
  coverImage?: string | null;
  coverImageUrl?: string | null;
  ticketLink?: string | null;
  ticketPrice?: number | null;
  collectionId?: string | null;
  unregisteredCollaborators: Array<{ name: string; email: string; imageUrl?: string }>;
  adTitle?: string | null;
  adDescription?: string | null;
  status: string;
  removalReason?: string | null;
  creator: EventDetailCreator;
  collaborators: EventDetailArtist[];
  collection?: { id: string; name: string } | null;
  isSaved: boolean;
  /** True while the viewing artist has a still-pending performance request on
   *  this event. Drives the "Request to Perform" ↔ "Request Sent" CTA; resets
   *  to false after a withdraw so the artist can ask again. */
  viewerHasPendingRequest: boolean;
  attendeeCount: number;
  relatedEvents: RelatedEvent[];
}
