import { describe, expect, it } from 'vitest';

import { normalizeOptionalUrl } from '../normalize-url';

describe('normalizeOptionalUrl', () => {
  it('returns undefined for empty or whitespace-only input', () => {
    expect(normalizeOptionalUrl(undefined)).toBeUndefined();
    expect(normalizeOptionalUrl('')).toBeUndefined();
    expect(normalizeOptionalUrl('   ')).toBeUndefined();
  });

  it('prepends https:// when no protocol is present', () => {
    expect(normalizeOptionalUrl('instagram.com/tara')).toBe('https://instagram.com/tara');
    expect(normalizeOptionalUrl('  facebook.com/me  ')).toBe('https://facebook.com/me');
  });

  it('preserves existing http and https schemes', () => {
    expect(normalizeOptionalUrl('https://instagram.com/tara')).toBe('https://instagram.com/tara');
    expect(normalizeOptionalUrl('http://venue.example')).toBe('http://venue.example');
  });

  it('is case-insensitive for the protocol check', () => {
    expect(normalizeOptionalUrl('HTTPS://Foo.com')).toBe('HTTPS://Foo.com');
  });
});
