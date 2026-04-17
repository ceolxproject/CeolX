import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Alert, Image, Linking, Pressable, Text, View } from 'react-native';

import { MOCK_PROFILE_IMAGE } from '@/utils/mock-images';

const SOCIAL_ICONS: Record<string, string> = {
  INSTAGRAM: 'logo-instagram',
  FACEBOOK: 'logo-facebook',
  TIKTOK: 'logo-tiktok',
  YOUTUBE: 'logo-youtube',
  TWITTER: 'logo-twitter',
  WEBSITE: 'globe-outline',
};

type ProfileHeaderProps = {
  displayName: string;
  subtitle: string | null;
  subtitleIcon?: keyof typeof Ionicons.glyphMap;
  secondarySubtitle?: string | null;
  profileImageUrl: string | null;
  followerCount: number;
  followingCount: number;
  isOwner: boolean;
  isFollowing: boolean;
  socialLinks: Record<string, string>;
  onEditPress?: () => void;
  onSettingsPress?: () => void;
  onFollowPress?: () => void;
  secondaryCta?: { label: string; onPress: () => void };
};

export function ProfileHeader({
  displayName,
  subtitle,
  subtitleIcon,
  secondarySubtitle,
  profileImageUrl,
  followerCount,
  followingCount,
  isOwner,
  isFollowing,
  socialLinks,
  onEditPress,
  onSettingsPress,
  onFollowPress,
  secondaryCta,
}: ProfileHeaderProps) {
  return (
    <View className="items-center pt-2 pb-4">
      {/* Avatar + followers/following row */}
      <View className="flex-row items-center justify-center gap-6 mb-3">
        <View className="items-center w-[58px]">
          <Text className="text-[17px] font-semibold text-white">{followerCount}</Text>
          <Text className="text-[13px] text-white">Followers</Text>
        </View>

        <Image
          source={profileImageUrl ? { uri: profileImageUrl } : MOCK_PROFILE_IMAGE}
          className="w-[86px] h-[86px] rounded-full bg-surface"
        />

        <View className="items-center w-[58px]">
          <Text className="text-[17px] font-semibold text-white">{followingCount}</Text>
          <Text className="text-[13px] text-white">Following</Text>
        </View>
      </View>

      {/* Name + subtitle */}
      <View className="items-center gap-1.5 mb-3">
        <Text className="text-xl font-bold text-white font-urbanist">{displayName}</Text>
        {subtitle && (
          <View className="flex-row items-center gap-1">
            {subtitleIcon && (
              <Ionicons name={subtitleIcon} size={12} color="rgba(255,255,255,0.6)" />
            )}
            <Text className="text-xs font-semibold text-white/60 font-urbanist">{subtitle}</Text>
          </View>
        )}
        {secondarySubtitle && (
          <Text className="text-xs font-semibold text-white/80 font-urbanist text-center w-[292px]">
            {secondarySubtitle}
          </Text>
        )}
      </View>

      {/* Action buttons */}
      {isOwner ? (
        <View className="flex-row items-center gap-2">
          <Pressable
            className="border border-[#8D8D8D] rounded-[20px] h-9 w-[109px] items-center justify-center"
            onPress={onEditPress}
          >
            <Text className="text-xs font-bold text-white uppercase tracking-wider font-urbanist">
              Edit Profile
            </Text>
          </Pressable>
          {onSettingsPress && (
            <Pressable className="w-9 h-9 items-center justify-center" onPress={onSettingsPress}>
              <Ionicons name="settings-outline" size={24} color="#fff" />
            </Pressable>
          )}
        </View>
      ) : (
        <View className="flex-row items-center gap-2">
          <Pressable
            className={cn(
              'h-9 rounded-[20px] items-center justify-center px-4',
              isFollowing ? 'bg-[#333335]' : 'bg-[#662FFF]',
              !secondaryCta && 'flex-1 mx-5'
            )}
            style={secondaryCta ? { width: 109 } : undefined}
            onPress={
              onFollowPress ??
              (() => Alert.alert('Coming Soon', 'Follow feature is coming in a future update.'))
            }
          >
            <Text className="text-xs font-bold text-white uppercase tracking-wider font-urbanist">
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </Pressable>
          {secondaryCta && (
            <Pressable
              className="h-9 rounded-[20px] items-center justify-center px-4 border border-[#8D8D8D]"
              onPress={secondaryCta.onPress}
            >
              <Text className="text-xs font-bold text-white uppercase tracking-wider font-urbanist">
                {secondaryCta.label}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Social links */}
      {Object.keys(socialLinks).length > 0 && (
        <View className="flex-row items-center gap-4 mt-4">
          {Object.entries(socialLinks).map(([platform, url]) => (
            <Pressable
              key={platform}
              onPress={() => Linking.openURL(url)}
              className="w-9 h-9 items-center justify-center rounded-full bg-[#333335]"
            >
              <Ionicons
                name={(SOCIAL_ICONS[platform] ?? 'link-outline') as keyof typeof Ionicons.glyphMap}
                size={18}
                color="#fff"
              />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
