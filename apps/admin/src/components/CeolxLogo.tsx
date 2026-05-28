interface CeolxLogoProps {
  fontSize?: number;
  letterSpacing?: number;
  className?: string;
}

/**
 * CEOLX wordmark with the brand purple-to-white vertical gradient. Web
 * counterpart of apps/native/components/CeolxLogo.tsx — uses HTML + CSS
 * background-clip instead of SVG <text> so the wordmark stays crisp at any
 * size and survives missing-font fallbacks.
 */
export function CeolxLogo({ fontSize = 28, letterSpacing = 3, className }: CeolxLogoProps) {
  return (
    <span
      role="img"
      aria-label="CeolX"
      className={className}
      style={{
        display: 'inline-block',
        fontFamily: "'Urbanist', system-ui, sans-serif",
        fontWeight: 900,
        fontSize,
        lineHeight: 1,
        letterSpacing: `${letterSpacing}px`,
        backgroundImage: 'linear-gradient(to bottom, #6155F5 0%, #FFFFFF 100%)',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
      }}
    >
      CEOLX
    </span>
  );
}
