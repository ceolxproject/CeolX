# Course Catalog UI - React Native Mobile

## Description

Implement the course discovery and browsing interface for Learner Mobile (React Native). This includes a FlatList-based course grid, pull-to-refresh functionality, bottom sheet filtering modal, sort controls, and skeleton loading states. The mobile UI must be optimized for touch interaction and fast performance on mid-range devices.

## Affected Apps/Packages

- `apps/learner-mobile` — React Native frontend
- `apps/learner-mobile/screens/CourseCatalogScreen.tsx` — Main catalog screen
- `apps/learner-mobile/screens/CourseDetailScreen.tsx` — Detail navigation target
- `apps/learner-mobile/components/CourseCard.tsx` — Card component
- `apps/learner-mobile/components/FilterBottomSheet.tsx` — Filter modal
- `apps/learner-mobile/components/SortMenu.tsx` — Sort dropdown
- `apps/learner-mobile/hooks/useCourses.ts` — Data fetching
- `shared/types` — Course type definitions

## UI Design System

### Color Palette

- Primary: Brand color (e.g., #FF6B9D)
- Secondary: Neutral gray (e.g., #F5F5F5)
- Text: Dark gray (#333333)
- Border: Light gray (#EEEEEE)
- Danger: Red (#E74C3C)
- Success: Green (#27AE60)

### Typography

- Heading 1 (title): 24px, bold (700)
- Heading 2 (card title): 16px, bold (600)
- Heading 3 (subtitle): 14px, medium (500)
- Body: 14px, regular (400)
- Caption: 12px, regular (400)

### Spacing

- xs: 4px
- sm: 8px
- md: 12px
- lg: 16px
- xl: 24px

### Border Radius

- Small: 8px (cards, buttons)
- Large: 12px (modal, sheets)

## Screen Structure

### Course Catalog Screen Layout

**Header (SafeAreaView):**

```
┌───────────────────────────────────────┐
│ ≡ Logo | Search | User Profile (icon) │
└───────────────────────────────────────┘
```

**Search Bar (sticky):**

```
┌───────────────────────────────────────┐
│ 🔍 Search courses...          [⚙️]   │
└───────────────────────────────────────┘
```

**Top Bar (below search):**

```
┌───────────────────────────────────────┐
│ [⬇ Sort] | [Newest ▼] | [Filters 🔽] │
└───────────────────────────────────────┘
```

**Main Content:**

```
┌──────────────────────┐ ┌──────────────────────┐
│   Course Card 1      │ │   Course Card 2      │
├──────────────────────┤ ├──────────────────────┤
│ Thumb (16:9)         │ │ Thumb (16:9)         │
│ Title (2 lines max)  │ │ Title (2 lines max)  │
│ Instructor + Avatar  │ │ Instructor + Avatar  │
│ Badges & Price       │ │ Badges & Price       │
│ ❤️ 567 Interest       │ │ ❤️ 234 Interest       │
└──────────────────────┘ └──────────────────────┘

┌──────────────────────┐ ┌──────────────────────┐
│   Course Card 3      │ │   Course Card 4      │
└──────────────────────┘ └──────────────────────┘
...
```

**Loading Indicator (bottom):**

```
Loading more courses...
⟳ (spinner)
```

### Course Card Component

**Dimensions:**

- Container: Full width with gutters (12px), 2-column grid
- Card width: (screen width - 24px - 12px gutter) / 2
- Thumbnail: 16:9 aspect ratio
- Touch target (card): min 48x48px

**Layout:**

```
┌─────────────────────┐
│  Thumbnail (16:9)   │ ← LazyImage with skeleton
├─────────────────────┤
│Title (2 lines max)  │
│Instructor + Avatar  │ ← 32x32px circle avatar
├─────────────────────┤
│Category | Type Badge│ ← Badge styling
│€29.99 | 8 lessons   │
├─────────────────────┤
│❤️ 567 interested    │ ← Heart icon + count
│[Interested Button]  │ ← Pressable area
└─────────────────────┘
```

**Styling:**

- Background: white (#FFFFFF)
- Border: 1px light gray
- Border radius: 8px
- Shadow: elevation 2 (Android), shadow-small (iOS)
- Padding: 8px

**Badge Colors:**

- Free: Green background, white text
- Paid: Gray background, white text
- Masterclass: Purple background, white text
- Single Lesson: Blue background, white text
- Category: Light gray background, dark text

### Bottom Sheet Filter Modal

**Header:**

```
┌──────────────────────────────┐
│ Filters              [Close X]│
└──────────────────────────────┘
```

**Content (ScrollView):**

```
📂 Category
  ☐ Makeup (45)
  ☐ Skincare (32)
  ☐ Haircare (18)
  [Show More...]

💰 Price
  ◉ All Courses
  ○ Free Only
  ○ Paid Only

📺 Course Type
  ☐ Masterclass (120)
  ☐ Single Lesson (54)

[Clear All Filters]

```

**Footer (sticky, safe area):**

```
┌──────────────────────────────┐
│[Cancel]           [Apply]    │
└──────────────────────────────┘
```

**Behavior:**

- Swipe-to-dismiss gesture (pan responder or BottomSheetModal)
- Drag indicator at top
- Safe area bottom padding
- Content scrollable, footer sticky
- Apply button updates parent state + API call
- Cancel button closes without changes

### Sort Menu

**Dropdown Style:**

```
┌─────────────────────────────────┐
│ ◉ Newest                        │
│ ○ Most Popular                  │
│ ○ Most Interested               │
│ ○ Price: Low to High            │
│ ○ Price: High to Low            │
│ ○ Duration: Short to Long       │
│ ○ Duration: Long to Short       │
└─────────────────────────────────┘
```

**Position:** Overlay menu below sort button, tap elsewhere to dismiss

## Component Implementation

### FlatList Configuration

```tsx
<FlatList
  data={courses}
  renderItem={renderCourseCard}
  keyExtractor={(item) => item.id}
  numColumns={2}
  columnWrapperStyle={{ gap: 12 }}
  contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12 }}
  onEndReached={handleLoadMore}
  onEndReachedThreshold={0.8}
  ListHeaderComponent={renderSearchBar}
  ListFooterComponent={renderLoadingIndicator}
  ListEmptyComponent={renderEmptyState}
  refreshControl={
    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
  }
  scrollIndicatorInsets={{ right: 1 }}
/>
```

### Pull-to-Refresh

- Triggered at FlatList top
- Show spinner while fetching
- Re-fetch first page of courses
- Reset all filters to defaults on refresh (optional)
- Duration: 500-1000ms for natural feel

### Skeleton Loader

**CourseCardSkeleton:**

```tsx
<View style={styles.card}>
  <Animated.View style={[styles.thumbnail, styles.skeleton]} />
  <View style={styles.content}>
    <Animated.View style={[styles.titleSkeleton, styles.skeleton]} />
    <Animated.View style={[styles.subtitleSkeleton, styles.skeleton]} />
    <Animated.View style={[styles.tagSkeleton, styles.skeleton]} />
  </View>
</View>
```

**Shimmer Effect:**

- Use `react-native-shimmer-placeholder` or Reanimated
- Animated gradient from left to right
- 1000ms duration, infinite loop
- Only show while loading

### Image Lazy Loading

- Use `react-native-lazy-index` or React Native Image
- Placeholder: gray rectangle (F5F5F5)
- Load image when visible in viewport
- Fade-in animation (200ms)
- Error fallback: generic image icon

### Touch Feedback

- Course card: opacity change on press (0.8)
- Interest button: scale animation (0.95x)
- Filter button: opacity + color change
- Duration: 150ms

## State Management

### Local State (per screen)

```tsx
const [courses, setCourses] = useState<Course[]>([]);
const [page, setPage] = useState(1);
const [isLoading, setIsLoading] = useState(false);
const [isRefreshing, setIsRefreshing] = useState(false);
const [hasMore, setHasMore] = useState(true);
const [error, setError] = useState<string | null>(null);

// Filters
const [filters, setFilters] = useState({
  category: null,
  priceType: "all",
  courseType: "all",
  sortBy: "newest",
});
```

### Global State (Redux/Zustand)

- Persist filter preferences across app sessions
- User interested courses list (for optimistic updates)
- Course detail cache

### API Integration Hook

```tsx
const useCourses = (filters: Filters, page: number) => {
  const [data, setData] = useState<{ courses: Course[]; total: number } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCourses(filters, page)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [filters, page]);

  return { data, loading, error };
};
```

## Navigation Flow

```
CourseCatalogScreen
  ├── [user taps course card]
  └─→ CourseDetailScreen (courseId: string)
       ├── [user taps "Interested" button]
       │  └─→ POST /courses/{id}/interest (optimistic update)
       └── [user taps "Enroll/Preview"]
          └─→ CoursePreviewScreen or CheckoutScreen
```

## Error Handling

### Network Errors

- No internet: Show "Check your connection" message with retry button
- API error (50x): Show "Something went wrong" with retry
- API error (4xx): Show specific error message (invalid filters, etc.)

### Empty States

- No courses found: "No courses match your filters. Try adjusting them."
- First load: Show skeleton grid (12 cards)
- End of list: Show "You've reached the end"

### Performance Optimization

- Memoize `renderCourseCard` with `useCallback`
- Use `React.memo` for CourseCard component
- Remove unused dependencies from hooks
- Debounce filter changes (300ms) before API call
- Pagination: load 12 items per page
- FlatList: `removeClippedSubviews={true}` on Android
- Max age for cached data: 5 minutes

## Acceptance Criteria

- [ ] CourseCatalogScreen renders with FlatList showing 2-column grid
- [ ] Course cards display: thumbnail, title, instructor, category, price, type badge, interested count
- [ ] FlatList pagination loads next page at 80% scroll
- [ ] Pull-to-refresh resets to page 1 and re-fetches data
- [ ] Filter bottom sheet opens on Filters button tap
- [ ] Category filter shows up to 5 categories with "Show More" option
- [ ] Price filter toggle (All/Free/Paid) works correctly
- [ ] Course type filter works and reflects in course cards
- [ ] Sort menu displays 6+ sort options
- [ ] Filter changes API call and update course list
- [ ] Applied filters count displayed on Filters button badge
- [ ] Skeleton loaders show during initial load
- [ ] Skeleton loaders have shimmer animation
- [ ] Course thumbnail images lazy-load with fade-in
- [ ] Interested button toggles optimistically (icon + count change)
- [ ] Interested count persists after app close/reopen
- [ ] Touch feedback (opacity) on card and button press
- [ ] Touch targets meet minimum 44px (accessibility)
- [ ] Empty state shown if no courses found
- [ ] Error state shown with retry button on API failure
- [ ] Loading indicator shown at bottom during pagination fetch
- [ ] Performance: initial load < 2s on mid-range device (Snapdragon 730)
- [ ] No memory leaks on filter changes or navigation away
- [ ] No jank (frame drops) during scroll on iOS/Android
- [ ] Responsive on iPhone SE (375px), iPhone 14 (390px), Samsung Galaxy A11 (360px)
- [ ] Safe area padding respected on notch/punch-hole devices
- [ ] No console warnings in release build
- [ ] Navigation back from detail screen returns to same scroll position
- [ ] Filter state persists on app backgrounding/resuming
- [ ] Works offline: show cached courses if available

## Dependencies

- `react-native` (v0.72+)
- `@react-navigation/native` (v6+) — Navigation
- `@react-navigation/bottom-tabs` — Bottom tab navigation
- `react-native-gesture-handler` — Gesture handling
- `react-native-reanimated` — Animations
- `@react-native-community/bottom-sheet` — Filter modal
- `react-native-image-cache-wrapper` — Image caching
- `axios` / `fetch` — HTTP client
- `zustand` / `redux-toolkit` — State management
- `react-native-splash-screen` — Splash screen
- `@react-native-firebase/analytics` (optional) — Event tracking

## Technical Notes

- Use StyleSheet.create() for style optimization (reuse references)
- Implement requestAnimationFrame for smooth animations
- Monitor bundle size: target < 50MB APK/IPA
- Test on both Android and iOS (Xcode simulator, Android emulator)
- Use ProGuard/R8 for Android release builds (shrink code)
- Implement error tracking (Sentry or similar)
- Cache API responses with default TTL of 5 minutes
- Batch interest updates (v2+): send accumulated interest changes every 30s
- Implement deep linking support: `app://courses/{courseId}`
- Consider native module for fast image loading on Android
- Test with network throttling (3G, 4G speeds)
- Implement analytics: track filter usage, sort preferences, interested clicks
- Currency display: always show € symbol (€29.99 format)
- Date formatting: use `react-native-date-fns` or Intl API for localization
