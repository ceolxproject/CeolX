# Interested Count Feature

## Description

Implement a system for tracking user interest in courses. Users can mark courses as "interested" with a heart icon toggle. The interested count displays on course cards and detail pages, updates in real-time, and prevents duplicate interests for authenticated users. For anonymous users, track interest via browser storage. Support optimistic UI updates for instant feedback.

## Affected Apps/Packages

- `backend/api/hono` — POST /courses/:id/interest endpoint
- `backend/db/migrations` — user_course_interests table
- `apps/learner-web` — Web interested button component
- `apps/learner-mobile` — React Native interested button
- `shared/types` — InterestRecord type
- `shared/hooks` — useInterested hook

## Database Schema

### User Course Interests Table

```sql
CREATE TABLE user_course_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- Index for fast lookups
CREATE INDEX idx_user_course_interests_user_id ON user_course_interests(user_id);
CREATE INDEX idx_user_course_interests_course_id ON user_course_interests(course_id);
```

### Course Interested Count Denormalization

```sql
ALTER TABLE courses ADD COLUMN interested_count INT DEFAULT 0;

-- Update count on interest add/remove via trigger
CREATE OR REPLACE FUNCTION update_course_interested_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE courses SET interested_count = interested_count + 1
    WHERE id = NEW.course_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE courses SET interested_count = interested_count - 1
    WHERE id = OLD.course_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER course_interests_count_trigger
AFTER INSERT OR DELETE ON user_course_interests
FOR EACH ROW EXECUTE FUNCTION update_course_interested_count();
```

## API Endpoint

### POST /courses/:id/interest

Mark or unmark a course as interested.

**Path Parameters:**

- `id` (string) — Course UUID

**Request Body:**

```json
{
  "interested": true
}
```

**Response Schema (200 OK):**

```json
{
  "success": true,
  "data": {
    "course_id": "uuid",
    "user_id": "uuid",
    "interested": true,
    "interested_count": 568
  }
}
```

**Error Responses:**

- 401 Unauthorized — User not authenticated
- 404 Not Found — Course does not exist
- 409 Conflict — Already interested (return current state)
- 500 Internal Server Error — Database error

**Implementation:**

```typescript
// backend/api/hono/routes/courses.ts
import { Hono } from "hono";
import { db } from "@/db";
import { auth } from "@/middleware/auth";

const app = new Hono();

app.post("/courses/:id/interest", auth(), async (c) => {
  const courseId = c.req.param("id");
  const userId = c.get("userId");
  const { interested } = await c.req.json();

  // Validate course exists
  const course = await db.query.courses.findFirst({
    where: eq(courses.id, courseId),
  });

  if (!course) {
    return c.json({ success: false, error: "Course not found" }, 404);
  }

  try {
    if (interested) {
      // Add interest
      await db
        .insert(user_course_interests)
        .values({
          user_id: userId,
          course_id: courseId,
        })
        .onConflictDoNothing(); // Handle duplicate gracefully
    } else {
      // Remove interest
      await db
        .delete(user_course_interests)
        .where(
          and(
            eq(user_course_interests.user_id, userId),
            eq(user_course_interests.course_id, courseId)
          )
        );
    }

    // Fetch updated course
    const updatedCourse = await db.query.courses.findFirst({
      where: eq(courses.id, courseId),
    });

    return c.json({
      success: true,
      data: {
        course_id: courseId,
        user_id: userId,
        interested,
        interested_count: updatedCourse.interested_count,
      },
    });
  } catch (error) {
    console.error("Interest update error:", error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

export default app;
```

## Web Implementation

### Interested Button Component

```typescript
// apps/learner-web/components/InterestedButton.tsx
import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import styles from './InterestedButton.module.css';

interface InterestedButtonProps {
  courseId: string;
  initialInterested?: boolean;
  initialCount?: number;
  onInterestedChange?: (isInterested: boolean, newCount: number) => void;
  size?: 'small' | 'medium' | 'large';
  variant?: 'icon' | 'button';
}

export const InterestedButton: React.FC<InterestedButtonProps> = ({
  courseId,
  initialInterested = false,
  initialCount = 0,
  onInterestedChange,
  size = 'medium',
  variant = 'button',
}) => {
  const { data: session } = useSession();
  const [isInterested, setIsInterested] = useState(initialInterested);
  const [count, setCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (!session?.user) {
      // Redirect to login or show login modal
      window.location.href = '/login';
      return;
    }

    setIsLoading(true);

    // Optimistic update
    const newInterested = !isInterested;
    const newCount = newInterested ? count + 1 : count - 1;
    setIsInterested(newInterested);
    setCount(newCount);

    try {
      const response = await fetch(`/api/v1/courses/${courseId}/interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interested: newInterested }),
      });

      if (!response.ok) {
        throw new Error('Failed to update interest');
      }

      const data = await response.json();
      setCount(data.data.interested_count);
      onInterestedChange?.(data.data.interested, data.data.interested_count);
    } catch (error) {
      // Revert optimistic update on error
      setIsInterested(!newInterested);
      setCount(count);
      console.error('Interest update error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const heartIcon = isInterested ? '❤️' : '🤍';

  if (variant === 'icon') {
    return (
      <button
        className={`${styles.iconButton} ${styles[size]}`}
        onClick={handleClick}
        disabled={isLoading}
        title={isInterested ? 'Remove interest' : 'Mark as interested'}
        aria-label="Toggle interest"
      >
        <span className={styles.heart}>{heartIcon}</span>
      </button>
    );
  }

  return (
    <button
      className={`${styles.button} ${styles[size]} ${
        isInterested ? styles.active : ''
      }`}
      onClick={handleClick}
      disabled={isLoading}
      aria-label={
        isInterested
          ? `${count} people interested, click to remove interest`
          : `${count} people interested, click to mark interest`
      }
    >
      <span className={styles.heart}>{heartIcon}</span>
      <span className={styles.count}>{count} interested</span>
      {isLoading && <span className={styles.spinner}>⟳</span>}
    </button>
  );
};
```

### Styling

```css
/* apps/learner-web/components/InterestedButton.module.css */

.button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  font-weight: 500;
  color: #666;
}

.button:hover:not(:disabled) {
  border-color: #ff6b9d;
  color: #ff6b9d;
}

.button.active {
  background: #fff0f7;
  border-color: #ff6b9d;
  color: #ff6b9d;
}

.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button.small {
  padding: 4px 8px;
  font-size: 12px;
}

.button.medium {
  padding: 8px 12px;
  font-size: 14px;
}

.button.large {
  padding: 12px 16px;
  font-size: 16px;
}

.iconButton {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  transition: transform 0.2s;
  font-size: 20px;
}

.iconButton:hover:not(:disabled) {
  transform: scale(1.1);
}

.iconButton:active:not(:disabled) {
  transform: scale(0.95);
}

.iconButton.small {
  font-size: 16px;
}

.iconButton.large {
  font-size: 24px;
}

.heart {
  display: inline-block;
  line-height: 1;
}

.count {
  white-space: nowrap;
}

.spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
```

### useInterested Hook

```typescript
// apps/learner-web/hooks/useInterested.ts
import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";

interface UseInterestedOptions {
  courseId: string;
  initialInterested?: boolean;
  initialCount?: number;
}

export const useInterested = ({
  courseId,
  initialInterested = false,
  initialCount = 0,
}: UseInterestedOptions) => {
  const { data: session } = useSession();
  const [isInterested, setIsInterested] = useState(initialInterested);
  const [count, setCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleInterest = useCallback(async () => {
    if (!session?.user) {
      setError("Please log in to mark interest");
      return false;
    }

    setIsLoading(true);
    setError(null);

    const newInterested = !isInterested;
    const newCount = newInterested ? count + 1 : count - 1;

    // Optimistic update
    setIsInterested(newInterested);
    setCount(newCount);

    try {
      const response = await fetch(`/api/v1/courses/${courseId}/interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interested: newInterested }),
      });

      if (!response.ok) {
        throw new Error("Failed to update interest");
      }

      const data = await response.json();
      setCount(data.data.interested_count);
      return true;
    } catch (err) {
      // Revert on error
      setIsInterested(!newInterested);
      setCount(count);
      setError(err instanceof Error ? err.message : "Unknown error");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [session, courseId, isInterested, count]);

  return {
    isInterested,
    count,
    isLoading,
    error,
    toggleInterest,
  };
};
```

## Mobile Implementation

```typescript
// apps/learner-mobile/components/InterestedButton.tsx
import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { markInterested } from '@/api/courses';
import styles from './InterestedButton.styles';

interface InterestedButtonProps {
  courseId: string;
  initialInterested?: boolean;
  initialCount?: number;
  onInterestedChange?: (isInterested: boolean, newCount: number) => void;
}

export const InterestedButton: React.FC<InterestedButtonProps> = ({
  courseId,
  initialInterested = false,
  initialCount = 0,
  onInterestedChange,
}) => {
  const { user } = useAuth();
  const [isInterested, setIsInterested] = useState(initialInterested);
  const [count, setCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);

  const handlePress = async () => {
    if (!user) {
      Alert.alert('Please Log In', 'You need to log in to mark interest.', [
        { text: 'OK' },
      ]);
      return;
    }

    setIsLoading(true);

    // Optimistic update
    const newInterested = !isInterested;
    const newCount = newInterested ? count + 1 : count - 1;
    setIsInterested(newInterested);
    setCount(newCount);

    try {
      const result = await markInterested(courseId, newInterested);
      setCount(result.interested_count);
      onInterestedChange?.(result.interested, result.interested_count);
    } catch (error) {
      // Revert on error
      setIsInterested(!newInterested);
      setCount(count);
      Alert.alert('Error', 'Failed to update interest. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isInterested && styles.buttonActive,
      ]}
      onPress={handlePress}
      disabled={isLoading}
      activeOpacity={0.7}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#ff6b9d" />
      ) : (
        <>
          <Text style={styles.heart}>
            {isInterested ? '❤️' : '🤍'}
          </Text>
          <Text style={[styles.text, isInterested && styles.textActive]}>
            {count} interested
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};
```

### Styling (Mobile)

```typescript
// apps/learner-mobile/components/InterestedButton.styles.ts
import { StyleSheet } from "react-native";

export default StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 6,
    backgroundColor: "#fff",
  },
  buttonActive: {
    borderColor: "#ff6b9d",
    backgroundColor: "#fff0f7",
  },
  heart: {
    fontSize: 18,
  },
  text: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  textActive: {
    color: "#ff6b9d",
  },
});
```

## Anonymous User Tracking (Browser Storage)

For non-authenticated users, track interested courses via localStorage:

```typescript
// apps/learner-web/utils/anonymousInterest.ts
const STORAGE_KEY = "anonymous_interested_courses";

export function getAnonymousInterests(): string[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function addAnonymousInterest(courseId: string): void {
  const interests = getAnonymousInterests();
  if (!interests.includes(courseId)) {
    interests.push(courseId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(interests));
  }
}

export function removeAnonymousInterest(courseId: string): void {
  const interests = getAnonymousInterests();
  const filtered = interests.filter((id) => id !== courseId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function isAnonymousInterested(courseId: string): boolean {
  return getAnonymousInterests().includes(courseId);
}
```

## Analytics Tracking

Track interested events for insights:

```typescript
// Track when user marks interest
const handleInterest = async (courseId: string, interested: boolean) => {
  // ... update interest

  // Analytics event
  analytics.track("course_interest_changed", {
    courseId,
    interested,
    timestamp: new Date().toISOString(),
  });
};
```

## Acceptance Criteria

- [ ] POST /courses/:id/interest endpoint accepts authenticated requests
- [ ] Interested state toggles on request success
- [ ] Interested count updates atomically in database
- [ ] API returns updated interested_count in response
- [ ] Web button shows heart icon (❤️ if interested, 🤍 if not)
- [ ] Web button shows count next to icon
- [ ] Web button optimistic update: UI changes immediately
- [ ] Web button reverts on API error
- [ ] Web button disabled while loading
- [ ] Mobile button same functionality as web
- [ ] Mobile button shows loading spinner while updating
- [ ] Anonymous users (web): interested tracked in localStorage
- [ ] Authenticated users: interested tracked in database
- [ ] Duplicate interests prevented: UNIQUE constraint enforced
- [ ] Interest removed correctly when toggled to false
- [ ] Count accurate: reflects database state
- [ ] No race conditions: concurrent requests handled correctly
- [ ] Error handling: show error message if update fails
- [ ] Unauthenticated users: redirected to login on click
- [ ] Course not found: API returns 404
- [ ] Performance: interest update completes < 500ms
- [ ] No memory leaks on component unmount
- [ ] Works offline (mobile): queue request, retry when online
- [ ] Interested count persists across page reloads
- [ ] Real-time sync: count updates when other users mark interest (v2+)
- [ ] Analytics tracked: interest change events logged

## Dependencies

- `next-auth` (web) — Authentication context
- `@react-navigation/native` (mobile) — Navigation
- `fetch` / `axios` — HTTP client

## Technical Notes

- Always use optimistic UI updates for better perceived performance
- Ensure UNIQUE constraint on (user_id, course_id) to prevent duplicates
- Use database trigger to maintain accurate interested_count denormalization
- Cache invalidate on interest change: clear related course queries
- Test concurrent interest updates from same user (should be idempotent)
- Monitor interested count updates: any anomalies indicate sync issues
- Anonymous interests migrate to user when user logs in (v2+)
- Interested count visible on all user-facing surfaces (cards, detail page)
- Consider social proof: show "X people are interested in this course"
- Future feature (v2+): notification when interested course goes on sale
