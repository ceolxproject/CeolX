import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PostCard } from '@/components/posts/PostCard';
import { useMe } from '@/hooks/use-me';
import { usePostById } from '@/hooks/use-post-by-id';

export default function PostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { data: post, isLoading, isError } = usePostById(postId);
  const { data: me } = useMe();

  // A shared post link can open this screen with nothing beneath it, so back
  // needs a destination of its own rather than a bare pop.
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(app)/(tabs)/discover');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }} edges={['top']}>
      <View className="flex-row items-center p-5">
        <Pressable onPress={goBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text className="ml-4 text-base font-bold text-white font-urbanist">Post</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {isLoading && (
          <View className="py-12 items-center">
            <ActivityIndicator color="#C8FF2F" />
          </View>
        )}

        {!isLoading && (isError || !post) && (
          <View className="py-16 items-center">
            <Text className="text-base text-white/60 text-center font-urbanist">
              This post is no longer available.
            </Text>
          </View>
        )}

        {post && (
          <PostCard post={post} currentUserId={me?.id ?? null} expanded onDeleted={goBack} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
