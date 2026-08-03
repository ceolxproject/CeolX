import { Image } from 'react-native';

import {
  clampFeedRatio,
  DETAIL_MIN_RATIO,
  FALLBACK_RATIO,
  useImageRatio,
} from '@/hooks/use-image-ratio';

type Props = {
  uri: string;
  /**
   * Detail-screen mode: render at the image's true ratio, floored only against
   * the pathological. The feed clamps both ways instead, so one very tall poster
   * can't swallow the scroll.
   */
  expanded?: boolean;
};

/**
 * Post image renderer. Both the feed and the detail screen size the container
 * to the image's own aspect ratio, so `cover` reveals the whole poster rather
 * than cropping it — gig posters are portrait, and the fixed 16:9 feed card
 * this replaced hid up to two thirds of them.
 */
export function PostImage({ uri, expanded }: Props) {
  const natural = useImageRatio(uri);

  let ratio = FALLBACK_RATIO;
  if (natural !== null) {
    ratio = expanded ? Math.max(natural, DETAIL_MIN_RATIO) : clampFeedRatio(natural);
  }

  return (
    <Image
      source={{ uri }}
      style={{ aspectRatio: ratio }}
      className="mb-3 w-full rounded-xl bg-white/5"
      resizeMode="cover"
    />
  );
}
