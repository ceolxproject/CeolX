import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { AdCard } from './AdCard';

import { dismissAd, getDismissedAdIds } from '@/lib/storage/dismissed-ads';
import { trpc } from '@/utils/trpc';

export function AdStack() {
  const router = useRouter();
  const { data: ads } = useQuery({
    ...trpc.events.feedAds.queryOptions(undefined),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const [dismissedIds, setDismissedIds] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getDismissedAdIds().then((ids) => {
      if (!cancelled) setDismissedIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDismiss = useCallback(async (id: string) => {
    await dismissAd(id);
    setDismissedIds((prev) => (prev ? Array.from(new Set([...prev, id])) : [id]));
  }, []);

  const handlePress = useCallback(
    (id: string) => {
      router.push(`/(app)/(tabs)/discover/event/${id}`);
    },
    [router]
  );

  // Don't render anything until we know what's been dismissed locally —
  // otherwise an ad would briefly flash before being filtered out.
  if (!ads || dismissedIds === null) return null;

  const visible = ads.filter((ad) => !dismissedIds.includes(ad.id));
  if (visible.length === 0) return null;

  return (
    <View className="gap-3 pb-2">
      {visible.map((ad) => (
        <AdCard
          key={ad.id}
          id={ad.id}
          adTitle={ad.adTitle}
          eventTitle={ad.eventTitle}
          coverImage={ad.coverImage}
          onDismiss={handleDismiss}
          onPress={handlePress}
        />
      ))}
    </View>
  );
}
