import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface MapHeaderProps {
  title?: string;
}

export function MapHeader({ title = 'Find Event' }: MapHeaderProps) {
  const insets = useSafeAreaInsets();

  const handleBackPress = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/(tabs)/discover');
    }
  }, []);

  return (
    <View
      className="absolute left-0 right-0 h-[52px] flex-row items-center px-4"
      style={{ top: insets.top }}
      pointerEvents="box-none"
    >
      <Pressable
        className="w-12 h-12 rounded-[60px] bg-[rgba(0,0,0,0.55)] items-center justify-center"
        onPress={handleBackPress}
      >
        <Ionicons name="arrow-back" size={24} color="#ffffff" />
      </Pressable>
      <Text
        className="flex-1 text-center text-white text-[28px] font-bold"
        style={{ fontFamily: 'Urbanist_700Bold' }}
      >
        {title}
      </Text>
      <View className="w-12" />
    </View>
  );
}
