import { EventStatus } from '@CeolX/shared/enums';

import type { EventDetailData } from '@/types/event-detail';

export const MOCK_EVENT_DETAIL: EventDetailData = {
  id: 'mock-event-1',
  title: 'The Bodhrán Buzz',
  description:
    "Get ready for an irresistible beat at The Bodhrán Buzz, a high-energy bodhrán masterclass and performance showcase. Join us for an evening of traditional Irish percussion, featuring some of Ireland's finest bodhrán players. Whether you're a seasoned musician or a curious newcomer, this event promises to deliver an unforgettable night of rhythm and craic. Expect live demonstrations, interactive workshops, and a closing session that'll have everyone on their feet.",
  dateStart: '2025-10-26T18:00:00.000Z',
  dateEnd: '2025-10-26T20:00:00.000Z',
  lat: 53.9631,
  lng: -10.0673,
  venueAddress: 'Dooagh, Achill Island, Co. Mayo, Ireland',
  category: 'Folk',
  coverImageUrl: undefined,
  ticketLink: 'https://example.com/tickets/bodhran-buzz',
  ticketPrice: 99900,
  unregisteredCollaborators: [],
  status: EventStatus.ACTIVE,
  creator: {
    id: 'creator-1',
    name: 'Create Future',
    imageUrl: undefined,
    type: 'venue',
  },
  collaborators: [
    {
      id: 'artist-1',
      stageName: 'Leonard Barry',
      genre: 'Singer-songwriter',
      profileImageUrl: undefined,
      eventCount: 27,
    },
    {
      id: 'artist-2',
      stageName: 'Colm Murphy',
      genre: 'Bodhrán master',
      profileImageUrl: undefined,
      eventCount: 14,
    },
    {
      id: 'artist-3',
      stageName: 'Éamon Murray',
      genre: 'Percussionist',
      profileImageUrl: undefined,
      eventCount: 32,
    },
  ],
  collection: {
    id: 'collection-1',
    name: 'Achill Island Sessions',
  },
  isSaved: false,
  attendeeCount: 180,
  relatedEvents: [
    {
      id: 'related-1',
      title: 'The Bodhrán Buzz II',
      dateStart: '2025-11-02T17:30:00.000Z',
      category: 'Folk',
      coverImageUrl: undefined,
      venueAddress: 'Dooagh, Achill Island, Co. Mayo',
    },
    {
      id: 'related-2',
      title: 'Mayo Trad Festival',
      dateStart: '2025-11-15T19:00:00.000Z',
      category: 'Traditional',
      coverImageUrl: undefined,
      venueAddress: 'Westport, Co. Mayo',
    },
    {
      id: 'related-3',
      title: 'Wild Atlantic Sessions',
      dateStart: '2025-12-01T20:00:00.000Z',
      category: 'Session',
      coverImageUrl: undefined,
      venueAddress: 'Clifden, Co. Galway',
    },
  ],
};
