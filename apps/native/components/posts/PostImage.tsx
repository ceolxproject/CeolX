import { useEffect, useState } from 'react';
import { Image } from 'react-native';

type Props = {
  uri: string;
  /**
   * Detail-screen mode: render the image uncropped at its natural aspect ratio
   * so the whole image is viewable. In preview mode (feed/list) the image stays
   * a cropped 16:9 card so cards keep a consistent height.
   */
  expanded?: boolean;
};

/** Feed preview crop and the fallback ratio while natural dimensions resolve. */
const PREVIEW_RATIO = 16 / 9;
/**
 * Floor for very tall portrait images so an extreme aspect ratio can't fill
 * several screens. The detail view scrolls, so this is just a guardrail.
 */
const MIN_RATIO = 0.6;

/**
 * Post image renderer. The feed shows a cropped 16:9 preview; the detail screen
 * (`expanded`) shows the full, uncropped image. RN's <Image> needs an explicit
 * aspect ratio to size itself without cropping, so we resolve the image's
 * natural dimensions via Image.getSize and drive the container ratio from them —
 * with the container ratio equal to the image ratio, `cover` reveals the whole
 * image with no crop.
 */
export function PostImage({ uri, expanded }: Props) {
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    if (!expanded) return;
    let active = true;
    Image.getSize(
      uri,
      (w, h) => {
        if (active && h > 0) setRatio(Math.max(w / h, MIN_RATIO));
      },
      () => {
        // On failure fall back to the preview ratio rather than leaving a gap.
        if (active) setRatio(PREVIEW_RATIO);
      }
    );
    return () => {
      active = false;
    };
  }, [uri, expanded]);

  if (!expanded) {
    return (
      <Image
        source={{ uri }}
        className="mb-3 aspect-video w-full rounded-xl bg-white/5"
        resizeMode="cover"
      />
    );
  }

  return (
    <Image
      source={{ uri }}
      style={{ aspectRatio: ratio ?? PREVIEW_RATIO }}
      className="mb-3 w-full rounded-xl bg-white/5"
      resizeMode="cover"
    />
  );
}
