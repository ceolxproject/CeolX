import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Image, Linking, Pressable, Text, View } from 'react-native';

import { appToast } from '@/components/AppToast';

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
  contactEmail?: string | null;
  onEditPress?: () => void;
  onSettingsPress?: () => void;
  onFollowPress?: () => void;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
  secondaryCta?: { label: string; onPress: () => void };
  /** When set, a Share button appears (used on public profiles that have a
   *  shareable handle). Omit to hide it — e.g. profiles with no username yet. */
  onSharePress?: () => void;
};

function CountBlock({
  value,
  label,
  onPress,
}: {
  value: number;
  label: string;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text maxFontSizeMultiplier={1.3} className="text-[17px] font-semibold text-white">
        {value}
      </Text>
      {/* One line at full width so the label never breaks mid-word; cap font scaling so a
          large OS font setting can't stretch the block wide enough to overflow the row */}
      <Text numberOfLines={1} maxFontSizeMultiplier={1.3} className="text-[13px] text-white">
        {label}
      </Text>
    </>
  );
  if (onPress) {
    return (
      <Pressable className="items-center min-w-[58px]" onPress={onPress}>
        {content}
      </Pressable>
    );
  }
  return <View className="items-center min-w-[58px]">{content}</View>;
}

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
  contactEmail,
  onEditPress,
  onSettingsPress,
  onFollowPress,
  onFollowersPress,
  onFollowingPress,
  secondaryCta,
  onSharePress,
}: ProfileHeaderProps) {
  const trimmedEmail = contactEmail?.trim();
  return (
    <View className="items-center pt-2 pb-4">
      {/* Avatar + followers/following row */}
      <View className="flex-row items-center justify-center gap-6 mb-3">
        <CountBlock value={followerCount} label="Followers" onPress={onFollowersPress} />

        {profileImageUrl ? (
          <Image
            source={{ uri: profileImageUrl }}
            className="w-[86px] h-[86px] rounded-full bg-surface"
          />
        ) : (
          <View className="w-[86px] h-[86px] rounded-full bg-surface items-center justify-center">
            <Ionicons name="person-outline" size={36} color="#8d8d8d" />
          </View>
        )}

        <CountBlock value={followingCount} label="Following" onPress={onFollowingPress} />
      </View>

      {/* Name + subtitle */}
      <View className="items-center gap-1.5 mb-3">
        <Text className="text-xl font-bold text-white font-urbanist">{displayName}</Text>
        {subtitle && (
          <View className="flex-row items-start justify-center gap-1 max-w-[292px]">
            {subtitleIcon && (
              <Ionicons
                name={subtitleIcon}
                size={12}
                color="rgba(255,255,255,0.6)"
                style={{ marginTop: 2 }}
              />
            )}
            <Text className="shrink text-xs font-semibold text-white/60 font-urbanist text-center">
              {subtitle}
            </Text>
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
              'h-9 rounded-[20px] items-center justify-center',
              isFollowing ? 'bg-[#333335]' : 'bg-[#662FFF]',
              secondaryCta ? 'w-[109px]' : 'flex-1 mx-5'
            )}
            onPress={
              onFollowPress ??
              (() => appToast.info('Coming Soon', 'Follow feature is coming in a future update.'))
            }
          >
            <Text
              numberOfLines={1}
              className="text-xs font-bold text-white uppercase tracking-wider font-urbanist"
            >
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
          {onSharePress && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share profile"
              hitSlop={8}
              className="w-9 h-9 items-center justify-center rounded-full bg-[#333335]"
              onPress={onSharePress}
            >
              <Ionicons name="share-outline" size={18} color="#fff" />
            </Pressable>
          )}
        </View>
      )}

      {/* Contact details */}
      {trimmedEmail && (
        <View className="items-center gap-2 mt-4">
          <Pressable
            onPress={() => Linking.openURL(`mailto:${trimmedEmail}`)}
            className="flex-row items-center gap-2 px-3 py-2 rounded-full bg-[#333335]"
          >
            <Ionicons name="mail-outline" size={14} color="#C8FF2F" />
            <Text className="text-xs font-semibold text-white">{trimmedEmail}</Text>
          </Pressable>
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
