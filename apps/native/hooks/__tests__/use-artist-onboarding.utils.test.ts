import { describe, expect, it } from 'vitest';

import { STAGE_NAME_MAX, initialStageName } from '../use-artist-onboarding.utils';

describe('initialStageName', () => {
  it('pre-fills the stage name from the account name', () => {
    expect(initialStageName('Vivek')).toBe('Vivek');
  });

  it('returns an empty string when the account name is missing', () => {
    expect(initialStageName(null)).toBe('');
    expect(initialStageName(undefined)).toBe('');
  });

  it('caps the pre-filled value at the stage-name length limit', () => {
    const result = initialStageName('a'.repeat(STAGE_NAME_MAX + 50));
    expect(result).toHaveLength(STAGE_NAME_MAX);
  });
});
