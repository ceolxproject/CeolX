# Mobile Progress Tracking

## Description

Implement comprehensive progress tracking for learners including lesson completion tracking (90% video watch threshold), module/course progress display with visual indicators, synchronization with web API, and My Courses organization with tabs for In Progress, Completed, and Bookmarked courses.

## Affected Apps/Packages

- `apps/mobile/src/screens/courses/MyCoursesScreen.tsx` (new)
- `apps/mobile/src/components/progress/` (new)
- `packages/shared/src/services/courseService.ts` (updated)

## Requirements

### 1. My Courses Screen

File: `src/screens/courses/MyCoursesScreen.tsx`

Main screen with segmented tabs for course categories:

```typescript
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Text,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { courseService } from '@services';
import SegmentedControl from '@components/common/SegmentedControl';
import CourseProgressCard from '@components/progress/CourseProgressCard';
import EmptyState from '@components/common/EmptyState';

type TabType = 'in-progress' | 'completed' | 'bookmarked';

interface CourseWithProgress {
  id: string;
  title: string;
  thumbnailUrl: string;
  instructor: {
    id: string;
    fullName: string;
    avatarUrl: string;
  };
  progress: {
    completedLessons: number;
    totalLessons: number;
    percentage: number;
    lastAccessedAt: string;
    estimatedTimeRemaining: number; // in minutes
  };
  rating: number;
  enrolledAt: string;
  price: number;
}

interface BookmarkedCourse extends CourseWithProgress {
  bookmarkedAt: string;
}

export function MyCoursesScreen({ route, navigation }: MyCoursesScreenProps) {
  const initialTab = route.params?.tab || 'in-progress';

  const [selectedTab, setSelectedTab] = useState<TabType>(initialTab);
  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const TAB_OPTIONS: Array<{ label: string; value: TabType }> = [
    { label: 'In Progress', value: 'in-progress' },
    { label: 'Completed', value: 'completed' },
    { label: 'Bookmarked', value: 'bookmarked' },
  ];

  const fetchCourses = useCallback(
    async (tabType: TabType, pageNum = 1, append = false) => {
      if (pageNum === 1) {
        setIsLoading(true);
      } else {
        setIsFetchingMore(true);
      }

      try {
        let results;

        switch (tabType) {
          case 'in-progress':
            results = await courseService.getEnrolledCourses({
              status: 'in_progress',
              page: pageNum,
              limit: 10,
              sort: 'lastAccessed',
            });
            break;

          case 'completed':
            results = await courseService.getEnrolledCourses({
              status: 'completed',
              page: pageNum,
              limit: 10,
              sort: 'completedAt',
            });
            break;

          case 'bookmarked':
            results = await courseService.getBookmarkedCourses({
              page: pageNum,
              limit: 10,
            });
            break;
        }

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
    []
  );

  useFocusEffect(
    useCallback(() => {
      fetchCourses(selectedTab, 1, false);
    }, [selectedTab, fetchCourses])
  );

  const handleTabChange = (tab: TabType) => {
    setSelectedTab(tab);
    setPage(1);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchCourses(selectedTab, 1, false);
    setIsRefreshing(false);
  };

  const handleLoadMore = () => {
    if (!isFetchingMore && hasMore) {
      fetchCourses(selectedTab, page + 1, true);
    }
  };

  const handleCoursePress = (courseId: string) => {
    navigation.navigate('home', {
      screen: 'CourseDetail',
      params: { courseId },
    });
  };

  const handleResumeCourse = async (course: CourseWithProgress) => {
    try {
      // Get last accessed lesson
      const lesson = await courseService.getLastAccessedLesson(course.id);
      if (lesson) {
        navigation.navigate('home', {
          screen: 'LessonPlayer',
          params: {
            courseId: course.id,
            lessonId: lesson.id,
            resumePosition: lesson.position,
          },
        });
      }
    } catch (error) {
      showError('Failed to resume course');
    }
  };

  return (
    <View style={styles.container}>
      {/* Tab selector */}
      <View style={styles.tabContainer}>
        <SegmentedControl
          values={TAB_OPTIONS.map((t) => t.label)}
          selectedIndex={TAB_OPTIONS.findIndex((t) => t.value === selectedTab)}
          onChange={(index) => handleTabChange(TAB_OPTIONS[index].value)}
        />
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : courses.length === 0 ? (
        <EmptyState
          icon={
            selectedTab === 'in-progress'
              ? 'book'
              : selectedTab === 'completed'
              ? 'checkmark-circle'
              : 'bookmark'
          }
          title={
            selectedTab === 'in-progress'
              ? 'No courses yet'
              : selectedTab === 'completed'
              ? 'No completed courses'
              : 'No bookmarked courses'
          }
          description={
            selectedTab === 'in-progress'
              ? 'Explore and enroll in courses to get started'
              : 'Courses you complete will appear here'
          }
          actionLabel={selectedTab === 'in-progress' ? 'Browse Courses' : undefined}
          onAction={
            selectedTab === 'in-progress'
              ? () => navigation.navigate('search')
              : undefined
          }
        />
      ) : (
        <FlatList
          data={courses}
          renderItem={({ item }) => (
            <CourseProgressCard
              course={item}
              onPress={() => handleCoursePress(item.id)}
              onResumePress={() => handleResumeCourse(item)}
              showResumeButton={selectedTab === 'in-progress'}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingMore ? (
              <ActivityIndicator
                size="large"
                color={colors.primary}
                style={styles.loadMoreIndicator}
              />
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          scrollEventThrottle={16}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  loadMoreIndicator: {
    marginVertical: spacing.lg,
  },
});

export default MyCoursesScreen;
```

### 2. Course Progress Card Component

File: `src/components/progress/CourseProgressCard.tsx`

Individual course card with progress visualization:

```typescript
interface CourseProgressCardProps {
  course: CourseWithProgress;
  onPress: () => void;
  onResumePress?: () => void;
  showResumeButton?: boolean;
}

export function CourseProgressCard({
  course,
  onPress,
  onResumePress,
  showResumeButton = false,
}: CourseProgressCardProps) {
  const formatLastAccessed = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <Pressable style={styles.container} onPress={onPress}>
      {/* Thumbnail with overlay */}
      <ImageBackground
        source={{ uri: course.thumbnailUrl }}
        style={styles.thumbnail}
        resizeMode="cover"
      >
        <View style={styles.overlay} />

        {/* Progress overlay */}
        <View style={styles.progressBadge}>
          <View style={styles.progressCircle}>
            <Text style={styles.progressText}>{course.progress.percentage}%</Text>
          </View>
        </View>
      </ImageBackground>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {course.title}
        </Text>

        {/* Instructor */}
        <View style={styles.instructorRow}>
          <Image
            source={{ uri: course.instructor.avatarUrl }}
            style={styles.instructorAvatar}
          />
          <Text style={styles.instructorName} numberOfLines={1}>
            {course.instructor.fullName}
          </Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              { width: `${course.progress.percentage}%` },
            ]}
          />
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <Text style={styles.statText}>
            {course.progress.completedLessons}/{course.progress.totalLessons} lessons
          </Text>
          {course.progress.estimatedTimeRemaining > 0 && (
            <Text style={styles.statText}>
              ~{formatMinutes(course.progress.estimatedTimeRemaining)} left
            </Text>
          )}
        </View>

        {/* Last accessed */}
        <Text style={styles.lastAccessedText}>
          Last accessed {formatLastAccessed(course.progress.lastAccessedAt)}
        </Text>

        {/* Resume button */}
        {showResumeButton && (
          <Pressable
            style={styles.resumeButton}
            onPress={onResumePress}
          >
            <Ionicons name="play" size={16} color={colors.white} />
            <Text style={styles.resumeButtonText}>Resume</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  thumbnail: {
    height: 140,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  progressBadge: {
    margin: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
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
  progressBarContainer: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  lastAccessedText: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  resumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 6,
    marginTop: spacing.md,
  },
  resumeButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
});

export default CourseProgressCard;
```

### 3. Progress Tracking Service

File: `packages/shared/src/services/courseService.ts` (add methods)

```typescript
interface LessonProgress {
  lessonId: string;
  courseId: string;
  position: number; // milliseconds
  completed: boolean;
  completedAt?: string;
  durationMillis: number;
  percentageWatched: number;
}

interface CourseProgress {
  courseId: string;
  enrolledAt: string;
  completedAt?: string;
  totalLessons: number;
  completedLessons: number;
  percentage: number;
  estimatedTimeRemaining: number; // minutes
  lastAccessedLessonId?: string;
  lastAccessedAt: string;
}

export class CourseService {
  async updateLessonProgress(data: {
    lessonId: string;
    courseId: string;
    position: number;
    completed: boolean;
  }): Promise<LessonProgress> {
    const { data: result } = await this.api.patch(
      `/courses/${data.courseId}/lessons/${data.lessonId}/progress`,
      {
        position: data.position,
        completed: data.completed,
      }
    );

    // Sync to local cache
    await this.cacheProgress(data.courseId, data.lessonId, result);

    return result;
  }

  async getCourseProgress(courseId: string): Promise<CourseProgress> {
    const { data } = await this.api.get<CourseProgress>(
      `/courses/${courseId}/progress`
    );
    return data;
  }

  async getEnrolledCourses(params: {
    status: "in_progress" | "completed";
    page: number;
    limit: number;
    sort: string;
  }): Promise<{ data: CourseWithProgress[]; hasMore: boolean }> {
    const { data } = await this.api.get("/users/enrolled-courses", {
      params,
    });
    return data;
  }

  async getBookmarkedCourses(params: {
    page: number;
    limit: number;
  }): Promise<{ data: BookmarkedCourse[]; hasMore: boolean }> {
    const { data } = await this.api.get("/users/bookmarked-courses", {
      params,
    });
    return data;
  }

  async getLastAccessedLesson(courseId: string): Promise<{
    id: string;
    position: number;
  } | null> {
    try {
      const { data } = await this.api.get(
        `/courses/${courseId}/last-accessed-lesson`
      );
      return data;
    } catch (error) {
      return null;
    }
  }

  // Calculate estimated time remaining
  private calculateEstimatedTimeRemaining(
    completedLessons: number,
    totalLessons: number,
    courseData: any
  ): number {
    const avgLessonDuration =
      (courseData.durationHours * 60) / courseData.totalLessons;
    const remainingLessons = totalLessons - completedLessons;
    return Math.round(remainingLessons * avgLessonDuration);
  }

  private async cacheProgress(
    courseId: string,
    lessonId: string,
    progress: LessonProgress
  ): Promise<void> {
    try {
      const cached = await AsyncStorage.getItem(`progress_${courseId}`);
      const progressMap = cached ? JSON.parse(cached) : {};
      progressMap[lessonId] = progress;
      await AsyncStorage.setItem(
        `progress_${courseId}`,
        JSON.stringify(progressMap)
      );
    } catch (error) {
      console.error("Cache error", error);
    }
  }
}
```

### 4. Progress Sync Strategy

File: `src/services/progressSync.ts`

Background sync of progress when online:

```typescript
export const useProgressSync = () => {
  const networkState = useNetInfo();

  useEffect(() => {
    if (!networkState.isConnected) return;

    const syncPendingProgress = async () => {
      try {
        // Get all pending progress from local storage
        const keys = await AsyncStorage.getAllKeys();
        const progressKeys = keys.filter((k) => k.startsWith("progress_"));

        for (const key of progressKeys) {
          const courseId = key.replace("progress_", "");
          const progressData = await AsyncStorage.getItem(key);

          if (!progressData) continue;

          const progress = JSON.parse(progressData);

          // Sync each lesson to backend
          for (const [lessonId, lessonProgress] of Object.entries(progress)) {
            try {
              await courseService.updateLessonProgress({
                lessonId,
                courseId,
                position: (lessonProgress as any).position,
                completed: (lessonProgress as any).completed,
              });
            } catch (error) {
              // Retry next sync
              console.error("Sync error for lesson", lessonId);
            }
          }
        }
      } catch (error) {
        console.error("Progress sync error", error);
      }
    };

    // Sync on interval (every 5 minutes when online)
    const interval = setInterval(syncPendingProgress, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [networkState.isConnected]);
};
```

### 5. Module Progress Display

File: `src/components/progress/ModuleProgressIndicator.tsx`

Visual indicator of module completion:

```typescript
interface ModuleProgressIndicatorProps {
  completedLessons: number;
  totalLessons: number;
  showLabel?: boolean;
}

export function ModuleProgressIndicator({
  completedLessons,
  totalLessons,
  showLabel = false,
}: ModuleProgressIndicatorProps) {
  const percentage = (completedLessons / totalLessons) * 100;
  const isCompleted = completedLessons === totalLessons;

  return (
    <View style={styles.container}>
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${percentage}%` }]} />
      </View>
      {showLabel && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            {completedLessons}/{totalLessons}
          </Text>
          {isCompleted && (
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  progressContainer: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});

export default ModuleProgressIndicator;
```

## Acceptance Criteria

- [ ] My Courses screen shows all enrolled courses
- [ ] Segmented control with 3 tabs: In Progress, Completed, Bookmarked
- [ ] Each course card displays progress percentage
- [ ] Progress bar visual indicator with percentage
- [ ] Lesson completion counter (X/Y lessons)
- [ ] Estimated time remaining calculated correctly
- [ ] Last accessed time displayed in human-readable format
- [ ] Resume button on In Progress tab works
- [ ] Pull-to-refresh syncs progress from backend
- [ ] Infinite scroll loads more courses
- [ ] Empty states for each tab with appropriate icons
- [ ] Completed courses show checkmark
- [ ] Bookmarked courses sortable and removable
- [ ] Progress syncs to backend every 30 seconds during playback
- [ ] 90% video watch = lesson complete
- [ ] Module progress displays in curriculum accordion
- [ ] Course progress persists across app restarts
- [ ] No console errors during sync

## Dependencies

- react-native (FlatList, ImageBackground)
- @react-navigation/native
- react-native-netinfo (for sync detection)
- @react-native-async-storage/async-storage (local caching)

## Technical Notes

### Completion Threshold

- Lesson complete when: position / duration >= 0.9 (90%)
- Synced to backend on every 30-second interval
- Also saved on pause/exit

### Progress Calculation

```typescript
courseProgress = (completedLessons / totalLessons) * 100;
estimatedTime = remainingLessons * avgLessonDuration;
```

### Sync Strategy

- Sync every 30 seconds during active playback
- Sync on app backgrounding
- Sync periodically (every 5 min) when online
- Queue failed syncs for retry

### Caching

Local cache structure in AsyncStorage:

```
progress_[courseId]: {
  [lessonId]: { position, completed, completedAt }
}
```

### Offline Support

- Progress saved locally even without network
- Syncs when connection restored
- Show "Syncing..." indicator
- Don't block playback on sync failure

### Accessibility

- Progress percentage as semantic number (not just visual bar)
- Color + icon for completed status
- Touch targets 44pt minimum
