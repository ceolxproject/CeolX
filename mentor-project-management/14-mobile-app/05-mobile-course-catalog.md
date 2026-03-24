# Mobile Course Catalog

## Description

Implement the course discovery catalog with grid-based course listings, advanced filtering options, sorting capabilities, pull-to-refresh, skeleton loading states, and search integration. The catalog provides a primary entry point for learners to find and browse courses.

## Affected Apps/Packages

- `apps/mobile/src/screens/search/` (new)
- `apps/mobile/src/components/course/` (new)
- `packages/shared/src/services/courseService.ts` (updated)

## Requirements

### 1. Search Results Screen

File: `src/screens/search/SearchResultsScreen.tsx`

Main screen displaying course grid with filters and sorting:

```typescript
import React, { useState, useCallback, useMemo } from 'react';
import {
  FlatList,
  View,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { courseService } from '@services';
import CourseCard from '@components/course/CourseCard';
import FilterBottomSheet from '@components/course/FilterBottomSheet';
import SortBottomSheet from '@components/course/SortBottomSheet';
import SearchHeader from '@components/search/SearchHeader';
import { Ionicons } from '@expo/vector-icons';

interface SearchFilters {
  categories: string[];
  instructors: string[];
  pricingType: 'free' | 'paid' | 'all';
  level: 'beginner' | 'intermediate' | 'advanced' | 'all';
  rating: number; // 0-5
  duration: 'short' | 'medium' | 'long' | 'all';
}

interface SortOption {
  type: 'relevance' | 'recent' | 'popular' | 'rating' | 'price-low' | 'price-high';
  label: string;
}

export function SearchResultsScreen({
  route,
  navigation,
}: SearchResultsScreenProps) {
  const { query = '', filters: initialFilters = {} } = route.params || {};

  const [searchQuery, setSearchQuery] = useState(query);
  const [filters, setFilters] = useState<SearchFilters>({
    categories: [],
    instructors: [],
    pricingType: 'all',
    level: 'all',
    rating: 0,
    duration: 'all',
    ...initialFilters,
  });
  const [sortBy, setSortBy] = useState<SortOption['type']>('relevance');
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);

  const fetchCourses = useCallback(
    async (pageNum = 1, append = false) => {
      if (pageNum === 1) {
        setIsLoading(true);
      } else {
        setIsFetchingMore(true);
      }

      try {
        const results = await courseService.search({
          query: searchQuery,
          filters,
          sortBy,
          page: pageNum,
          limit: 12,
        });

        if (append) {
          setCourses((prev) => [...prev, ...results.data]);
        } else {
          setCourses(results.data);
        }

        setHasMore(results.hasMore);
        setPage(pageNum);
      } catch (error) {
        showError('Failed to load courses');
      } finally {
        setIsLoading(false);
        setIsFetchingMore(false);
      }
    },
    [searchQuery, filters, sortBy]
  );

  useFocusEffect(
    useCallback(() => {
      fetchCourses(1, false);
    }, [fetchCourses])
  );

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    setPage(1);
  };

  const handleApplyFilters = (newFilters: SearchFilters) => {
    setFilters(newFilters);
    setPage(1);
    setShowFilterSheet(false);
  };

  const handleSort = (sortOption: SortOption['type']) => {
    setSortBy(sortOption);
    setShowSortSheet(false);
  };

  const handleLoadMore = () => {
    if (!isFetchingMore && hasMore) {
      fetchCourses(page + 1, true);
    }
  };

  const handleRefresh = () => {
    fetchCourses(1, false);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.categories.length > 0) count++;
    if (filters.instructors.length > 0) count++;
    if (filters.pricingType !== 'all') count++;
    if (filters.level !== 'all') count++;
    if (filters.rating > 0) count++;
    if (filters.duration !== 'all') count++;
    return count;
  }, [filters]);

  return (
    <View style={styles.container}>
      <SearchHeader
        value={searchQuery}
        onChangeText={handleSearch}
        onFilterPress={() => setShowFilterSheet(true)}
        onSortPress={() => setShowSortSheet(true)}
        filterBadge={activeFilterCount > 0 ? activeFilterCount.toString() : undefined}
      />

      {isLoading ? (
        <SkeletonLoader count={6} />
      ) : courses.length === 0 ? (
        <EmptyState
          icon="search"
          title="No courses found"
          description={`Try adjusting your search or filters`}
        />
      ) : (
        <FlatList
          data={courses}
          renderItem={({ item }) => (
            <CourseCard
              course={item}
              onPress={() =>
                navigation.navigate('CourseDetail', { courseId: item.id })
              }
            />
          )}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingMore ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : null
          }
          refreshing={isLoading}
          onRefresh={handleRefresh}
          scrollEventThrottle={16}
        />
      )}

      <FilterBottomSheet
        visible={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        onApply={handleApplyFilters}
        initialFilters={filters}
      />

      <SortBottomSheet
        visible={showSortSheet}
        onClose={() => setShowSortSheet(false)}
        onSelect={handleSort}
        selected={sortBy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  listContent: {
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
});
```

### 2. Course Card Component

File: `src/components/course/CourseCard.tsx`

Individual course card for grid display:

```typescript
interface CourseCardProps {
  course: Course;
  onPress: () => void;
  showBookmarkButton?: boolean;
  onBookmarkToggle?: (courseId: string, isBookmarked: boolean) => void;
}

export function CourseCard({
  course,
  onPress,
  showBookmarkButton = true,
  onBookmarkToggle,
}: CourseCardProps) {
  const [isBookmarked, setIsBookmarked] = useState(course.isBookmarked || false);

  const handleBookmarkPress = () => {
    const newValue = !isBookmarked;
    setIsBookmarked(newValue);
    onBookmarkToggle?.(course.id, newValue);
  };

  return (
    <Pressable style={styles.container} onPress={onPress}>
      <ImageBackground
        source={{ uri: course.thumbnailUrl }}
        style={styles.thumbnail}
        resizeMode="cover"
      >
        {/* Overlay gradient */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.6)']}
          style={styles.overlay}
        />

        {/* Price badge */}
        {course.price > 0 && (
          <View style={styles.priceBadge}>
            <Text style={styles.priceText}>${course.price}</Text>
          </View>
        )}

        {/* Bookmark button */}
        {showBookmarkButton && (
          <Pressable
            style={styles.bookmarkButton}
            onPress={handleBookmarkPress}
          >
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={colors.white}
            />
          </Pressable>
        )}

        {/* Duration badge */}
        <View style={styles.durationBadge}>
          <Ionicons name="time" size={14} color={colors.white} />
          <Text style={styles.durationText}>{course.durationHours}h</Text>
        </View>
      </ImageBackground>

      {/* Content */}
      <View style={styles.content}>
        <Text
          style={styles.title}
          numberOfLines={2}
        >
          {course.title}
        </Text>

        <View style={styles.instructorRow}>
          <Image
            source={{ uri: course.instructor.avatarUrl }}
            style={styles.instructorAvatar}
          />
          <Text
            style={styles.instructorName}
            numberOfLines={1}
          >
            {course.instructor.fullName}
          </Text>
        </View>

        {/* Rating */}
        <View style={styles.ratingRow}>
          <View style={styles.stars}>
            {[...Array(5)].map((_, i) => (
              <Ionicons
                key={i}
                name={i < Math.floor(course.rating) ? 'star' : 'star-outline'}
                size={12}
                color={i < Math.floor(course.rating) ? colors.warning : colors.border}
              />
            ))}
          </View>
          <Text style={styles.ratingText}>
            {course.rating.toFixed(1)} ({course.reviewCount})
          </Text>
        </View>

        {/* Enrollment info */}
        <Text style={styles.enrolledText}>
          {course.enrolledCount.toLocaleString()} students
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  thumbnail: {
    height: 150,
    width: '100%',
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  priceBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  priceText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 12,
  },
  bookmarkButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  durationText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 18,
  },
  instructorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  instructorAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  instructorName: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginVertical: spacing.xs,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  enrolledText: {
    fontSize: 11,
    color: colors.textTertiary,
  },
});
```

### 3. Filter Bottom Sheet

File: `src/components/course/FilterBottomSheet.tsx`

```typescript
interface FilterBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: SearchFilters) => void;
  initialFilters: SearchFilters;
}

export function FilterBottomSheet({
  visible,
  onClose,
  onApply,
  initialFilters,
}: FilterBottomSheetProps) {
  const [filters, setFilters] = useState(initialFilters);
  const [categories, setCategories] = useState<string[]>([]);
  const [instructors, setInstructors] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      loadFilterOptions();
    }
  }, [visible]);

  const loadFilterOptions = async () => {
    const cats = await courseService.getCategories();
    const instrs = await courseService.getFeaturedInstructors();
    setCategories(cats);
    setInstructors(instrs);
  };

  const toggleFilter = (
    type: keyof SearchFilters,
    value: any
  ) => {
    if (type === 'categories' || type === 'instructors') {
      const array = filters[type] as string[];
      if (array.includes(value)) {
        setFilters({
          ...filters,
          [type]: array.filter((item) => item !== value),
        });
      } else {
        setFilters({
          ...filters,
          [type]: [...array, value],
        });
      }
    } else {
      setFilters({
        ...filters,
        [type]: value,
      });
    }
  };

  const handleApply = () => {
    onApply(filters);
  };

  const handleReset = () => {
    setFilters({
      categories: [],
      instructors: [],
      pricingType: 'all',
      level: 'all',
      rating: 0,
      duration: 'all',
    });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Filters</Text>
          <Pressable onPress={handleReset}>
            <Text style={styles.resetLink}>Reset</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Category filter */}
          <FilterSection title="Category">
            {categories.map((cat) => (
              <FilterCheckbox
                key={cat}
                label={cat}
                checked={filters.categories.includes(cat)}
                onToggle={() => toggleFilter('categories', cat)}
              />
            ))}
          </FilterSection>

          {/* Level filter */}
          <FilterSection title="Level">
            {['Beginner', 'Intermediate', 'Advanced'].map((level) => (
              <FilterCheckbox
                key={level}
                label={level}
                checked={filters.level === level.toLowerCase()}
                onToggle={() =>
                  toggleFilter('level', level.toLowerCase())
                }
              />
            ))}
          </FilterSection>

          {/* Price filter */}
          <FilterSection title="Price">
            {['Free', 'Paid'].map((type) => (
              <FilterCheckbox
                key={type}
                label={type}
                checked={filters.pricingType === type.toLowerCase()}
                onToggle={() =>
                  toggleFilter('pricingType', type.toLowerCase())
                }
              />
            ))}
          </FilterSection>

          {/* Rating filter */}
          <FilterSection title="Minimum Rating">
            {[0, 3, 4, 4.5].map((rating) => (
              <FilterCheckbox
                key={rating}
                label={rating === 0 ? 'Any' : `${rating}+`}
                checked={filters.rating === rating}
                onToggle={() => toggleFilter('rating', rating)}
              />
            ))}
          </FilterSection>

          {/* Duration filter */}
          <FilterSection title="Duration">
            {['Short', 'Medium', 'Long'].map((duration) => (
              <FilterCheckbox
                key={duration}
                label={duration}
                checked={filters.duration === duration.toLowerCase()}
                onToggle={() =>
                  toggleFilter('duration', duration.toLowerCase())
                }
              />
            ))}
          </FilterSection>

          {/* Instructors filter */}
          <FilterSection title="Instructor">
            {instructors.map((instructor) => (
              <FilterCheckbox
                key={instructor.id}
                label={instructor.fullName}
                checked={filters.instructors.includes(instructor.id)}
                onToggle={() =>
                  toggleFilter('instructors', instructor.id)
                }
              />
            ))}
          </FilterSection>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Cancel"
            variant="outline"
            onPress={onClose}
            style={{ flex: 1 }}
          />
          <Button
            title="Apply"
            onPress={handleApply}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

function FilterCheckbox({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable style={styles.checkboxRow} onPress={onToggle}>
      <Ionicons
        name={checked ? 'checkbox' : 'checkbox-outline'}
        size={20}
        color={checked ? colors.primary : colors.border}
      />
      <Text style={styles.checkboxLabel}>{label}</Text>
    </Pressable>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: '80%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  resetLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  sectionContent: {
    gap: spacing.md,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  checkboxLabel: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
```

### 4. Sort Bottom Sheet

File: `src/components/course/SortBottomSheet.tsx`

```typescript
const SORT_OPTIONS: SortOption[] = [
  { type: 'relevance', label: 'Relevance' },
  { type: 'recent', label: 'Newest First' },
  { type: 'popular', label: 'Most Popular' },
  { type: 'rating', label: 'Highest Rated' },
  { type: 'price-low', label: 'Price: Low to High' },
  { type: 'price-high', label: 'Price: High to Low' },
];

interface SortBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (sortType: SortOption['type']) => void;
  selected: SortOption['type'];
}

export function SortBottomSheet({
  visible,
  onClose,
  onSelect,
  selected,
}: SortBottomSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.container}>
        <Text style={styles.title}>Sort By</Text>

        {SORT_OPTIONS.map((option) => (
          <Pressable
            key={option.type}
            style={styles.optionRow}
            onPress={() => {
              onSelect(option.type);
              onClose();
            }}
          >
            <Text
              style={[
                styles.optionLabel,
                selected === option.type && styles.optionLabelActive,
              ]}
            >
              {option.label}
            </Text>
            {selected === option.type && (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={colors.primary}
              />
            )}
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionLabel: {
    fontSize: 16,
    color: colors.text,
  },
  optionLabelActive: {
    fontWeight: '600',
    color: colors.primary,
  },
});
```

### 5. Skeleton Loading Component

File: `src/components/loading/SkeletonLoader.tsx`

```typescript
interface SkeletonLoaderProps {
  count?: number;
}

export function SkeletonLoader({ count = 6 }: SkeletonLoaderProps) {
  return (
    <View style={styles.container}>
      {[...Array(count)].map((_, i) => (
        <View key={i} style={styles.columnWrapper}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ))}
    </View>
  );
}

function SkeletonCard() {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800 }),
        withTiming(0.3, { duration: 800 })
      ),
      -1
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.card, animatedStyle]}>
      <View style={styles.thumbnail} />
      <View style={styles.content}>
        <View style={styles.line} />
        <View style={styles.line} />
        <View style={styles.smallLine} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  card: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  thumbnail: {
    height: 150,
    backgroundColor: colors.border,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  line: {
    height: 12,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  smallLine: {
    height: 8,
    width: '60%',
    borderRadius: 4,
    backgroundColor: colors.border,
  },
});
```

### 6. Search Header Component

File: `src/components/search/SearchHeader.tsx`

```typescript
interface SearchHeaderProps {
  value: string;
  onChangeText: (text: string) => void;
  onFilterPress: () => void;
  onSortPress: () => void;
  filterBadge?: string;
}

export function SearchHeader({
  value,
  onChangeText,
  onFilterPress,
  onSortPress,
  filterBadge,
}: SearchHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Ionicons
          name="search"
          size={20}
          color={colors.textTertiary}
        />
        <TextInput
          placeholder="Search courses..."
          placeholderTextColor={colors.textTertiary}
          value={value}
          onChangeText={onChangeText}
          style={styles.input}
        />
      </View>

      <Pressable
        style={styles.filterButton}
        onPress={onFilterPress}
      >
        <Ionicons name="funnel" size={20} color={colors.primary} />
        {filterBadge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{filterBadge}</Text>
          </View>
        )}
      </Pressable>

      <Pressable
        style={styles.sortButton}
        onPress={onSortPress}
      >
        <Ionicons name="swap-vertical" size={20} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    color: colors.text,
  },
  filterButton: {
    position: 'relative',
    padding: spacing.sm,
  },
  sortButton: {
    padding: spacing.sm,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
});
```

## Acceptance Criteria

- [ ] Course grid displays 2 columns of course cards
- [ ] Course cards show thumbnail, title, instructor, rating, price, duration, enrollment count
- [ ] Pull-to-refresh functionality works
- [ ] Infinite scroll loads more courses on reaching end
- [ ] Filter bottom sheet opens with 6 filter types (category, level, price, rating, duration, instructor)
- [ ] Filter selections persist and show badge count on header
- [ ] Sort options include relevance, recent, popular, rating, price (ascending/descending)
- [ ] Search updates results in real-time (with debounce)
- [ ] Skeleton loading shows while fetching
- [ ] Empty state shown when no courses match filters
- [ ] Bookmark toggle works on course cards
- [ ] Course card tap navigates to detail screen
- [ ] Smooth animations on filter/sort transitions
- [ ] Performance: scrolling smooth at 60fps
- [ ] Network error handling with retry option

## Dependencies

- react-native (FlatList, ImageBackground)
- @react-navigation/native
- react-native-gesture-handler
- react-native-reanimated (for skeleton loading)

## Technical Notes

### Search Debouncing

Debounce search queries to avoid excessive API calls:

```typescript
const debouncedSearch = useMemo(
  () =>
    debounce((query: string) => {
      handleSearch(query);
    }, 500),
  [],
);
```

### Pagination Strategy

- Fetch 12 courses per page (2 columns x 6 rows)
- Load more when user reaches 50% from bottom
- Append new courses to existing list

### Filter Persistence

Save filter state to local storage for quick reapply:

```typescript
await AsyncStorage.setItem("lastFilters", JSON.stringify(filters));
```

### Accessibility

- Ensure touch targets 44pt minimum
- Use semantic HTML-like roles (button, checkbox)
- Announce filter counts to screen readers
- Make stars keyboard-navigable

### Cache Strategy

Consider caching course search results with React Query:

```typescript
const { data, isFetching } = useQuery({
  queryKey: ['courses', { query, filters, sortBy, page }],
  queryFn: () => courseService.search(...),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```
