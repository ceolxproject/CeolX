import { z } from 'zod';

import { SOCIAL_PLATFORMS } from '../enums';

// ── Artist onboarding (initial profile creation — follows Figma design) ───────

// Reusable URL field — accepts a valid URL or empty string (treated as omitted)
const socialUrl = z.string().url('Invalid URL').or(z.literal('')).optional();

// Validated against SOCIAL_PLATFORMS so adding a new platform here requires updating the enum too.
export const socialLinksSchema = z.object({
  INSTAGRAM: socialUrl,
  FACEBOOK: socialUrl,
  TIKTOK: socialUrl,
  YOUTUBE: socialUrl,
} satisfies Record<Extract<(typeof SOCIAL_PLATFORMS)[number], 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'YOUTUBE'>, unknown>);

// ── Venue onboarding (initial profile creation — follows Figma design) ────────

export const venueLinksSchema = z.object({
  WEBSITE: socialUrl,
  INSTAGRAM: socialUrl,
  FACEBOOK: socialUrl,
  TWITTER: socialUrl,
} satisfies Record<Extract<(typeof SOCIAL_PLATFORMS)[number], 'WEBSITE' | 'INSTAGRAM' | 'FACEBOOK' | 'TWITTER'>, unknown>);

export const createVenueOnboardingSchema = z.object({
  venueName: z.string().min(1, 'Venue name is required').max(255).trim(),
  address: z.string().min(1, 'Venue location is required').max(255).trim(),
  bio: z.string().max(50, 'Description must be 50 characters or less').trim().optional(),
  contactEmail: z.string().email('Invalid email address').optional(),
  venueLinks: venueLinksSchema.optional(),
  // profileImageUrl omitted — S3/CDN upload deferred to M10.
});

export type CreateVenueOnboardingInput = z.infer<typeof createVenueOnboardingSchema>;

// ── Artist onboarding (initial profile creation — follows Figma design) ───────

export const createArtistOnboardingSchema = z.object({
  stageName: z.string().min(1, 'Stage name is required').max(100).trim(),
  bio: z.string().max(50, 'Bio must be 50 characters or less').trim().optional(),
  contactEmail: z.string().email('Invalid email address').optional(),
  socialLinks: socialLinksSchema.optional(),
  // profileImageUrl omitted — S3/CDN upload deferred to M10. Add here when upload flow is ready.
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
