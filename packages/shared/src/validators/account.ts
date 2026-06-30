import { z } from 'zod';

// Single source of truth for the spectator "Update Profile" screen. Both the
// api server (users.updateMe) and apps/native (account-edit screen + hook)
// import from here. A spectator has no *_profiles row — their display name and
// avatar live directly on the BetterAuth `user` table, so this is the only
// schema that validates an account-level name/image edit.
export const updateAccountSchema = z.object({
  // Name is required (non-empty, trimmed) and capped to keep parity with the
  // artist/venue display-name caps. The trim runs before the min check so a
  // whitespace-only value is rejected, not silently saved as blank.
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or fewer'),
  // undefined => leave the avatar unchanged; null => clear it; string => new
  // CDN url. Mirrors the profileImageUrl idiom used in profiles validators.
  image: z.string().url().nullable().optional(),
});

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
