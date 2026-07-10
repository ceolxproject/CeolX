import { describe, expect, it } from 'vitest';

import { nextCollapseProgress, SCROLL_JITTER } from '../collapsing-header';

const THRESHOLD = 200;

describe('nextCollapseProgress', () => {
  it('shows the header at the top of the list', () => {
    expect(nextCollapseProgress(0, 50, THRESHOLD, 1)).toBe(0);
    expect(nextCollapseProgress(-10, 0, THRESHOLD, 1)).toBe(0); // overscroll bounce
  });

  it('collapses on a downward scroll once past the threshold', () => {
    expect(nextCollapseProgress(THRESHOLD + 50, THRESHOLD + 40, THRESHOLD, 0)).toBe(1);
  });

  it('stays shown while still scrolling through the sliding part', () => {
    expect(nextCollapseProgress(THRESHOLD - 20, THRESHOLD - 40, THRESHOLD, 0)).toBe(0);
  });

  it('reveals on any real upward scroll', () => {
    expect(nextCollapseProgress(500, 520, THRESHOLD, 1)).toBe(0);
  });

  it('holds position for sub-threshold jitter', () => {
    // tiny down move (< jitter) keeps whatever it was (collapsed)
    expect(nextCollapseProgress(300 + SCROLL_JITTER - 1, 300, THRESHOLD, 1)).toBe(1);
    // tiny up move (< jitter) keeps whatever it was (shown)
    expect(nextCollapseProgress(300, 300 + SCROLL_JITTER - 1, THRESHOLD, 0)).toBe(0);
  });
});
