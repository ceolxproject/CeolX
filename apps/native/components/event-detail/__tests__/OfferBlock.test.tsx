import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Image: 'Image',
  Text: 'Text',
  View: 'View',
}));

import { OfferBlock } from '../OfferBlock';

describe('OfferBlock', () => {
  const baseProps = {
    adTitle: 'Flat 50% Off',
    eventTitle: 'The Bodhrán Buzz',
    coverImage: null,
  };

  it('renders null when adTitle is empty', () => {
    expect(OfferBlock({ ...baseProps, adTitle: '' })).toBeNull();
  });

  it('renders null when adTitle is null', () => {
    expect(OfferBlock({ ...baseProps, adTitle: null })).toBeNull();
  });

  it('renders a section element when adTitle is non-empty', () => {
    expect(OfferBlock(baseProps)).not.toBeNull();
  });
});
