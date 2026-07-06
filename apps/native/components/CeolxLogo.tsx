import { Image } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const logoSource = require('@/assets/images/ceolx-logo.png') as number;

// Logo asset is 16:9.
const ASPECT_RATIO = 16 / 9;

interface CeolxLogoProps {
  /**
   * Nominal logo size in px. Render height = size × 1.5 (the legacy wordmark
   * ratio), so call sites keep the scale they had when this was a text wordmark.
   */
  size?: number;
}

/** CeolX icon + wordmark logo. Replaces the old purple→white gradient text. */
export function CeolxLogo({ size = 22 }: CeolxLogoProps) {
  // Floor keeps the logo legible in compact headers, where the small sizes
  // (18–22) would otherwise render an icon + wordmark too small to read.
  const height = Math.max(size * 1.5, 44);
  return (
    <Image
      source={logoSource}
      style={{ height, width: height * ASPECT_RATIO }}
      resizeMode="contain"
      accessibilityLabel="CeolX"
    />
  );
}
