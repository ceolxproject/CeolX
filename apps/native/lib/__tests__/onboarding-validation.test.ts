import { describe, expect, it } from 'vitest';

import { computeStepErrors } from '../onboarding-validation';

/** Minimal stand-ins for zod's safeParse result — enough for the pure reducer. */
const ok = { success: true as const };
const fail = (...issues: { path: (string | number)[]; message: string }[]) => ({
  success: false as const,
  error: { issues },
});

describe('computeStepErrors', () => {
  it('surfaces an error only for a touched, invalid field', () => {
    const next = computeStepErrors({
      result: fail({ path: ['venueName'], message: 'Venue name is required' }),
      stepFields: ['venueName', 'contactEmail'],
      touched: new Set(['venueName']),
      prevErrors: {},
    });

    expect(next).toEqual({ venueName: 'Venue name is required' });
  });

  it('does not surface an error for an invalid field that has not been touched', () => {
    const next = computeStepErrors({
      result: fail({ path: ['venueName'], message: 'Venue name is required' }),
      stepFields: ['venueName', 'contactEmail'],
      touched: new Set(),
      prevErrors: {},
    });

    expect(next).toEqual({});
  });

  // The bug: a touched field that had failed must lose its error the moment
  // its value becomes valid — even while the user is still typing.
  it('clears a previously-set error once the field becomes valid', () => {
    const next = computeStepErrors({
      result: ok,
      stepFields: ['venueName', 'contactEmail'],
      touched: new Set(['venueName']),
      prevErrors: { venueName: 'Venue name is required' },
    });

    expect(next).toEqual({});
  });

  it("leaves other steps' errors untouched", () => {
    const next = computeStepErrors({
      result: ok,
      stepFields: ['venueName', 'contactEmail'],
      touched: new Set(['venueName', 'bio']),
      prevErrors: { venueName: 'Venue name is required', bio: 'Bio is too long' },
    });

    expect(next).toEqual({ bio: 'Bio is too long' });
  });

  it('joins nested issue paths with a dot', () => {
    const next = computeStepErrors({
      result: fail({ path: ['venueLinks', 'WEBSITE'], message: 'Enter a valid URL' }),
      stepFields: ['venueLinks.WEBSITE'],
      touched: new Set(['venueLinks.WEBSITE']),
      prevErrors: {},
    });

    expect(next).toEqual({ 'venueLinks.WEBSITE': 'Enter a valid URL' });
  });
});
