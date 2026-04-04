import { cn } from 'heroui-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

interface CheckboxFieldProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  error?: string;
  className?: string;
}

export function CheckboxField({ checked, onChange, label, error, className }: CheckboxFieldProps) {
  return (
    <View className={cn('gap-1', className)}>
      <Pressable
        className="flex-row items-center gap-3"
        onPress={() => onChange(!checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
      >
        <View
          className={cn(
            'h-5 w-5 rounded border-2 items-center justify-center',
            checked ? 'bg-green-10 border-green-10' : 'border-gray-7 bg-transparent'
          )}
        >
          {checked && <Text className="text-xs text-surface-dark font-bold leading-none">✓</Text>}
        </View>
        <View className="flex-1">
          {typeof label === 'string' ? <Text className="text-sm text-gray-3">{label}</Text> : label}
        </View>
      </Pressable>
      {error && <Text className="text-xs text-error ml-8">{error}</Text>}
    </View>
  );
}
