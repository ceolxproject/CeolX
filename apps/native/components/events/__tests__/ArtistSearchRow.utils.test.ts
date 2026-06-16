import { describe, expect, it } from 'vitest';

import { getArtistRowSubtitle } from '../ArtistSearchRow.utils';

describe('getArtistRowSubtitle', () => {
  it('shows the account name and genre when the account name differs from the stage name', () => {
    // Vivek performs as "Tune Bomb" — show both so searching "Vivek" isn't confusing.
    expect(getArtistRowSubtitle({ name: 'Vivek', stageName: 'Tune Bomb', genre: 'Rock' })).toBe(
      'Vivek · Rock'
    );
  });

  it('omits the account name when it equals the stage name', () => {
    expect(getArtistRowSubtitle({ name: 'Echo', stageName: 'Echo', genre: 'Trad' })).toBe('Trad');
  });

  it('shows only the account name when there is no genre', () => {
    expect(getArtistRowSubtitle({ name: 'Vivek', stageName: 'Tune Bomb', genre: null })).toBe(
      'Vivek'
    );
  });

  it('returns null when the account name matches the stage name and there is no genre', () => {
    expect(getArtistRowSubtitle({ name: 'Echo', stageName: 'Echo', genre: null })).toBeNull();
  });

  it('falls back to the genre when the account name is null', () => {
    expect(getArtistRowSubtitle({ name: null, stageName: 'Tune Bomb', genre: 'Rock' })).toBe(
      'Rock'
    );
  });
});
