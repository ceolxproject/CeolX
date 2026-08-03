import { useEffect, useState } from 'react';
import { Image } from 'react-native';

/**
 * Feed bounds. Measured against every image in production: the tallest is a
 * 1080x1920 story graphic (9:16) and the widest is 1.779, so these bounds crop
 * nothing that exists today — they only stop a pathological banner from
 * swallowing several screens of feed.
 */
export const FEED_MIN_RATIO = 9 / 16;
export const FEED_MAX_RATIO = 1.91;

/** Used while the natural ratio resolves, and when it can't be read at all. */
export const FALLBACK_RATIO = 4 / 5;

export function clampFeedRatio(ratio: number): number {
  return Math.min(Math.max(ratio, FEED_MIN_RATIO), FEED_MAX_RATIO);
}

// Ratios outlive the card that measured them so a re-scrolled or re-opened
// image is sized correctly on first paint instead of jumping a second time.
// ponytail: unbounded Map — a session would need thousands of distinct images
// to matter; swap for an LRU if that ever becomes true.
const cache = new Map<string, number>();

function measure(uri: string): Promise<number | null> {
  const hit = cache.get(uri);
  if (hit !== undefined) return Promise.resolve(hit);

  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => {
        if (height <= 0) {
          resolve(null);
          return;
        }
        const ratio = width / height;
        cache.set(uri, ratio);
        resolve(ratio);
      },
      () => resolve(null)
    );
  });
}

/**
 * Warm the cache for a whole page of media before its cards mount, so the
 * common case renders at the right height first time rather than resizing
 * under the user. Fire-and-forget.
 */
export function prefetchImageRatios(uris: (string | null | undefined)[]): void {
  for (const uri of uris) {
    if (uri && !cache.has(uri)) void measure(uri);
  }
}

/**
 * Natural width/height of a remote or local image, or null until it resolves.
 * Callers pick their own fallback and bounds — the feed clamps, detail screens
 * show the true ratio.
 */
export function useImageRatio(uri: string | null | undefined): number | null {
  const [ratio, setRatio] = useState<number | null>(() => (uri ? (cache.get(uri) ?? null) : null));

  useEffect(() => {
    if (!uri) {
      setRatio(null);
      return;
    }

    const hit = cache.get(uri);
    if (hit !== undefined) {
      setRatio(hit);
      return;
    }

    let active = true;
    void measure(uri).then((resolved) => {
      if (active) setRatio(resolved);
    });
    return () => {
      active = false;
    };
  }, [uri]);

  return ratio;
}
