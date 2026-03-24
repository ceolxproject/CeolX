# Course Completion Flow & Celebration Page

## Description

Implement the course completion celebration experience when a learner finishes all lessons in a course (100% completion). This includes a congratulations page with instructor message, shareable social media links with deep linking and Open Graph metadata, and marking the course as completed in the "My Courses" section with a completion badge.

## Affected Apps/Packages

- `apps/learner-web` (Next.js)
- `apps/learner-mobile` (React Native)
- `packages/types` (TypeScript types)
- Backend: course completion service, certificate generation
- Database: course_completion table, completion_history table

## API Endpoints

- `GET /api/courses/:courseId/completion-status` - Check if learner completed course
- `GET /api/courses/:courseId/completion-page` - Fetch completion page data (instructor message, course info)
- `POST /api/users/:userId/completion-share` - Track social share events
- `POST /api/certificates/:courseId/generate` - Generate shareable certificate PDF (optional)
- `GET /api/users/:userId/completed-courses` - List completed courses for "My Courses" display

## Requirements

### 1. Congratulations Page

**Trigger**: When learner reaches 100% course completion (all lessons complete)

- **Route**: `/courses/:courseId/completed` or modal overlay on course detail
- **URL Deep Link**: `learner.example.com/courses/{courseId}/completion`
- **Page Elements**:
  - Large celebration heading: "Congratulations! You've Completed [Course Name]"
  - Instructor message (from course metadata): "Well done! [Custom message from instructor]"
  - Course thumbnail/banner image
  - Completion date and time
  - Completion percentage: "100% Complete"
  - Share buttons for social media (5 platforms)
  - "View Certificate" button (if applicable)
  - "Continue to Next Course" button (if available)
  - "Return to My Courses" button

### 2. Completion Badges & Visuals

- **Animated Celebration**: Confetti animation or celebration effects
- **Completion Badge**: Icon/badge displayed in course card in "My Courses"
  - Small badge in corner of course thumbnail
  - Text: "Completed [date]"
  - Color: Gold/signature color (#FF6B9D or similar)
- **Progress Ring**: Show 100% completion ring (if not already animated)

### 3. Social Sharing

**Supported Platforms**:

1. **LinkedIn**: Professional network sharing
2. **Twitter/X**: Quick tweet with hashtag
3. **Facebook**: Course completion post
4. **WhatsApp**: Share with contacts
5. **Email**: Share via email link

**Share Data**:

- **Title**: "I just completed [Course Name] on Mentor by Mentor!"
- **URL**: Deep link to completion page: `learner.example.com/courses/{courseId}/completion?share=true`
- **Description**: "[Course Name] is a comprehensive beauty/cosmetics course covering [topics]. Join me!"
- **Hashtags**: #Mentor #MentorApp #BeautyEducation #LearningComplete
- **Image**: Course thumbnail (1200x630px for OG image)

### 4. Open Graph (OG) Metadata

Add to completion page for rich previews:

```html
<meta property="og:title" content="I completed [Course Name]!" />
<meta
  property="og:description"
  content="I just finished the [Course Name] course on Mentor by Mentor. Check it out!"
/>
<meta
  property="og:image"
  content="https://cdn.example.com/courses/{courseId}/og-image.png"
/>
<meta
  property="og:url"
  content="https://learner.example.com/courses/{courseId}/completion?share=true"
/>
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="I completed [Course Name]!" />
<meta
  name="twitter:description"
  content="Check out this course on Mentor by Mentor"
/>
<meta
  name="twitter:image"
  content="https://cdn.example.com/courses/{courseId}/og-image.png"
/>
```

### 5. My Courses Integration

**Completion Status Display**:

- Course card shows: "✓ Completed [date]" with gold badge
- Sort option: "Completed" filter in My Courses list
- Completion date displayed on course detail page
- Re-enroll option available below "Completed" status

### 6. Completion History & Tracking

- **Completion Timestamp**: Exact moment learner reaches 100%
- **Learner Profile**: Show list of completed courses in learner's public/private profile
- **Certificate**: Optional PDF certificate with completion date (if feature enabled)
- **Badge System**: Unlock achievement badges (cosmetics/beauty themed)

## Acceptance Criteria

- [ ] Completion page displays when learner finishes course (100%)
- [ ] Page shows instructor message from course metadata
- [ ] Course name, thumbnail, and completion date visible
- [ ] Celebration animation/effects triggered
- [ ] Completion badge appears on course card in My Courses
- [ ] All 5 social share buttons present (LinkedIn, Twitter, Facebook, WhatsApp, Email)
- [ ] Share buttons generate correct share URLs with OG metadata
- [ ] Deep links work and include ?share=true parameter
- [ ] OG metadata correct on completion page (title, description, image, URL)
- [ ] Social previews show course thumbnail image
- [ ] Share tracking via analytics (track clicks per platform)
- [ ] Mobile: Completion page responsive and mobile-friendly
- [ ] Mobile: Share buttons use native share sheet (if available)
- [ ] "View Certificate" button works (if certificates enabled)
- [ ] "Continue to Next Course" navigation works
- [ ] "Return to My Courses" button returns to course list
- [ ] Completed courses show in "My Courses" with completion date
- [ ] Completion timestamp immutable in database
- [ ] Re-enrollment available after completion
- [ ] Performance: Page loads within 2 seconds
- [ ] Completion event logged in analytics with course/user data

## Dependencies

- Mux video completion tracking (previous tasks)
- Lesson completion logic (triggers course completion)
- Course data API (course name, thumbnail, instructor)
- OG image generation (or pre-generated images)
- Social share libraries: `react-share` (web), native APIs (mobile)
- Analytics tracking (completion, share events)
- Certificate generation (optional, backend)

## Technical Notes

### Completion Page Component (React/Next.js)

```typescript
// /apps/learner-web/src/pages/courses/[courseId]/completion.tsx
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import Confetti from 'react-confetti';
import {
  LinkedinShareButton,
  TwitterShareButton,
  FacebookShareButton,
  EmailShareButton,
} from 'react-share';
import Head from 'next/head';

interface CompletionData {
  courseId: string;
  courseName: string;
  instructor: string;
  instructorMessage: string;
  thumbnail: string;
  completedAt: Date;
  completionPercentage: number;
  nextCourseId?: string;
  nextCourseName?: string;
}

export default function CourseCompletionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { courseId, share } = router.query;
  const [completionData, setCompletionData] = useState<CompletionData | null>(null);
  const [showConfetti, setShowConfetti] = useState(true);
  const [copied, setCopied] = useState(false);

  // Fetch completion data
  useEffect(() => {
    const fetchData = async () => {
      const response = await fetch(
        `/api/courses/${courseId}/completion-page?userId=${user?.id}`
      );
      const data = await response.json();
      setCompletionData(data);

      // Log completion view
      analytics.track('course_completion_viewed', {
        courseId,
        userId: user?.id,
        sharedImmediately: share === 'true',
      });
    };

    if (courseId && user?.id) {
      fetchData();
    }
  }, [courseId, user?.id, share]);

  if (!completionData) {
    return <LoadingSpinner />;
  }

  const shareUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/courses/${courseId}/completion?share=true`;
  const shareTitle = `I just completed ${completionData.courseName} on Mentor by Mentor!`;
  const shareDescription = `I completed the ${completionData.courseName} course. Check it out on Mentor!`;
  const hashtag = '#Mentor #MentorApp #BeautyEducation';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    analytics.track('completion_share_link_copied', {
      courseId,
      userId: user?.id,
    });
  };

  const handleShare = (platform: string) => {
    analytics.track('completion_shared', {
      courseId,
      userId: user?.id,
      platform,
    });
  };

  return (
    <>
      <Head>
        <title>Course Completed - {completionData.courseName}</title>
        <meta property="og:title" content={shareTitle} />
        <meta property="og:description" content={shareDescription} />
        <meta property="og:image" content={completionData.thumbnail} />
        <meta property="og:url" content={shareUrl} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={shareTitle} />
        <meta name="twitter:description" content={shareDescription} />
        <meta name="twitter:image" content={completionData.thumbnail} />
      </Head>

      <div className="completion-page">
        {showConfetti && <Confetti />}

        <div className="completion-container">
          {/* Celebration Header */}
          <div className="celebration-header">
            <div className="celebration-icon">🎉</div>
            <h1>Congratulations!</h1>
            <p className="subtitle">You've completed {completionData.courseName}</p>
          </div>

          {/* Course Info Card */}
          <div className="course-card">
            <img
              src={completionData.thumbnail}
              alt={completionData.courseName}
              className="course-thumbnail"
            />
            <div className="course-info">
              <h2>{completionData.courseName}</h2>
              <p className="instructor">by {completionData.instructor}</p>
              <div className="completion-stats">
                <div className="stat">
                  <div className="stat-value">100%</div>
                  <div className="stat-label">Complete</div>
                </div>
                <div className="stat">
                  <div className="stat-value">
                    {new Date(completionData.completedAt).toLocaleDateString()}
                  </div>
                  <div className="stat-label">Completed On</div>
                </div>
              </div>
            </div>
          </div>

          {/* Instructor Message */}
          {completionData.instructorMessage && (
            <div className="instructor-message">
              <p className="message-label">A message from your instructor:</p>
              <blockquote>{completionData.instructorMessage}</blockquote>
            </div>
          )}

          {/* Share Section */}
          <div className="share-section">
            <h3>Share Your Achievement</h3>
            <p className="share-subtitle">Tell your friends about your learning journey</p>

            <div className="share-buttons">
              <LinkedinShareButton
                url={shareUrl}
                title={shareTitle}
                summary={shareDescription}
                onClick={() => handleShare('linkedin')}
              >
                <button className="share-btn linkedin">
                  <i className="fab fa-linkedin"></i>
                  LinkedIn
                </button>
              </LinkedinShareButton>

              <TwitterShareButton
                url={shareUrl}
                title={shareTitle}
                hashtags={['Mentor', 'MentorApp', 'BeautyEducation']}
                onClick={() => handleShare('twitter')}
              >
                <button className="share-btn twitter">
                  <i className="fab fa-twitter"></i>
                  Twitter
                </button>
              </TwitterShareButton>

              <FacebookShareButton
                url={shareUrl}
                quote={shareTitle}
                onClick={() => handleShare('facebook')}
              >
                <button className="share-btn facebook">
                  <i className="fab fa-facebook"></i>
                  Facebook
                </button>
              </FacebookShareButton>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(shareTitle + ' ' + shareUrl)}`}
                onClick={() => handleShare('whatsapp')}
                target="_blank"
                rel="noopener noreferrer"
              >
                <button className="share-btn whatsapp">
                  <i className="fab fa-whatsapp"></i>
                  WhatsApp
                </button>
              </a>

              <EmailShareButton
                url={shareUrl}
                subject={shareTitle}
                body={shareDescription}
                onClick={() => handleShare('email')}
              >
                <button className="share-btn email">
                  <i className="fas fa-envelope"></i>
                  Email
                </button>
              </EmailShareButton>

              <button
                className="share-btn copy-link"
                onClick={handleCopyLink}
              >
                <i className="fas fa-link"></i>
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            {completionData.nextCourseId && (
              <button
                className="btn btn-primary"
                onClick={() => router.push(`/courses/${completionData.nextCourseId}`)}
              >
                Continue to {completionData.nextCourseName}
              </button>
            )}

            <button
              className="btn btn-secondary"
              onClick={() => router.push('/my-courses')}
            >
              Return to My Courses
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .completion-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #ff6b9d 0%, #c76a8e 100%);
          padding: 40px 20px;
        }

        .completion-container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }

        .celebration-header {
          text-align: center;
          margin-bottom: 40px;
        }

        .celebration-icon {
          font-size: 48px;
          margin-bottom: 16px;
          animation: bounce 1s infinite;
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        h1 {
          font-size: 32px;
          font-weight: 600;
          color: #1a1a1a;
          margin: 0 0 8px 0;
        }

        .subtitle {
          font-size: 18px;
          color: #666;
          margin: 0;
        }

        .course-card {
          background: #f5f5f5;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 30px;
          display: flex;
          gap: 20px;
        }

        .course-thumbnail {
          width: 100px;
          height: 100px;
          border-radius: 4px;
          object-fit: cover;
        }

        .course-info {
          flex: 1;
        }

        .course-info h2 {
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 4px 0;
        }

        .instructor {
          font-size: 14px;
          color: #999;
          margin: 0 0 12px 0;
        }

        .completion-stats {
          display: flex;
          gap: 20px;
        }

        .stat {
          text-align: center;
        }

        .stat-value {
          font-size: 18px;
          font-weight: 600;
          color: #ff6b9d;
        }

        .stat-label {
          font-size: 12px;
          color: #999;
        }

        .instructor-message {
          background: #fff5f7;
          border-left: 4px solid #ff6b9d;
          padding: 16px;
          border-radius: 4px;
          margin-bottom: 30px;
        }

        .message-label {
          font-size: 12px;
          color: #999;
          text-transform: uppercase;
          margin: 0 0 8px 0;
        }

        blockquote {
          font-size: 16px;
          font-style: italic;
          color: #1a1a1a;
          margin: 0;
          line-height: 1.5;
        }

        .share-section {
          margin-bottom: 30px;
          text-align: center;
        }

        .share-section h3 {
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 4px 0;
        }

        .share-subtitle {
          font-size: 14px;
          color: #999;
          margin: 0 0 20px 0;
        }

        .share-buttons {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .share-btn {
          padding: 12px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: white;
        }

        .share-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .linkedin { background: #0a66c2; }
        .twitter { background: #1da1f2; }
        .facebook { background: #1877f2; }
        .whatsapp { background: #25d366; }
        .email { background: #ea4335; }
        .copy-link { background: #666; }

        .action-buttons {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .btn {
          padding: 14px 24px;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }

        .btn-primary {
          background: #ff6b9d;
          color: white;
        }

        .btn-primary:hover {
          background: #e85a8c;
        }

        .btn-secondary {
          background: #f5f5f5;
          color: #1a1a1a;
          border: 2px solid #ddd;
        }

        .btn-secondary:hover {
          background: #eee;
        }
      `}</style>
    </>
  );
}
```

### Backend: Completion Page Data Endpoint

```typescript
// Backend: GET /api/courses/:courseId/completion-page
app.get(
  "/courses/:courseId/completion-page",
  authenticateToken,
  async (req, res) => {
    const { courseId } = req.params;
    const userId = req.user.id;

    try {
      // Verify course completion
      const completionResult = await db.query(
        `SELECT completed_at, completion_percentage FROM course_completion
       WHERE course_id = $1 AND user_id = $2`,
        [courseId, userId],
      );

      if (!completionResult.rows[0]?.completed_at) {
        return res.status(403).json({ error: "Course not completed" });
      }

      // Get course data
      const courseResult = await db.query(
        `SELECT id, title, thumbnail_url, instructor_id, instructor_message, display_order
       FROM courses WHERE id = $1`,
        [courseId],
      );

      const course = courseResult.rows[0];

      // Get instructor info
      const instructorResult = await db.query(
        `SELECT first_name, last_name FROM users WHERE id = $1`,
        [course.instructor_id],
      );

      const instructor = instructorResult.rows[0];

      // Find next course if exists
      const nextCourseResult = await db.query(
        `SELECT id, title FROM courses
       WHERE display_order > (SELECT display_order FROM courses WHERE id = $1)
       ORDER BY display_order ASC LIMIT 1`,
        [courseId],
      );

      const nextCourse = nextCourseResult.rows[0];

      return res.json({
        courseId,
        courseName: course.title,
        instructor: `${instructor.first_name} ${instructor.last_name}`,
        instructorMessage: course.instructor_message,
        thumbnail: course.thumbnail_url,
        completedAt: completionResult.rows[0].completed_at,
        completionPercentage: completionResult.rows[0].completion_percentage,
        nextCourseId: nextCourse?.id,
        nextCourseName: nextCourse?.title,
      });
    } catch (error) {
      console.error("Error fetching completion page:", error);
      return res.status(500).json({ error: "Failed to fetch completion data" });
    }
  },
);
```

### My Courses: Display Completed Badge

```typescript
// Component: Course card in My Courses list
export const CourseCard = ({ course, completion }) => {
  return (
    <div className="course-card">
      <img src={course.thumbnail} alt={course.title} />
      <div className="course-info">
        <h3>{course.title}</h3>
        {completion?.completed ? (
          <div className="completion-badge">
            <i className="fas fa-check-circle"></i>
            <span>Completed {new Date(completion.completed_at).toLocaleDateString()}</span>
          </div>
        ) : (
          <div className="progress-bar">
            <div style={{ width: `${completion?.completion_percentage || 0}%` }} />
          </div>
        )}
      </div>
    </div>
  );
};

const styles = `
  .completion-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #ff6b9d;
    font-size: 14px;
    font-weight: 500;
  }

  .completion-badge i {
    font-size: 16px;
  }
`;
```

### Mobile Implementation (React Native)

```javascript
// /apps/learner-mobile/src/screens/CourseCompletionScreen.tsx
import React, { useEffect, useState } from "react";
import { View, Text, Image, ScrollView, Share, Animated } from "react-native";
import { useRoute } from "@react-navigation/native";
import LottieView from "lottie-react-native";

export const CourseCompletionScreen = () => {
  const route = useRoute();
  const { courseId } = route.params;
  const [completionData, setCompletionData] = useState(null);
  const celebrationAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loadCompletionData = async () => {
      const response = await fetch(
        `/api/courses/${courseId}/completion-page?userId=${userId}`,
      );
      const data = await response.json();
      setCompletionData(data);

      // Start animation
      Animated.timing(celebrationAnimation, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    };

    loadCompletionData();
  }, [courseId]);

  const handleShare = async (platform) => {
    const shareUrl = `learner.example.com/courses/${courseId}/completion`;
    const title = `I just completed ${completionData.courseName}!`;

    if (platform === "native") {
      Share.share({
        message: `${title}\n${shareUrl}`,
        url: shareUrl,
        title: title,
      });
    } else {
      // Open platform-specific share URLs
      const urls = {
        whatsapp: `whatsapp://send?text=${encodeURIComponent(title + " " + shareUrl)}`,
        linkedin: `linkedin://news`,
        twitter: `twitter://intent/tweet?text=${encodeURIComponent(title)}&url=${shareUrl}`,
      };
      Linking.openURL(urls[platform]);
    }

    analytics.track("completion_shared_mobile", { courseId, platform });
  };

  if (!completionData) return <LoadingSpinner />;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Confetti Animation */}
      <LottieView
        source={require("@/assets/animations/confetti.json")}
        autoPlay
        loop={false}
        style={styles.confetti}
      />

      <View style={styles.content}>
        {/* Celebration Header */}
        <Text style={styles.heading}>Congratulations!</Text>
        <Text style={styles.subheading}>
          You've completed {completionData.courseName}
        </Text>

        {/* Course Info */}
        <Image
          source={{ uri: completionData.thumbnail }}
          style={styles.courseThumbnail}
        />
        <Text style={styles.courseName}>{completionData.courseName}</Text>
        <Text style={styles.instructor}>by {completionData.instructor}</Text>

        {/* Completion Stats */}
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>100%</Text>
            <Text style={styles.statLabel}>Complete</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {new Date(completionData.completedAt).toLocaleDateString()}
            </Text>
            <Text style={styles.statLabel}>Completed On</Text>
          </View>
        </View>

        {/* Instructor Message */}
        {completionData.instructorMessage && (
          <View style={styles.messageBox}>
            <Text style={styles.messageLabel}>
              Message from your instructor:
            </Text>
            <Text style={styles.message}>
              {completionData.instructorMessage}
            </Text>
          </View>
        )}

        {/* Share Section */}
        <Text style={styles.shareTitle}>Share Your Achievement</Text>
        <View style={styles.shareButtons}>
          <TouchableOpacity
            style={[styles.shareBtn, styles.shareNative]}
            onPress={() => handleShare("native")}
          >
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.shareBtn, styles.shareWhatsapp]}
            onPress={() => handleShare("whatsapp")}
          >
            <Text style={styles.shareBtnText}>WhatsApp</Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate("MyCourses")}
        >
          <Text style={styles.primaryButtonText}>Return to My Courses</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  confetti: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  content: {
    padding: 20,
  },
  heading: {
    fontSize: 28,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 20,
  },
  subheading: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
    marginBottom: 30,
  },
  courseThumbnail: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
  // ... more styles
});
```

### Database: Track Shares

```sql
CREATE TABLE completion_shares (
  id SERIAL PRIMARY KEY,
  course_id UUID NOT NULL,
  user_id UUID NOT NULL,
  platform VARCHAR(50), -- linkedin, twitter, facebook, whatsapp, email, copy
  shared_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Track share analytics
INSERT INTO completion_shares (course_id, user_id, platform)
VALUES (...);
```
