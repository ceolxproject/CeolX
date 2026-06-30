/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Image: 'Image',
  Text: 'Text',
  View: 'View',
}));

import { AdHeadline } from '../../ads/AdHeadline';
import { OfferBlock } from '../OfferBlock';

describe('OfferBlock', () => {
  const baseProps = {
    adTitle: 'Flat 50% Off',
    adDescription: '50% off early bird tickets',
    eventTitle: 'The Bodhrán Buzz',
    coverImage: null,
  };

  it('renders null only when both adTitle and adDescription are empty', () => {
    expect(OfferBlock({ ...baseProps, adTitle: '', adDescription: '' })).toBeNull();
    expect(OfferBlock({ ...baseProps, adTitle: null, adDescription: null })).toBeNull();
    expect(OfferBlock({ ...baseProps, adTitle: '   ', adDescription: '  ' })).toBeNull();
  });

  it('renders the ad using the description alone when adTitle is empty', () => {
    const el = OfferBlock({ ...baseProps, adTitle: '' });
    expect(el).not.toBeNull();
    // Description still shown…
    expect(collectText(el)).toContain('50% off early bird tickets');
    // …and the headline is delegated to AdHeadline with the empty title + event title.
    const headline = findByType(el, AdHeadline);
    expect(headline).toBeDefined();
    expect(headline.props.adTitle).toBe('');
    expect(headline.props.eventTitle).toBe('The Bodhrán Buzz');
  });

  it('passes adTitle + eventTitle to the headline when adTitle is present', () => {
    const headline = findByType(OfferBlock(baseProps), AdHeadline);
    expect(headline).toBeDefined();
    expect(headline.props.adTitle).toBe('Flat 50% Off');
    expect(headline.props.eventTitle).toBe('The Bodhrán Buzz');
  });

  it('renders the ad description text when present', () => {
    expect(collectText(OfferBlock(baseProps))).toContain('50% off early bird tickets');
  });

  it('omits the description line when adDescription is empty/whitespace but title exists', () => {
    expect(leafStrings(OfferBlock({ ...baseProps, adDescription: '   ' }))).not.toContain('   ');
  });

  it('does not crash when adDescription is null but title exists', () => {
    expect(OfferBlock({ ...baseProps, adDescription: null })).not.toBeNull();
  });
});

// Walks the returned element tree and concatenates every string child.
function collectText(node: any): string {
  return leafStrings(node).join(' ');
}

// Collects each string/number leaf as a separate entry (no joining).
function leafStrings(node: any): string[] {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  const children = node.props?.children;
  const arr = Array.isArray(children) ? children.flat(Infinity) : [children];
  return arr.flatMap(leafStrings);
}

// Finds the first element in the tree whose type is the given component.
function findByType(node: any, type: unknown): any {
  if (!node || typeof node !== 'object') return undefined;
  if (node.type === type) return node;
  const children = node.props?.children;
  const arr = Array.isArray(children) ? children.flat(Infinity) : [children];
  for (const child of arr) {
    const found = findByType(child, type);
    if (found) return found;
  }
  return undefined;
}
