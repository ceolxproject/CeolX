import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProgressRing } from '@/components/analytics/ProgressRing';
import { useEventAnalytics } from '@/hooks/use-event-analytics';
import { formatEventDate } from '@/utils/format-event-date';

const ACCENT = '#C8FF2F';
const SUBTLE_TEXT = 'rgba(255,255,255,0.6)';

export default function EventAnalyticsScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const { data, isLoading, isError, error } = useEventAnalytics(eventId);

  const isForbidden =
    isError && (error as { data?: { code?: string } })?.data?.code === 'FORBIDDEN';

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
      <ScreenHeader onBack={() => router.back()} />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : isForbidden ? (
        <ErrorState
          title="You can't view this analytics page"
          subtitle="Only the event creator can see analytics for their events."
          onBack={() => router.back()}
        />
      ) : isError || !data ? (
        <ErrorState
          title="Couldn't load analytics"
          subtitle="Please try again in a moment."
          onBack={() => router.back()}
        />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          <HeroCard data={data} />

          <SectionTitle>Views over time</SectionTitle>
          <ViewsChart daily={data.views.daily} chartWidth={width - 40} />

          <SectionTitle>Engagement</SectionTitle>
          <EngagementRings data={data} />

          {data.performers.confirmed.length > 0 || data.performers.invitedCount > 0 ? (
            <>
              <SectionTitle>Performers</SectionTitle>
              <PerformersList data={data} />
            </>
          ) : null}

          <SectionTitle>Details</SectionTitle>
          <ContextStrip data={data} />
        </ScrollView>
      )}
    </View>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function ScreenHeader({ onBack }: { onBack: () => void }) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3">
      <Pressable
        onPress={onBack}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={24} color="white" />
      </Pressable>
      <Text className="text-base font-bold tracking-widest text-[#C8FF2F] font-urbanist">
        CEOLX
      </Text>
      <View style={{ width: 24 }} />
    </View>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

interface HeroCardProps {
  data: {
    event: {
      title: string;
      coverImage: string | null;
      dateStart: string;
      dateEnd: string | null;
      venueAddress: string | null;
      category: string;
    };
    saves: { total: number };
  };
}

function HeroCard({ data }: HeroCardProps) {
  const { event, saves } = data;
  return (
    <View className="mx-5 mt-2 rounded-2xl overflow-hidden border border-[rgba(141,141,141,0.4)] bg-[rgba(141,141,141,0.1)]">
      <View className="h-[208px] relative">
        {event.coverImage ? (
          <Image
            source={{ uri: event.coverImage }}
            className="absolute inset-0 w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="absolute inset-0 w-full h-full bg-white/5 items-center justify-center">
            <Ionicons name="image-outline" size={40} color="rgba(255,255,255,0.3)" />
          </View>
        )}
        <View className="absolute bottom-3 left-3 right-3 flex-row items-center justify-between">
          <View className="flex-row items-center bg-[#C8FF2F] rounded-full px-2 h-5 gap-1">
            <Text className="text-[11px]">🎵</Text>
            <Text className="text-[11px] font-semibold text-black font-urbanist">
              {event.category}
            </Text>
          </View>
          {saves.total > 0 && (
            <View className="flex-row items-center gap-1 rounded-full bg-black/55 px-2.5 py-1">
              <Ionicons name="person-outline" size={11} color="white" />
              <Text className="text-[11px] font-semibold text-white font-urbanist">
                {saves.total} Joined
              </Text>
            </View>
          )}
        </View>
      </View>
      <View className="px-3 pt-3 pb-4">
        <Text className="text-2xl font-semibold text-white font-urbanist" numberOfLines={2}>
          {event.title}
        </Text>
        <View className="flex-row items-start gap-2 mt-2">
          <View className="flex-1 flex-row items-center gap-1">
            <Ionicons name="location-outline" size={12} color={SUBTLE_TEXT} />
            <Text className="text-xs font-semibold text-white/60 font-urbanist" numberOfLines={1}>
              {event.venueAddress ?? 'Location TBC'}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="calendar-outline" size={12} color={SUBTLE_TEXT} />
            <Text className="text-xs font-semibold text-white/60 font-urbanist" numberOfLines={1}>
              {formatEventDate(event.dateStart, event.dateEnd ?? undefined)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Section title ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text className="px-5 mt-6 mb-3 text-base font-bold text-white font-urbanist">{children}</Text>
  );
}

// ─── Daily views chart ──────────────────────────────────────────────────────

interface ViewsChartProps {
  daily: Array<{ date: string; count: number }>;
  chartWidth: number;
}

function ViewsChart({ daily, chartWidth }: ViewsChartProps) {
  const total = daily.reduce((sum, b) => sum + b.count, 0);
  const maxCount = daily.reduce((max, b) => Math.max(max, b.count), 0);

  // Pin the y-axis to a clean multiple of noOfSections so every gridline is a
  // whole number of views (no fractional / duplicate ticks from auto-scaling).
  const noOfSections = 4;
  const maxValue = Math.max(noOfSections, Math.ceil(maxCount / noOfSections) * noOfSections);

  // Label every 3rd day on the x-axis (14 days fit comfortably). Irish DD/MM format.
  const data = daily.map((b, i) => {
    const [, mm, dd] = b.date.split('-');
    return {
      value: b.count,
      label: i % 3 === 0 ? `${dd}/${mm}` : '',
      dataPointText: b.count > 0 ? String(b.count) : '',
    };
  });

  if (total === 0) {
    return (
      <View className="mx-5 rounded-2xl bg-[rgba(141,141,141,0.1)] border border-[rgba(141,141,141,0.4)] p-6 items-center">
        <Text className="text-sm text-white/60 font-urbanist text-center">
          No views yet — share your event link to start collecting data.
        </Text>
      </View>
    );
  }

  return (
    <View className="mx-5 rounded-2xl bg-[rgba(141,141,141,0.1)] border border-[rgba(141,141,141,0.4)] py-4 pl-1 pr-4">
      <Text className="pl-4 pb-3 text-[10px] uppercase tracking-wider text-white/40 font-urbanist">
        Views per day
      </Text>
      <LineChart
        data={data}
        // Math: chartWidth - left margin (~30) - right padding (~20). 14 buckets.
        spacing={Math.max(18, Math.floor((chartWidth - 70) / Math.max(daily.length - 1, 1)))}
        thickness={2}
        color={ACCENT}
        dataPointsColor={ACCENT}
        dataPointsRadius={3}
        textColor="white"
        textShiftY={-6}
        textFontSize={9}
        yAxisTextStyle={{ color: SUBTLE_TEXT, fontSize: 10 }}
        // Widen + center each label so full DD/MM dates show (was clipped to "06…").
        xAxisLabelTextStyle={{ color: SUBTLE_TEXT, fontSize: 9, width: 40, textAlign: 'center' }}
        xAxisColor="rgba(141,141,141,0.4)"
        yAxisColor="rgba(141,141,141,0.4)"
        rulesColor="rgba(141,141,141,0.15)"
        rulesType="solid"
        initialSpacing={10}
        endSpacing={20}
        height={140}
        maxValue={maxValue}
        noOfSections={noOfSections}
        hideYAxisText={false}
        backgroundColor="transparent"
      />
    </View>
  );
}

// ─── Engagement rings (3 metrics) ───────────────────────────────────────────

interface EngagementRingsProps {
  data: {
    views: { total: number };
    saves: { total: number };
    engagement: { rate: number };
    ticketClicks: { total: number; clickRate: number | null };
    event: { hasTicketLink: boolean };
  };
}

function EngagementRings({ data }: EngagementRingsProps) {
  return (
    <View className="mx-5 rounded-2xl bg-[rgba(141,141,141,0.1)] border border-[rgba(141,141,141,0.4)] p-4 gap-4">
      <RingRow
        ring={<ProgressRing percentage={data.engagement.rate} />}
        title="Engagement Rate"
        subtitle={`${data.saves.total} saves / ${data.views.total} views`}
      />
      <Divider />
      <RingRow
        ring={<ProgressRing percentage={data.ticketClicks.clickRate} />}
        title="Ticket Link Click Rate"
        subtitle={
          !data.event.hasTicketLink
            ? 'No external ticket link'
            : `${data.ticketClicks.total} click${data.ticketClicks.total === 1 ? '' : 's'} / ${data.views.total} views`
        }
      />
    </View>
  );
}

function RingRow({
  ring,
  title,
  subtitle,
}: {
  ring: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <View className="flex-row items-center gap-4">
      {ring}
      <View className="flex-1">
        <Text className="text-sm font-bold text-white font-urbanist">{title}</Text>
        <Text className="text-xs text-white/60 font-urbanist mt-0.5">{subtitle}</Text>
      </View>
    </View>
  );
}

function Divider() {
  return <View className="h-px bg-[rgba(141,141,141,0.2)]" />;
}

// ─── Performers ─────────────────────────────────────────────────────────────

interface PerformersListProps {
  data: {
    performers: {
      confirmed: Array<{
        artistProfileId: string;
        stageName: string;
        profileImageUrl: string | null;
      }>;
      invitedCount: number;
    };
  };
}

function PerformersList({ data }: PerformersListProps) {
  const { confirmed, invitedCount } = data.performers;
  return (
    <View className="mx-5 rounded-2xl bg-[rgba(141,141,141,0.1)] border border-[rgba(141,141,141,0.4)] p-4 gap-3">
      {confirmed.map((p) => (
        <View key={p.artistProfileId} className="flex-row items-center gap-3">
          {p.profileImageUrl ? (
            <Image
              source={{ uri: p.profileImageUrl }}
              style={{ width: 36, height: 36, borderRadius: 18 }}
            />
          ) : (
            <View className="w-9 h-9 rounded-full bg-[rgba(255,255,255,0.1)] items-center justify-center">
              <Ionicons name="person" size={16} color={SUBTLE_TEXT} />
            </View>
          )}
          <Text className="flex-1 text-sm text-white font-urbanist" numberOfLines={1}>
            {p.stageName}
          </Text>
        </View>
      ))}
      {invitedCount > 0 && (
        <Text className="text-xs text-white/50 font-urbanist">
          + {invitedCount} outside-platform invite{invitedCount === 1 ? '' : 's'} pending
        </Text>
      )}
    </View>
  );
}

// ─── Context strip ──────────────────────────────────────────────────────────

interface ContextStripProps {
  data: {
    event: {
      status: string;
      createdAt: string;
      updatedAt: string;
    };
    cachedAt: string;
  };
}

function ContextStrip({ data }: ContextStripProps) {
  const created = new Date(data.event.createdAt).toLocaleDateString();
  const updated = new Date(data.event.updatedAt).toLocaleDateString();
  const cachedAt = new Date(data.cachedAt).toLocaleTimeString();

  return (
    <View className="mx-5 rounded-2xl bg-[rgba(141,141,141,0.1)] border border-[rgba(141,141,141,0.4)] p-4 gap-2">
      <ContextRow label="Status" value={data.event.status.toUpperCase()} />
      <ContextRow label="Created" value={created} />
      <ContextRow label="Last edited" value={updated} />
      <ContextRow label="Data freshness" value={`Cached at ${cachedAt}`} />
    </View>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-xs text-white/60 font-urbanist">{label}</Text>
      <Text className="text-xs font-semibold text-white font-urbanist">{value}</Text>
    </View>
  );
}

// ─── Error state ────────────────────────────────────────────────────────────

function ErrorState({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center px-8 gap-3">
      <Ionicons name="lock-closed-outline" size={48} color={SUBTLE_TEXT} />
      <Text className="text-base font-bold text-white font-urbanist text-center">{title}</Text>
      <Text className="text-sm text-white/60 font-urbanist text-center">{subtitle}</Text>
      <Pressable
        onPress={onBack}
        className="mt-4 px-6 py-3 bg-green-10 rounded-full active:opacity-80"
      >
        <Text className="text-xs font-bold text-black tracking-widest uppercase font-urbanist">
          Go Back
        </Text>
      </Pressable>
    </View>
  );
}
