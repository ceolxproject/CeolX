import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { NotificationDto } from '@CeolX/shared/validators';

import { EmptyState } from '@/components/EmptyState';
import { NotificationListItem } from '@/components/notifications/NotificationListItem';
import { useMarkAllAsRead, useMarkAsRead } from '@/hooks/use-mark-notifications';
import { useNotifications } from '@/hooks/use-notifications';
import { resolveNotificationRoute } from '@/lib/notification-route';

export default function NotificationsScreen() {
  const { notifications, isLoading, isFetchingNextPage, hasNextPage, total, loadMore, refresh } =
    useNotifications();

  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  // Tap handler: mark read + navigate. No persona auto-switch — CLAUDE.md
  // (MoM 03/04/2026 §2.1) prohibits role switching on the mobile client.
  // The notification's persona stays in the row for filtering / future audit.
  const handleTap = useCallback(
    (notification: NotificationDto) => {
      if (!notification.isRead) {
        markAsRead.mutate({ id: notification.id });
      }
      // Normalise the stored route to a real screen — legacy/bare routes would
      // otherwise hit +not-found ("Page Not Found"). Asana 1215279003641211.
      router.push(resolveNotificationRoute(notification.route));
    },
    [markAsRead]
  );

  const handleMarkAllPress = useCallback(() => {
    markAllAsRead.mutate(undefined);
  }, [markAllAsRead]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }} edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-3 border-b border-[#1d1d1d]">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <Text className="text-base font-bold text-white font-urbanist">Notifications</Text>
        </View>

        {unreadCount > 0 && (
          <Pressable
            onPress={handleMarkAllPress}
            disabled={markAllAsRead.isPending}
            hitSlop={8}
            accessibilityLabel="Mark all as read"
          >
            <Text className="text-sm text-blue-10 font-semibold font-urbanist">
              Mark all as read
            </Text>
          </Pressable>
        )}
      </View>

      {/* List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#C8FF2F" />
        </View>
      ) : notifications.length === 0 ? (
        <EmptyState variant="no-notifications" />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => (
            <NotificationListItem notification={item} onPress={handleTap} />
          )}
          onEndReached={() => hasNextPage && loadMore()}
          onEndReachedThreshold={0.5}
          onRefresh={refresh}
          refreshing={false}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="py-4 items-center">
                <ActivityIndicator color="#C8FF2F" />
              </View>
            ) : !hasNextPage && total > 0 ? (
              <View className="py-6 items-center">
                <Text className="text-xs text-[#8d8d8d] font-urbanist">You're all caught up</Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}
