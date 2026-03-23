# Mobile Course Detail

## Description

Implement the course detail screen displaying comprehensive course information including hero section with thumbnail, curriculum accordion, instructor profile, enrollment/purchase call-to-action, bookmarking, social sharing, related courses, and interested learner count. This is the main gateway for users to decide whether to enroll in a course.

## Affected Apps/Packages

- `apps/mobile/src/screens/course/CourseDetailScreen.tsx` (new)
- `apps/mobile/src/components/course/` (new)
- `packages/shared/src/services/courseService.ts` (updated)

## Requirements

### 1. Course Detail Screen

File: `src/screens/course/CourseDetailScreen.tsx`

Main screen with scrollable layout:

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { courseService } from '@services';
import HeroSection from '@components/course/detail/HeroSection';
import CourseStats from '@components/course/detail/CourseStats';
import InstructorCard from '@components/course/detail/InstructorCard';
import CurriculumAccordion from '@components/course/detail/CurriculumAccordion';
import RelatedCourses from '@components/course/detail/RelatedCourses';
import EnrollmentBar from '@components/course/detail/EnrollmentBar';

interface CourseDetail extends Course {
  description: string;
  curriculum: Module[];
  instructor: InstructorProfile;
  interestedCount: number;
  prerequisites?: string[];
  tags: string[];
  reviews: Review[];
}

export function CourseDetailScreen({
  route,
  navigation,
}: CourseDetailScreenProps) {
  const { courseId } = route.params;
  const insets = useSafeAreaInsets();

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);

  const fetchCourseDetail = useCallback(async () => {
    setIsLoading(true);
    try {
      const details = await courseService.getDetail(courseId);
      setCourse(details);
      setIsBookmarked(details.isBookmarked || false);
      setIsEnrolled(details.isEnrolled || false);
    } catch (err) {
      setError('Failed to load course details');
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useFocusEffect(
    useCallback(() => {
      fetchCourseDetail();
    }, [fetchCourseDetail])
  );

  const handleBookmarkToggle = async () => {
    try {
      if (isBookmarked) {
        await courseService.removeBookmark(courseId);
      } else {
        await courseService.addBookmark(courseId);
      }
      setIsBookmarked(!isBookmarked);
    } catch (error) {
      showError('Failed to update bookmark');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out "${course?.title}" on Mentor! 🎓`,
        url: course?.shareUrl || `https://example.com/courses/${courseId}`,
        title: course?.title,
      });
    } catch (error) {
      console.error('Share error', error);
    }
  };

  const handleEnroll = async () => {
    if (course?.price === 0) {
      // Free course - enroll directly
      try {
        await courseService.enroll(courseId);
        setIsEnrolled(true);
        navigation.navigate('home', {
          screen: 'LessonPlayer',
          params: { courseId, lessonId: course.curriculum[0]?.lessons[0]?.id },
        });
      } catch (error) {
        showError('Failed to enroll');
      }
    } else {
      // Paid course - redirect to payment
      navigation.navigate('PaymentCheckout', {
        courseId,
        price: course?.price,
        courseName: course?.title,
      });
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !course) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Course not found'}</Text>
        <Button
          title="Go Back"
          onPress={() => navigation.goBack()}
        />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 60,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with back button */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.headerActions}>
            <Pressable
              onPress={handleBookmarkToggle}
              style={styles.headerButton}
            >
              <Ionicons
                name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                size={24}
                color={colors.primary}
              />
            </Pressable>
            <Pressable
              onPress={handleShare}
              style={styles.headerButton}
            >
              <Ionicons name="share-social" size={24} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {/* Hero section */}
        <HeroSection
          course={course}
          isBookmarked={isBookmarked}
          onBookmarkPress={handleBookmarkToggle}
        />

        {/* Course title and stats */}
        <View style={styles.section}>
          <Text style={styles.title}>{course.title}</Text>
          <CourseStats
            rating={course.rating}
            reviewCount={course.reviewCount}
            enrolledCount={course.enrolledCount}
            interestedCount={course.interestedCount}
          />
        </View>

        {/* Price section */}
        {course.price > 0 && (
          <View style={styles.priceSection}>
            <Text style={styles.price}>${course.price}</Text>
            <Button
              title="Buy Now"
              onPress={handleEnroll}
              style={{ flex: 1 }}
            />
          </View>
        )}

        {/* Description */}
        {course.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About this course</Text>
            <Text style={styles.description}>{course.description}</Text>
          </View>
        )}

        {/* Prerequisites */}
        {course.prerequisites && course.prerequisites.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Prerequisites</Text>
            {course.prerequisites.map((prereq, index) => (
              <View key={index} style={styles.prerequisiteRow}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={styles.prerequisiteText}>{prereq}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Instructor section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instructor</Text>
          <InstructorCard
            instructor={course.instructor}
            onPress={() =>
              navigation.navigate('InstructorProfile', {
                instructorId: course.instructor.id,
              })
            }
          />
        </View>

        {/* Curriculum */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Curriculum</Text>
          <Text style={styles.curriculumSubtitle}>
            {course.curriculum.length} modules • {course.durationHours}h total
          </Text>
          <CurriculumAccordion
            modules={course.curriculum}
            isEnrolled={isEnrolled}
            onLessonPress={(lessonId, moduleIndex) => {
              if (isEnrolled) {
                navigation.navigate('LessonPlayer', {
                  lessonId,
                  courseId,
                });
              }
            }}
          />
        </View>

        {/* Tags */}
        {course.tags && course.tags.length > 0 && (
          <View style={styles.section}>
            <View style={styles.tagsContainer}>
              {course.tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Related courses */}
        <View style={styles.section}>
          <RelatedCourses
            courseId={courseId}
            onCoursePress={(relatedCourseId) => {
              navigation.replace('CourseDetail', {
                courseId: relatedCourseId,
              });
            }}
          />
        </View>

        {/* Reviews */}
        <View style={styles.section}>
          <View style={styles.reviewsHeader}>
            <Text style={styles.sectionTitle}>Reviews</Text>
            <Pressable
              onPress={() =>
                navigation.navigate('CourseReviews', { courseId })
              }
            >
              <Text style={styles.viewAllLink}>View all</Text>
            </Pressable>
          </View>
          {course.reviews.slice(0, 3).map((review, index) => (
            <ReviewCard key={index} review={review} />
          ))}
        </View>
      </ScrollView>

      {/* Sticky enrollment button */}
      {!isEnrolled && (
        <EnrollmentBar
          course={course}
          onEnroll={handleEnroll}
          isLoading={false}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    zIndex: 10,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  headerButton: {
    padding: spacing.sm,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  priceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  price: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
  },
  prerequisiteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  prerequisiteText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
    lineHeight: 20,
  },
  curriculumSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
  },
  tagText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  viewAllLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
});

export default CourseDetailScreen;
```

### 2. Hero Section Component

File: `src/components/course/detail/HeroSection.tsx`

```typescript
interface HeroSectionProps {
  course: CourseDetail;
  isBookmarked: boolean;
  onBookmarkPress: () => void;
}

export function HeroSection({
  course,
  isBookmarked,
  onBookmarkPress,
}: HeroSectionProps) {
  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: course.thumbnailUrl }}
        style={styles.thumbnail}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.overlay}
        />

        {/* Play button if video available */}
        <Pressable style={styles.playButton}>
          <Ionicons name="play" size={40} color={colors.white} />
        </Pressable>

        {/* Info overlay */}
        <View style={styles.infoOverlay}>
          <View style={styles.infoContent}>
            <View style={styles.durationBadge}>
              <Ionicons name="time" size={14} color={colors.white} />
              <Text style={styles.durationText}>{course.durationHours}h</Text>
            </View>
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>{course.level}</Text>
            </View>
          </View>

          <View style={styles.ratingOverlay}>
            <Ionicons name="star" size={16} color={colors.warning} />
            <Text style={styles.ratingText}>
              {course.rating.toFixed(1)} ({course.reviewCount})
            </Text>
          </View>
        </View>
      </ImageBackground>

      {/* Enrolled badge if applicable */}
      {course.isEnrolled && (
        <View style={styles.enrolledBanner}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.enrolledText}>You are enrolled</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  thumbnail: {
    height: 250,
    backgroundColor: colors.border,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoOverlay: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  infoContent: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 6,
  },
  durationText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  levelBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  levelText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  ratingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  enrolledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.successLight,
  },
  enrolledText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
  },
});

export default HeroSection;
```

### 3. Course Stats Component

File: `src/components/course/detail/CourseStats.tsx`

```typescript
interface CourseStatsProps {
  rating: number;
  reviewCount: number;
  enrolledCount: number;
  interestedCount: number;
}

export function CourseStats({
  rating,
  reviewCount,
  enrolledCount,
  interestedCount,
}: CourseStatsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.stat}>
        <Ionicons name="star" size={16} color={colors.warning} />
        <Text style={styles.statValue}>{rating.toFixed(1)}</Text>
        <Text style={styles.statLabel}>({reviewCount})</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.stat}>
        <Ionicons name="people" size={16} color={colors.primary} />
        <Text style={styles.statValue}>{formatNumber(enrolledCount)}</Text>
        <Text style={styles.statLabel}>Enrolled</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.stat}>
        <Ionicons name="heart" size={16} color={colors.error} />
        <Text style={styles.statValue}>{formatNumber(interestedCount)}</Text>
        <Text style={styles.statLabel}>Interested</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
  },
  stat: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
});

export default CourseStats;
```

### 4. Instructor Card Component

File: `src/components/course/detail/InstructorCard.tsx`

```typescript
interface InstructorCardProps {
  instructor: InstructorProfile;
  onPress?: () => void;
}

export function InstructorCard({
  instructor,
  onPress,
}: InstructorCardProps) {
  return (
    <Pressable
      style={styles.container}
      onPress={onPress}
      disabled={!onPress}
    >
      <Image
        source={{ uri: instructor.avatarUrl }}
        style={styles.avatar}
      />

      <View style={styles.content}>
        <Text style={styles.name}>{instructor.fullName}</Text>
        <Text style={styles.title}>{instructor.title}</Text>
        <Text
          style={styles.bio}
          numberOfLines={2}
        >
          {instructor.bio}
        </Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Courses</Text>
            <Text style={styles.statValue}>{instructor.courseCount}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Students</Text>
            <Text style={styles.statValue}>
              {formatNumber(instructor.studentCount)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Rating</Text>
            <Text style={styles.statValue}>{instructor.rating.toFixed(1)}</Text>
          </View>
        </View>
      </View>

      {onPress && <Ionicons name="chevron-forward" size={20} color={colors.border} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: 12,
    gap: spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  bio: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
});

export default InstructorCard;
```

### 5. Curriculum Accordion Component

File: `src/components/course/detail/CurriculumAccordion.tsx`

```typescript
interface CurriculumAccordionProps {
  modules: Module[];
  isEnrolled: boolean;
  onLessonPress: (lessonId: string, moduleIndex: number) => void;
}

export function CurriculumAccordion({
  modules,
  isEnrolled,
  onLessonPress,
}: CurriculumAccordionProps) {
  const [expandedModules, setExpandedModules] = useState<Set<number>>(
    new Set([0])
  );

  const toggleModule = (index: number) => {
    const updated = new Set(expandedModules);
    if (updated.has(index)) {
      updated.delete(index);
    } else {
      updated.add(index);
    }
    setExpandedModules(updated);
  };

  return (
    <View>
      {modules.map((module, moduleIndex) => (
        <ModuleItem
          key={module.id}
          module={module}
          moduleIndex={moduleIndex}
          isExpanded={expandedModules.has(moduleIndex)}
          onToggle={() => toggleModule(moduleIndex)}
          isEnrolled={isEnrolled}
          onLessonPress={(lessonId) =>
            onLessonPress(lessonId, moduleIndex)
          }
        />
      ))}
    </View>
  );
}

function ModuleItem({
  module,
  moduleIndex,
  isExpanded,
  onToggle,
  isEnrolled,
  onLessonPress,
}: {
  module: Module;
  moduleIndex: number;
  isExpanded: boolean;
  onToggle: () => void;
  isEnrolled: boolean;
  onLessonPress: (lessonId: string) => void;
}) {
  return (
    <View style={styles.moduleContainer}>
      <Pressable
        style={[
          styles.moduleHeader,
          isExpanded && styles.moduleHeaderExpanded,
        ]}
        onPress={onToggle}
      >
        <View style={styles.moduleTitle}>
          <Text style={styles.moduleName}>{module.title}</Text>
          <Text style={styles.lessonCount}>
            {module.lessons.length} lessons • {module.durationMinutes}m
          </Text>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.text}
        />
      </Pressable>

      {isExpanded && (
        <View style={styles.lessonsContainer}>
          {module.lessons.map((lesson, lessonIndex) => (
            <Pressable
              key={lesson.id}
              style={styles.lessonRow}
              onPress={() => {
                if (isEnrolled) {
                  onLessonPress(lesson.id);
                }
              }}
              disabled={!isEnrolled}
            >
              <View style={styles.lessonIndex}>
                <Text style={styles.lessonIndexText}>{lessonIndex + 1}</Text>
              </View>

              <View style={styles.lessonContent}>
                <Text
                  style={[
                    styles.lessonTitle,
                    !isEnrolled && styles.lessonTitleLocked,
                  ]}
                >
                  {lesson.title}
                </Text>
                <Text style={styles.lessonDuration}>
                  {lesson.durationMinutes} min
                </Text>
              </View>

              {!isEnrolled ? (
                <Ionicons
                  name="lock-closed"
                  size={16}
                  color={colors.textTertiary}
                />
              ) : lesson.completed ? (
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.success}
                />
              ) : (
                <Ionicons
                  name="play-circle"
                  size={20}
                  color={colors.primary}
                />
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  moduleContainer: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  moduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  moduleHeaderExpanded: {
    backgroundColor: colors.surface,
  },
  moduleTitle: {
    flex: 1,
  },
  moduleName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  lessonCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  lessonsContainer: {
    backgroundColor: colors.surface,
  },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  lessonIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonIndexText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  lessonContent: {
    flex: 1,
  },
  lessonTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  lessonTitleLocked: {
    color: colors.textSecondary,
  },
  lessonDuration: {
    fontSize: 12,
    color: colors.textTertiary,
  },
});

export default CurriculumAccordion;
```

## Acceptance Criteria

- [ ] Course detail loads with all information (title, description, curriculum)
- [ ] Hero section shows thumbnail, play button, duration, level, rating
- [ ] Course stats display (rating, enrolled count, interested count)
- [ ] Instructor card shows profile with stats
- [ ] Curriculum accordion shows all modules and lessons
- [ ] Lessons show lock icon for non-enrolled users
- [ ] Enrolled users can tap lessons to play
- [ ] Bookmark button toggles and persists
- [ ] Share button works on iOS and Android
- [ ] Free courses show "Enroll" button
- [ ] Paid courses show price and "Buy Now" button
- [ ] Prerequisites section appears if applicable
- [ ] Related courses carousel at bottom
- [ ] Review section shows top reviews with link to all
- [ ] Sticky enrollment bar visible at bottom (when not enrolled)
- [ ] All content loads smoothly without jank
- [ ] No console errors

## Dependencies

- react-native (ScrollView, ImageBackground, Share)
- @react-navigation/native
- expo-linear-gradient (for overlays)
- @react-native-community/hooks

## Technical Notes

### Enrollment Flow

- Free courses: Direct enrollment, redirect to first lesson
- Paid courses: Navigate to payment screen, return with enrollment status

### Performance Optimization

- Lazy load related courses section
- Cache instructor profile data
- Use FlatList for reviews if many

### Accessibility

- All interactive elements 44pt+ touch target
- Heading hierarchy: title > section titles
- Announce lock status for screen readers
- Color not sole indicator (use icons)

### Share Implementation

Customize share message by platform:

```typescript
const message = Platform.select({
  ios: `Check out "${course.title}" on Mentor! 🎓\n\nMaster beauty and cosmetics skills.`,
  android: `Check out "${course.title}" on Mentor!\nMaster beauty and cosmetics skills.`,
});
```
