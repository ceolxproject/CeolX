import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

interface EmptyRequestsProps {
  tab: 'sent' | 'received';
}

export function EmptyRequests({ tab }: EmptyRequestsProps) {
  return (
    <View className="items-center justify-center pt-16 px-8">
      <Ionicons name="mail-outline" size={48} color="rgba(255,255,255,0.2)" />
      <Text className="text-white/40 text-center text-sm font-urbanist mt-4">
        {tab === 'sent'
          ? 'No sent requests yet. Invite artists to your events to send performance invitations.'
          : 'No received requests yet. Venues and festivals will send you performance invitations here.'}
      </Text>
    </View>
  );
}
