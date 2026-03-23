# Task: Course Analytics - Instructor Dashboard

## Description

Implement instructor analytics dashboard for published courses. Displays enrollment trends, lesson completion rates, watch time via Mux Data API, and engagement metrics (comments, posts, votes). Provides charts and data tables for performance tracking and course improvement insights.

## Affected Apps/Packages

- Backend: `@mentor/api` (Hono on Vercel)
- Database: `@mentor/db` (Drizzle + Neon PostgreSQL)
- Frontend: `@mentor/web` (Next.js, React)
- Shared types: `@mentor/types`
- Charts: Recharts or Chart.js
- External: Mux Data API

## API Endpoints

### GET /api/v1/courses/{courseId}/analytics

Get comprehensive course analytics.

**Query Parameters:**

- `period`: "7d" (7 days), "30d", "90d", "all" (default: "30d")
- `metric`: Optional, specific metric to focus on

**Response (200 OK):**

```json
{
  "courseId": "uuid",
  "courseName": string,
  "period": "30d",
  "analytics": {
    "enrollment": {
      "totalEnrolled": 150,
      "newEnrollments": [
        {
          "date": "2026-02-18",
          "count": 5
        }
      ],
      "enrollmentTrend": "up",
      "percentageChange": 12.5
    },
    "completion": {
      "totalCompleted": 45,
      "completionRate": 30.0,
      "inProgress": 105,
      "notStarted": 0,
      "completionByLesson": [
        {
          "lessonId": "uuid",
          "lessonTitle": "Lesson 1",
          "completionRate": 95.0,
          "completedCount": 142
        }
      ]
    },
    "watchTime": {
      "totalWatchTimeMinutes": 12500,
      "averageWatchTimePerLearner": 83.3,
      "totalVideoViews": 1250,
      "averageSessionDuration": 15.5,
      "completionRate": 78.0
    },
    "engagement": {
      "totalComments": 280,
      "totalPosts": 45,
      "totalVotes": 520,
      "avgCommentsPerLesson": 3.5,
      "mostCommentedLesson": {
        "lessonId": "uuid",
        "title": "Lesson 5",
        "commentCount": 45
      }
    },
    "learnerBreakdown": {
      "active": 45,
      "inactive30Days": 30,
      "inactive90Days": 50,
      "neverStarted": 25
    }
  },
  "generatedAt": "ISO8601"
}
```

### GET /api/v1/courses/{courseId}/analytics/enrollment

Get enrollment analytics over time.

**Query Parameters:**

- `period`: "7d", "30d", "90d", "all"
- `granularity`: "daily", "weekly", "monthly"

**Response (200 OK):**

```json
{
  "courseId": "uuid",
  "enrollmentTrend": [
    {
      "date": "2026-02-18",
      "newEnrollments": 5,
      "cumulativeEnrollments": 150,
      "churnRate": 0.5
    }
  ],
  "summary": {
    "totalEnrollments": 150,
    "growth": 12.5,
    "retentionRate": 98.5,
    "churnRate": 1.5
  }
}
```

### GET /api/v1/courses/{courseId}/analytics/learners

Get detailed learner list and progress.

**Query Parameters:**

- `status`: "all", "active", "completed", "inProgress", "notStarted"
- `sortBy`: "lastActive", "completionRate", "enrolledDate"
- `limit`: 20 (default), max 100
- `offset`: 0 (default)

**Response (200 OK):**

```json
{
  "courseId": "uuid",
  "learners": [
    {
      "userId": "uuid",
      "name": string,
      "enrolledDate": "ISO8601",
      "lastActiveDate": "ISO8601",
      "completionRate": 45.0,
      "lessonsCompleted": 4,
      "lessonsTotal": 8,
      "watchTimeMinutes": 125,
      "status": "inProgress"
    }
  ],
  "total": number,
  "summary": {
    "activeCount": 45,
    "completedCount": 45,
    "inProgressCount": 60,
    "notStartedCount": 0
  }
}
```

### GET /api/v1/courses/{courseId}/analytics/lesson-performance

Get per-lesson performance metrics.

**Response (200 OK):**

```json
{
  "courseId": "uuid",
  "lessons": [
    {
      "lessonId": "uuid",
      "lessonTitle": string,
      "moduleId": "uuid",
      "moduleName": string,
      "views": 142,
      "completionRate": 95.0,
      "averageWatchTime": 12.5,
      "avgCompletionTime": 45.0,
      "comments": 23,
      "difficulty": "moderate"
    }
  ]
}
```

### GET /api/v1/courses/{courseId}/analytics/mux-data

Get video analytics from Mux Data API.

**Query Parameters:**

- `period`: "24h", "7d", "30d"

**Response (200 OK):**

```json
{
  "courseId": "uuid",
  "videoMetrics": {
    "totalViews": 1250,
    "uniqueViewers": 280,
    "totalWatchTimeMinutes": 12500,
    "averageSessionDuration": 15.5,
    "completionRate": 78.0,
    "droppedOffPercentage": 22.0,
    "droppedOffPoints": [
      {
        "percentageWatched": 25.0,
        "viewers": 35
      },
      {
        "percentageWatched": 50.0,
        "viewers": 60
      },
      {
        "percentageWatched": 75.0,
        "viewers": 90
      }
    ]
  }
}
```

## UI Components

### Analytics Dashboard Overview

- Header: Course name, publication date, stats cards
- Cards showing:
  - Total enrollments (with trend ↑/↓)
  - Completion rate
  - Average watch time
  - Engagement score
- Quick filters: Period selector (7d, 30d, 90d, all)

### Enrollment Trend Chart

- Line chart showing new enrollments over time
- X-axis: Time (daily/weekly/monthly)
- Y-axis: Enrollment count
- Color: Blue
- Hover tooltip showing exact count and date

### Completion Rate Chart

- Bar chart showing completion rate by lesson
- Or pie chart showing completion breakdown (completed/in progress/not started)
- Sortable by completion rate
- Hover shows completion count and percentage

### Watch Time Analytics

- Table showing average watch time per learner
- Chart: Average session duration over time
- Dropoff rate: Visualization of where learners typically stop watching
- Completion rate indicator

### Engagement Metrics

- Table: Most commented lessons
- Comments, posts, votes counts
- Engagement trend over time
- Most engaged learner list (optional)

### Learner Progress Table

- Columns: Learner name, enrollment date, last active, completion %, lessons completed, watch time
- Sortable by any column
- Filter: Status (all, active, completed, in progress, not started)
- Search: By learner name
- Actions: Message learner (optional)

### Lesson Performance Table

- Columns: Lesson title, views, completion rate, avg watch time, comments, difficulty
- Sorted by completion rate (or configurable)
- Color coding: Red (low completion), yellow (medium), green (high)

## Requirements

1. **Enrollment Analytics**
   - Total enrollment count
   - New enrollments per day/week/month
   - Cumulative enrollment trend
   - Retention/churn rate calculation
   - Growth percentage

2. **Completion Analytics**
   - Overall course completion rate
   - Per-lesson completion rates
   - Completion breakdown (completed, in progress, not started)
   - Time to completion (average)
   - Completion trend over time

3. **Watch Time Data (from Mux)**
   - Total video watch minutes
   - Average watch time per learner
   - Average session duration
   - Video completion rate
   - Dropoff rate (where learners typically stop)
   - Dropoff visualization

4. **Engagement Metrics**
   - Total comments on lessons/course
   - Community posts count
   - Vote count
   - Comments per lesson average
   - Most engaged lesson
   - Engagement trend

5. **Learner Breakdown**
   - Active learners (accessed within 30 days)
   - Completed learners
   - In-progress learners
   - Never started
   - Last activity tracking

6. **Learner List**
   - Detailed learner progress table
   - Sortable and filterable
   - Enrollment date, last active date
   - Completion percentage and count
   - Watch time per learner
   - Status indicator

7. **Per-Lesson Performance**
   - Lesson title and module
   - View count
   - Completion rate
   - Average watch time
   - Average completion time
   - Comment/engagement count
   - Difficulty indicator (based on completion rate)

8. **Mux Data Integration**
   - Query Mux Data API for video metrics
   - Query per course or per video asset
   - Track views, unique viewers, watch time
   - Get dropout/dropoff insights
   - Calculate completion rates from Mux data

9. **Date Filtering**
   - Support periods: Last 7 days, 30 days, 90 days, all time
   - Flexible date range selector (optional)
   - Default: Last 30 days

10. **Performance Optimization**
    - Cache analytics data (1 hour TTL)
    - Lazy load heavy charts/tables
    - Paginate large learner lists
    - Mux API rate limiting consideration

## Acceptance Criteria

- [ ] GET /api/v1/courses/{courseId}/analytics returns comprehensive metrics
- [ ] Enrollment analytics includes trend and growth percentage
- [ ] Completion rate calculated per lesson
- [ ] Watch time data retrieved from Mux
- [ ] Engagement metrics (comments, posts, votes) calculated
- [ ] Learner breakdown shows active/inactive/completed counts
- [ ] Enrollment chart displays trend over time
- [ ] Completion chart shows per-lesson rates
- [ ] Watch time visualization shows average and dropout points
- [ ] Learner list shows all enrolled learners with progress
- [ ] Lesson performance table shows completion and engagement
- [ ] Period filter (7d, 30d, 90d, all) works
- [ ] Data sortable by relevant columns
- [ ] Data filterable by learner status
- [ ] Charts responsive and visually clear
- [ ] Data accurate and matches database
- [ ] Mux Data API integration working
- [ ] Analytics cached with 1 hour TTL
- [ ] 403 returned if user not course owner
- [ ] 404 returned if course not found

## Dependencies

- **Upstream**: Course Creation API (course-creation-api.md)
- **Upstream**: Lesson Management (lesson-management.md)
- **Upstream**: Learning Progress Tracking (07-video-player-and-learning)
- **Related**: Instructor Dashboard (10-instructor-dashboard-and-revenue)
- **External**: Mux Data API

## Technical Notes

### Database Queries for Analytics

```typescript
// Enrollment count
const enrollmentCount = await db.query.enrollments.findMany({
  where: (e, { eq }) => eq(e.courseId, courseId),
});

// New enrollments by date
const enrollmentsByDate = await db
  .select({
    date: sql`DATE(${enrollments.enrolledAt})`,
    count: sql`COUNT(*)`,
  })
  .from(enrollments)
  .where(
    and(
      eq(enrollments.courseId, courseId),
      gte(
        enrollments.enrolledAt,
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      )
    )
  )
  .groupBy(sql`DATE(${enrollments.enrolledAt})`)
  .orderBy(sql`DATE(${enrollments.enrolledAt})`);

// Completion rate per lesson
const lessonCompletion = await db
  .select({
    lessonId: learnerProgress.lessonId,
    completed: sql`COUNT(CASE WHEN ${learnerProgress.completed} = true THEN 1 END)`,
    total: sql`COUNT(*)`,
  })
  .from(learnerProgress)
  .where(
    and(
      inArray(
        learnerProgress.lessonId,
        db
          .select({ id: lessons.id })
          .from(lessons)
          .where(eq(lessons.courseId, courseId))
      ),
      eq(learnerProgress.courseId, courseId)
    )
  )
  .groupBy(learnerProgress.lessonId);

// Engagement metrics
const comments = await db.query.comments.findMany({
  where: (c, { eq, inArray }) =>
    inArray(
      c.lessonId,
      db
        .select({ id: lessons.id })
        .from(lessons)
        .where(eq(lessons.courseId, courseId))
    ),
});

const posts = await db.query.communityPosts.findMany({
  where: (p, { eq }) => eq(p.courseId, courseId),
});
```

### Backend Handler: Get Analytics

```typescript
export const getCourseAnalytics = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { courseId } = event.context.params;
  const { period = "30d" } = getQuery(event);

  // Verify course ownership
  const course = await db.query.courses.findFirst({
    where: (courses, { eq, and }) =>
      and(eq(courses.id, courseId), eq(courses.instructorId, user.id)),
  });

  if (!course) throw createError({ statusCode: 403 });

  // Get enrollment analytics
  const enrollments = await getEnrollmentAnalytics(courseId, period);

  // Get completion analytics
  const completion = await getCompletionAnalytics(courseId);

  // Get watch time from Mux
  const watchTime = await getMuxWatchTimeAnalytics(courseId, period);

  // Get engagement metrics
  const engagement = await getEngagementAnalytics(courseId);

  // Get learner breakdown
  const breakdown = await getLearnerBreakdown(courseId);

  return {
    courseId,
    courseName: course.title,
    period,
    analytics: {
      enrollment: enrollments,
      completion,
      watchTime,
      engagement,
      learnerBreakdown: breakdown,
    },
    generatedAt: new Date().toISOString(),
  };
});

async function getMuxWatchTimeAnalytics(courseId: string, period: string) {
  // Query Mux Data API for video metrics
  const mux = new Mux();

  // Get all Mux asset IDs for course
  const lessons = await db.query.lessons.findMany({
    where: (l, { eq }) => eq(l.courseId, courseId),
  });

  const muxAssetIds = lessons.map((l) => l.muxAssetId).filter(Boolean);

  let totalWatchTime = 0;
  let totalViews = 0;
  let uniqueViewers = new Set<string>();

  // Query each asset
  for (const assetId of muxAssetIds) {
    try {
      const metrics = await mux.data.metrics.breakdown({
        timeframe: [getTimestamp(period), Date.now().toString()],
        filters: [`asset_id:${assetId}`],
        dimension: "asset_id",
      });

      // Parse metrics and aggregate
      // (specific metric parsing depends on Mux Data API format)
    } catch (error) {
      console.error(`Error fetching Mux metrics for asset ${assetId}:`, error);
    }
  }

  return {
    totalWatchTimeMinutes: Math.round(totalWatchTime / 60),
    averageWatchTimePerLearner: Math.round(
      totalWatchTime / 60 / lessons.length
    ),
    totalVideoViews: totalViews,
    averageSessionDuration: 15.5, // From Mux data
    completionRate: 78.0, // From Mux data
  };
}

function getTimestamp(period: string): string {
  const now = Date.now();
  const days: Record<string, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    all: 365, // Default to 1 year
  };

  const daysAgo = days[period] || 30;
  const timestamp = new Date(now - daysAgo * 24 * 60 * 60 * 1000).getTime();
  return Math.round(timestamp / 1000).toString();
}
```

### Frontend Component: Analytics Dashboard

```typescript
import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export function AnalyticsDashboard({ courseId }: Props) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [isLoading, setIsLoading] = useState(true);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [lessonPerf, setLessonPerf] = useState<LessonPerformance[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, [courseId, period]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const [analyticsRes, learnersRes, lessonRes] = await Promise.all([
        fetch(`/api/v1/courses/${courseId}/analytics?period=${period}`),
        fetch(`/api/v1/courses/${courseId}/analytics/learners`),
        fetch(`/api/v1/courses/${courseId}/analytics/lesson-performance`)
      ]);

      setAnalytics(await analyticsRes.json());
      setLearners(await learnersRes.json());
      setLessonPerf(await lessonRes.json());
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <div>Loading analytics...</div>;

  if (!analytics) return <div>No analytics available</div>;

  return (
    <div className="analytics-dashboard">
      <div className="header">
        <h1>{analytics.courseName} Analytics</h1>
        <select value={period} onChange={(e) => setPeriod(e.target.value as any)}>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <Card
          title="Total Enrollments"
          value={analytics.analytics.enrollment.totalEnrolled}
          trend={analytics.analytics.enrollment.percentageChange}
        />
        <Card
          title="Completion Rate"
          value={`${analytics.analytics.completion.completionRate.toFixed(1)}%`}
        />
        <Card
          title="Avg Watch Time"
          value={`${analytics.analytics.watchTime.averageWatchTimePerLearner.toFixed(1)} min`}
        />
        <Card
          title="Total Engagement"
          value={analytics.analytics.engagement.totalComments + analytics.analytics.engagement.totalPosts}
        />
      </div>

      {/* Charts */}
      <div className="charts">
        <div className="chart-container">
          <h2>Enrollment Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.analytics.enrollment.newEnrollments}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#3B82F6" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <h2>Completion by Lesson</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.analytics.completion.completionByLesson}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="lessonTitle" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="completionRate" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Learner Table */}
      <div className="learner-section">
        <h2>Learner Progress</h2>
        <table className="learner-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Enrolled</th>
              <th>Last Active</th>
              <th>Completion</th>
              <th>Watch Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {learners.map(learner => (
              <tr key={learner.userId}>
                <td>{learner.name}</td>
                <td>{formatDate(learner.enrolledDate)}</td>
                <td>{formatDate(learner.lastActiveDate)}</td>
                <td>
                  <ProgressBar value={learner.completionRate} />
                  {learner.completionRate.toFixed(0)}%
                </td>
                <td>{learner.watchTimeMinutes} min</td>
                <td><Badge>{learner.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lesson Performance */}
      <div className="lesson-section">
        <h2>Lesson Performance</h2>
        <table className="lesson-table">
          <thead>
            <tr>
              <th>Lesson</th>
              <th>Views</th>
              <th>Completion</th>
              <th>Avg Watch Time</th>
              <th>Comments</th>
              <th>Difficulty</th>
            </tr>
          </thead>
          <tbody>
            {lessonPerf.map(lesson => (
              <tr key={lesson.lessonId}>
                <td>{lesson.lessonTitle}</td>
                <td>{lesson.views}</td>
                <td>
                  <ProgressBar value={lesson.completionRate} />
                  {lesson.completionRate.toFixed(0)}%
                </td>
                <td>{lesson.averageWatchTime.toFixed(1)} min</td>
                <td>{lesson.comments}</td>
                <td><DifficultyBadge level={lesson.difficulty} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### Testing Checklist

- Analytics endpoint returns enrollment, completion, watch time, engagement
- Enrollment trend shows new enrollments per day
- Completion rate calculated correctly per lesson
- Mux watch time data retrieved successfully
- Engagement metrics include comments, posts, votes
- Learner list shows all enrollments with progress
- Lesson performance shows per-lesson metrics
- Period filter (7d, 30d, 90d, all) works
- Charts display correctly
- Data sortable and filterable
- 403 returned if not course owner
- Cache working (1 hour TTL)
