import { ActivityIndicator, Pressable, Text, View } from 'react-native';

interface StepNavButtonsProps {
  showBack: boolean;
  primaryLabel: string;
  isPending: boolean;
  onBack: () => void;
  onPrimary: () => void;
}

export function StepNavButtons({
  showBack,
  primaryLabel,
  isPending,
  onBack,
  onPrimary,
}: StepNavButtonsProps) {
  return (
    <View className="flex-row gap-3 bg-[#080808] px-5 pb-4 pt-3">
      {showBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go to previous step"
          className="flex-1 items-center justify-center rounded-full py-4"
          style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}
        >
          <Text
            style={{
              color: '#fff',
              fontSize: 16,
              fontWeight: '700',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            Back
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={onPrimary}
        disabled={isPending}
        accessibilityRole="button"
        accessibilityLabel={primaryLabel}
        className="items-center justify-center rounded-full py-4 px-4"
        style={{
          backgroundColor: isPending ? '#4d42cc' : '#6155F5',
          flex: showBack ? 2 : 1,
        }}
      >
        {isPending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={{
              color: '#fff',
              fontSize: 16,
              fontWeight: '700',
              letterSpacing: 1,
              textTransform: 'uppercase',
              textAlign: 'center',
            }}
          >
            {primaryLabel}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
