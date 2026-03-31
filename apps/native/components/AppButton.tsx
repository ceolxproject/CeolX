import { cn } from 'heroui-native';
import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';
type Size = 'sm' | 'md';

interface AppButtonProps extends Omit<PressableProps, 'style'> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  children: string;
  className?: string;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-blue-10 active:opacity-80',
  secondary: 'bg-green-10 active:opacity-80',
  outline: 'border border-blue-10 active:opacity-80',
  ghost: 'active:opacity-60',
};

const TEXT_CLASSES: Record<Variant, string> = {
  primary: 'text-white font-semibold',
  secondary: 'text-surface-dark font-semibold',
  outline: 'text-blue-10 font-semibold',
  ghost: 'text-gray-3 font-medium',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'px-4 py-2 rounded-md',
  md: 'px-6 py-3 rounded-lg',
};

const TEXT_SIZE_CLASSES: Record<Size, string> = {
  sm: 'text-sm',
  md: 'text-base',
};

export function AppButton({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  children,
  className,
  ...props
}: AppButtonProps) {
  const isDisabled = disabled ?? isLoading;

  return (
    <Pressable
      className={cn(
        'flex-row items-center justify-center',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        isDisabled && 'opacity-50',
        className
      )}
      disabled={isDisabled}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'secondary' ? '#fff' : '#662fff'}
        />
      ) : (
        <Text className={cn(TEXT_CLASSES[variant], TEXT_SIZE_CLASSES[size])}>{children}</Text>
      )}
    </Pressable>
  );
}
