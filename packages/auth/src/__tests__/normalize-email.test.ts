import { describe, expect, it } from 'vitest';

import { normalizeEmail } from '../normalize-email.js';

describe('normalizeEmail', () => {
  it('lowercases and trims so signup/login agree on one key', () => {
    expect(normalizeEmail('  Foo@Example.COM ')).toBe('foo@example.com');
  });

  it('keeps the +tag sub-address so plus-addressed accounts stay independent', () => {
    // a+artist@x.com and a+venue@x.com must remain distinct accounts
    // (Asana 1215700058851867).
    expect(normalizeEmail('A+Artist@Domain.com')).toBe('a+artist@domain.com');
    expect(normalizeEmail('a+artist@domain.com')).not.toBe(normalizeEmail('a+venue@domain.com'));
  });

  it('returns undefined for non-strings and blank input so callers defer to Better Auth validation', () => {
    expect(normalizeEmail(undefined)).toBeUndefined();
    expect(normalizeEmail(null)).toBeUndefined();
    expect(normalizeEmail(123)).toBeUndefined();
    expect(normalizeEmail('   ')).toBeUndefined();
  });

  it('is idempotent', () => {
    const once = normalizeEmail('Foo@Example.com');
    expect(normalizeEmail(once)).toBe(once);
  });
});
