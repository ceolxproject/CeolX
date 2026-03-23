# Shared React Native Mobile Components Library

## Description

Build foundational React Native components in `packages/ui-mobile` for iOS and Android applications. Create navigation components, form inputs, cards, buttons, video player wrapper, bottom sheet, pull-to-refresh, and skeleton loaders. Ensure consistent cross-platform behavior and styling using UniWind CSS configuration. Components serve as the building blocks for course learning, mentorship, and community features.

## Affected Apps/Packages

- `packages/ui-mobile` - Mobile component library
- `apps/mobile-ios` - iOS app consumer
- `apps/mobile-android` - Android app consumer
- `packages/validators` - Form validation integration
- `packages/api-client` - Data fetching integration

## Requirements

### Navigation Components

#### BottomTabNavigator

- Tab-based navigation for main sections
- 4-5 tabs: Home/Explore, My Courses, Saved/Wishlist, Messages, Profile
- Icons with labels, brand color highlight on active tab
- Badge for notification count (messages, new courses)
- Platform-specific styling (iOS: light translucent, Android: solid)
- Bottom safe area awareness
- Accessibility: Tab order, screen reader labels

#### TabBar Header Navigation

- Horizontal scrollable tabs for section filtering
- Active tab indicator (brand primary color underline)
- Smooth scroll to tab on selection
- Variant: scrollable vs. fixed (responsive)
- Props: tabs, activeTab, onTabChange

#### Stack Navigator (Back Navigation)

- Header with back button, title, and optional action button
- Platform-specific back behavior (iOS: swipe back, Android: Android back)
- Status bar color management
- Safe area padding
- Props: title, onBack, rightAction

### Form Components

#### TextInput

- Single-line text input with platform-specific styling
- Props: placeholder, value, onChangeText, error, disabled
- Error state styling (red border, error message below)
- Character limit counter
- Clear button on focus
- Keyboard variants: default, email, numeric, phone, password
- Password toggle (eye icon)

#### SelectInput (Dropdown Picker)

- Modal-based dropdown selector (cross-platform)
- Option list with search/filter
- Single or multiple selection modes
- Customizable option rendering
- Props: items, value, onSelect, multiple, searchable, disabled

#### CheckboxInput

- Checkbox with label
- Controlled component pattern
- Brand color for checked state
- Props: label, checked, onPress, disabled, error

#### RadioGroup

- Radio button group with vertical/horizontal layout
- Single selection from options
- Props: items, value, onSelect, layout, disabled

#### FormField

- Wrapper combining label, input, error, helper text
- Automatic validation feedback
- Required field indicator
- Props: label, required, helper, error, children

#### DateTimePicker

- Platform-native date/time pickers
- iOS: Picker modal, Android: Dialog
- Controlled component with formatting
- Props: value, onChange, mode, minimumDate, maximumDate

### UI Components

#### Card

- Content container with rounded corners and shadow
- Variants: default, elevated, outlined
- Props: title, subtitle, children, footer, onPress, variant

#### Button

- Primary, secondary, ghost, outline, destructive variants
- Loading state with spinner
- Size variants: small, medium, large
- Full-width option
- Icon support (left/right)
- Props: title, variant, onPress, loading, disabled, icon, size, fullWidth

#### Badge

- Status indicator (success, warning, error, info)
- Size variants and colors
- Dismissible option
- Props: label, variant, dismissible, onDismiss, size

#### Avatar

- User profile image display
- Initials fallback
- Size variants: small, medium, large, xlarge
- Optional border/ring style
- Props: image, initials, size, onPress, name

#### StatusIndicator

- Loading spinner with multiple styles (dots, circular, bars)
- Success/error/warning icons
- Optional text below indicator
- Props: status, size, text, color

#### AlertBox

- Alert message display (info, success, warning, error)
- Dismissible with X button
- Icon indicator
- Props: type, title, message, dismissible, onDismiss

#### Badge Pill / Chip

- Small label with optional icon and removal
- Background color variants aligned to brand
- Props: label, icon, onRemove, variant, size

### Media Components

#### VideoPlayer

- Wrapper around react-native-video or Expo Video
- Controls: play/pause, progress bar, fullscreen, volume
- Thumbnail/poster support
- Loading indicator
- Error state with retry
- Adaptive bitrate streaming support
- Progress tracking for learning metrics
- Props: source, poster, onProgress, onEnded, title, autoPlay

#### ImageViewer

- Full-screen image display with pinch-to-zoom
- Swipeable gallery for multiple images
- Thumbnail carousel
- Props: images, initialIndex, onClose

#### VideoThumbnail

- Cached video thumbnail preview
- Loading state with skeleton
- Play icon overlay
- Props: videoId, uri, onPress, size

### Sheet & Modal Components

#### BottomSheet

- Slide-up modal from bottom with drag indicator
- Snap to multiple positions
- Content scrollable within sheet
- Backdrop dismissal
- Props: visible, onClose, snapPoints, children, title, topAction

#### ConfirmationDialog (Mobile)

- Centered modal for confirmations
- Title, description, action buttons
- Responsive: stacked on small screens
- Props: visible, title, message, onConfirm, onCancel, destructive

#### ActionMenu

- Bottom sheet action menu
- Icon and label per action
- Swipe down to close
- Props: items, onSelect, visible, onClose

### List & Collection Components

#### FlatList Wrapper

- Optimized scrolling for large lists
- Pull-to-refresh functionality
- Load more / infinite scroll
- Empty state support
- Separator lines
- Props: data, renderItem, onEndReached, onRefresh, empty, separator

#### SectionList

- Grouped list with section headers
- Sticky section headers
- Props: sections, renderItem, renderSectionHeader

#### PullToRefresh

- Native pull-to-refresh gesture
- Custom refresh icon/animation
- Threshold distance
- Platform-specific styling
- Props: onRefresh, refreshing, colors, backgroundColor

### Skeleton & Loading Components

#### SkeletonLoader

- Animated placeholder for loading content
- Customizable shape (line, circle, rectangle)
- Multiple skeleton variants (list item, card, full screen)
- Props: type, width, height, animated, style

#### SkeletonCard

- Pre-configured skeleton for card loading
- Useful for course/content cards
- Props: count

#### SkeletonListItem

- Pre-configured skeleton for list item loading
- Props: count, animated

#### Shimmer Effect

- Shimmering animation overlay
- Use with skeleton loaders
- Props: style, duration

### Progress Components

#### ProgressBar

- Linear progress indicator
- Percentage or value-based
- Color variants (primary, success, warning, error)
- Animated transitions
- Props: progress, variant, height, animated

#### CircleProgress

- Circular progress indicator
- Percentage display in center
- Size and color variants
- Props: progress, size, color, thickness

#### StepIndicator

- Multi-step progress indicator
- Vertical or horizontal layout
- Current step highlighting
- Props: steps, currentStep, direction, completed

### Other Components

#### EmptyState

- Centered placeholder for empty collections
- Icon, title, description, optional CTA
- Variants: no data, no access, error, no search results
- Props: icon, title, description, action

#### ErrorBoundary

- Error handling for component trees
- Fallback UI display
- Error logging integration
- Props: fallback, onError, resetKeys

#### SafeAreaView

- Wrapper ensuring content respects safe areas
- Automatically handle notch/home indicator
- Props: children, edges

## Acceptance Criteria

- [x] BottomTabNavigator with 4-5 tabs and badge support
- [x] TabBar component for section filtering
- [x] Stack Navigator with back button and safe area support
- [x] TextInput with error states, keyboard variants, password toggle
- [x] SelectInput with modal picker and search/filter
- [x] CheckboxInput, RadioGroup with proper styling
- [x] FormField wrapper combining label, input, error display
- [x] DateTimePicker with platform-native behavior
- [x] Card component with multiple variants and actions
- [x] Button with primary/secondary/ghost/outline/destructive variants
- [x] Badge, Avatar, StatusIndicator components
- [x] AlertBox for notifications
- [x] VideoPlayer wrapper with controls and progress tracking
- [x] ImageViewer with zoom and swipe gallery
- [x] BottomSheet with snap points and gesture handling
- [x] ConfirmationDialog for user confirmations
- [x] ActionMenu for quick actions
- [x] FlatList wrapper with pull-to-refresh and infinite scroll
- [x] SectionList for grouped content
- [x] PullToRefresh gesture component
- [x] SkeletonLoader and variants (Card, ListItem)
- [x] ProgressBar and CircleProgress indicators
- [x] StepIndicator for multi-step flows
- [x] EmptyState component with icon and CTA
- [x] ErrorBoundary for error handling
- [x] SafeAreaView wrapper for notch/home indicator
- [x] All components responsive across device sizes
- [x] All components meet WCAG 2.1 AA accessibility standards (where applicable)
- [x] Keyboard navigation and screen reader support
- [x] TypeScript definitions and JSDoc comments
- [x] Unit tests for component logic
- [x] Integration tests with validators and API client
- [x] Cross-platform testing on iOS and Android emulators
- [x] Performance tested with large lists (1000+ items)
- [x] Zero console warnings or errors

## Dependencies

- `react-native` 0.73+
- `react-native-safe-area-context` - Safe area handling
- `@react-navigation/native` - Navigation framework
- `@react-navigation/bottom-tabs` - Tab navigation
- `@react-navigation/native-stack` - Stack navigation
- `@react-native-community/hooks` - Custom hooks
- `react-native-video` or `expo-video` - Video playback
- `react-native-image-zoom-viewer` - Image zoom
- `react-native-bottom-sheet` - Bottom sheet modal
- `react-native-gesture-handler` - Gesture support
- `react-native-reanimated` - Animation library
- `nativewind` or `uniwind` - Tailwind CSS for React Native
- TypeScript 5.x

## Technical Notes

### Component Structure

```
packages/ui-mobile/components/
├── navigation/
│   ├── BottomTabNavigator.tsx
│   ├── TabBar.tsx
│   └── StackNavigator.tsx
├── form/
│   ├── TextInput.tsx
│   ├── SelectInput.tsx
│   ├── CheckboxInput.tsx
│   ├── RadioGroup.tsx
│   ├── FormField.tsx
│   ├── DateTimePicker.tsx
│   └── index.ts
├── ui/
│   ├── Card.tsx
│   ├── Button.tsx
│   ├── Badge.tsx
│   ├── Avatar.tsx
│   ├── StatusIndicator.tsx
│   ├── AlertBox.tsx
│   └── index.ts
├── media/
│   ├── VideoPlayer.tsx
│   ├── ImageViewer.tsx
│   └── VideoThumbnail.tsx
├── sheet/
│   ├── BottomSheet.tsx
│   ├── ConfirmationDialog.tsx
│   └── ActionMenu.tsx
├── list/
│   ├── FlatListWrapper.tsx
│   ├── SectionList.tsx
│   ├── PullToRefresh.tsx
│   └── index.ts
├── skeleton/
│   ├── SkeletonLoader.tsx
│   ├── SkeletonCard.tsx
│   ├── SkeletonListItem.tsx
│   └── Shimmer.tsx
├── progress/
│   ├── ProgressBar.tsx
│   ├── CircleProgress.tsx
│   └── StepIndicator.tsx
├── empty/
│   ├── EmptyState.tsx
│   └── ErrorBoundary.tsx
└── index.ts
```

### TextInput Implementation Example

```typescript
// components/form/TextInput.tsx
import React, { useState } from 'react'
import {
  View,
  TextInput as RNTextInput,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native'
import { useTheme } from '../../hooks/useTheme'
import { X, Eye, EyeOff } from 'lucide-react-native'

interface TextInputProps {
  placeholder?: string
  value: string
  onChangeText: (text: string) => void
  error?: string
  disabled?: boolean
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'decimal-pad'
  secureTextEntry?: boolean
  maxLength?: number
  multiline?: boolean
  showCharCount?: boolean
}

export function TextInput({
  placeholder,
  value,
  onChangeText,
  error,
  disabled = false,
  keyboardType = 'default',
  secureTextEntry = false,
  maxLength,
  multiline = false,
  showCharCount = false,
}: TextInputProps) {
  const { theme } = useTheme()
  const [isFocused, setIsFocused] = useState(false)
  const [showPassword, setShowPassword] = useState(!secureTextEntry)

  const borderColor = error
    ? theme.colors.semantic.error
    : isFocused
      ? theme.colors.primary[600]
      : theme.colors.neutral[300]

  return (
    <View style={{ marginBottom: error ? 20 : 0 }}>
      <View
        style={{
          borderWidth: 1,
          borderColor,
          borderRadius: theme.borderRadius.md,
          paddingHorizontal: theme.spacing[3],
          paddingVertical: theme.spacing[2],
          flexDirection: 'row',
          alignItems: 'center',
          opacity: disabled ? 0.5 : 1,
          backgroundColor: disabled ? theme.colors.neutral[100] : 'white',
        }}
      >
        <RNTextInput
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          editable={!disabled}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry && !showPassword}
          maxLength={maxLength}
          multiline={multiline}
          style={{
            flex: 1,
            fontSize: theme.typography.fontSize.base,
            fontFamily: theme.typography.fontFamily.sans,
            color: theme.colors.secondary[900],
            paddingVertical: multiline ? theme.spacing[2] : 0,
          }}
          placeholderTextColor={theme.colors.neutral[400]}
        />

        {value && (
          <TouchableOpacity
            onPress={() => onChangeText('')}
            style={{ padding: theme.spacing[1] }}
            disabled={disabled}
          >
            <X
              size={18}
              color={theme.colors.neutral[400]}
              strokeWidth={2}
            />
          </TouchableOpacity>
        )}

        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={{ padding: theme.spacing[1], marginLeft: theme.spacing[1] }}
          >
            {showPassword ? (
              <Eye size={18} color={theme.colors.primary[600]} strokeWidth={2} />
            ) : (
              <EyeOff size={18} color={theme.colors.neutral[400]} strokeWidth={2} />
            )}
          </TouchableOpacity>
        )}
      </View>

      {showCharCount && maxLength && (
        <Text
          style={{
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.neutral[500],
            marginTop: theme.spacing[1],
            textAlign: 'right',
          }}
        >
          {value.length} / {maxLength}
        </Text>
      )}

      {error && (
        <Text
          style={{
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.semantic.error,
            marginTop: theme.spacing[1],
          }}
        >
          {error}
        </Text>
      )}
    </View>
  )
}
```

### VideoPlayer Implementation Example

```typescript
// components/media/VideoPlayer.tsx
import React, { useRef, useState } from 'react'
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native'
import Video, { OnProgress, OnLoadData } from 'react-native-video'
import { Play, Pause, Maximize, Volume2, VolumeX } from 'lucide-react-native'
import { useTheme } from '../../hooks/useTheme'

interface VideoPlayerProps {
  source: string | { uri: string }
  poster?: string
  title?: string
  autoPlay?: boolean
  onProgress?: (progress: OnProgress) => void
  onEnded?: () => void
  onError?: (error: any) => void
  style?: any
}

export function VideoPlayer({
  source,
  poster,
  title,
  autoPlay = false,
  onProgress,
  onEnded,
  onError,
  style,
}: VideoPlayerProps) {
  const { theme } = useTheme()
  const videoRef = useRef<Video>(null)
  const [paused, setPaused] = useState(!autoPlay)
  const [muted, setMuted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)

  const handleLoad = (data: OnLoadData) => {
    setDuration(data.duration)
    setLoading(false)
  }

  const handleProgress = (progress: OnProgress) => {
    setCurrentTime(progress.currentTime)
    onProgress?.(progress)
  }

  const handleEnded = () => {
    setPaused(true)
    onEnded?.()
  }

  const progress = duration ? (currentTime / duration) * 100 : 0

  return (
    <View style={[styles.container, style]}>
      <Video
        ref={videoRef}
        source={typeof source === 'string' ? { uri: source } : source}
        poster={poster}
        paused={paused}
        muted={muted}
        onLoad={handleLoad}
        onProgress={handleProgress}
        onEnd={handleEnded}
        onError={onError}
        resizeMode="contain"
        style={styles.video}
        progressUpdateInterval={1000}
      />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary[600]} />
        </View>
      )}

      <View style={styles.controlsOverlay}>
        <TouchableOpacity
          onPress={() => setPaused(!paused)}
          style={styles.playButton}
        >
          {paused ? (
            <Play size={40} color="white" fill="white" />
          ) : (
            <Pause size={40} color="white" fill="white" />
          )}
        </TouchableOpacity>

        <View style={styles.bottomControls}>
          <View
            style={{
              height: 4,
              backgroundColor: theme.colors.neutral[300],
              borderRadius: 2,
              marginBottom: 8,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                backgroundColor: theme.colors.primary[600],
                width: `${progress}%`,
              }}
            />
          </View>

          <View style={styles.controlsRow}>
            <TouchableOpacity onPress={() => setMuted(!muted)}>
              {muted ? (
                <VolumeX size={20} color="white" />
              ) : (
                <Volume2 size={20} color="white" />
              )}
            </TouchableOpacity>

            <Text style={{ color: 'white', fontSize: 12 }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </Text>

            <TouchableOpacity onPress={() => setFullscreen(!fullscreen)}>
              <Maximize size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {title && (
        <View style={styles.titleBar}>
          <Text style={styles.titleText}>{title}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: 'black',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  playButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  titleText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
})

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
```

### SkeletonLoader Implementation

```typescript
// components/skeleton/SkeletonLoader.tsx
import React, { useEffect, useRef } from 'react'
import {
  View,
  Animated,
  ViewStyle,
} from 'react-native'
import { useTheme } from '../../hooks/useTheme'

interface SkeletonLoaderProps {
  type: 'line' | 'circle' | 'rectangle'
  width?: number | string
  height?: number
  animated?: boolean
  style?: ViewStyle
}

export function SkeletonLoader({
  type,
  width = '100%',
  height = 16,
  animated = true,
  style,
}: SkeletonLoaderProps) {
  const { theme } = useTheme()
  const shimmerAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!animated) return

    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [animated, shimmerAnim])

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  })

  const baseStyle = {
    backgroundColor: theme.colors.neutral[200],
    overflow: 'hidden' as const,
  }

  let shapeStyle: ViewStyle = {}

  if (type === 'circle') {
    shapeStyle = {
      width: height,
      height,
      borderRadius: height / 2,
    }
  } else if (type === 'rectangle') {
    shapeStyle = {
      width,
      height,
      borderRadius: theme.borderRadius.md,
    }
  } else {
    shapeStyle = {
      width,
      height,
      borderRadius: theme.borderRadius.sm,
    }
  }

  return (
    <Animated.View
      style={[
        baseStyle,
        shapeStyle,
        style,
        animated && { opacity },
      ]}
    />
  )
}
```

### Accessibility Guidelines

- Use `accessible` and `accessibilityLabel` props
- Ensure touch target size >= 44x44pt
- Provide screen reader labels for icons
- Test with TalkBack (Android) and VoiceOver (iOS)
- Ensure sufficient color contrast (4.5:1 for text)

### Testing Strategy

1. Unit tests for component logic and state management
2. Snapshot tests for component rendering
3. Integration tests with Redux/Context state
4. E2E tests with React Native Testing Library
5. Manual testing on iOS and Android devices
6. Performance profiling (memory, CPU)
7. Accessibility testing with screen readers

### Performance Tips

- Memoize components with `React.memo()` when appropriate
- Use `FlatList` for large lists with `maxToRenderPerBatch`
- Optimize images and video loading
- Profile bundle size with `react-native-bundle-visualizer`
- Use lazy loading for heavy components
