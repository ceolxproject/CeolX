import { describe, expect, it, vi } from 'vitest';

// The module only needs Image.getSize at runtime; the clamp itself is pure.
vi.mock('react-native', () => ({ Image: { getSize: vi.fn() } }));

const { clampFeedRatio, FEED_MAX_RATIO, FEED_MIN_RATIO } = await import('../use-image-ratio');

/**
 * Every distinct image ratio in production on 2026-08-03, measured off the
 * actual S3/CloudFront files. The bounds exist to stop a pathological banner,
 * not to crop real posters — if a future change starts cropping any of these,
 * this fails.
 */
const PRODUCTION_RATIOS = [
  { ratio: 1080 / 1920, label: '9:16 story graphic (tallest in prod)' },
  { ratio: 864 / 1261, label: 'A4 gig poster' },
  { ratio: 1080 / 1350, label: '4:5 portrait' },
  { ratio: 386 / 390, label: 'near-square' },
  { ratio: 1203 / 1203, label: 'square' },
  { ratio: 4032 / 3024, label: '4:3 photo' },
  { ratio: 1280 / 853, label: '3:2 photo' },
  { ratio: 1080 / 714, label: 'landscape' },
  { ratio: 1080 / 608, label: '16:9 cover' },
  { ratio: 2000 / 1126, label: '16:9 cover (widest in prod)' },
];

describe('clampFeedRatio', () => {
  it.each(PRODUCTION_RATIOS)('leaves $label uncropped', ({ ratio }) => {
    expect(clampFeedRatio(ratio)).toBeCloseTo(ratio, 5);
  });

  it('bounds an image taller than the floor', () => {
    expect(clampFeedRatio(1 / 4)).toBe(FEED_MIN_RATIO);
  });

  it('bounds an image wider than the ceiling', () => {
    expect(clampFeedRatio(5)).toBe(FEED_MAX_RATIO);
  });
});
