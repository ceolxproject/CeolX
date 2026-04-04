import { z } from 'zod';

export const artistProfileSchema = z.object({
  stageName: z.string().min(1, 'Stage name is required').max(100).trim(),
  bio: z.string().max(1000).trim().optional(),
  genre: z.string().min(1, 'Genre is required').max(50),
  profileImageUrl: z.string().url().optional(),
});

export const venueProfileSchema = z.object({
  venueName: z.string().min(1, 'Venue name is required').max(100).trim(),
  address: z.string().min(1, 'Address is required').max(300).trim(),
  bio: z.string().max(1000).trim().optional(),
  profileImageUrl: z.string().url().optional(),
});

export type ArtistProfileInput = z.infer<typeof artistProfileSchema>;
export type VenueProfileInput = z.infer<typeof venueProfileSchema>;
