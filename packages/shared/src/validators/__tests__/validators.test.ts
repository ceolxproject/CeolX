import { describe, it, expect } from 'vitest';

import {
  signUpSchema,
  signInSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  consentSchema,
  createEventSchema,
  removeEventSchema,
  adminEventListQuerySchema,
  adminRemoveEventSchema,
  onboardingSchema,
  switchRoleSchema,
  createArtistOnboardingSchema,
  createVenueOnboardingSchema,
  artistOnboardingStep1Schema,
  artistOnboardingStep2Schema,
  artistOnboardingStep3Schema,
  venueOnboardingStep1Schema,
  venueOnboardingStep2Schema,
  venueOnboardingStep3Schema,
} from '../index.js';

// ─── Auth validators ────────────────────────────────────────────────────────

describe('signUpSchema', () => {
  const valid = {
    name: 'Priya Yadav',
    email: 'priya@ceolx.ie',
    password: 'SecurePass1!',
    confirmPassword: 'SecurePass1!',
  };

  it('accepts valid sign-up data', () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects password without uppercase', () => {
    const result = signUpSchema.safeParse({
      ...valid,
      password: 'securepass1!',
      confirmPassword: 'securepass1!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password without number', () => {
    const result = signUpSchema.safeParse({
      ...valid,
      password: 'SecurePass!!',
      confirmPassword: 'SecurePass!!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password without special character', () => {
    const result = signUpSchema.safeParse({
      ...valid,
      password: 'SecurePass12',
      confirmPassword: 'SecurePass12',
    });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched confirmPassword', () => {
    const result = signUpSchema.safeParse({ ...valid, confirmPassword: 'Different1!' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('confirmPassword');
    }
  });

  it('normalises email to lowercase', () => {
    const result = signUpSchema.safeParse({ ...valid, email: 'PRIYA@CEOLX.IE' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('priya@ceolx.ie');
    }
  });

  it('rejects invalid email format', () => {
    expect(signUpSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
  });
});

describe('signInSchema', () => {
  it('accepts valid credentials', () => {
    expect(signInSchema.safeParse({ email: 'test@ceolx.ie', password: 'any' }).success).toBe(true);
  });

  it('rejects empty password', () => {
    expect(signInSchema.safeParse({ email: 'test@ceolx.ie', password: '' }).success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'test@ceolx.ie' }).success).toBe(true);
  });

  it('rejects non-email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'not-valid' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  const valid = {
    token: '550e8400-e29b-41d4-a716-446655440000',
    newPassword: 'NewPass1!',
    confirmPassword: 'NewPass1!',
  };

  it('accepts valid reset data', () => {
    expect(resetPasswordSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects non-UUID token', () => {
    expect(resetPasswordSchema.safeParse({ ...valid, token: 'not-a-uuid' }).success).toBe(false);
  });

  it('rejects mismatched passwords', () => {
    expect(resetPasswordSchema.safeParse({ ...valid, confirmPassword: 'Other1!' }).success).toBe(
      false
    );
  });
});

// ─── User / Onboarding validators ───────────────────────────────────────────

describe('consentSchema', () => {
  it('accepts all consents granted', () => {
    const result = consentSchema.safeParse({
      privacyPolicyAccepted: true,
      termsAccepted: true,
      marketingOptIn: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects privacyPolicyAccepted: false', () => {
    expect(
      consentSchema.safeParse({
        privacyPolicyAccepted: false,
        termsAccepted: true,
        marketingOptIn: false,
      }).success
    ).toBe(false);
  });

  it('rejects termsAccepted: false', () => {
    expect(
      consentSchema.safeParse({
        privacyPolicyAccepted: true,
        termsAccepted: false,
        marketingOptIn: false,
      }).success
    ).toBe(false);
  });
});

describe('onboardingSchema', () => {
  it('accepts valid personas', () => {
    expect(onboardingSchema.safeParse({ persona: 'spectator' }).success).toBe(true);
    expect(onboardingSchema.safeParse({ persona: 'artist' }).success).toBe(true);
    expect(onboardingSchema.safeParse({ persona: 'venue' }).success).toBe(true);
  });

  it('rejects unknown persona', () => {
    expect(onboardingSchema.safeParse({ persona: 'admin' }).success).toBe(false);
  });
});

describe('switchRoleSchema', () => {
  it('accepts valid role', () => {
    expect(switchRoleSchema.safeParse({ role: 'artist' }).success).toBe(true);
  });

  it('rejects admin (not switchable)', () => {
    expect(switchRoleSchema.safeParse({ role: 'admin' }).success).toBe(false);
  });
});

// ─── Event validators ────────────────────────────────────────────────────────

describe('createEventSchema', () => {
  const valid = {
    title: 'Trad Night',
    description: 'A wonderful traditional session at the local pub.',
    dateStart: '2026-08-01T20:00:00.000Z',
    lat: 53.3498,
    lng: -6.2603,
    venueAddress: "O'Brien's Pub, Dublin",
    category: 'Traditional',
  };

  it('accepts valid event data', () => {
    expect(createEventSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects latitude below -90', () => {
    expect(createEventSchema.safeParse({ ...valid, lat: -91 }).success).toBe(false);
  });

  it('rejects latitude above 90', () => {
    expect(createEventSchema.safeParse({ ...valid, lat: 91 }).success).toBe(false);
  });

  it('rejects longitude below -180', () => {
    expect(createEventSchema.safeParse({ ...valid, lng: -181 }).success).toBe(false);
  });

  it('rejects when neither coordinates nor venueId provided', () => {
    const noLocation = {
      title: valid.title,
      description: valid.description,
      dateStart: valid.dateStart,
      category: valid.category,
    };
    expect(createEventSchema.safeParse(noLocation).success).toBe(false);
  });

  it('rejects a free-text venueAddress without coordinates or a venueId', () => {
    // Map and feed are coordinate-driven — an address string alone cannot place
    // an event, so it must not satisfy the location requirement.
    const addressOnly = {
      title: valid.title,
      description: valid.description,
      dateStart: valid.dateStart,
      venueAddress: "O'Brien's Pub, Dublin",
      category: valid.category,
    };
    expect(createEventSchema.safeParse(addressOnly).success).toBe(false);
  });

  it('accepts a venueId without coordinates (server inherits the venue pin)', () => {
    const withVenueId = {
      title: valid.title,
      description: valid.description,
      dateStart: valid.dateStart,
      venueId: '550e8400-e29b-41d4-a716-446655440000',
      category: valid.category,
    };
    expect(createEventSchema.safeParse(withVenueId).success).toBe(true);
  });

  it('rejects dateEnd before dateStart', () => {
    expect(
      createEventSchema.safeParse({
        ...valid,
        dateEnd: '2026-07-01T20:00:00.000Z',
      }).success
    ).toBe(false);
  });

  it('accepts new fields (ticketPrice, collaborators, etc.)', () => {
    expect(
      createEventSchema.safeParse({
        ...valid,
        ticketPrice: 1500,
        adTitle: 'Special offer',
        adDescription: 'Early bird discount',
        collaborators: ['550e8400-e29b-41d4-a716-446655440000'],
      }).success
    ).toBe(true);
  });

  it('rejects more than 10 collaborators', () => {
    const tooMany = Array.from({ length: 11 }, (_, i) => `550e8400-e29b-41d4-a716-44665544000${i}`);
    expect(createEventSchema.safeParse({ ...valid, collaborators: tooMany }).success).toBe(false);
  });
});

// ─── Profile validators ──────────────────────────────────────────────────────

describe('createArtistOnboardingSchema', () => {
  const valid = {
    stageName: 'Seán Ó Murchú',
    bio: 'Traditional fiddle player.',
    contactEmail: 'sean@music.ie',
    socialLinks: {
      instagram: 'https://instagram.com/sean',
      facebook: 'https://facebook.com/sean',
    },
  };

  it('accepts valid onboarding data with all fields', () => {
    expect(createArtistOnboardingSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts minimal input with only stageName', () => {
    expect(createArtistOnboardingSchema.safeParse({ stageName: 'Seán' }).success).toBe(true);
  });

  it('rejects empty stageName', () => {
    expect(createArtistOnboardingSchema.safeParse({ stageName: '' }).success).toBe(false);
  });

  it('rejects stageName longer than 100 characters', () => {
    expect(createArtistOnboardingSchema.safeParse({ stageName: 'a'.repeat(101) }).success).toBe(
      false
    );
  });

  it('rejects bio longer than 50 characters', () => {
    expect(
      createArtistOnboardingSchema.safeParse({ stageName: 'Seán', bio: 'a'.repeat(51) }).success
    ).toBe(false);
  });

  it('accepts missing bio (optional)', () => {
    expect(createArtistOnboardingSchema.safeParse({ stageName: 'Seán' }).success).toBe(true);
  });

  it('rejects invalid contactEmail format', () => {
    expect(
      createArtistOnboardingSchema.safeParse({ ...valid, contactEmail: 'not-an-email' }).success
    ).toBe(false);
  });

  it('accepts missing contactEmail (optional)', () => {
    const noEmail = { stageName: valid.stageName, bio: valid.bio, socialLinks: valid.socialLinks };
    expect(createArtistOnboardingSchema.safeParse(noEmail).success).toBe(true);
  });

  it('accepts partial socialLinks with only INSTAGRAM', () => {
    expect(
      createArtistOnboardingSchema.safeParse({
        stageName: 'Seán',
        socialLinks: { INSTAGRAM: 'https://instagram.com/sean' },
      }).success
    ).toBe(true);
  });

  it('rejects invalid URL in socialLinks.INSTAGRAM', () => {
    expect(
      createArtistOnboardingSchema.safeParse({
        stageName: 'Seán',
        socialLinks: { INSTAGRAM: 'not-a-url' },
      }).success
    ).toBe(false);
  });

  it('accepts empty string in socialLinks to clear a field', () => {
    expect(
      createArtistOnboardingSchema.safeParse({
        stageName: 'Seán',
        socialLinks: { INSTAGRAM: '' },
      }).success
    ).toBe(true);
  });

  it('accepts missing socialLinks entirely (optional)', () => {
    expect(createArtistOnboardingSchema.safeParse({ stageName: 'Seán' }).success).toBe(true);
  });
});

// ─── Onboarding step schemas (multi-step refactor 2026-05-06) ──────────────
//
// These per-step schemas back the wizard UI in apps/native. The merged
// createArtist/VenueOnboardingSchema is the server contract — the equivalence
// block at the bottom guards that the merge stays byte-equivalent to what the
// flat schema produced before this refactor (D1.A: bio remains optional).

describe('artistOnboardingStep1Schema', () => {
  it('accepts stageName + contactEmail', () => {
    expect(
      artistOnboardingStep1Schema.safeParse({ stageName: 'Seán', contactEmail: 'a@b.co' }).success
    ).toBe(true);
  });

  it('accepts stageName only (email optional)', () => {
    expect(artistOnboardingStep1Schema.safeParse({ stageName: 'Seán' }).success).toBe(true);
  });

  it('rejects empty stageName', () => {
    expect(artistOnboardingStep1Schema.safeParse({ stageName: '' }).success).toBe(false);
  });

  it('rejects stageName longer than 100 characters', () => {
    expect(artistOnboardingStep1Schema.safeParse({ stageName: 'a'.repeat(101) }).success).toBe(
      false
    );
  });

  it('rejects malformed contactEmail', () => {
    expect(
      artistOnboardingStep1Schema.safeParse({ stageName: 'Seán', contactEmail: 'not-an-email' })
        .success
    ).toBe(false);
  });
});

describe('artistOnboardingStep2Schema (D1.A — bio optional)', () => {
  it('accepts bio at exactly 50 characters', () => {
    expect(artistOnboardingStep2Schema.safeParse({ bio: 'a'.repeat(50) }).success).toBe(true);
  });

  it('accepts empty body — bio omitted', () => {
    expect(artistOnboardingStep2Schema.safeParse({}).success).toBe(true);
  });

  it('trims surrounding whitespace from bio', () => {
    const result = artistOnboardingStep2Schema.safeParse({ bio: '  short bio  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.bio).toBe('short bio');
  });

  it('rejects bio longer than 50 characters', () => {
    expect(artistOnboardingStep2Schema.safeParse({ bio: 'a'.repeat(51) }).success).toBe(false);
  });
});

describe('artistOnboardingStep3Schema', () => {
  it('accepts missing socialLinks entirely', () => {
    expect(artistOnboardingStep3Schema.safeParse({}).success).toBe(true);
  });

  it('accepts all four links as empty strings (clear intent)', () => {
    expect(
      artistOnboardingStep3Schema.safeParse({
        socialLinks: { INSTAGRAM: '', FACEBOOK: '', TIKTOK: '', YOUTUBE: '' },
      }).success
    ).toBe(true);
  });

  it('accepts a single filled link', () => {
    expect(
      artistOnboardingStep3Schema.safeParse({
        socialLinks: { INSTAGRAM: 'https://instagram.com/sean' },
      }).success
    ).toBe(true);
  });

  it('accepts all four filled links', () => {
    expect(
      artistOnboardingStep3Schema.safeParse({
        socialLinks: {
          INSTAGRAM: 'https://instagram.com/x',
          FACEBOOK: 'https://facebook.com/x',
          TIKTOK: 'https://tiktok.com/@x',
          YOUTUBE: 'https://youtube.com/@x',
        },
      }).success
    ).toBe(true);
  });

  it('rejects malformed URL in any link', () => {
    expect(
      artistOnboardingStep3Schema.safeParse({ socialLinks: { INSTAGRAM: 'not-a-url' } }).success
    ).toBe(false);
  });
});

describe('venueOnboardingStep1Schema', () => {
  it('accepts venueName + contactEmail', () => {
    expect(
      venueOnboardingStep1Schema.safeParse({ venueName: 'The Cobblestone', contactEmail: 'a@b.co' })
        .success
    ).toBe(true);
  });

  it('accepts venueName only (email optional)', () => {
    expect(venueOnboardingStep1Schema.safeParse({ venueName: 'The Cobblestone' }).success).toBe(
      true
    );
  });

  it('rejects empty venueName', () => {
    expect(venueOnboardingStep1Schema.safeParse({ venueName: '' }).success).toBe(false);
  });

  it('rejects venueName longer than 255 characters', () => {
    expect(venueOnboardingStep1Schema.safeParse({ venueName: 'a'.repeat(256) }).success).toBe(
      false
    );
  });

  it('rejects malformed contactEmail', () => {
    expect(
      venueOnboardingStep1Schema.safeParse({ venueName: 'The Cobblestone', contactEmail: 'bad' })
        .success
    ).toBe(false);
  });
});

describe('venueOnboardingStep2Schema', () => {
  it('accepts address + coordinates + bio', () => {
    expect(
      venueOnboardingStep2Schema.safeParse({
        address: 'Galway',
        lat: 53.2707,
        lng: -9.0568,
        bio: 'Trad sessions nightly',
      }).success
    ).toBe(true);
  });

  it('accepts address + coordinates only (bio optional)', () => {
    expect(
      venueOnboardingStep2Schema.safeParse({ address: 'Galway', lat: 53.2707, lng: -9.0568 })
        .success
    ).toBe(true);
  });

  it('rejects empty address', () => {
    expect(
      venueOnboardingStep2Schema.safeParse({ address: '', lat: 53.2707, lng: -9.0568 }).success
    ).toBe(false);
  });

  it('rejects missing coordinates (map pin required)', () => {
    expect(venueOnboardingStep2Schema.safeParse({ address: 'Galway' }).success).toBe(false);
  });

  it('rejects out-of-range coordinates', () => {
    expect(
      venueOnboardingStep2Schema.safeParse({ address: 'Galway', lat: 91, lng: -9.0568 }).success
    ).toBe(false);
  });

  it('rejects missing address entirely', () => {
    expect(venueOnboardingStep2Schema.safeParse({}).success).toBe(false);
  });

  it('rejects bio longer than 50 characters', () => {
    expect(
      venueOnboardingStep2Schema.safeParse({
        address: 'Galway',
        lat: 53.2707,
        lng: -9.0568,
        bio: 'a'.repeat(51),
      }).success
    ).toBe(false);
  });
});

describe('venueOnboardingStep3Schema', () => {
  it('accepts missing venueLinks entirely', () => {
    expect(venueOnboardingStep3Schema.safeParse({}).success).toBe(true);
  });

  it('accepts a mix of filled and empty links', () => {
    expect(
      venueOnboardingStep3Schema.safeParse({
        venueLinks: {
          WEBSITE: 'https://thecobblestone.ie',
          INSTAGRAM: '',
          FACEBOOK: '',
          TWITTER: '',
        },
      }).success
    ).toBe(true);
  });

  it('rejects malformed URL in any link', () => {
    expect(
      venueOnboardingStep3Schema.safeParse({ venueLinks: { WEBSITE: 'not-a-url' } }).success
    ).toBe(false);
  });
});

describe('Onboarding schema equivalence (server contract)', () => {
  // Pinned regression tests: a payload + its expected parsed output. If the
  // per-step schemas drift from the prior flat shape, these break.

  it('artist — full payload parses to expected shape', () => {
    const result = createArtistOnboardingSchema.safeParse({
      stageName: '  Seán Ó Murchú  ',
      bio: '  Trad fiddle.  ',
      contactEmail: 'sean@music.ie',
      socialLinks: {
        INSTAGRAM: 'https://instagram.com/sean',
        FACEBOOK: '',
        TIKTOK: '',
        YOUTUBE: '',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        stageName: 'Seán Ó Murchú',
        bio: 'Trad fiddle.',
        contactEmail: 'sean@music.ie',
        socialLinks: {
          INSTAGRAM: 'https://instagram.com/sean',
          FACEBOOK: '',
          TIKTOK: '',
          YOUTUBE: '',
        },
      });
    }
  });

  it('artist — minimal payload parses to {stageName} only', () => {
    const result = createArtistOnboardingSchema.safeParse({ stageName: 'Seán' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ stageName: 'Seán' });
  });

  it('artist — profileImageUrl is silently stripped (M10 deferral preserved)', () => {
    const result = createArtistOnboardingSchema.safeParse({
      stageName: 'Seán',
      profileImageUrl: 'https://cdn.ceolx.ie/x.jpg',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ stageName: 'Seán' });
      expect('profileImageUrl' in result.data).toBe(false);
    }
  });

  it('venue — full payload parses to expected shape', () => {
    const result = createVenueOnboardingSchema.safeParse({
      venueName: '  The Cobblestone  ',
      address: '  77 King St N, Smithfield, Dublin  ',
      lat: 53.3498,
      lng: -6.2603,
      bio: '  Trad sessions nightly  ',
      contactEmail: 'hello@cobblestone.ie',
      venueLinks: {
        WEBSITE: 'https://thecobblestone.ie',
        INSTAGRAM: '',
        FACEBOOK: '',
        TWITTER: '',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        venueName: 'The Cobblestone',
        address: '77 King St N, Smithfield, Dublin',
        lat: 53.3498,
        lng: -6.2603,
        bio: 'Trad sessions nightly',
        contactEmail: 'hello@cobblestone.ie',
        venueLinks: {
          WEBSITE: 'https://thecobblestone.ie',
          INSTAGRAM: '',
          FACEBOOK: '',
          TWITTER: '',
        },
      });
    }
  });

  it('venue — minimal payload parses to {venueName, address, lat, lng}', () => {
    const result = createVenueOnboardingSchema.safeParse({
      venueName: 'The Cobblestone',
      address: 'Dublin',
      lat: 53.3498,
      lng: -6.2603,
    });
    expect(result.success).toBe(true);
    if (result.success)
      expect(result.data).toEqual({
        venueName: 'The Cobblestone',
        address: 'Dublin',
        lat: 53.3498,
        lng: -6.2603,
      });
  });

  it('venue — profileImageUrl is silently stripped (M10 deferral preserved)', () => {
    const result = createVenueOnboardingSchema.safeParse({
      venueName: 'The Cobblestone',
      address: 'Dublin',
      lat: 53.3498,
      lng: -6.2603,
      profileImageUrl: 'https://cdn.ceolx.ie/x.jpg',
    });
    expect(result.success).toBe(true);
    if (result.success) expect('profileImageUrl' in result.data).toBe(false);
  });
});

describe('removeEventSchema', () => {
  it('accepts a reason of sufficient length', () => {
    expect(
      removeEventSchema.safeParse({ removalReason: 'This event is not Irish music.' }).success
    ).toBe(true);
  });

  it('rejects reason shorter than 10 characters', () => {
    expect(removeEventSchema.safeParse({ removalReason: 'Too short' }).success).toBe(false);
  });

  it('rejects empty reason', () => {
    expect(removeEventSchema.safeParse({ removalReason: '' }).success).toBe(false);
  });
});

describe('adminEventListQuerySchema', () => {
  it('accepts an empty input and applies defaults', () => {
    const result = adminEventListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('active');
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
      expect(result.data.persona).toBeUndefined();
      expect(result.data.q).toBeUndefined();
    }
  });

  it('accepts a fully specified valid input', () => {
    expect(
      adminEventListQuerySchema.safeParse({
        status: 'removed',
        persona: 'venue',
        q: 'trad session',
        limit: 50,
        offset: 40,
      }).success
    ).toBe(true);
  });

  it('rejects invalid status values', () => {
    expect(adminEventListQuerySchema.safeParse({ status: 'pending_review' }).success).toBe(false);
  });

  it('rejects invalid persona values', () => {
    expect(adminEventListQuerySchema.safeParse({ persona: 'spectator' }).success).toBe(false);
  });

  it('rejects limit greater than 50', () => {
    expect(adminEventListQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
  });

  it('rejects negative offset', () => {
    expect(adminEventListQuerySchema.safeParse({ offset: -1 }).success).toBe(false);
  });

  it('rejects non-integer limit', () => {
    expect(adminEventListQuerySchema.safeParse({ limit: 1.5 }).success).toBe(false);
  });

  it('rejects q longer than 100 characters', () => {
    expect(adminEventListQuerySchema.safeParse({ q: 'a'.repeat(101) }).success).toBe(false);
  });
});

describe('adminRemoveEventSchema', () => {
  const validId = '550e8400-e29b-41d4-a716-446655440000';

  it('accepts a valid uuid + sufficient reason', () => {
    expect(
      adminRemoveEventSchema.safeParse({
        id: validId,
        removalReason: 'Event location is outside Ireland.',
      }).success
    ).toBe(true);
  });

  it('rejects a non-uuid id', () => {
    const result = adminRemoveEventSchema.safeParse({
      id: 'not-a-uuid',
      removalReason: 'Valid reason here.',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path.join('.'))).toContain('id');
    }
  });

  it('rejects reason shorter than 10 characters', () => {
    expect(
      adminRemoveEventSchema.safeParse({ id: validId, removalReason: 'Too short' }).success
    ).toBe(false);
  });

  it('rejects reason longer than 500 characters', () => {
    expect(
      adminRemoveEventSchema.safeParse({
        id: validId,
        removalReason: 'a'.repeat(501),
      }).success
    ).toBe(false);
  });
});
