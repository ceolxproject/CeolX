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
  description: string;
  dateStart: string;
  dateEnd?: string | null;
  lat: number;
  lng: number;
  venueAddress?: string | null;
  venueId?: string | null;
  category: string;
  coverImage?: string | null;
  coverImageUrl?: string | null;
  ticketLink?: string | null;
  ticketPrice?: number | null;
  isGigOpportunity: boolean;
  collectionId?: string | null;
  adTitle?: string | null;
  adDescription?: string | null;
  status: string;
  removalReason?: string | null;
  creator: EventDetailCreator;
  collaborators: EventDetailArtist[];
  collection?: { id: string; name: string } | null;
  isSaved: boolean;
  attendeeCount: number;
  relatedEvents: RelatedEvent[];
}
