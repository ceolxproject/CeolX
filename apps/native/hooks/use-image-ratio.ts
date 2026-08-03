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

/**
 * Detail-screen floor — roughly 1:3.6. The detail screen scrolls, so it shows
 * the true ratio and needs no feed bounds; this exists only so one pathological
 * upload can't turn the screen into an endless strip of a single image. The
 * tallest thing in production is 9:16 (0.5625), so it is well clear of anything
 * real and is not meant to shape ordinary posters.
 */
export const DETAIL_MIN_RATIO = FEED_MIN_RATIO / 2;

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

// A URI already being measured must not be measured again. Both the page prefetch
// and each card's own hook ask for the same image, and the feed re-prefetches
// whenever the posts array identity changes — pagination, a refetch, even an
// optimistic like patch. Since `cache` is only written on success, that meant
// several concurrent Image.getSize fetches for one image. Failures are left
// retryable (a transient error shouldn't pin a wrong ratio for the session), and
// this guard is what stops a retry storm.
const inFlight = new Map<string, Promise<number | null>>();

function measure(uri: string): Promise<number | null> {
  const hit = cache.get(uri);
  if (hit !== undefined) return Promise.resolve(hit);

  const pending = inFlight.get(uri);
  if (pending) return pending;

  const promise = new Promise<number | null>((resolve) => {
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
  }).finally(() => {
    inFlight.delete(uri);
  });

  inFlight.set(uri, promise);
  return promise;
}

/**
 * Warm the cache for a whole page of media before its cards mount, so the
 * common case renders at the right height first time rather than resizing
 * under the user. Fire-and-forget.
 */
export function prefetchImageRatios(uris: (string | null | undefined)[]): void {
  for (const uri of uris) {
    if (uri) void measure(uri);
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
