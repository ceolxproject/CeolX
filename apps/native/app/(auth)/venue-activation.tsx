import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { appToast } from '@/components/AppToast';
import {
  activationPanelFor,
  formatTrialEnd,
} from '@/components/subscription/venue-subscription-state.utils';
import { useActivationEmail } from '@/hooks/use-activation-email';
import { useMe } from '@/hooks/use-me';
import { useVenueSubscription } from '@/hooks/use-venue-subscription';
import { AnalyticsEvent, track } from '@/lib/analytics';
import { openEmailApp } from '@/utils/open-email-app';

/**
 * Venue activation hand-off, shown once immediately after venue onboarding (M8-T0 D-16).
 *
 * Fixes a genuine hole in the flow rather than adding a step: a venue used to finish
 * onboarding, land on the map, and find out only by wandering into their own profile that
 * the account still needed setting up. Nothing in onboarding said so, and — because
 * `createVenueProfile` never sent the activation email — nothing had been sent either.
 * This screen sends it and says so, at the moment the venue is still thinking about
 * signing up.
 *
 * A screen, not a modal: it must survive a backgrounded app and be readable at leisure,
 * and it is closeable, because everything it describes can be finished later from the
 * profile. Mirrors `(auth)/verify-email` deliberately — the venue has just been through
 * that exact screen minutes earlier, so the second "check your email" moment looks like
 * the first.
 *
 * Carries no price, no URL and no checkout button (D-16). The email holds all of that.
 */
/**
 * Shared frame for both panels.
 *
 * Centred while the content fits, scrollable when it does not — at a large accessibility
 * font scale on a short device the reassurance line at the bottom is the first thing to
 * clip, and that is precisely the line that makes closing feel safe. `flexGrow` on the
 * content container rather than `flex-1` is what keeps the centring.
 *
 * One component because the success and waiting panels had byte-identical wrappers, which is
 * how two panels end up with different padding after one edit.
 */
function ActivationLayout({
  onClose,
  children,
}: {
  /** Omitted on the success panel, where the primary button already leaves. */
  onClose?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-1 bg-surface-dark">
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Close sits in the corner on its own row, so it can never collide with the centred
            content below at any font scale. Reserves its height either way to stop the
            content jumping when the panel changes. */}
        <View className="h-11 flex-row items-center justify-end px-4">
          {onClose ? (
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="h-9 w-9 items-center justify-center rounded-full active:opacity-60"
            >
              <Ionicons name="close" size={24} color="rgba(255,255,255,0.6)" />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 24,
            paddingBottom: 16,
          }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

export default function VenueActivationScreen() {
  // Polls `users.me` until billing goes live, then stops on its own. The screen has no other
  // way to find out: payment happens in a browser, frequently on another device (D-16), so
  // there is no callback, no deep link and no push. The first version polled nowhere, and a
  // venue who paid came back to "One last step" 96 seconds after the webhook had landed.
  const subscription = useVenueSubscription({ pollUntilActivated: true });
  const { data: me } = useMe();

  // Sends on mount: the copy claims an email is already on its way, so the claim has to be
  // made by an actual request rather than by the wording. `notify` off — this screen renders
  // the outcome itself, and a toast over it would just repeat the address.
  //
  // Suppressed once activated, which matters on a remount: `users.me` is served from cache,
  // so the success panel paints immediately and a send here would be a pointless request
  // that `requestActivation` rejects with CONFLICT anyway.
  const activation = useActivationEmail({
    source: 'onboarding',
    sendOnMount: !subscription.activated,
    notify: false,
  });

  // The server's address is authoritative, but it is only known once a send has succeeded —
  // the 429 path returns nothing. Fall back to the account email so a remount never
  // degrades to "your email address".
  const address = activation.sentTo ?? me?.email ?? null;

  const panel = activationPanelFor({
    activated: subscription.activated,
    error: activation.error,
    isPending: activation.isPending,
    sent: activation.sent,
  });

  const close = useCallback(() => {
    // `replace`, not `back`: onboarding replaced its way here, so there is nothing to pop
    // to and a plain back would drop out of the app. This also lets (app)/_layout run its
    // location-setup gate on the way to the map.
    router.replace('/(app)/(tabs)/map');
  }, []);

  // Funnel impression, once per mount, and only for a venue actually being prompted. Firing
  // it on the success panel would record a prompt that was never shown and inflate the
  // denominator of the very conversion rate this event exists to measure.
  const seen = useRef(false);
  useEffect(() => {
    if (seen.current || subscription.activated) return;
    seen.current = true;
    track(AnalyticsEvent.VENUE_ACTIVATION_PROMPT_SHOWN, {
      already_requested: false,
      source: 'onboarding',
    });
  }, [subscription.activated]);

  // Android hardware back closes rather than exiting the app (see `close`). Returning
  // true swallows the default pop.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  const handleOpenEmailApp = async () => {
    const opened = await openEmailApp();
    if (!opened) {
      appToast.error(
        "Couldn't open your email app",
        'Open it manually and tap the activation link we sent you.'
      );
    }
  };

  const trialEndsLabel = formatTrialEnd(subscription.trialEndsAt);

  // Activation landed while they were away. Confirming it is the point — they have just
  // handed over a card in a browser and come back to check it worked, so silently dropping
  // them on the map would leave that unanswered.
  if (panel === 'success') {
    return (
      <ActivationLayout>
        <View className="items-center mb-6">
          <Ionicons name="checkmark-circle-outline" size={64} color="#C8FF2F" />
        </View>

        <Text className="text-[28px] font-bold text-white mb-4 text-center">
          You&apos;re all set
        </Text>

        <View className="self-stretch gap-3 mb-8">
          <Text className="text-base text-white/60 text-center leading-6">
            Your subscription is set up and your profile is live — artists can find you now.
          </Text>
          {trialEndsLabel ? (
            <Text className="text-base text-white/60 text-center leading-6">
              Your free trial runs until{' '}
              <Text className="text-white font-semibold">{trialEndsLabel}</Text>. We&apos;ll email
              you before the first payment.
            </Text>
          ) : null}
        </View>

        <AppButton variant="secondary" onPress={close} className="w-full rounded-full py-[18px]">
          CONTINUE TO CEOLX
        </AppButton>
      </ActivationLayout>
    );
  }

  // First send still in flight. Holding here rather than rendering "we've sent…"
  // optimistically — that sentence is either true or it is a lie, and the request is
  // one round trip.
  if (panel === 'sending') {
    return (
      <View className="flex-1 bg-surface-dark items-center justify-center">
        <ActivityIndicator size="large" color="#662FFF" />
        <Text className="text-white text-base mt-4">Setting up your subscription…</Text>
      </View>
    );
  }

  return (
    <ActivationLayout onClose={close}>
      <View className="items-center mb-6">
        <Ionicons name="mail-unread-outline" size={64} color="#C8FF2F" />
      </View>

      <Text className="text-[28px] font-bold text-white mb-4 text-center">One last step</Text>

      {activation.error ? (
        <>
          <View className="self-stretch gap-3 mb-6">
            <Text className="text-base text-white/60 text-center leading-6">
              Your venue profile is created. We couldn&apos;t send the activation email just now, so
              your subscription isn&apos;t set up yet.
            </Text>
          </View>

          <View className="bg-error/15 rounded-lg p-3 mb-6 self-stretch">
            <Text className="text-error text-sm text-center">{activation.error}</Text>
          </View>

          <AppButton
            variant="secondary"
            onPress={activation.request}
            isLoading={activation.isPending}
            disabled={activation.disabled}
            className="w-full rounded-full py-[18px] mb-4"
          >
            TRY AGAIN
          </AppButton>
        </>
      ) : (
        <>
          {/* Separate Texts with a gap rather than '\n\n' inside one block — a blank
                  line costs a full 24px of leading and leaves the paragraphs floating. */}
          <View className="self-stretch gap-3 mb-8">
            <Text className="text-base text-white/60 text-center leading-6">
              Your venue profile is created. We&apos;ve emailed an activation link to{'\n'}
              <Text className="text-white font-semibold">{address ?? 'your email address'}</Text>.
            </Text>
            <Text className="text-base text-white/60 text-center leading-6">
              Open it to set up your subscription and start your free trial. Your profile goes live
              for artists as soon as that&apos;s done.
            </Text>
          </View>

          <AppButton
            variant="secondary"
            onPress={handleOpenEmailApp}
            className="w-full rounded-full py-[18px] mb-4"
          >
            OPEN EMAIL APP
          </AppButton>

          <Pressable
            className={`py-3 ${activation.disabled ? 'opacity-40' : ''}`}
            onPress={activation.request}
            disabled={activation.disabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: activation.disabled }}
          >
            <Text className="text-green-10 text-sm font-semibold text-center">
              {activation.remaining > 0
                ? `Resend in ${activation.remaining}s`
                : "Didn't receive it? Resend email"}
            </Text>
          </Pressable>

          {/* Both words on purpose — Gmail files it under Spam, Outlook under Junk. */}
          <Text className="text-white/40 text-xs text-center mb-4">
            Still nothing? Check your spam or junk folder.
          </Text>
        </>
      )}

      {/* The reassurance that makes closing safe. Without it the X reads as
              "abandon setup". */}
      <Text className="text-white/40 text-xs text-center leading-[18px]">
        No rush — you can finish this any time from your profile.
      </Text>
    </ActivationLayout>
  );
}
