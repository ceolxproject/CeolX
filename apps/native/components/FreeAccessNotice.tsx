import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, Text, View } from 'react-native';

// Interim messaging while venues are free ahead of the Stripe subscription
// launch. No price, CTA, or ceolx.com/subscribe link — App Store Rule 3.1.1
// allows a plain notice, not a nudge toward external payment. Delete this
// file and its call sites once subscriptions ship.
export const FREE_ACCESS_TITLE = 'Introductory free access';

export const FREE_ACCESS_BODY =
  "You're using CeolX during the introductory free access period. Subscription plans will be introduced in a future update, and we'll let you know before anything changes.";

/** Inline card used on venue onboarding and event/post creation. */
export function FreeAccessNotice() {
  return (
    <View className="flex-row items-start gap-2 rounded-xl bg-[#333335] px-3 py-2.5">
      <Ionicons
        name="information-circle-outline"
        size={16}
        color="rgba(255,255,255,0.6)"
        style={{ marginTop: 1 }}
      />
      <Text className="shrink text-xs leading-[18px] text-white/60 font-urbanist">
        {FREE_ACCESS_BODY}
      </Text>
    </View>
  );
}

/** Pill for the venue's own profile header — own profile only, never public. */
export function FreeAccessBadge() {
  return (
    <Pressable
      onPress={() => Alert.alert(FREE_ACCESS_TITLE, FREE_ACCESS_BODY)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`${FREE_ACCESS_TITLE}. Tap for details.`}
      className="rounded-[6px] border border-gray-10 px-1.5 py-px"
    >
      <Text className="text-[10px] font-bold uppercase tracking-[0.2px] text-[#8a8a8f] font-urbanist">
        Free access
      </Text>
    </Pressable>
  );
}
