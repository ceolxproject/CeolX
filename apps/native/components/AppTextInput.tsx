import { cn } from 'heroui-native';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, Text, TextInput, type TextInputProps, View } from 'react-native';

interface AppTextInputProps extends Omit<TextInputProps, 'secureTextEntry'> {
  label?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  secureTextEntry?: boolean;
}

export function AppTextInput({
  label,
  error,
  leftIcon,
  rightIcon,
  secureTextEntry = false,
  className,
  ...props
}: AppTextInputProps) {
  const [visible, setVisible] = useState(!secureTextEntry);

  return (
    <View className="gap-1.5">
      {label && <Text className="text-sm font-medium text-gray-3">{label}</Text>}
      <View
        className={cn(
          'flex-row items-center rounded-lg border bg-surface px-3 py-2.5',
          error ? 'border-error' : 'border-gray-8'
        )}
      >
        {leftIcon && <View className="mr-2">{leftIcon}</View>}
        <TextInput
          className={cn('flex-1 text-sm text-white', className)}
          placeholderTextColor="#8d8d8d"
          secureTextEntry={!visible}
          {...props}
        />
        {secureTextEntry && (
          <Pressable onPress={() => setVisible((v) => !v)} className="ml-2 p-1">
            <Text className="text-xs text-gray-7">{visible ? 'Hide' : 'Show'}</Text>
          </Pressable>
        )}
        {!secureTextEntry && rightIcon && <View className="ml-2">{rightIcon}</View>}
      </View>
      {error && <Text className="text-xs text-error">{error}</Text>}
    </View>
  );
}
