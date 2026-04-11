import { cn } from 'heroui-native';
import { Text, View } from 'react-native';

type Props = {
  currentStep: 1 | 2 | 3;
  labels?: [string, string, string];
};

const DEFAULT_LABELS: [string, string, string] = ['BASIC DETAILS', 'DATE & VENUE', 'TICKET & ADS'];

export function StepIndicator({ currentStep, labels = DEFAULT_LABELS }: Props) {
  const steps = [1, 2, 3] as const;

  return (
    <View className="px-6 py-4">
      {/* Dots and lines row */}
      <View className="flex-row items-center">
        {steps.map((step, index) => {
          const isCompleted = step < currentStep;
          const isActive = step === currentStep;
          const isFilled = isCompleted || isActive;

          return (
            <View key={step} className="flex-row items-center flex-1 last:flex-none">
              {/* Dot */}
              <View
                className={cn(
                  'w-3 h-3 rounded-full',
                  isFilled ? 'bg-[#C8FF2F]' : 'border-[1.5px] border-neutral-500 bg-transparent'
                )}
              />
              {/* Line after dot (except last) */}
              {index < steps.length - 1 && (
                <View
                  className={cn(
                    'h-[1.5px] flex-1',
                    isCompleted ? 'bg-[#C8FF2F]' : 'bg-neutral-500'
                  )}
                />
              )}
            </View>
          );
        })}
      </View>

      {/* Labels row */}
      <View className="flex-row mt-2">
        {labels.map((label, index) => {
          const step = (index + 1) as 1 | 2 | 3;
          const isFilled = step <= currentStep;

          return (
            <View
              key={label}
              className={cn(
                'flex-1',
                index === 0 && 'items-start',
                index === 1 && 'items-center',
                index === 2 && 'items-end'
              )}
            >
              <Text
                className={cn(
                  'text-[10px] font-urbanist',
                  isFilled ? 'text-white font-bold' : 'text-neutral-500 font-medium'
                )}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
