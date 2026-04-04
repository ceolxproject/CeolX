import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { queryClient, trpc } from '@/utils/trpc';

type Session = {
  id: string;
  isCurrent: boolean;
  deviceLabel: string;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function SessionRow({
  session,
  onRevoke,
  isRevoking,
}: {
  session: Session;
  onRevoke: (id: string) => void;
  isRevoking: boolean;
}) {
  return (
    <View className="flex-row justify-between items-center py-4 border-b border-gray-10">
      <View className="flex-1 mr-3">
        <Text className="text-sm font-semibold text-white" numberOfLines={1}>
          {session.deviceLabel}
        </Text>
        {session.isCurrent && (
          <View className="self-start bg-green-900 border border-green-700 rounded-full px-2 py-0.5 mt-1">
            <Text className="text-[11px] text-green-400 font-medium">This device</Text>
          </View>
        )}
        {session.ipAddress ? (
          <Text className="text-[12px] text-gray-10 mt-1">{session.ipAddress}</Text>
        ) : null}
        <Text className="text-[11px] text-gray-10 mt-0.5">
          Active since {formatDate(session.createdAt)}
        </Text>
      </View>

      {!session.isCurrent && (
        <Pressable
          onPress={() => onRevoke(session.id)}
          disabled={isRevoking}
          className="px-3 py-1.5 rounded-lg border border-red-800"
        >
          <Text className="text-red-400 text-[13px] font-medium">
            {isRevoking ? 'Signing out…' : 'Sign out'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export default function ActiveSessionsScreen() {
  const { data, isLoading, error, refetch } = useQuery({
    ...trpc.sessions.list.queryOptions(),
    retry: 1,
  });

  const revokeMutation = useMutation({
    ...trpc.sessions.revoke.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: trpc.sessions.list.queryKey() });
    },
  });

  const revokeAllMutation = useMutation({
    ...trpc.sessions.revokeAll.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: trpc.sessions.list.queryKey() });
    },
  });

  const handleRevoke = (sessionId: string) => {
    revokeMutation.mutate({ sessionId });
  };

  const handleRevokeAll = () => {
    Alert.alert(
      'Log out of all other devices?',
      'This will end all sessions except the current one.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out all',
          style: 'destructive',
          onPress: () => revokeAllMutation.mutate(undefined),
        },
      ]
    );
  };

  const sessions = data?.sessions ?? [];
  const otherSessionCount = sessions.filter((s) => !s.isCurrent).length;

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
        <View className="flex-1 justify-center items-center">
          <Text className="text-gray-10">Loading sessions…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
        <View className="flex-1 justify-center items-center p-8">
          <Text className="text-red-400 text-center mb-4">Failed to load sessions.</Text>
          <Pressable
            onPress={() => void refetch()}
            className="px-4 py-2 border border-gray-10 rounded-lg"
          >
            <Text className="text-white text-sm">Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ListHeaderComponent={
          <View className="pt-2 pb-4">
            <Text className="text-sm text-gray-10 leading-5">
              These devices are signed in to your account. Sign out of sessions you don't recognise.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <SessionRow
            session={item}
            onRevoke={handleRevoke}
            isRevoking={revokeMutation.isPending && revokeMutation.variables?.sessionId === item.id}
          />
        )}
        ListFooterComponent={
          otherSessionCount > 0 ? (
            <Pressable
              onPress={handleRevokeAll}
              disabled={revokeAllMutation.isPending}
              className="mt-8 py-3 border border-red-800 rounded-xl items-center"
            >
              <Text className="text-red-400 text-sm font-semibold">
                {revokeAllMutation.isPending
                  ? 'Signing out of all other devices…'
                  : 'Log out of all other devices'}
              </Text>
            </Pressable>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
