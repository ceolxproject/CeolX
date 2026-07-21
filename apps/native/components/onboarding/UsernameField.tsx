import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, View } from 'react-native';

import { USERNAME_MAX } from '@CeolX/shared/validators';

import { AppTextField } from '@/components/AppTextField';
import type { UsernameStatus } from '@/hooks/use-username-field';

interface UsernameFieldProps {
  value: string;
  onChangeText: (v: string) => void;
  status: UsernameStatus;
  error: string | null;
}

/** Right-side status glyph: spinner while checking, green tick when available. */
function StatusAdornment({ status }: { status: UsernameStatus }) {
  if (status === 'checking') return <ActivityIndicator size="small" color="#8d8d8d" />;
  if (status === 'available') return <Ionicons name="checkmark-circle" size={20} color="#22c55e" />;
  return null;
}

/**
 * The shared handle input. Reused by artist/venue onboarding and the
 * set-on-first-share sheet. Shows the resulting shareable URL as helper text so
 * the user sees exactly what they're claiming — and that it's permanent.
 */
export function UsernameField({ value, onChangeText, status, error }: UsernameFieldProps) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-bold text-white/80">
        Username <Text className="text-error">*</Text>
      </Text>
      <AppTextField
        variant="light"
        placeholder="yourhandle"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        maxLength={USERNAME_MAX}
        error={error ?? undefined}
        rightAdornment={<StatusAdornment status={status} />}
      />
      <Text className="text-xs font-semibold text-gray-10">
        {value
          ? `Your profile link: ceolx.com/u/${value} · permanent, can't be changed later`
          : "Lowercase letters, numbers and underscores. Permanent — can't be changed later."}
      </Text>
    </View>
  );
}
