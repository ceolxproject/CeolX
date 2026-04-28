interface CeolxLogoProps {
  fontSize?: number;
  letterSpacing?: number;
  className?: string;
}

/**
 * CEOLX wordmark with the purple-to-white vertical gradient. Web version of
 * apps/native/components/CeolxLogo.tsx — same visual, plain SVG instead of
 * react-native-svg.
 */
export function CeolxLogo({ fontSize = 22, letterSpacing = 3, className }: CeolxLogoProps) {
  const width = fontSize * 5.6 + letterSpacing * 5;
  const height = fontSize * 1.5;
  const gradId = 'ceolx-logo-grad';

  return (
    <svg width={width} height={height} className={className} aria-label="CeolX">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6155F5" />
          <stop offset="100%" stopColor="#FFFFFF" />
        </linearGradient>
      </defs>
      <text
        x={width / 2}
        y={height * 0.82}
        textAnchor="middle"
        fontSize={fontSize}
        fontFamily="Urbanist"
        fontWeight={900}
        fill={`url(#${gradId})`}
        letterSpacing={letterSpacing}
      >
        CEOLX
      </text>
    </svg>
  );
}
