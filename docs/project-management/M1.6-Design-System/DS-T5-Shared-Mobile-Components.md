# DS-T5 · Shared Mobile Components Library

| Field          | Value                                                          |
| -------------- | -------------------------------------------------------------- |
| **Milestone**  | M1.6 — Design System & Shared Packages                         |
| **Status**     | ✅ Done                                                        |
| **Depends on** | DS-T4 (NativeWind v5 + HeroUI Native must be configured)       |
| **PRD Ref**    | Section 10.1 (Mobile App), Section 5 (Map), Section 6 (Events) |

---

## Description

Build the foundational React Native component library in `apps/native/src/components/` for iOS and Android. These components are the building blocks for all M2+ screens. Covers navigation, form inputs, event cards, map pins, skeleton loaders, and feedback components — all styled with NativeWind v5 and CeolX brand tokens.

---

## Affected Apps / Packages

| App / Package | Role                                                      |
| ------------- | --------------------------------------------------------- |
| `apps/native` | Components in `src/components/` — used across all screens |

---

## Requirements

### Navigation Components

#### `BottomTabBar`

Two distinct variants — sourced directly from Figma nav bar components:

**End User variant** (`Nav Bar - End User - *`): 4 tabs — Map, Home (Discover), Bookings, Profile. No FAB. Active tab: `blue-10` icon + label; inactive: `gray-7`.

**Artist / Venue variant** (`Nav Bar - Artist/Venue - *`): 4 tabs — Map, Discover, Requests, Profile — **plus a floating `+` FAB** (green circle, `green-10` background, `#080808` icon) anchored at centre between Discover and Requests. Badge support on Requests tab (count shown as `green-10` circle overlay, per Figma).

Both variants:

- iOS: blurred translucent background; Android: `surface-dark` with elevation shadow
- Bottom safe area aware (`useSafeAreaInsets`)
- Active tab label rendered with `body-3` token (12px SemiBold, per typography scale)

### Form Components

#### `AppTextInput`

- Wraps HeroUI Native `Input` with CeolX styling
- Props: `label`, `error`, `secureTextEntry`, `leftIcon`, `rightIcon`
- Error state: red border + error message below
- Show/hide toggle for password fields

#### `AppButton`

Two button sizes per Figma (`Primary CTA Small`, `Primary CTA Large`, `Secondary CTA Small/Large`, `Text CTA Small/Large`, `Tertiary CTA`):

| Figma name          | Variant    | Size | Notes                                 |
| ------------------- | ---------- | ---- | ------------------------------------- |
| Primary CTA Large   | `primary`  | `lg` | `blue-10` fill, white uppercase label |
| Primary CTA Small   | `primary`  | `sm` | `blue-10` fill, white uppercase label |
| Secondary CTA Large | `outline`  | `lg` | `blue-10` border, transparent fill    |
| Secondary CTA Small | `outline`  | `sm` | `blue-10` border                      |
| Text CTA Large      | `ghost`    | `lg` | No border/fill, `blue-10` text        |
| Text CTA Small      | `ghost`    | `sm` | No border/fill, `blue-10` text        |
| Tertiary CTA        | `tertiary` | `sm` | Gray border, `gray-7` text            |

All labels use `button-1` (16px/20px Bold, uppercase, 1px tracking) or `button-2` (12px/16px Bold, uppercase, 2px tracking) per Figma typography.

- Loading state: spinner replaces label
- Disabled state: reduced opacity

#### `CheckboxField`

- Label + checkbox with CeolX green checked state
- Used for consent checkboxes (DS-T7 / M2-T7)

### Content Components

#### `EventCard`

- Displays event summary in Feed view
- Shows: cover image, title, date, venue name, category badge
- Tappable — navigates to event detail
- Skeleton variant for loading state

#### `MapEventPin`

- Custom map pin for `react-native-maps`
- Single pin: green circle with category icon
- Cluster pin: green circle with count badge
- Active state: enlarged with drop shadow

#### `PersonaCard`

- Displays Artist or Venue profile summary
- Shows: profile image, name, bio snippet, genre tags (Artist) or location (Venue)
- Used in search results and booking flow

### Feedback Components

#### `SkeletonLoader`

- Animated shimmer placeholder
- Variants: `card`, `list-item`, `profile`, `full-screen`
- Used while data is fetching

#### `EmptyState`

- Illustration + title + subtitle + optional CTA button
- Variants: `no-events`, `no-results`, `no-bookings`

#### `AppToast`

- Non-blocking toast notification
- Types: `success`, `error`, `info`, `warning`
- Auto-dismisses after 3 seconds
- Uses `react-native-toast-message` or similar

#### `BottomSheet`

- Reusable bottom sheet (wraps `@gorhom/bottom-sheet`)
- Used for: filter panel on map, booking confirmation, role switch confirmation

---

## Acceptance Criteria

- [ ] `BottomTabBar` renders 4 tabs with correct active/inactive states on iOS + Android
- [ ] `AppTextInput` shows error message and red border when `error` prop is set
- [ ] `AppButton` renders all 4 variants with correct CeolX colours
- [ ] `AppButton` shows spinner in loading state and is non-tappable
- [ ] `EventCard` renders with image, title, date, and skeleton variant
- [ ] `MapEventPin` renders as green circle — cluster variant shows count
- [ ] `SkeletonLoader` animates shimmer effect on iOS + Android
- [ ] `EmptyState` renders illustration + text for each variant
- [ ] `BottomSheet` opens and closes with swipe gesture
- [ ] All components have TypeScript prop definitions (no `any`)

---

## Dependencies

### Upstream

- DS-T4 (NativeWind v5 + HeroUI Native — all components use className)

### Downstream

- M2-T1 (Sign Up/Sign In screens use `AppTextInput`, `AppButton`)
- M3 (Map uses `MapEventPin`, `BottomSheet`, `EmptyState`)
- M4 (Events feed uses `EventCard`, `SkeletonLoader`)
- M5 (Booking flow uses `PersonaCard`, `BottomSheet`)

---

## Technical Notes

### AppButton

```tsx
// apps/native/src/components/AppButton.tsx

import { ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { cn } from '@/lib/utils';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

const variantStyles = {
  primary: 'bg-blue-10 border-transparent',
  outline: 'bg-transparent border-blue-10',
  ghost: 'bg-transparent border-transparent',
  tertiary: 'bg-transparent border-gray-5',
  destructive: 'bg-[#EF4444] border-transparent',
};

const textStyles = {
  primary: 'text-white',
  outline: 'text-blue-10',
  ghost: 'text-blue-10',
  tertiary: 'text-gray-7',
  destructive: 'text-white',
};

const sizeStyles = {
  sm: 'px-3 py-1.5',
  md: 'px-4 py-2.5',
  lg: 'px-6 py-3.5',
};

export const AppButton = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  className,
}: AppButtonProps) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled || loading}
    className={cn(
      'flex-row items-center justify-center rounded-lg border',
      variantStyles[variant],
      sizeStyles[size],
      (disabled || loading) && 'opacity-50',
      className
    )}
  >
    {loading ? (
      <ActivityIndicator color={variant === 'primary' ? '#fff' : '#662FFF'} />
    ) : (
      <Text className={cn('font-semibold text-sm', textStyles[variant])}>{label}</Text>
    )}
  </TouchableOpacity>
);
```

### EventCard

```tsx
// apps/native/src/components/EventCard.tsx

import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import type { Event } from '@ceolx/shared';

export const EventCard = ({ event }: { event: Event }) => {
  const router = useRouter();

  return (
    <TouchableOpacity
      className="bg-surface-dark rounded-xl overflow-hidden border border-gray-10/20 mb-3"
      onPress={() => router.push(`/events/${event.id}`)}
    >
      <Image source={{ uri: event.coverImage }} className="w-full h-40" resizeMode="cover" />
      <View className="p-3">
        <Text className="text-white font-semibold text-base">{event.title}</Text>
        <Text className="text-gray-5 text-sm mt-1">{event.dateStart}</Text>
        <Text className="text-gray-7 text-xs mt-0.5">{event.venueName}</Text>
      </View>
    </TouchableOpacity>
  );
};
```

---

## Common Gotchas

- **Safe area on iOS**: Always use `useSafeAreaInsets()` for bottom tab bar and any full-screen views — without it, components overlap the home indicator on iPhone.
- **Android elevation vs iOS shadow**: NativeWind `shadow-*` classes work on iOS; use `android:elevation-*` for Android card shadows.
- **`react-native-maps` pins**: Custom map pins must be lightweight — avoid SVGs with gradients. Use simple `View`+`Text` compositions to keep map performance smooth.
- **`@gorhom/bottom-sheet` requires Reanimated**: Ensure `react-native-reanimated` is installed and the Babel plugin is configured before using BottomSheet.

---
