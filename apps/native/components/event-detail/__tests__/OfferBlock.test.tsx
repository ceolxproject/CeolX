import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Text: 'Text',
  View: 'View',
}));

import { OfferBlock } from '../OfferBlock';

describe('OfferBlock', () => {
  it('renders null when title is empty', () => {
    expect(OfferBlock({ title: '', description: 'x' })).toBeNull();
  });

  it('renders null when title is null', () => {
    expect(OfferBlock({ title: null, description: 'x' })).toBeNull();
  });

  it('renders a section element when title is non-empty', () => {
    const node = OfferBlock({ title: 'Flat 50% Off', description: 'Tonight only' });
    expect(node).not.toBeNull();
  });
});
