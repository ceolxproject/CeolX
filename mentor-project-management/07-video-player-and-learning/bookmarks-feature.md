# Course Bookmarks Feature

## Description

Implement bookmarking functionality allowing learners to bookmark/unbookmark courses for quick access. Bookmarked courses appear in a dedicated "Bookmarks" tab within "My Courses" section. Bookmarks sync across devices and provide an easy way for learners to organize and access their favorite or frequently-visited courses.

## Affected Apps/Packages

- `apps/learner-web` (Next.js)
- `apps/learner-mobile` (React Native)
- Backend: bookmark service and API
- Database: bookmarks table

## API Endpoints

- `POST /api/bookmarks` - Create bookmark for course
  - Request: `{ "courseId": "uuid" }`
  - Response: `{ "id": "uuid", "courseId": "uuid", "userId": "uuid", "createdAt": ... }`
- `DELETE /api/bookmarks/:courseId` - Remove bookmark
  - Response: `{ "success": true }`
- `GET /api/users/:userId/bookmarks` - Get all bookmarked courses
  - Response: `[{ "id": "uuid", "courseId": "uuid", "createdAt": ... }, ...]`
- `GET /api/bookmarks/:courseId/status` - Check if course is bookmarked
  - Response: `{ "bookmarked": true, "bookmarkId": "uuid" }`

## Requirements

### 1. Bookmark Toggle UI

**Course Cards**:

- Bookmark icon (star or heart) visible on all course cards
- Icon state: filled (bookmarked) or outline (not bookmarked)
- Color: Gold/signature color when filled (#FFD700 or #FF6B9D)
- Gray/white outline when empty
- Click icon: toggle bookmark state immediately (optimistic update)
- Show toast: "Added to bookmarks" or "Removed from bookmarks"

**Course Detail Page**:

- Large bookmark button in header or action bar
- Text: "Bookmark" or "Bookmarked" depending on state
- Icon next to text
- Same toggle behavior as cards

### 2. My Courses Integration

**Bookmarks Tab**:

- New tab in "My Courses" alongside "All Courses", "In Progress", "Completed"
- Shows only bookmarked courses
- Same course card layout as other tabs
- Empty state message: "No bookmarked courses yet. Add one from the course details!"
- Bookmark count displayed (e.g., "Bookmarks (5)")

**Course Card Indicator**:

- Bookmarked courses have small star/heart badge in corner
- Optional: different styling/highlight for bookmarked courses

### 3. Persistent Bookmarks

- Bookmarks synced to backend on toggle
- Stored per user, survives across sessions
- Available on any device user logs into
- Deletion of course removes bookmark automatically

### 4. Performance & Caching

- **Optimistic Updates**: Icon changes immediately, API call in background
- **Failed Toggles**: Rollback UI if API fails (show error toast)
- **Caching**: Cache bookmark status locally to avoid repeated API calls
- **Bulk Load**: Fetch all bookmark statuses on "My Courses" page load

### 5. Mobile Specific

- Bookmark icon accessible on mobile course cards
- Same toggle behavior
- Touch-friendly size (min 44x44 tap target)

## Acceptance Criteria

- [ ] Bookmark icon visible on course cards (all views)
- [ ] Bookmark icon visible on course detail page
- [ ] Click icon toggles bookmark state immediately (optimistic)
- [ ] Toast notification shows "Added to bookmarks"
- [ ] Toast notification shows "Removed from bookmarks"
- [ ] API call made in background to persist toggle
- [ ] If API fails, UI rolls back and error toast shown
- [ ] "Bookmarks" tab present in "My Courses"
- [ ] Tab shows count of bookmarked courses
- [ ] Bookmarked courses display in tab with correct layout
- [ ] Bookmark state persists across app restarts (web)
- [ ] Bookmark state persists across app restarts (mobile)
- [ ] Bookmarked courses synced across devices
- [ ] Empty state message shown if no bookmarks
- [ ] Bookmark removed when course is deleted (admin)
- [ ] Mobile: bookmark icon tap target min 44x44
- [ ] Mobile: no layout issues on small screens
- [ ] Performance: toggle completes within 300ms
- [ ] No duplicate bookmarks possible
- [ ] Bookmark created/updated timestamps accurate

## Dependencies

- Course data API (course details, list)
- User authentication context (userId)
- Bookmark API (toggle, fetch, check status)
- Toast notification system
- Design system (icons, colors, spacing)

## Technical Notes

### Database Schema

```sql
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  course_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, course_id), -- Prevent duplicate bookmarks
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Index for fast lookups
CREATE INDEX idx_bookmarks_user ON bookmarks(user_id);
CREATE INDEX idx_bookmarks_course ON bookmarks(course_id);
CREATE INDEX idx_bookmarks_user_course ON bookmarks(user_id, course_id);
```

### Web Implementation (React/Next.js)

```typescript
// /packages/ui-components/src/BookmarkButton/index.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import styles from './BookmarkButton.module.css';

interface BookmarkButtonProps {
  courseId: string;
  onToggle?: (bookmarked: boolean) => void;
  showLabel?: boolean;
}

export const BookmarkButton = ({
  courseId,
  onToggle,
  showLabel = false,
}: BookmarkButtonProps) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check bookmark status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(
          `/api/bookmarks/${courseId}/status?userId=${user?.id}`
        );
        const data = await response.json();
        setIsBookmarked(data.bookmarked);
      } catch (error) {
        console.error('Error checking bookmark status:', error);
      }
    };

    if (user?.id) {
      checkStatus();
    }
  }, [courseId, user?.id]);

  const handleToggle = async () => {
    const previousState = isBookmarked;
    const action = previousState ? 'removed_from' : 'added_to';

    // Optimistic update
    setIsBookmarked(!previousState);
    setIsLoading(true);

    try {
      if (previousState) {
        // Delete bookmark
        await fetch(`/api/bookmarks/${courseId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user?.id }),
        });
        showToast('Removed from bookmarks', 'success');
      } else {
        // Create bookmark
        await fetch(`/api/bookmarks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId, userId: user?.id }),
        });
        showToast('Added to bookmarks', 'success');
      }

      onToggle?.(!previousState);

      // Analytics
      analytics.track('bookmark_toggled', {
        courseId,
        action,
        userId: user?.id,
      });
    } catch (error) {
      // Rollback on error
      setIsBookmarked(previousState);
      showToast('Failed to update bookmark', 'error');
      console.error('Error toggling bookmark:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      className={`${styles.bookmarkBtn} ${isBookmarked ? styles.bookmarked : ''}`}
      onClick={handleToggle}
      disabled={isLoading}
      aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
      title={isBookmarked ? 'Bookmarked' : 'Bookmark this course'}
    >
      <i className={`${styles.icon} fas fa-star`}></i>
      {showLabel && (
        <span className={styles.label}>
          {isBookmarked ? 'Bookmarked' : 'Bookmark'}
        </span>
      )}
    </button>
  );
};
```

### Styling

```css
/* /packages/ui-components/src/BookmarkButton/BookmarkButton.module.css */
.bookmarkBtn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: none;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  color: #666;
  min-width: 44px;
  min-height: 44px;
  justify-content: center;
}

.bookmarkBtn:hover {
  border-color: #ffd700;
  color: #ffd700;
  background: rgba(255, 215, 0, 0.05);
}

.icon {
  font-size: 18px;
}

.bookmarkBtn.bookmarked {
  color: #ffd700;
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.1);
}

.bookmarkBtn.bookmarked:hover {
  background: rgba(255, 215, 0, 0.15);
}

.bookmarkBtn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.label {
  font-weight: 500;
}

/* Compact variant (on course card) */
.bookmarkBtn {
  padding: 6px 8px;
  font-size: 12px;
}

.icon {
  font-size: 16px;
}
```

### My Courses: Bookmarks Tab

```typescript
// /apps/learner-web/src/pages/my-courses.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { CourseCard } from '@/components/CourseCard';
import styles from '@/styles/MyCourses.module.css';

type TabType = 'all' | 'in-progress' | 'completed' | 'bookmarks';

export default function MyCoursesPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [allCourses, setAllCourses] = useState([]);
  const [bookmarkedCourseIds, setBookmarkedCourseIds] = useState<Set<string>>(new Set());

  // Fetch bookmarks
  useEffect(() => {
    const fetchBookmarks = async () => {
      const response = await fetch(`/api/users/${user?.id}/bookmarks`);
      const data = await response.json();
      const ids = new Set(data.map((b: any) => b.courseId));
      setBookmarkedCourseIds(ids);
    };

    if (user?.id) {
      fetchBookmarks();
    }
  }, [user?.id]);

  // Fetch all courses
  useEffect(() => {
    const fetchCourses = async () => {
      const response = await fetch(`/api/users/${user?.id}/courses`);
      const data = await response.json();
      setAllCourses(data);
    };

    if (user?.id) {
      fetchCourses();
    }
  }, [user?.id]);

  // Filter courses based on tab
  const filteredCourses = allCourses.filter(course => {
    switch (activeTab) {
      case 'bookmarks':
        return bookmarkedCourseIds.has(course.id);
      case 'in-progress':
        return course.enrollmentStatus === 'active' && course.completionPercentage < 100;
      case 'completed':
        return course.completionPercentage === 100;
      case 'all':
      default:
        return true;
    }
  });

  const handleBookmarkToggle = (courseId: string, isBookmarked: boolean) => {
    if (isBookmarked) {
      setBookmarkedCourseIds(prev => new Set([...prev, courseId]));
    } else {
      setBookmarkedCourseIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(courseId);
        return newSet;
      });
    }
  };

  return (
    <div className={styles.container}>
      <h1>My Courses</h1>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'all' ? styles.active : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Courses
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'in-progress' ? styles.active : ''}`}
          onClick={() => setActiveTab('in-progress')}
        >
          In Progress
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'completed' ? styles.active : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          Completed
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'bookmarks' ? styles.active : ''}`}
          onClick={() => setActiveTab('bookmarks')}
        >
          Bookmarks ({bookmarkedCourseIds.size})
        </button>
      </div>

      {/* Course Grid */}
      {filteredCourses.length === 0 ? (
        <div className={styles.empty}>
          <p>
            {activeTab === 'bookmarks'
              ? 'No bookmarked courses yet. Add one from the course details!'
              : 'No courses found.'}
          </p>
        </div>
      ) : (
        <div className={styles.courseGrid}>
          {filteredCourses.map(course => (
            <CourseCard
              key={course.id}
              course={course}
              isBookmarked={bookmarkedCourseIds.has(course.id)}
              onBookmarkToggle={(isBookmarked) =>
                handleBookmarkToggle(course.id, isBookmarked)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Course Card with Bookmark

```typescript
// /apps/learner-web/src/components/CourseCard/index.tsx
import React from 'react';
import Link from 'next/link';
import { BookmarkButton } from '@/components/BookmarkButton';
import styles from './CourseCard.module.css';

interface CourseCardProps {
  course: any;
  isBookmarked?: boolean;
  onBookmarkToggle?: (isBookmarked: boolean) => void;
}

export const CourseCard = ({
  course,
  isBookmarked = false,
  onBookmarkToggle,
}: CourseCardProps) => {
  return (
    <div className={styles.card}>
      {/* Thumbnail */}
      <Link href={`/courses/${course.id}`}>
        <a className={styles.thumbnailLink}>
          <img
            src={course.thumbnail}
            alt={course.title}
            className={styles.thumbnail}
          />
          {course.completionPercentage === 100 && (
            <div className={styles.completedBadge}>
              <i className="fas fa-check-circle"></i>
              Completed
            </div>
          )}
          {isBookmarked && (
            <div className={styles.bookmarkBadge}>
              <i className="fas fa-star"></i>
            </div>
          )}
        </a>
      </Link>

      {/* Info */}
      <div className={styles.info}>
        <Link href={`/courses/${course.id}`}>
          <a className={styles.title}>{course.title}</a>
        </Link>
        <p className={styles.instructor}>{course.instructorName}</p>

        {/* Progress Bar */}
        {course.completionPercentage < 100 && (
          <div className={styles.progressBar}>
            <div
              className={styles.progress}
              style={{ width: `${course.completionPercentage}%` }}
            />
          </div>
        )}

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.completion}>
            {course.completionPercentage}% Complete
          </span>
          <BookmarkButton
            courseId={course.id}
            onToggle={onBookmarkToggle}
          />
        </div>
      </div>
    </div>
  );
};
```

### Backend API

```typescript
// Backend: POST /api/bookmarks
app.post("/bookmarks", authenticateToken, async (req, res) => {
  const { courseId } = req.body;
  const userId = req.user.id;

  try {
    const result = await db.query(
      `INSERT INTO bookmarks (user_id, course_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, course_id) DO NOTHING
       RETURNING *`,
      [userId, courseId]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating bookmark:", error);
    return res.status(500).json({ error: "Failed to create bookmark" });
  }
});

// Backend: DELETE /api/bookmarks/:courseId
app.delete("/bookmarks/:courseId", authenticateToken, async (req, res) => {
  const { courseId } = req.params;
  const userId = req.user.id;

  try {
    await db.query(
      "DELETE FROM bookmarks WHERE user_id = $1 AND course_id = $2",
      [userId, courseId]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting bookmark:", error);
    return res.status(500).json({ error: "Failed to delete bookmark" });
  }
});

// Backend: GET /api/users/:userId/bookmarks
app.get("/users/:userId/bookmarks", authenticateToken, async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await db.query(
      `SELECT id, course_id AS "courseId", created_at AS "createdAt"
       FROM bookmarks
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("Error fetching bookmarks:", error);
    return res.status(500).json({ error: "Failed to fetch bookmarks" });
  }
});

// Backend: GET /api/bookmarks/:courseId/status
app.get("/bookmarks/:courseId/status", authenticateToken, async (req, res) => {
  const { courseId } = req.params;
  const userId = req.user.id;

  try {
    const result = await db.query(
      "SELECT id FROM bookmarks WHERE user_id = $1 AND course_id = $2",
      [userId, courseId]
    );

    const bookmarked = result.rows.length > 0;

    return res.json({
      bookmarked,
      bookmarkId: result.rows[0]?.id || null,
    });
  } catch (error) {
    console.error("Error checking bookmark status:", error);
    return res.status(500).json({ error: "Failed to check bookmark status" });
  }
});
```

### Mobile Implementation (React Native)

```javascript
// /apps/learner-mobile/src/components/BookmarkButton.tsx
import React, { useState, useEffect } from "react";
import { TouchableOpacity, StyleSheet, Animated } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useAuth } from "@/context/AuthContext";
import Toast from "react-native-toast-message";

export const BookmarkButton = ({ courseId, onToggle }) => {
  const { user } = useAuth();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    checkStatus();
  }, [courseId]);

  const checkStatus = async () => {
    try {
      const response = await fetch(
        `/api/bookmarks/${courseId}/status?userId=${user?.id}`
      );
      const data = await response.json();
      setIsBookmarked(data.bookmarked);
    } catch (error) {
      console.error("Error checking bookmark:", error);
    }
  };

  const handlePress = async () => {
    const previousState = isBookmarked;
    setIsBookmarked(!previousState);
    setIsLoading(true);

    // Animate
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      if (previousState) {
        await fetch(`/api/bookmarks/${courseId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user?.id }),
        });
        Toast.show({
          type: "success",
          text1: "Removed from bookmarks",
        });
      } else {
        await fetch(`/api/bookmarks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId, userId: user?.id }),
        });
        Toast.show({
          type: "success",
          text1: "Added to bookmarks",
        });
      }

      onToggle?.(!previousState);
    } catch (error) {
      setIsBookmarked(previousState);
      Toast.show({
        type: "error",
        text1: "Failed to update bookmark",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.btn, isBookmarked && styles.bookmarked]}
        onPress={handlePress}
        disabled={isLoading}
      >
        <Icon
          name="star"
          size={20}
          color={isBookmarked ? "#FFD700" : "#999"}
          solid={isBookmarked}
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  btn: {
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  bookmarked: {
    borderColor: "#FFD700",
    backgroundColor: "rgba(255, 215, 0, 0.1)",
  },
});
```
