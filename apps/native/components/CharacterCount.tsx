import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Text, View } from 'react-native';

interface CharacterCountProps {
  count: number;
  max: number;
  className?: string;
}

// Header counter for capped text fields. At the cap it turns warning-amber and
// semibold — the weight change is a non-color reinforcement so the state never
// relies on color alone (DESIGN.md a11y rule). Reaching the max is a valid
// boundary, not an error, so this is a warning, not error-red.
export function CharacterCount({ count, max, className }: CharacterCountProps) {
  const atLimit = count >= max;
  return (
    <Text
      className={cn(className, atLimit && 'text-warning font-semibold')}
      accessibilityLabel={`${count} of ${max} characters used`}
    >
      {count}/{max}
    </Text>
  );
}

// Below-input note shown only at the cap. Icon + text (not color alone) and an
// alert role so screen readers announce it. The copy disambiguates the limit as
// characters (not words) at the moment the user hits it.
export function CharacterLimitNote({ count, max, className }: CharacterCountProps) {
  if (count < max) return null;
  return (
    <View className={cn('flex-row items-center gap-1', className)} accessibilityRole="alert">
      <Ionicons name="alert-circle" size={13} color="#f59e0b" />
      <Text className="text-xs text-warning">Limit reached — {max} characters max</Text>
    </View>
  );
}
