import { Defs, LinearGradient, Stop, Svg, Text as SvgText } from 'react-native-svg';

interface CeolxLogoProps {
  fontSize?: number;
  letterSpacing?: number;
}

/**
 * CEOLX wordmark with the purple-to-white vertical gradient from the design.
 * The SVG width is sized to the text so it can be dropped in wherever a
 * plain <Text>CEOLX</Text> was used before.
 */
export function CeolxLogo({ fontSize = 22, letterSpacing = 3 }: CeolxLogoProps) {
  // Hug the "CEOLX" glyphs tightly. The old 5.6 multiplier left ~20px of empty
  // space on each side of the centre-anchored text, which read as the logo being
  // indented past the screen's px-5 edge wherever it sits left-aligned (headers).
  const width = fontSize * 3.5 + letterSpacing * 5;
  const height = fontSize * 1.5;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="ceolxGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#6155F5" />
          <Stop offset="100%" stopColor="#FFFFFF" />
        </LinearGradient>
      </Defs>
      <SvgText
        x={width / 2}
        y={height * 0.82}
        textAnchor="middle"
        fontSize={fontSize}
        fontFamily="Urbanist_900Black"
        fontWeight="900"
        fill="url(#ceolxGrad)"
        letterSpacing={letterSpacing}
      >
        CEOLX
      </SvgText>
    </Svg>
  );
}
