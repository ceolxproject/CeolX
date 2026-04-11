/**
 * Local type definitions for the Event Detail screen.
 * These will be replaced by shared types from @CeolX/shared
 * once the events.byId backend procedure is implemented.
 */

export interface EventDetailArtist {
  id: string;
  stageName: string;
  genre?: string;
  profileImageUrl?: string;
  eventCount: number;
}

export interface EventDetailCreator {
  id: string;
  name: string;
  imageUrl?: string;
  type: 'artist' | 'venue';
}

export interface RelatedEvent {
  id: string;
  title: string;
  dateStart: string;
  category: string;
  coverImageUrl?: string;
  venueAddress?: string;
}

export interface EventDetailData {
  id: string;
  title: string;
  description: string;
  dateStart: string;
  dateEnd?: string;
  lat: number;
  lng: number;
  venueAddress?: string;
  category: string;
  coverImageUrl?: string;
  ticketLink?: string;
  ticketPrice?: number;
  isGigOpportunity: boolean;
  status: string;
  creator: EventDetailCreator;
  collaborators: EventDetailArtist[];
  collection?: { id: string; name: string };
  isSaved: boolean;
  attendeeCount: number;
  relatedEvents: RelatedEvent[];
}
