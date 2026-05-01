import { describe, expect, it } from 'vitest';

import { adminUsersListInputSchema, USER_SORT_FIELDS } from '../admin.js';

describe('adminUsersListInputSchema', () => {
  it('applies defaults when called with empty input', () => {
    const result = adminUsersListInputSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.sortBy).toBe('createdAt');
      expect(result.data.sortDir).toBe('desc');
      expect(result.data.search).toBeUndefined();
    }
  });

  it('accepts a fully specified payload', () => {
    const result = adminUsersListInputSchema.safeParse({
      page: 3,
      limit: 50,
      search: 'siobhan@',
      sortBy: 'email',
      sortDir: 'asc',
    });
    expect(result.success).toBe(true);
  });

  it('rejects page < 1', () => {
    const result = adminUsersListInputSchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer page', () => {
    const result = adminUsersListInputSchema.safeParse({ page: 1.5 });
    expect(result.success).toBe(false);
  });

  it('rejects limit > 100', () => {
    const result = adminUsersListInputSchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });

  it('rejects limit < 1', () => {
    const result = adminUsersListInputSchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });

  it('trims whitespace from search and treats empty string as undefined', () => {
    const result = adminUsersListInputSchema.safeParse({ search: '   ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.search).toBeUndefined();
    }
  });

  it('rejects an unknown sortBy field', () => {
    const result = adminUsersListInputSchema.safeParse({ sortBy: 'password' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown sortDir', () => {
    const result = adminUsersListInputSchema.safeParse({ sortDir: 'sideways' });
    expect(result.success).toBe(false);
  });

  it('exposes the supported sort fields', () => {
    expect(USER_SORT_FIELDS).toEqual(['name', 'email', 'createdAt', 'lastLoginAt']);
  });
});
