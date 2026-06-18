/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
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
    adDescription: '50% off early bird tickets',
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

  it('renders the ad description text when present', () => {
    expect(collectText(OfferBlock(baseProps))).toContain('50% off early bird tickets');
  });

  it('omits the description line when adDescription is empty/whitespace', () => {
    expect(collectText(OfferBlock({ ...baseProps, adDescription: '   ' }))).not.toContain('   ');
  });

  it('does not crash when adDescription is null', () => {
    expect(OfferBlock({ ...baseProps, adDescription: null })).not.toBeNull();
  });
});

// Walks the returned element tree and concatenates every string child.
function collectText(node: any): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  const children = node.props?.children;
  const arr = Array.isArray(children) ? children.flat(Infinity) : [children];
  return arr.map(collectText).join(' ');
}
