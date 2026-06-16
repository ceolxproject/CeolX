import { z } from 'zod';

import type { SOCIAL_PLATFORMS } from '../enums';

// ── Artist onboarding (initial profile creation — follows Figma design) ───────

// Real-domain check: valid URL whose host has ≥1 dot and non-empty labels.
// The mobile clients prepend `https://` to bare input before validating, which
// makes `z.url()` alone accept single-word junk like `dhjdjddk` (it parses as a
// valid hostname). This rejects that while allowing bare domains. Used for the
// generic Website fields, where any real domain is acceptable.
export const isRealDomain = (value: string): boolean => {
  try {
    return /^[^.\s]+(\.[^.\s]+)+$/.test(new URL(value).hostname);
  } catch {
    return false;
  }
};

// Host allow-lists per platform, including common alternates (short links,
// regional/mobile subdomains are covered by the `endsWith` match below).
const PLATFORM_HOSTS = {
  INSTAGRAM: ['instagram.com', 'instagr.am'],
  FACEBOOK: ['facebook.com', 'fb.com', 'fb.me'],
  TWITTER: ['twitter.com', 'x.com'],
  TIKTOK: ['tiktok.com'],
  YOUTUBE: ['youtube.com', 'youtu.be'],
} as const;

// True when the URL's host is (or is a subdomain of) one of the allowed hosts.
// `www.` is stripped and subdomains like `m.facebook.com` match via the suffix.
const matchesPlatform = (value: string, allowed: readonly string[]): boolean => {
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
    return allowed.some((a) => host === a || host.endsWith(`.${a}`));
  } catch {
    return false;
  }
};

// Per-platform URL field — must be a valid URL pointing at that platform's
// domain (or empty, treated as omitted).
const platformUrl = (label: string, example: string, allowed: readonly string[]) =>
  z
    .string()
    .url('Invalid URL')
    .refine((v) => matchesPlatform(v, allowed), `Enter a valid ${label} link (e.g. ${example})`)
    .or(z.literal(''))
    .optional();

// Generic Website field — any real domain is fine.
const websiteUrlField = z
  .string()
  .url('Invalid URL')
  .refine(isRealDomain, 'Enter a valid link (e.g. yourvenue.com)')
  .or(z.literal(''))
  .optional();

// Validated against SOCIAL_PLATFORMS so adding a new platform here requires updating the enum too.
export const socialLinksSchema = z.object({
  INSTAGRAM: platformUrl('Instagram', 'instagram.com/you', PLATFORM_HOSTS.INSTAGRAM),
  FACEBOOK: platformUrl('Facebook', 'facebook.com/you', PLATFORM_HOSTS.FACEBOOK),
  TIKTOK: platformUrl('TikTok', 'tiktok.com/@you', PLATFORM_HOSTS.TIKTOK),
  YOUTUBE: platformUrl('YouTube', 'youtube.com/@you', PLATFORM_HOSTS.YOUTUBE),
} satisfies Record<
  Extract<(typeof SOCIAL_PLATFORMS)[number], 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'YOUTUBE'>,
  unknown
>);

// ── Venue onboarding (initial profile creation — follows Figma design) ────────

export const venueLinksSchema = z.object({
  WEBSITE: websiteUrlField,
  INSTAGRAM: platformUrl('Instagram', 'instagram.com/you', PLATFORM_HOSTS.INSTAGRAM),
  FACEBOOK: platformUrl('Facebook', 'facebook.com/you', PLATFORM_HOSTS.FACEBOOK),
  TWITTER: platformUrl('Twitter/X', 'x.com/you', PLATFORM_HOSTS.TWITTER),
} satisfies Record<
  Extract<(typeof SOCIAL_PLATFORMS)[number], 'WEBSITE' | 'INSTAGRAM' | 'FACEBOOK' | 'TWITTER'>,
  unknown
>);

// Per-step schemas power the multi-step wizard UI in apps/native.
// The merged createVenueOnboardingSchema is the server contract — its shape must stay equivalent to the prior flat schema (asserted in validators.test.ts).
export const venueOnboardingStep1Schema = z.object({
  venueName: z.string().min(1, 'Venue name is required').max(255).trim(),
  contactEmail: z.string().email('Invalid email address').optional(),
  profileImageUrl: z.string().url().optional(),
});

export const venueOnboardingStep2Schema = z.object({
  address: z.string().min(1, 'Venue location is required').max(255).trim(),
  // lat/lng come from the map pin and are mandatory — the map screen, event
  // creation and navigation all rely on coordinates, not the address text.
  lat: z.number({ message: 'Pin your venue on the map' }).min(-90).max(90),
  lng: z.number({ message: 'Pin your venue on the map' }).min(-180).max(180),
  bio: z.string().max(50, 'Description must be 50 characters or less').trim().optional(),
});

export const venueOnboardingStep3Schema = z.object({
  venueLinks: venueLinksSchema.optional(),
});

export const createVenueOnboardingSchema = venueOnboardingStep1Schema
  .merge(venueOnboardingStep2Schema)
  .merge(venueOnboardingStep3Schema);
// profileImageUrl carries the CloudFront URL from the Step 1 photo upload (optional — users may skip the photo).

export type CreateVenueOnboardingInput = z.infer<typeof createVenueOnboardingSchema>;

// ── Artist onboarding (initial profile creation — follows Figma design) ───────

export const artistOnboardingStep1Schema = z.object({
  stageName: z.string().min(1, 'Stage name is required').max(100).trim(),
  contactEmail: z.string().email('Invalid email address').optional(),
  profileImageUrl: z.string().url().optional(),
});

export const artistOnboardingStep2Schema = z.object({
  bio: z.string().max(50, 'Bio must be 50 characters or less').trim().optional(),
});

export const artistOnboardingStep3Schema = z.object({
  socialLinks: socialLinksSchema.optional(),
});

export const createArtistOnboardingSchema = artistOnboardingStep1Schema
  .merge(artistOnboardingStep2Schema)
  .merge(artistOnboardingStep3Schema);
// profileImageUrl carries the CloudFront URL from the Step 1 photo upload (optional — users may skip the photo).

export type CreateArtistOnboardingInput = z.infer<typeof createArtistOnboardingSchema>;
export type SocialLinks = z.infer<typeof socialLinksSchema>;

// ── Artist / Venue profile schemas (profile editing — M6-T1) ───────────────

export const artistProfileSchema = z.object({
  stageName: z.string().min(1, 'Stage name is required').max(100).trim(),
  bio: z.string().max(1000).trim().optional(),
  genre: z.string().min(1, 'Genre is required').max(50),
  profileImageUrl: z.string().url().optional(),
});

/** Input schema for artists.updateMe — all fields optional (partial update). */
export const updateArtistProfileSchema = z.object({
  displayName: z.string().min(1).max(100).trim().optional(),
  bio: z.string().max(2000).trim().optional(),
  genres: z.array(z.string().max(50)).max(10).optional(),
  location: z.string().max(255).trim().optional(),
  // null clears the stored image (remove photo); undefined leaves it unchanged.
  profileImageUrl: z.string().url().nullable().optional(),
  coverImageUrl: z.string().url().optional(),
  socialLinks: socialLinksSchema.optional(),
});

export const venueProfileSchema = z.object({
  venueName: z.string().min(1, 'Venue name is required').max(100).trim(),
  address: z.string().min(1, 'Address is required').max(300).trim(),
  bio: z.string().max(1000).trim().optional(),
  profileImageUrl: z.string().url().optional(),
});

/** Input schema for venues.updateMe — all fields optional (partial update). */
export const updateVenueProfileSchema = z.object({
  displayName: z.string().min(1).max(150).trim().optional(), // maps to venueName in DB
  bio: z.string().max(2000).trim().optional(),
  address: z.string().max(255).trim().optional(),
  county: z.string().max(100).trim().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  // null clears the stored image (remove photo); undefined leaves it unchanged.
  profileImageUrl: z.string().url().nullable().optional(),
  coverImageUrl: z.string().url().optional(),
  // User-typed website — any real domain (same generic check as venue WEBSITE).
  websiteUrl: websiteUrlField,
  phone: z.string().max(30).trim().optional(),
  socialLinks: venueLinksSchema.optional(),
});

export type ArtistProfileInput = z.infer<typeof artistProfileSchema>;
export type UpdateArtistProfileInput = z.infer<typeof updateArtistProfileSchema>;
export type VenueProfileInput = z.infer<typeof venueProfileSchema>;
export type UpdateVenueProfileInput = z.infer<typeof updateVenueProfileSchema>;
