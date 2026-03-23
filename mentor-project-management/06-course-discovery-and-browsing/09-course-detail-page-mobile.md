# Course Detail Page - React Native Mobile

## Description

Implement a comprehensive course detail screen for Learner Mobile (React Native) with scrollable detail view, collapsible sections for curriculum, floating action button (FAB) for enrollment, course sharing capability, and bookmark functionality. Optimized for touch interaction and performance on mid-range devices.

## Affected Apps/Packages

- `apps/learner-mobile/screens/CourseDetailScreen.tsx` — Main detail screen
- `apps/learner-mobile/components/CourseHeader.tsx` — Hero section
- `apps/learner-mobile/components/CurriculumSection.tsx` — Expandable modules
- `apps/learner-mobile/components/InstructorSection.tsx` — Instructor info
- `apps/learner-mobile/components/RelatedCoursesSection.tsx` — Related carousel
- `backend/api/hono` — GET /courses/:id endpoint
- `shared/types` — Course detail types

## Screen Structure

### Full Screen Layout

```
┌──────────────────────────────────┐
│ ◀ Course Detail        [Share]   │ ← Header (SafeAreaView)
├──────────────────────────────────┤
│ ScrollView (main content)        │
│                                  │
│ ┌────────────────────────────┐   │
│ │ Thumbnail (16:9) ▶         │   │ ← Play icon overlay
│ │                            │   │
│ │ Course Title (2-3 lines)   │   │
│ │ Instructor + Avatar        │   │
│ │ Category | Type            │   │
│ │ €29.99 | Paid             │   │
│ │                            │   │
│ │ ❤️ 567 interested          │   │
│ │ [Interested Button]        │   │
│ └────────────────────────────┘   │
│                                  │
│ About This Course                │
│ This course teaches makeup...    │
│                                  │
│ What You'll Learn                │
│ • Skill 1                        │
│ • Skill 2                        │
│ • Skill 3                        │
│                                  │
│ Requirements (if applicable)     │
│ • Requirement 1                  │
│ • Requirement 2                  │
│                                  │
│ Curriculum                       │
│ ┌──────────────────────────────┐ │
│ │ Module 1: Foundations    [▼]  │ │
│ │ 3 lessons, 45 min             │
│ │ ├─ Lesson 1: Intro            │
│ │ ├─ Lesson 2: Basics           │
│ │ └─ Lesson 3: Tools            │
│ │                               │
│ │ Module 2: Techniques     [►]  │
│ │ 4 lessons, 60 min             │
│ └──────────────────────────────┘
│                                  │
│ Instructor                       │
│ ┌──────────────────────────────┐ │
│ │ Avatar (48x48)               │ │
│ │ Name                         │ │
│ │ Bio (2 lines max)            │ │
│ │ [View Other Courses]         │ │
│ └──────────────────────────────┘
│                                  │
│ Related Courses                  │
│ ┌──────┐ ┌──────┐ ┌──────┐      │
│ │Card 1│ │Card 2│ │Card 3│      │
│ └──────┘ └──────┘ └──────┘      │
│                                  │
│ Padding                          │
└──────────────────────────────────┘
┌──────────────────────────────────┐
│ [Floating Action Button]         │ ← FAB (fixed bottom)
│ Enroll Now | €29.99             │
└──────────────────────────────────┘
```

## Screen Implementation

### Main Course Detail Screen

```typescript
// apps/learner-mobile/screens/CourseDetailScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  Share,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getCourseById, markInterested } from '@/api/courses';
import { Course } from '@/types';
import { CourseHeader } from '@/components/CourseHeader';
import { CourseHero } from '@/components/CourseHero';
import { AboutSection } from '@/components/AboutSection';
import { SkillsSection } from '@/components/SkillsSection';
import { RequirementsSection } from '@/components/RequirementsSection';
import { CurriculumSection } from '@/components/CurriculumSection';
import { InstructorSection } from '@/components/InstructorSection';
import { RelatedCoursesSection } from '@/components/RelatedCoursesSection';
import { EnrollFAB } from '@/components/EnrollFAB';
import styles from './CourseDetailScreen.styles';

interface RouteParams {
  courseId: string;
  courseSlug?: string;
}

export const CourseDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { courseId } = route.params as RouteParams;

  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInterested, setIsInterested] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch course on mount
  useEffect(() => {
    const loadCourse = async () => {
      try {
        setIsLoading(true);
        const data = await getCourseById(courseId);
        setCourse(data);
        setIsInterested(data.userIsInterested || false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load course');
      } finally {
        setIsLoading(false);
      }
    };

    loadCourse();
  }, [courseId]);

  // Handle share
  const handleShare = async () => {
    if (!course) return;

    try {
      await Share.share({
        message: `Check out "${course.title}" on Mentor - Learn from ${course.instructor.name}`,
        url: `https://mentor.example.com/courses/${course.slug}`,
        title: course.title,
      });
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  // Handle interested toggle
  const handleInterestedToggle = async () => {
    if (!course) return;

    try {
      setIsInterested(!isInterested);
      await markInterested(course.id, !isInterested);

      // Update course interested count optimistically
      setCourse({
        ...course,
        interested_count: isInterested
          ? course.interested_count - 1
          : course.interested_count + 1,
      });
    } catch (err) {
      // Revert on error
      setIsInterested(isInterested);
      Alert.alert('Error', 'Failed to update interest');
    }
  };

  // Handle enroll
  const handleEnroll = () => {
    if (!course) return;

    if (course.price_type === 'free') {
      // Navigate to free course preview
      navigation.navigate('CoursePreview', { courseId: course.id });
    } else {
      // Navigate to checkout
      navigation.navigate('Checkout', { courseId: course.id });
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff6b9d" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !course) {
    return (
      <SafeAreaView style={styles.container}>
        <CourseHeader
          title="Course"
          onSharePress={handleShare}
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Course not found'}</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: 0 }]}>
      <CourseHeader
        title={course.title}
        onSharePress={handleShare}
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Hero Section */}
        <CourseHero
          course={course}
          isInterested={isInterested}
          onInterestedChange={handleInterestedToggle}
        />

        {/* About Section */}
        <AboutSection description={course.description} />

        {/* What You'll Learn */}
        <SkillsSection skills={course.what_you_learn} />

        {/* Requirements */}
        {course.requirements.length > 0 && (
          <RequirementsSection requirements={course.requirements} />
        )}

        {/* Curriculum */}
        <CurriculumSection modules={course.modules} />

        {/* Instructor */}
        <InstructorSection
          instructor={course.instructor}
          otherCoursesCount={course.instructor.other_courses_count}
          onViewCourses={() =>
            navigation.navigate('InstructorProfile', {
              instructorId: course.instructor.id,
            })
          }
        />

        {/* Related Courses */}
        {course.relatedCourses && course.relatedCourses.length > 0 && (
          <RelatedCoursesSection
            courses={course.relatedCourses}
            onSelectCourse={(relatedCourseId) =>
              navigation.push('CourseDetail', { courseId: relatedCourseId })
            }
          />
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <EnrollFAB
        course={course}
        onPress={handleEnroll}
        insetBottom={insets.bottom}
      />
    </SafeAreaView>
  );
};

export default CourseDetailScreen;
```

## Component Implementations

### Course Header

```typescript
// apps/learner-mobile/components/CourseHeader.tsx
import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import styles from './CourseHeader.styles';

interface CourseHeaderProps {
  title: string;
  onBackPress: () => void;
  onSharePress: () => void;
}

export const CourseHeader: React.FC<CourseHeaderProps> = ({
  title,
  onBackPress,
  onSharePress,
}) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
          <Text style={styles.backIcon}>◀</Text>
        </TouchableOpacity>

        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        <TouchableOpacity onPress={onSharePress} style={styles.shareButton}>
          <Text style={styles.shareIcon}>↗️</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};
```

### Course Hero Section

```typescript
// apps/learner-mobile/components/CourseHero.tsx
import React from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import { Course } from '@/types';
import styles from './CourseHero.styles';

interface CourseHeroProps {
  course: Course;
  isInterested: boolean;
  onInterestedChange: (isInterested: boolean) => void;
}

export const CourseHero: React.FC<CourseHeroProps> = ({
  course,
  isInterested,
  onInterestedChange,
}) => {
  const [isUpdating, setIsUpdating] = React.useState(false);

  const handleInterestedToggle = async () => {
    setIsUpdating(true);
    try {
      onInterestedChange(!isInterested);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Thumbnail with Play Icon */}
      <View style={styles.thumbnailContainer}>
        <Image
          source={{ uri: course.thumbnail_url }}
          style={styles.thumbnail}
        />
        <View style={styles.playIconContainer}>
          <Text style={styles.playIcon}>▶</Text>
        </View>
      </View>

      {/* Course Info */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {course.title}
        </Text>

        {/* Instructor */}
        <View style={styles.instructor}>
          <Image
            source={{ uri: course.instructor.avatar_url }}
            style={styles.instructorAvatar}
          />
          <Text style={styles.instructorName}>{course.instructor.name}</Text>
        </View>

        {/* Metadata */}
        <View style={styles.metadata}>
          <Text style={styles.category}>{course.category.name}</Text>
          <Text style={styles.type}>{course.course_type}</Text>
          <Text style={styles.level}>{course.difficulty}</Text>
        </View>

        {/* Price */}
        <View style={styles.priceContainer}>
          {course.price_type === 'free' ? (
            <Text style={styles.freeBadge}>FREE</Text>
          ) : (
            <Text style={styles.priceBadge}>€{course.price.toFixed(2)}</Text>
          )}
        </View>

        {/* Interested Button */}
        <TouchableOpacity
          style={[
            styles.interestedButton,
            isInterested && styles.interestedButtonActive,
          ]}
          onPress={handleInterestedToggle}
          disabled={isUpdating}
        >
          {isUpdating ? (
            <ActivityIndicator size="small" color="#ff6b9d" />
          ) : (
            <>
              <Text style={styles.heartIcon}>
                {isInterested ? '❤️' : '🤍'}
              </Text>
              <Text style={styles.interestedText}>
                {course.interested_count} interested
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};
```

### Curriculum Section (Collapsible)

```typescript
// apps/learner-mobile/components/CurriculumSection.tsx
import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  FlatList,
  LayoutAnimation,
} from 'react-native';
import { Module } from '@/types';
import styles from './CurriculumSection.styles';

interface CurriculumSectionProps {
  modules: Module[];
}

export const CurriculumSection: React.FC<CurriculumSectionProps> = ({
  modules,
}) => {
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(
    modules[0]?.id || null
  );

  const toggleModule = (moduleId: string) => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.easeInEaseOut();
    }
    setExpandedModuleId(
      expandedModuleId === moduleId ? null : moduleId
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Curriculum</Text>

      <FlatList
        data={modules}
        scrollEnabled={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item: module }) => (
          <View key={module.id} style={styles.module}>
            <TouchableOpacity
              style={styles.moduleHeader}
              onPress={() => toggleModule(module.id)}
            >
              <Text style={styles.expandIcon}>
                {expandedModuleId === module.id ? '▼' : '▶'}
              </Text>
              <View style={styles.moduleInfo}>
                <Text style={styles.moduleName}>{module.title}</Text>
                <Text style={styles.moduleMeta}>
                  {module.lessons.length} lessons • {module.duration_minutes} min
                </Text>
              </View>
            </TouchableOpacity>

            {expandedModuleId === module.id && (
              <View style={styles.moduleLessons}>
                {module.lessons.map((lesson, idx) => (
                  <View key={lesson.id} style={styles.lesson}>
                    <Text style={styles.lessonNumber}>{idx + 1}</Text>
                    <View style={styles.lessonInfo}>
                      <Text style={styles.lessonTitle} numberOfLines={1}>
                        {lesson.title}
                      </Text>
                      <Text style={styles.lessonDuration}>
                        {lesson.duration_minutes} min
                      </Text>
                    </View>
                    {lesson.is_free_preview && (
                      <Text style={styles.previewBadge}>Preview</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
};
```

### Floating Action Button (FAB)

```typescript
// apps/learner-mobile/components/EnrollFAB.tsx
import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Course } from '@/types';

interface EnrollFABProps {
  course: Course;
  onPress: () => void;
  insetBottom: number;
}

export const EnrollFAB: React.FC<EnrollFABProps> = ({
  course,
  onPress,
  insetBottom,
}) => {
  const buttonLabel =
    course.price_type === 'free' ? 'Start Learning' : 'Enroll Now';

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: insetBottom > 0 ? insetBottom : 16 },
      ]}
    >
      <TouchableOpacity
        style={styles.fab}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={styles.fabContent}>
          <Text style={styles.fabLabel}>{buttonLabel}</Text>
          {course.price_type === 'paid' && (
            <Text style={styles.fabPrice}>€{course.price.toFixed(2)}</Text>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  fab: {
    backgroundColor: '#ff6b9d',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  fabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fabLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fabPrice: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
```

## Instructor Section

```typescript
// apps/learner-mobile/components/InstructorSection.tsx
import React from 'react';
import {
  View,
  Image,
  Text,
  TouchableOpacity,
} from 'react-native';
import { Instructor } from '@/types';
import styles from './InstructorSection.styles';

interface InstructorSectionProps {
  instructor: Instructor & { other_courses_count: number };
  otherCoursesCount: number;
  onViewCourses: () => void;
}

export const InstructorSection: React.FC<InstructorSectionProps> = ({
  instructor,
  otherCoursesCount,
  onViewCourses,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>About the Instructor</Text>

      <View style={styles.card}>
        <Image
          source={{ uri: instructor.avatar_url }}
          style={styles.avatar}
        />

        <View style={styles.info}>
          <Text style={styles.name}>{instructor.name}</Text>
          <Text style={styles.specialization}>
            {instructor.specialization}
          </Text>
          <Text style={styles.bio} numberOfLines={2}>
            {instructor.bio}
          </Text>

          <TouchableOpacity
            style={styles.viewCoursesButton}
            onPress={onViewCourses}
          >
            <Text style={styles.viewCoursesText}>
              View All Courses ({otherCoursesCount})
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
```

## Acceptance Criteria

- [ ] Course detail screen renders with course data
- [ ] Hero section displays thumbnail, title, instructor, price, interested button
- [ ] Thumbnail shows with play icon overlay
- [ ] Course description renders fully
- [ ] What You'll Learn shows as bullet list
- [ ] Requirements section shows if applicable
- [ ] Curriculum accordion shows all modules
- [ ] Curriculum modules expandable/collapsible with smooth animation
- [ ] Lessons show duration and preview badge
- [ ] Instructor card shows avatar, name, bio, specialization
- [ ] "View Other Courses" button navigates to instructor profile
- [ ] Related courses display in horizontal scroll
- [ ] Interested button toggles state and updates count optimistically
- [ ] Interested button shows loading state while updating
- [ ] Share button opens native share sheet
- [ ] Share sheet shows course title and URL
- [ ] Floating action button (FAB) sticky at bottom
- [ ] Enroll/Start Learning button navigates to checkout or preview
- [ ] FAB button text changes based on course type (free/paid)
- [ ] FAB shows price for paid courses
- [ ] Back button navigates to previous screen
- [ ] Back button appears on header
- [ ] Course header title shows course name
- [ ] ScrollView content scrolls smoothly without jank
- [ ] Safe area padding respected on notch devices
- [ ] Images lazy-load and don't cause layout shift
- [ ] Error state shows if course fails to load
- [ ] Loading state shows spinner while fetching
- [ ] Responsive on iPhone SE (375px), iPhone 14 (390px), Android devices
- [ ] Touch targets min 44x44px
- [ ] No console errors or warnings
- [ ] Performance: detail page loads < 2s on 4G network
- [ ] Memory efficient: no leaks on navigation away

## Dependencies

- `react-native` (v0.72+)
- `@react-navigation/native` (v6+) — Navigation
- `react-native-safe-area-context` — Safe area handling
- `react-native-gesture-handler` — Gesture support
- `react-native-reanimated` (optional) — Advanced animations

## Technical Notes

- Use SafeAreaView wrapper for notch/punch-hole devices
- Implement FlatList with scrollEnabled={false} for sections within ScrollView
- Use LayoutAnimation for smooth collapse/expand of curriculum modules
- Optimize images: compress thumbnails, use appropriate resolution
- Cache course data in AsyncStorage for offline viewing (v2+)
- Implement deep linking: `app://courses/{courseId}`
- Track analytics: course view, interested, enroll button clicks
- Consider video player integration for preview lesson (v2+)
- FAB button should not overlap ScrollView content (padding-bottom)
- Test with network throttling (3G, 4G, poor connectivity)
- Consider skeleton loader while course data loads
- Implement pull-to-refresh to reload course data
- Add review/rating section in v2 (not in V1)
