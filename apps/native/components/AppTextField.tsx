import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { type ReactNode, useState } from 'react';
import { Pressable, Text, TextInput, type TextInputProps, View } from 'react-native';

import { CharacterLimitNote } from './CharacterCount';

export type AppTextFieldVariant = 'light' | 'dark' | 'surface';

interface AppTextFieldProps extends Omit<TextInputProps, 'secureTextEntry' | 'style'> {
  label?: string;
  error?: string;
  variant?: AppTextFieldVariant;
  leftIcon?: ReactNode;
  rightAdornment?: ReactNode;
  secureTextEntry?: boolean;
  /** Extra classes for the outer wrapper (use for margins / label gap). */
  containerClassName?: string;
  /** Extra classes for the field box row (bg / border overrides). */
  fieldClassName?: string;
  /** Extra classes for the inner TextInput (text/font tweaks only). */
  className?: string;
}

/**
 * Canonical single-line text field.
 *
 * Encodes the iOS-safe vertical-centering rule: the field box is a
 * `flex-row items-center` container with a `min-height` (never a fixed
 * `height` on the TextInput), and the inner TextInput sets NO `lineHeight`
 * / `leading-*`. An explicit lineHeight on a single-line iOS TextInput
 * overrides UITextField's native centering and — together with the async
 * custom-font swap — drops glyphs to the bottom of the box on focus. Routing
 * every single-line input through this component prevents that regression.
 *
 * Multiline inputs are intentionally NOT handled here; they use
 * `textAlignVertical: 'top'` at their own call sites.
 */
const VARIANT: Record<
  AppTextFieldVariant,
  { field: string; h: string; px: string; input: string; placeholder: string; icon: string }
> = {
  // NOTE: font sizes use arbitrary values (text-[16px], not text-base). Tailwind's
  // named size utilities also set a `lineHeight`, and ANY lineHeight on a
  // single-line iOS TextInput breaks UITextField's vertical centering — the text
  // drops and the descender (g, y, p) clips at the bottom. Arbitrary sizes set
  // fontSize only. This is why the search-bar inputs (text-[14px]) never had the bug.
  light: {
    field: 'bg-white',
    h: 'h-[52px]',
    px: 'px-4',
    input: 'text-[16px] text-black',
    placeholder: '#8d8d8d',
    icon: '#8d8d8d',
  },
  dark: {
    field: 'bg-[#1C1C1E]',
    h: 'h-[48px]',
    px: 'px-4',
    input: 'text-[16px] font-medium text-white',
    placeholder: '#8d8d8d',
    icon: '#8d8d8d',
  },
  surface: {
    field: 'bg-surface border border-gray-8',
    h: 'h-[48px]',
    px: 'px-3',
    input: 'text-[14px] text-white font-urbanist',
    placeholder: '#8d8d8d',
    icon: '#8d8d8d',
  },
};

export function AppTextField({
  label,
  error,
  variant = 'light',
  leftIcon,
  rightAdornment,
  secureTextEntry = false,
  containerClassName,
  fieldClassName,
  className,
  value,
  maxLength,
  ...props
}: AppTextFieldProps) {
  const [visible, setVisible] = useState(!secureTextEntry);
  const v = VARIANT[variant];
  // When the field is capped, surface a consistent "limit reached" note the
  // moment the value hits maxLength — otherwise the input just stops accepting
  // characters silently and reads as broken. The note renders only at the cap.
  const count = typeof value === 'string' ? value.length : 0;

  return (
    <View className={cn(containerClassName)}>
      {label && <Text className="mb-2 text-sm font-medium font-inter text-white/80">{label}</Text>}
      <View
        className={cn(
          'flex-row items-center rounded-lg',
          v.h,
          v.px,
          v.field,
          error && 'border border-error',
          fieldClassName
        )}
      >
        {leftIcon && <View className="mr-3">{leftIcon}</View>}
        <TextInput
          value={value}
          maxLength={maxLength}
          className={cn('flex-1', v.input, className)}
          // The fixed height lives on the container; the TextInput stays at its
          // intrinsic one-line height and is centered by `items-center`. A
          // single-line iOS UITextField given a frame taller than its line does
          // NOT reliably center — it drops the line to the bottom on the first
          // re-layout (typing). `padding: 0` clears iOS's default content inset.
          // No `lineHeight`. Mirrors the rock-solid MapSearchBar pattern.
          style={{ padding: 0 }}
          placeholderTextColor={v.placeholder}
          secureTextEntry={secureTextEntry ? !visible : undefined}
          {...props}
        />
        {secureTextEntry ? (
          <Pressable onPress={() => setVisible((s) => !s)} hitSlop={8} className="ml-2 p-1">
            <Ionicons name={visible ? 'eye-outline' : 'eye-off-outline'} size={20} color={v.icon} />
          </Pressable>
        ) : rightAdornment ? (
          <View className="ml-2">{rightAdornment}</View>
        ) : null}
      </View>
      {error ? <Text className="mt-1 text-xs text-error">{error}</Text> : null}
      {maxLength !== undefined ? (
        <CharacterLimitNote count={count} max={maxLength} className="mt-1" />
      ) : null}
    </View>
  );
}
