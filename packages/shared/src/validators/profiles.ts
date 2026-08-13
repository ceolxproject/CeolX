import { z } from 'zod';

import type { SOCIAL_PLATFORMS } from '../enums';

// Single source of truth for the bio/short-description character cap. Both the
// onboarding wizard and the Edit Profile screen (Artist + Venue) must use this
// so the two flows can never diverge again (Asana 1215717564020178).
export const BIO_MAX_LENGTH = 150;

// Name caps (characters), exported so the onboarding + profile UIs cap inputs
// with the same values the schemas enforce. STAGE_NAME_MAX covers the artist
// stage/display name everywhere it appears. VENUE_NAME_MAX is unified to the DB
// column width (venue_name varchar(255)) across onboarding, profile and update
// so a name accepted at onboarding can't later be rejected on edit.
export const STAGE_NAME_MAX = 100;
export const VENUE_NAME_MAX = 255;

// Optional bio field with the shared cap. `label` tailors the message ("Bio" on
// artist screens, "Description" on venue screens) while the limit stays unified.
const bioField = (label: 'Bio' | 'Description' = 'Bio') =>
  z
    .string()
    .max(BIO_MAX_LENGTH, `${label} must be ${BIO_MAX_LENGTH} characters or less`)
    .trim()
    .optional();

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
  .refine(isRealDomain, 'Enter a valid link (e.g. yourwebsite.com)')
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
  venueName: z.string().min(1, 'Venue/festival name is required').max(VENUE_NAME_MAX).trim(),
  contactEmail: z.string().email('Invalid email address').optional(),
  profileImageUrl: z.string().url().optional(),
});

export const venueOnboardingStep2Schema = z.object({
  address: z.string().min(1, 'Venue/festival location is required').max(255).trim(),
  // lat/lng come from the map pin and are mandatory — the map screen, event
  // creation and navigation all rely on coordinates, not the address text.
  lat: z.number({ message: 'Pin your venue/festival on the map' }).min(-90).max(90),
  lng: z.number({ message: 'Pin your venue/festival on the map' }).min(-180).max(180),
  bio: bioField('Description'),
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
  stageName: z.string().min(1, 'Stage name is required').max(STAGE_NAME_MAX).trim(),
  contactEmail: z.string().email('Invalid email address').optional(),
  profileImageUrl: z.string().url().optional(),
});

export const artistOnboardingStep2Schema = z.object({
  bio: bioField(),
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

// ── Username handle (shareable ceolx.com/u/<username> — one-time, permanent) ──

// Handles live in the shared /u/ URL namespace and never change once set, so
// the rule set is deliberately tight: lowercase a–z, digits, underscore; a
// leading letter is NOT required but at least one letter must appear (blocks
// "123"/"___"). This same schema is passed to the better-auth username() plugin
// validator, so client form, tRPC input, and auth-layer all enforce the
// identical rule. lowercase-only ⇒ displayUsername always equals username.
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

// Brand/impersonation + defensive route names + generic words. Kept as an
// in-code Set (not a DB table) so the check stays one lookup away and the list
// is trivially extensible. Values are compared against the lowercased handle.
export const RESERVED_USERNAMES = new Set<string>([
  // brand / impersonation
  'ceolx',
  'official',
  'support',
  'help',
  'admin',
  'team',
  'staff',
  'mod',
  'moderator',
  'contact',
  // route names — defensive; the /u/ namespace already isolates real routes
  'api',
  'event',
  'events',
  'post',
  'posts',
  'subscribe',
  'auth',
  'login',
  'signup',
  'invite',
  'r',
  'u',
  'well-known',
  // generic
  'me',
  'all',
  'everyone',
  'null',
  'undefined',
]);

export const usernameSchema = z
  .string()
  .trim()
  .min(USERNAME_MIN, `Username must be at least ${USERNAME_MIN} characters`)
  .max(USERNAME_MAX, `Username must be ${USERNAME_MAX} characters or less`)
  .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers, and underscores only')
  .regex(/[a-z]/, 'Username must contain at least one letter')
  .refine((u) => !RESERVED_USERNAMES.has(u), 'That username is not available');

export type Username = z.infer<typeof usernameSchema>;

// ── Artist / Venue profile schemas (profile editing — M6-T1) ───────────────

export const artistProfileSchema = z.object({
  stageName: z.string().min(1, 'Stage name is required').max(STAGE_NAME_MAX).trim(),
  bio: bioField(),
  genre: z.string().min(1, 'Genre is required').max(50),
  profileImageUrl: z.string().url().optional(),
});

/** Input schema for artists.updateMe — all fields optional (partial update). */
export const updateArtistProfileSchema = z.object({
  displayName: z.string().min(1).max(STAGE_NAME_MAX).trim().optional(),
  bio: bioField(),
  genres: z.array(z.string().max(50)).max(10).optional(),
  location: z.string().max(255).trim().optional(),
  // null clears the stored image (remove photo); undefined leaves it unchanged.
  profileImageUrl: z.string().url().nullable().optional(),
  coverImageUrl: z.string().url().optional(),
  socialLinks: socialLinksSchema.optional(),
});

export const venueProfileSchema = z.object({
  venueName: z.string().min(1, 'Venue/festival name is required').max(VENUE_NAME_MAX).trim(),
  address: z.string().min(1, 'Address is required').max(300).trim(),
  bio: bioField('Description'),
  profileImageUrl: z.string().url().optional(),
});

/** Input schema for venues.updateMe — all fields optional (partial update). */
export const updateVenueProfileSchema = z.object({
  displayName: z.string().min(1).max(VENUE_NAME_MAX).trim().optional(), // maps to venueName in DB
  bio: bioField('Description'),
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
