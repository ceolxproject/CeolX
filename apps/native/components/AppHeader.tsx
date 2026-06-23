import { Ionicons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
import { cn } from 'heroui-native';
import { type ComponentProps, type ReactNode, useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CeolxLogo } from './CeolxLogo';
import { BellWithBadge } from './notifications/BellWithBadge';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/**
 * One trailing icon action, rendered AFTER the notification bell in array order.
 * The bell can never follow an action — the ordering convention is enforced by
 * the component, not the caller (see AppHeader's trailing cluster).
 */
export interface HeaderAction {
  key: string;
  icon: IoniconName;
  onPress: () => void;
  /** Required — e.g. "Save event", "Share", "New collection". */
  accessibilityLabel: string;
  /** Active pill highlight (bg #C8FF2F + dark icon). Implies pill chrome. */
  active?: boolean;
  /** Render the rounded #1d1d1d pill at rest (Feed calendar/filter style). */
  pill?: boolean;
  /** Bare-icon colour override (default white). */
  iconColor?: string;
  /** Icon size override (default 23 bare / 20 pill). */
  size?: number;
  disabled?: boolean;
}

export interface AppHeaderProps {
  /* ---- Leading ---- */
  /** 'logo' = brand wordmark, 'back' = arrow + smart back, 'none' = no leading. */
  leading?: 'logo' | 'back' | 'none';
  /** Custom back handler. Falls back to smart router.back() when omitted. */
  onBack?: () => void;
  /** Route used when the stack can't pop. Default Discover. */
  backFallback?: Href;
  /** Logo size when leading='logo'. Default 18. */
  logoFontSize?: number;
  /** Escape hatch replacing the leading slot entirely (e.g. onboarding logout). */
  leadingNode?: ReactNode;

  /* ---- Title ---- */
  title?: string;
  /** Escape hatch for a custom title node (e.g. an editable TextInput). */
  titleNode?: ReactNode;
  titleAlign?: 'left' | 'center';
  /** 'bar' = text-lg bold (default); 'display' = 28px Urbanist hero title. */
  titleSize?: 'bar' | 'display';

  /* ---- Trailing (order is fixed: [bell?][...actions][trailingAccessory?]) ---- */
  /** Notification bell as the first trailing item. Primary surfaces only. */
  showBell?: boolean;
  onBellPress?: () => void;
  bellSize?: number;
  actions?: HeaderAction[];
  /** Non-icon trailing content after bell + actions (Save, Mark-all link, SKIP). */
  trailingAccessory?: ReactNode;

  /* ---- Layout / variant ---- */
  /** 'floating' = absolute overlay for the map (translucent back + top inset). */
  variant?: 'default' | 'floating';
  /** Add top safe-area inset inside the header (screens without a SafeAreaView). */
  insetTop?: boolean;
  /** Bottom hairline border. */
  bordered?: boolean;
  /** Background override (default transparent — parent paints the surface). */
  bgClassName?: string;
  className?: string;
}

const DEFAULT_FALLBACK = '/(app)/(tabs)/discover' as Href;

export function AppHeader({
  leading = 'none',
  onBack,
  backFallback = DEFAULT_FALLBACK,
  logoFontSize = 18,
  leadingNode,
  title,
  titleNode,
  titleAlign = 'left',
  titleSize = 'bar',
  showBell = false,
  onBellPress,
  bellSize = 24,
  actions,
  trailingAccessory,
  variant = 'default',
  insetTop = false,
  bordered = false,
  bgClassName,
  className,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();

  const handleBack = useCallback(() => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace(backFallback);
  }, [onBack, backFallback]);

  const handleBellPress = useCallback(() => {
    if (onBellPress) return onBellPress();
    router.push('/notifications');
  }, [onBellPress]);

  const hasPill = actions?.some((a) => a.pill || a.active) ?? false;
  const hasTrailing = showBell || (actions?.length ?? 0) > 0 || Boolean(trailingAccessory);

  const renderAction = (a: HeaderAction) =>
    a.pill || a.active ? (
      <Pressable
        key={a.key}
        onPress={a.onPress}
        disabled={a.disabled}
        hitSlop={8}
        accessibilityLabel={a.accessibilityLabel}
        className={cn(
          'w-10 h-10 rounded-full items-center justify-center',
          a.active ? 'bg-[#C8FF2F]' : 'bg-[#1d1d1d]'
        )}
      >
        <Ionicons
          name={a.icon}
          size={a.size ?? 20}
          color={a.active ? '#080808' : (a.iconColor ?? '#FFFFFF')}
        />
      </Pressable>
    ) : (
      <Pressable
        key={a.key}
        onPress={a.onPress}
        disabled={a.disabled}
        hitSlop={12}
        accessibilityLabel={a.accessibilityLabel}
        className="active:opacity-70"
      >
        <Ionicons name={a.icon} size={a.size ?? 23} color={a.iconColor ?? '#FFFFFF'} />
      </Pressable>
    );

  const trailing = hasTrailing ? (
    <View className={cn('flex-row items-center', hasPill ? 'gap-2' : 'gap-4')}>
      {showBell && <BellWithBadge onPress={handleBellPress} size={bellSize} />}
      {actions?.map(renderAction)}
      {trailingAccessory}
    </View>
  ) : null;

  /* ---- Floating map overlay (reproduces the old MapHeader exactly) ---- */
  if (variant === 'floating') {
    return (
      <View
        className="absolute left-0 right-0 h-[52px] flex-row items-center px-4"
        style={{ top: insets.top }}
        pointerEvents="box-none"
      >
        {leading === 'back' ? (
          <Pressable
            className="w-12 h-12 rounded-[60px] bg-[rgba(0,0,0,0.55)] items-center justify-center"
            onPress={handleBack}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
        ) : (
          <View className="w-12" />
        )}
        {title ? (
          <Text
            className="flex-1 text-center text-white text-[28px] font-bold"
            style={{ fontFamily: 'Urbanist_700Bold' }}
          >
            {title}
          </Text>
        ) : (
          <View className="flex-1" />
        )}
        {trailing ?? <View className="w-12" />}
      </View>
    );
  }

  /* ---- Leading slot ---- */
  let leadingEl: ReactNode = null;
  if (leadingNode) {
    leadingEl = leadingNode;
  } else if (leading === 'logo') {
    leadingEl = <CeolxLogo fontSize={logoFontSize} letterSpacing={2} />;
  } else if (leading === 'back') {
    leadingEl = (
      <Pressable
        onPress={handleBack}
        hitSlop={12}
        accessibilityLabel="Go back"
        className="active:opacity-70"
      >
        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
      </Pressable>
    );
  }

  /* ---- Title slot ---- */
  const titleEl =
    titleNode ??
    (title ? (
      <Text
        numberOfLines={1}
        className={cn(
          'text-white',
          titleSize === 'display' ? 'text-[28px] font-bold' : 'text-lg font-bold font-urbanist'
        )}
        style={titleSize === 'display' ? { fontFamily: 'Urbanist_700Bold' } : undefined}
      >
        {title}
      </Text>
    ) : null);

  // w-full so the bar always spans its parent — without it, an items-center (or
  // otherwise non-stretching) parent collapses the row to its content width and
  // the trailing cluster drifts to centre instead of pinning right.
  const rowClass = cn(
    'h-14 px-5 flex-row items-center w-full',
    bordered && 'border-b border-[#1d1d1d]',
    bgClassName,
    className
  );

  const row =
    titleAlign === 'center' ? (
      <View className={cn(rowClass, 'justify-between')}>
        {leadingEl ?? <View className="w-6" />}
        {trailing ?? <View className="w-6" />}
        {titleEl && (
          <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
            {titleEl}
          </View>
        )}
      </View>
    ) : (
      <View className={rowClass}>
        {leadingEl}
        {titleEl ? (
          <View className={cn('flex-1', leadingEl && 'ml-3')}>{titleEl}</View>
        ) : (
          <View className="flex-1" />
        )}
        {trailing}
      </View>
    );

  if (insetTop) {
    return (
      <View style={{ paddingTop: insets.top }} className={bgClassName}>
        {row}
      </View>
    );
  }

  return row;
}
