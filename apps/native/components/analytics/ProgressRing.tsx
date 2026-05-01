import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface ProgressRingProps {
  /** Percentage value 0–100. null renders a dashed inactive ring. */
  percentage: number | null;
  size?: number;
  strokeWidth?: number;
  /** Custom label inside the ring. Defaults to the percentage with a "%" suffix. */
  centerLabel?: string;
}

// Compact circular progress ring used by the engagement metric tiles on the
// per-event analytics screen. Falls back to a dashed grey ring when the metric
// is not applicable (e.g. no bookings → null acceptance rate).
export function ProgressRing({
  percentage,
  size = 56,
  strokeWidth = 6,
  centerLabel,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safePct = percentage === null ? 0 : Math.min(100, Math.max(0, percentage));
  const strokeDashoffset = circumference - (safePct / 100) * circumference;

  const isInactive = percentage === null;
  const trackColor = '#3a3a3a';
  const progressColor = isInactive ? trackColor : '#C8FF2F';
  const label = centerLabel ?? (isInactive ? '—' : `${Math.round(safePct)}%`);

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {!isInactive && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={progressColor}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Text className="text-xs font-bold text-white font-urbanist">{label}</Text>
      </View>
    </View>
  );
}
