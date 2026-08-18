import { describe, expect, it } from 'vitest';

import { BILLING_INTERVALS } from '../../enums.js';
import {
  activateQuerySchema,
  activationTokenSchema,
  billingIntervalSchema,
  createCheckoutSessionSchema,
} from '../subscriptions.js';

const VALID_TOKEN = 'a'.repeat(43); // base64url of 32 random bytes is 43 chars

describe('billingIntervalSchema', () => {
  it('accepts exactly the two intervals and nothing else', () => {
    for (const interval of BILLING_INTERVALS) {
      expect(billingIntervalSchema.parse(interval)).toBe(interval);
    }
    expect(billingIntervalSchema.safeParse('weekly').success).toBe(false);
    expect(billingIntervalSchema.safeParse('MONTHLY').success).toBe(false);
    expect(billingIntervalSchema.safeParse('').success).toBe(false);
  });

  it('rejects a Stripe Price ID — the wire value is an interval, never an id (D-08)', () => {
    // The whole point of the allowlist: a crafted activation link must not be
    // able to steer checkout at an arbitrary Price.
    expect(billingIntervalSchema.safeParse('price_1234567890abcdef').success).toBe(false);
  });
});

describe('activationTokenSchema', () => {
  it('accepts a base64url token of realistic length', () => {
    expect(activationTokenSchema.parse(VALID_TOKEN)).toBe(VALID_TOKEN);
    expect(activationTokenSchema.safeParse('Aa0-_'.repeat(10)).success).toBe(true);
  });

  it('rejects anything shorter than the floor', () => {
    expect(activationTokenSchema.safeParse('a'.repeat(31)).success).toBe(false);
    expect(activationTokenSchema.safeParse('').success).toBe(false);
  });

  it('rejects an over-long value rather than carrying it further', () => {
    expect(activationTokenSchema.safeParse('a'.repeat(257)).success).toBe(false);
  });

  it.each([
    ['SQL meta-characters', `${'a'.repeat(40)}' OR 1=1--`],
    ['a path separator', `${'a'.repeat(40)}/../etc/passwd`],
    ['angle brackets', `${'a'.repeat(40)}<script>`],
    ['a percent escape', `${'a'.repeat(40)}%2e%2e`],
    ['whitespace', `${'a'.repeat(40)} ${'b'.repeat(10)}`],
    ['a newline', `${'a'.repeat(40)}\n`],
    ['base64 padding and plus', `${'a'.repeat(40)}+b/c=`],
  ])('rejects %s', (_label, value) => {
    expect(activationTokenSchema.safeParse(value).success).toBe(false);
  });
});

describe('activateQuerySchema', () => {
  it('accepts a well-formed activation link query', () => {
    expect(activateQuerySchema.parse({ token: VALID_TOKEN, plan: 'annual' })).toEqual({
      token: VALID_TOKEN,
      plan: 'annual',
    });
  });

  it('requires a plan — the token carries none (D-63), so a link without one is unresolvable', () => {
    expect(activateQuerySchema.safeParse({ token: VALID_TOKEN }).success).toBe(false);
  });

  it('requires a token', () => {
    expect(activateQuerySchema.safeParse({ plan: 'monthly' }).success).toBe(false);
  });
});

describe('createCheckoutSessionSchema', () => {
  it('takes only the interval — the venue comes from the session, never the caller', () => {
    expect(createCheckoutSessionSchema.parse({ plan: 'monthly' })).toEqual({ plan: 'monthly' });
  });

  it('strips a caller-supplied venue id rather than trusting it', () => {
    // Guards against one venue opening a checkout for another. Zod objects strip
    // unknown keys by default; this pins that the schema was not written with
    // .passthrough() and that no venue identifier was ever added to the input.
    const parsed = createCheckoutSessionSchema.parse({
      plan: 'monthly',
      venueId: '00000000-0000-0000-0000-000000000000',
      venueProfileId: 'someone-else',
    });
    expect(parsed).toEqual({ plan: 'monthly' });
    expect(parsed).not.toHaveProperty('venueId');
    expect(parsed).not.toHaveProperty('venueProfileId');
  });
});
