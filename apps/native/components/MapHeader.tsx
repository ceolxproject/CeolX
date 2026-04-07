import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
    <View style={[styles.container, { top: insets.top }]} pointerEvents="box-none">
      <Pressable style={styles.backButton} onPress={handleBackPress}>
        <Ionicons name="arrow-back" size={24} color="#ffffff" />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 60,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    fontFamily: 'Urbanist_700Bold',
  },
  spacer: {
    width: 48,
  },
});
