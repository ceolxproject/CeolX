/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Image: 'Image',
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
}));

import { AdCard } from '../AdCard';

describe('AdCard', () => {
  const baseProps = {
    id: 'evt-1',
    adTitle: 'Flat 50% Off',
    adDescription: '50% off early bird tickets',
    eventTitle: 'The Bodhrán Buzz',
    coverImage: null,
    onDismiss: vi.fn(),
    onPress: vi.fn(),
  };

  it('renders without crashing', () => {
    const el = AdCard(baseProps);
    expect(el).toBeTruthy();
  });

  it('renders the ad description text when present', () => {
    expect(collectText(AdCard(baseProps))).toContain('50% off early bird tickets');
  });

  it('omits the description line when adDescription is null', () => {
    const el = AdCard({ ...baseProps, adDescription: null });
    expect(el).toBeTruthy();
    expect(collectText(el)).not.toContain('50% off early bird tickets');
  });

  it('passes the ad id to onDismiss when the dismiss handler fires', () => {
    const onDismiss = vi.fn();
    const node: any = AdCard({ ...baseProps, onDismiss });
    const dismissBtn = findByA11yLabel(node, 'Dismiss ad');
    expect(dismissBtn).toBeDefined();
    dismissBtn.props.onPress();
    expect(onDismiss).toHaveBeenCalledWith('evt-1');
  });

  it('passes the ad id to onPress when view details is tapped', () => {
    const onPress = vi.fn();
    const node: any = AdCard({ ...baseProps, onPress });
    const viewBtn = findByA11yLabel(node, 'View ad details');
    viewBtn.props.onPress();
    expect(onPress).toHaveBeenCalledWith('evt-1');
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

function findByA11yLabel(node: any, label: string): any {
  if (!node) return undefined;
  if (node.props?.accessibilityLabel === label) return node;
  const children = Array.isArray(node.props?.children)
    ? node.props.children.flat()
    : [node.props?.children];
  for (const child of children) {
    const found = findByA11yLabel(child, label);
    if (found) return found;
  }
  return undefined;
}
