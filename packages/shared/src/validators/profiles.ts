import { z } from 'zod';

// ── Artist onboarding (initial profile creation — follows Figma design) ───────

export const socialLinksSchema = z.object({
  instagram: z.string().url('Invalid Instagram URL').or(z.literal('')).optional(),
  facebook: z.string().url('Invalid Facebook URL').or(z.literal('')).optional(),
  tiktok: z.string().url('Invalid TikTok URL').or(z.literal('')).optional(),
  youtube: z.string().url('Invalid YouTube URL').or(z.literal('')).optional(),
});

export const createArtistOnboardingSchema = z.object({
  stageName: z.string().min(1, 'Stage name is required').max(100).trim(),
  bio: z.string().max(50, 'Bio must be 50 characters or less').trim().optional(),
  contactEmail: z.string().email('Invalid email address').optional(),
  socialLinks: socialLinksSchema.optional(),
  profileImageUrl: z.string().url('Invalid image URL').optional(),
});

export type CreateArtistOnboardingInput = z.infer<typeof createArtistOnboardingSchema>;
export type SocialLinks = z.infer<typeof socialLinksSchema>;

// ── Artist / Venue profile schemas (future profile editing) ──────────────────

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
