import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Pressable, Text, View } from 'react-native';

import { CeolxLogo } from './CeolxLogo';
import { BellWithBadge } from './notifications/BellWithBadge';

interface FeedHeaderProps {
  locationText?: string;
  onBookmarkPress?: () => void;
  onNotificationPress?: () => void;
  onLocationPress?: () => void;
  onCalendarPress?: () => void;
  onFilterPress?: () => void;
  /** Highlights the calendar button when a date filter is applied. */
  calendarActive?: boolean;
  /** Highlights the filter button when a category filter is applied. */
  filterActive?: boolean;
  /** Shows the event-only calendar + filter buttons (hidden on the Posts tab). */
  showEventActions?: boolean;
  /** Shows the location row (hidden on the Posts tab — posts are a global feed, not location-scoped). */
  showLocation?: boolean;
  className?: string;
}

export function FeedHeader({
  locationText = 'Ireland',
  onNotificationPress,
  onLocationPress,
  onCalendarPress,
  onFilterPress,
  calendarActive = false,
  filterActive = false,
  showEventActions = true,
  showLocation = true,
  className,
}: FeedHeaderProps) {
  return (
    <View className={cn('px-5 gap-3', className)}>
      {/* Row 1: Logo + action icons */}
      <View className="flex-row items-center justify-between">
        <CeolxLogo fontSize={18} letterSpacing={2} />

        <View className="flex-row items-center gap-4">
          {onNotificationPress && <BellWithBadge onPress={onNotificationPress} />}
        </View>
      </View>

      {/* Row 2: Location + filter/sort buttons. Hidden entirely on the Posts
          tab, where neither the location nor the event actions apply. */}
      {(showLocation || showEventActions) && (
        <View className="flex-row items-center justify-between gap-3">
          {/* flex-1 lets the location block claim the remaining row width and
              truncate inside it, rather than expanding and pushing the buttons
              off-screen. */}
          {showLocation && (
            <Pressable onPress={onLocationPress} className="flex-1 flex-row items-center gap-1">
              <View className="flex-1 flex-col">
                <View className="flex-row items-center gap-1">
                  <Ionicons name="location-outline" size={14} color="#8D8D8D" />
                  <Text className="text-xs text-[#8D8D8D] font-urbanist">Your location</Text>
                </View>
                <View className="flex-row items-center gap-1 mt-0.5">
                  {/* Single line, tail-truncated so only the start of a long address
                      shows and the chevron stays visible (cf. the reference design). */}
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    className="flex-1 text-[15px] font-medium text-white font-urbanist"
                  >
                    {locationText}
                  </Text>
                  <Ionicons name="chevron-down" size={12} color="#FFFFFF" />
                </View>
              </View>
            </Pressable>
          )}

          {/* Left: calendar — Right: filter sliders (matches Figma node 1:3349) */}
          {/* shrink-0 keeps both buttons at full size and on-screen no matter how
              long the address is. Event-only — hidden on the Posts tab. */}
          {showEventActions && (
            <View className="flex-row items-center gap-2 shrink-0">
              <Pressable
                onPress={onCalendarPress}
                hitSlop={8}
                className={cn(
                  'w-10 h-10 rounded-full items-center justify-center',
                  calendarActive ? 'bg-[#C8FF2F]' : 'bg-[#1d1d1d]'
                )}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={calendarActive ? '#080808' : '#FFFFFF'}
                />
              </Pressable>
              <Pressable
                onPress={onFilterPress}
                hitSlop={8}
                className={cn(
                  'w-10 h-10 rounded-full items-center justify-center',
                  filterActive ? 'bg-[#C8FF2F]' : 'bg-[#1d1d1d]'
                )}
              >
                <Ionicons
                  name="options-outline"
                  size={20}
                  color={filterActive ? '#080808' : '#FFFFFF'}
                />
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
