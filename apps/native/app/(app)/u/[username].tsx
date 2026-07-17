import { useQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { trpc } from '@/utils/trpc';

/**
 * Deep-link landing for shared profile links (`ceolx.com/u/<username>` /
 * Universal / App Link). Unlike event/post links the URL carries a handle, not
 * an id, so this thin route resolves the handle → role + user id via
 * profiles.getByUsername, then forwards to the canonical artist/venue detail
 * screen (which resolve by user id). Unknown/not-live handles fall back to the
 * map rather than dead-ending.
 */
export default function ProfileDeepLinkScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();

  const { data, isLoading, isError } = useQuery({
    ...trpc.profiles.getByUsername.queryOptions({ username: username ?? '' }),
    enabled: !!username,
    retry: false,
  });

  if (!username || isError) {
    return <Redirect href="/(app)/(tabs)/map" />;
  }

  if (isLoading || !data) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  const href = (
    data.role === 'artist' ? `/(app)/artist/${data.userId}` : `/(app)/venue/${data.userId}`
  ) as Href;

  return <Redirect href={href} />;
}
