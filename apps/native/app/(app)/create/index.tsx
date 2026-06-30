import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';

type ChoiceProps = {
  icon: 'calendar' | 'create';
  title: string;
  description: string;
  onPress: () => void;
};

function Choice({ icon, title, description, onPress }: ChoiceProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center gap-2 rounded-xl border border-white/10 bg-[rgba(141,141,141,0.3)] px-4 py-5"
    >
      <View className="h-8 w-8 items-center justify-center rounded-2xl bg-[#C8FF2F]">
        <Ionicons
          name={icon === 'calendar' ? 'calendar-outline' : 'create-outline'}
          size={20}
          color="#080808"
        />
      </View>
      <Text className="text-base font-bold text-white font-urbanist">{title}</Text>
      <Text className="text-center text-sm text-white/80 font-urbanist">{description}</Text>
    </Pressable>
  );
}

export default function CreateChooserScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }} edges={['top']}>
      <AppHeader leading="back" />

      <View className="px-5">
        <Text className="text-[28px] font-bold text-white font-urbanist leading-[32px]">
          What would you like to create?
        </Text>
      </View>

      <View className="mt-10 flex-row gap-4 px-5">
        <Choice
          icon="calendar"
          title="Create Event"
          description="Host a gig, concert, or any live show."
          onPress={() => router.replace('/(app)/events/create')}
        />
        <Choice
          icon="create"
          title="Create Post"
          description="Share anything with your community."
          onPress={() => router.replace('/(app)/create/post')}
        />
      </View>
    </SafeAreaView>
  );
}
