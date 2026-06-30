/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Text: 'Text',
}));

import { AdHeadline } from '../AdHeadline';

describe('AdHeadline', () => {
  it('renders "<title> on <event>" when adTitle is present', () => {
    const text = collectText(AdHeadline({ adTitle: 'Flat 50% Off', eventTitle: 'Summer Fest' }));
    expect(text).toContain('Flat 50% Off');
    expect(text).toMatch(/\bon\b/);
    expect(text).toContain('Summer Fest');
  });

  it('falls back to just the event title when adTitle is empty', () => {
    const text = collectText(AdHeadline({ adTitle: '', eventTitle: 'Summer Fest' }));
    expect(text).toContain('Summer Fest');
    expect(text).not.toMatch(/\bon\b/);
    expect(text).not.toContain('null');
    expect(text).not.toContain('undefined');
  });

  it('falls back to just the event title when adTitle is null or whitespace', () => {
    expect(collectText(AdHeadline({ adTitle: null, eventTitle: 'Summer Fest' }))).not.toMatch(
      /\bon\b/
    );
    expect(collectText(AdHeadline({ adTitle: '   ', eventTitle: 'Summer Fest' }))).not.toMatch(
      /\bon\b/
    );
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
