import { describe, expect, it } from 'vitest';

import { resolveProfileImageUrl } from '../routers/events/helpers';

// Regression for Asana 1215429148917917 — Venue/Artist profile pictures were
// missing on Events because the resolver read user.image (BetterAuth, only set
// for Google/Apple logins) instead of the profile table's profileImageUrl,
// where onboarding actually stores the uploaded picture. Precedence must match
// hydrateAuthors (posts): profile image first, user.image only as a fallback.
describe('resolveProfileImageUrl', () => {
  it('prefers the profile image over the auth user.image', () => {
    expect(
      resolveProfileImageUrl({ profileImageUrl: 'https://cdn.ceolx.ie/profiles/a.jpg' }, null)
    ).toBe('https://cdn.ceolx.ie/profiles/a.jpg');
  });

  it('uses the profile image even when a user.image exists (the bug)', () => {
    expect(
      resolveProfileImageUrl(
        { profileImageUrl: 'https://cdn.ceolx.ie/profiles/a.jpg' },
        'https://lh3.googleusercontent.com/social.jpg'
      )
    ).toBe('https://cdn.ceolx.ie/profiles/a.jpg');
  });

  it('falls back to user.image when the profile has no uploaded picture', () => {
    expect(
      resolveProfileImageUrl(
        { profileImageUrl: null },
        'https://lh3.googleusercontent.com/social.jpg'
      )
    ).toBe('https://lh3.googleusercontent.com/social.jpg');
  });

  it('falls back to user.image when there is no profile row at all', () => {
    expect(resolveProfileImageUrl(null, 'https://lh3.googleusercontent.com/social.jpg')).toBe(
      'https://lh3.googleusercontent.com/social.jpg'
    );
  });

  it('returns null when neither a profile image nor a user.image exists', () => {
    expect(resolveProfileImageUrl(null, null)).toBeNull();
    expect(resolveProfileImageUrl({ profileImageUrl: null }, undefined)).toBeNull();
  });
});
