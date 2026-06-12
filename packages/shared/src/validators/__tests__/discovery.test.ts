import { describe, expect, it } from 'vitest';

import { suggestSchema } from '../discovery.js';

describe('suggestSchema', () => {
  it('accepts a query and defaults scope to events', () => {
    const result = suggestSchema.safeParse({ q: 'tune' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.scope).toBe('events');
  });

  it('trims surrounding whitespace from the query', () => {
    const result = suggestSchema.safeParse({ q: '  galway  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.q).toBe('galway');
  });

  it('rejects an empty query', () => {
    expect(suggestSchema.safeParse({ q: '' }).success).toBe(false);
  });

  it('rejects a whitespace-only query', () => {
    expect(suggestSchema.safeParse({ q: '   ' }).success).toBe(false);
  });

  it('rejects a query longer than 100 characters', () => {
    expect(suggestSchema.safeParse({ q: 'a'.repeat(101) }).success).toBe(false);
  });

  it('accepts an explicit posts scope', () => {
    const result = suggestSchema.safeParse({ q: 'tune', scope: 'posts' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.scope).toBe('posts');
  });

  it('rejects an unknown scope', () => {
    expect(suggestSchema.safeParse({ q: 'tune', scope: 'venues' }).success).toBe(false);
  });
});
