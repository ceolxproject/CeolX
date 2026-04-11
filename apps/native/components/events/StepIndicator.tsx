import { cn } from 'heroui-native';
import { Fragment } from 'react';
import { Text, View } from 'react-native';

type Props = {
  currentStep: 1 | 2 | 3;
  labels?: [string, string, string];
};

const DEFAULT_LABELS: [string, string, string] = ['BASIC DETAILS', 'DATE & VENUE', 'TICKET & ADS'];

export function StepIndicator({ currentStep, labels = DEFAULT_LABELS }: Props) {
  const steps = [1, 2, 3] as const;

  return (
    <View className="py-4">
      {/* Dots and lines — flat siblings so flex-1 lines span cleanly between dots */}
      <View className="flex-row items-center">
        {steps.map((step, index) => {
          const isCompleted = step < currentStep;
          const isActive = step === currentStep;
          const isFilled = isCompleted || isActive;

          return (
            <Fragment key={step}>
              <View
                className={cn(
                  'w-3 h-3 rounded-full',
                  isFilled ? 'bg-[#C8FF2F]' : 'border-[1.5px] border-neutral-500 bg-transparent'
                )}
              />
              {index < steps.length - 1 && (
                <View
                  className={cn(
                    'flex-1 h-[1.5px]',
                    isCompleted ? 'bg-[#C8FF2F]' : 'bg-neutral-500'
                  )}
                />
              )}
            </Fragment>
          );
        })}
      </View>

      {/* Labels — absolute so left/center/right align to screen edges, not flex columns */}
      <View className="relative h-5 mt-2">
        {labels.map((label, index) => {
          const step = (index + 1) as 1 | 2 | 3;
          const isFilled = step <= currentStep;

          return (
            <Text
              key={label}
              numberOfLines={1}
              className={cn(
                'absolute text-[10px] font-urbanist',
                index === 0 && 'left-0',
                index === 1 && 'left-0 right-0 text-center',
                index === 2 && 'right-0',
                isFilled ? 'text-white font-bold' : 'text-neutral-500 font-medium'
              )}
            >
              {label}
            </Text>
          );
        })}
      </View>
    </View>
  );
}
