import { describe, it, expect } from 'vitest';

import { generateSlug, truncate, capitalize } from '../string.js';

describe('generateSlug', () => {
  it('converts spaces to hyphens', () => {
    expect(generateSlug('Trad Night')).toBe('trad-night');
  });

  it('removes special characters except hyphens', () => {
    expect(generateSlug("Trad Night at O'Brien's")).toBe('trad-night-at-obriens');
  });

  it('handles Irish fadas (accented characters)', () => {
    expect(generateSlug('Ó Briain')).toBe('o-briain');
    expect(generateSlug('Café na hÉireann')).toBe('cafe-na-heireann');
  });

  it('collapses multiple hyphens', () => {
    expect(generateSlug('hello---world')).toBe('hello-world');
  });

  it('trims leading/trailing hyphens', () => {
    expect(generateSlug('  hello world  ')).toBe('hello-world');
  });
});

describe('truncate', () => {
  it('returns unchanged text when under maxLength', () => {
    expect(truncate('Short text', 50)).toBe('Short text');
  });

  it('never cuts mid-word', () => {
    const result = truncate('The quick brown fox jumps over', 20);
    // Should end with ellipsis
    expect(result).toMatch(/…$/);
    // The cut must happen at a word boundary (space before the ellipsis or end of a complete word)
    // "The quick brown fox…" is valid: 'fox' is complete, cut at space after 'fox'
    const withoutEllipsis = result.slice(0, -1).trimEnd();
    const words = withoutEllipsis.split(' ');
    const lastWord = words[words.length - 1];
    // Every word before the ellipsis should match the original string's words
    const originalWords = 'The quick brown fox jumps over'.split(' ');
    expect(originalWords).toContain(lastWord);
  });

  it('returns the full text if no space found before maxLength', () => {
    // "superlongword" has no space, should still truncate gracefully
    const result = truncate('superlongwordthatexceedslimit', 10);
    expect(result.length).toBeLessThanOrEqual(11); // 10 + ellipsis
  });
});

describe('capitalize', () => {
  it('capitalizes first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
  });
});
