// Below this many px of movement we treat the scroll as jitter and hold
// position, so a resting finger's micro-scrolls don't flicker the header.
export const SCROLL_JITTER = 6;

/**
 * Decide the target collapse progress for one scroll frame.
 * Returns 0 = header shown, 1 = header collapsed. A single progress drives both
 * the sliding part (location + search) and the pinned tab strip, each by its
 * own distance.
 *
 * Reading comes first, so:
 * - At/above the top → always shown (also covers overscroll bounce, y < 0).
 * - Scrolling down, once past the sliding part's height → collapse.
 * - Scrolling up beyond the jitter threshold → bring it back.
 * - Anything smaller → leave it where it is.
 */
export function nextCollapseProgress(
  y: number,
  lastY: number,
  threshold: number,
  current: number
): number {
  'worklet';
  if (y <= 0) return 0;
  const dy = y - lastY;
  if (dy > SCROLL_JITTER && y > threshold) return 1;
  if (dy < -SCROLL_JITTER) return 0;
  return current;
}
