import logoSource from '@/assets/images/ceolx-logo.png';

interface CeolxLogoProps {
  size?: number;
  className?: string;
}

// Logo asset is 16:9.
const ASPECT_RATIO = 16 / 9;

/** CeolX icon + wordmark logo. Web counterpart of apps/native/components/CeolxLogo.tsx. */
export function CeolxLogo({ size = 22, className }: CeolxLogoProps) {
  return (
    <img
      src={logoSource}
      alt="CeolX"
      className={className}
      style={{ height: size, width: size * ASPECT_RATIO }}
    />
  );
}
