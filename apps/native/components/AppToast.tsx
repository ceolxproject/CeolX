import { View, Text } from 'react-native';
import Toast, { type ToastConfig } from 'react-native-toast-message';

type ToastType = 'success' | 'error' | 'info' | 'warning';

const TOAST_COLORS: Record<ToastType, string> = {
  success: '#c8ff2f',
  error: '#ef4444',
  info: '#662fff',
  warning: '#f59e0b',
};

const toastConfig: ToastConfig = {
  success: ({ text1, text2 }) => (
    <View
      style={{
        height: 'auto',
        minHeight: 56,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#2B2B2B',
        borderLeftWidth: 4,
        borderLeftColor: TOAST_COLORS.success,
        borderRadius: 8,
        marginHorizontal: 16,
        gap: 2,
      }}
    >
      {text1 && <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>{text1}</Text>}
      {text2 && <Text style={{ color: '#afafaf', fontSize: 12 }}>{text2}</Text>}
    </View>
  ),
  error: ({ text1, text2 }) => (
    <View
      style={{
        height: 'auto',
        minHeight: 56,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#2B2B2B',
        borderLeftWidth: 4,
        borderLeftColor: TOAST_COLORS.error,
        borderRadius: 8,
        marginHorizontal: 16,
        gap: 2,
      }}
    >
      {text1 && <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>{text1}</Text>}
      {text2 && <Text style={{ color: '#afafaf', fontSize: 12 }}>{text2}</Text>}
    </View>
  ),
  info: ({ text1, text2 }) => (
    <View
      style={{
        height: 'auto',
        minHeight: 56,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#2B2B2B',
        borderLeftWidth: 4,
        borderLeftColor: TOAST_COLORS.info,
        borderRadius: 8,
        marginHorizontal: 16,
        gap: 2,
      }}
    >
      {text1 && <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>{text1}</Text>}
      {text2 && <Text style={{ color: '#afafaf', fontSize: 12 }}>{text2}</Text>}
    </View>
  ),
  warning: ({ text1, text2 }) => (
    <View
      style={{
        height: 'auto',
        minHeight: 56,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#2B2B2B',
        borderLeftWidth: 4,
        borderLeftColor: TOAST_COLORS.warning,
        borderRadius: 8,
        marginHorizontal: 16,
        gap: 2,
      }}
    >
      {text1 && <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>{text1}</Text>}
      {text2 && <Text style={{ color: '#afafaf', fontSize: 12 }}>{text2}</Text>}
    </View>
  ),
};

/** Mount once at the top of your root layout. */
export function AppToastProvider() {
  return <Toast config={toastConfig} visibilityTime={3000} />;
}

/** Programmatic toast API */
export const appToast = {
  success: (text1: string, text2?: string) => Toast.show({ type: 'success', text1, text2 }),
  error: (text1: string, text2?: string) => Toast.show({ type: 'error', text1, text2 }),
  info: (text1: string, text2?: string) => Toast.show({ type: 'info', text1, text2 }),
  warning: (text1: string, text2?: string) => Toast.show({ type: 'warning', text1, text2 }),
};
