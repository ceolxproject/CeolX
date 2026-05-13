import { Platform, Pressable, Text, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';

function GoogleIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09A6.97 6.97 0 0 1 5.47 12c0-.72.13-1.43.37-2.09V7.07H2.18A11.96 11.96 0 0 0 .95 12c0 1.94.46 3.77 1.23 5.33l2.66-2.07V14.09z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

function AppleIcon() {
  return (
    <Svg width={16} height={20} viewBox="0 0 17 20" fill="white">
      <Path d="M11.73 1.04C12.5.15 13.58-.26 14.75.1c.16 1.23-.36 2.45-1.1 3.32-.76.89-1.86 1.51-3.02 1.36-.18-1.17.42-2.4 1.1-3.26v-.48zM15.08 10.66c.03 3.16 2.78 4.21 2.81 4.23-.02.07-.44 1.5-1.45 2.97-.87 1.27-1.77 2.53-3.19 2.56-1.4.03-1.84-.83-3.44-.83-1.59 0-2.09.8-3.41.86-1.37.05-2.41-1.37-3.29-2.64C1.33 15.27.02 11.17 1.87 8.36 2.78 6.97 4.2 6.1 5.74 6.08c1.35-.03 2.62.91 3.45.91.83 0 2.38-1.12 4.01-.96.68.03 2.6.28 3.83 2.08-.1.06-2.29 1.33-2.26 3.98l.31.57z" />
    </Svg>
  );
}

interface SocialLoginButtonsProps {
  separator?: string;
  onGooglePress: () => void;
  onApplePress: () => void;
}

export function SocialLoginButtons({
  separator = 'Or sign in with',
  onGooglePress,
  onApplePress,
}: SocialLoginButtonsProps) {
  return (
    <>
      {/* Social buttons */}
      <View className="flex-row gap-[18px] mb-4">
        <Pressable
          onPress={onGooglePress}
          className="flex-1 border border-[#ededed] rounded-lg p-2 items-center justify-center"
        >
          <GoogleIcon />
        </Pressable>
        {Platform.OS === 'ios' ? (
          <Pressable
            onPress={onApplePress}
            className="flex-1 border border-[#ededed] rounded-lg p-2 items-center justify-center"
          >
            <AppleIcon />
          </Pressable>
        ) : null}
      </View>

      {/* Separator */}
      <View className="flex-row items-center gap-4 mb-4">
        <View className="flex-1 h-px bg-gray-10" />
        <Text className="text-[#7e8492] text-sm font-medium font-inter leading-5">{separator}</Text>
        <View className="flex-1 h-px bg-gray-10" />
      </View>
    </>
  );
}
