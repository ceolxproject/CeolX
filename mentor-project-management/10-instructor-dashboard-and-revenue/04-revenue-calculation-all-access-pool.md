# Revenue Calculation: All Access Subscription Pool

## Description

Implement server-side calculation logic for All Access subscription revenue attribution to instructors. Monthly subscription pool revenue is divided among instructors based on their courses' watch-time share. Admin configures which courses are eligible for All Access revenue. Calculate and record earnings per billing cycle using Mux Data API for watch-time metrics. Run calculation as monthly batch job.

## Affected Apps/Packages

- Backend: `hono-api` service
- Database: earnings, subscription_eligibility, watch_time_metrics tables
- Analytics: Mux Data API for video watch-time
- Batch Jobs: Background job queue (Bull, node-schedule, or Cloud Tasks)
- External Service: Stripe for subscription revenue data, Mux for analytics

## Architecture Overview

### Data Flow

```
Stripe Subscription → Monthly Pool Total
                          ↓
      Admin Config: Eligible Courses
                          ↓
        Mux Data API: Watch-Time Metrics
                          ↓
        Calculate: Watch-Time Percentages
                          ↓
   Assign: Revenue to Each Instructor
                          ↓
    Create: Earnings Records per Instructor
```

---

## Configuration & Setup

### Subscription Eligibility Management

#### GET /admin/subscription-eligibility

**List current eligible courses for All Access**

**Request:**

```http
GET /admin/subscription-eligibility
Authorization: Bearer {super_admin_jwt}
```

**Response (200 OK):**

```json
{
  "billingPeriod": "2024-02",
  "totalPool": 5000.0,
  "eligibleCourses": [
    {
      "courseId": "course-uuid-1",
      "courseName": "Advanced Makeup Techniques",
      "instructorId": "instructor-uuid-1",
      "instructorName": "Jane Doe",
      "addedAt": "2024-02-01T00:00:00Z",
      "watchTimeMinutes": 12450,
      "watchTimePercentage": 25.5,
      "estimatedRevenue": 1275.0,
      "status": "active"
    },
    {
      "courseId": "course-uuid-2",
      "courseName": "Skin Care Fundamentals",
      "instructorId": "instructor-uuid-2",
      "instructorName": "John Smith",
      "addedAt": "2024-01-15T00:00:00Z",
      "watchTimeMinutes": 9875,
      "watchTimePercentage": 20.2,
      "estimatedRevenue": 1010.0,
      "status": "active"
    }
  ],
  "totalWatchTimeMinutes": 48900,
  "totalEligibleCoursesCount": 5,
  "nextCalculationDate": "2024-03-01T00:00:00Z"
}
```

---

#### POST /admin/subscription-eligibility/add-course

**Add course to All Access eligible pool**

**Request:**

```json
{
  "courseId": "course-uuid-3"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "courseId": "course-uuid-3",
  "courseName": "Lip Art Masterclass",
  "instructorId": "instructor-uuid-3",
  "addedAt": "2024-02-18T10:30:00Z",
  "message": "Course added to All Access pool. Revenue calculation for Feb 2024 is complete; this course will be included in March 2024 calculation."
}
```

---

#### DELETE /admin/subscription-eligibility/remove-course/:courseId

**Remove course from All Access pool**

**Request:**

```http
DELETE /admin/subscription-eligibility/remove-course/course-uuid-3
Authorization: Bearer {super_admin_jwt}
```

**Response (200 OK):**

```json
{
  "success": true,
  "courseId": "course-uuid-3",
  "removedAt": "2024-02-18T10:35:00Z",
  "message": "Course removed from All Access pool. Revenue already allocated for Feb 2024 remains; no future allocations will include this course."
}
```

---

## Data Model

### subscription_eligibility Table

```sql
CREATE TABLE subscription_eligibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Course reference
  course_id UUID NOT NULL UNIQUE REFERENCES courses(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES instructors(id),

  -- Eligibility tracking
  is_eligible BOOLEAN DEFAULT TRUE,
  eligible_from_period VARCHAR(7),  -- YYYY-MM format, first period to include
  eligible_until_period VARCHAR(7) DEFAULT NULL,  -- NULL = ongoing

  -- Admin notes
  reason_added VARCHAR(255),
  reason_removed VARCHAR(255),

  -- Timestamps
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  removed_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT valid_period_dates CHECK (
    eligible_until_period IS NULL OR eligible_until_period > eligible_from_period
  )
);

CREATE INDEX idx_subscription_eligibility_course_id ON subscription_eligibility(course_id);
CREATE INDEX idx_subscription_eligibility_instructor_id ON subscription_eligibility(instructor_id);
CREATE INDEX idx_subscription_eligibility_is_eligible ON subscription_eligibility(is_eligible);
```

### watch_time_metrics Table

```sql
CREATE TABLE watch_time_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  billing_period VARCHAR(7) NOT NULL,  -- YYYY-MM format
  course_id UUID NOT NULL REFERENCES courses(id),
  instructor_id UUID NOT NULL REFERENCES instructors(id),

  -- Watch-time data from Mux
  total_watch_time_minutes INT NOT NULL DEFAULT 0,
  unique_viewers INT DEFAULT 0,
  total_views INT DEFAULT 0,
  average_watch_time_minutes DECIMAL(10, 2) DEFAULT 0,

  -- Calculated metrics
  total_pool_watch_time_minutes INT,  -- Sum of all eligible courses for period
  watch_time_percentage DECIMAL(5, 2),  -- This course's % of total

  -- Source metadata
  mux_data_retrieved_at TIMESTAMP,
  mux_query_start_date DATE,
  mux_query_end_date DATE,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT valid_watch_time CHECK (total_watch_time_minutes >= 0),
  CONSTRAINT valid_percentage CHECK (
    watch_time_percentage >= 0 AND watch_time_percentage <= 100
  ),
  CONSTRAINT unique_period_course CHECK (
    billing_period IS NOT NULL AND course_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX idx_watch_time_metrics_period_course
  ON watch_time_metrics(billing_period, course_id);
CREATE INDEX idx_watch_time_metrics_instructor_id
  ON watch_time_metrics(instructor_id);
```

### Updated earnings Table (for subscriptions)

```sql
-- Add these columns to earnings table from 03-revenue-calculation-single-purchase

ALTER TABLE earnings ADD COLUMN (
  -- Subscription-specific fields
  billing_period VARCHAR(7),  -- YYYY-MM, which month's pool
  course_ids JSONB,  -- Array of course IDs (for subscriptions with multiple courses)
  all_access_pool_total DECIMAL(10, 2),  -- Total pool amount
  watch_time_percentage DECIMAL(5, 2),  -- This instructor's watch-time %
  watch_time_minutes INT,  -- This instructor's watch-time in billing period
  subscription_subscriber_count INT  -- Total All Access subscribers
);

-- Existing constraint validation still applies
```

---

## Watch-Time Calculation Using Mux Data API

### Mux Data Integration

#### Get Watch-Time Metrics from Mux

```typescript
import { MuxData } from "@mux/mux-node";

const muxData = new MuxData({
  accessTokenId: process.env.MUX_DATA_ACCESS_TOKEN_ID,
  accessTokenSecret: process.env.MUX_DATA_ACCESS_TOKEN_SECRET,
});

async function getWatchTimeMetricsForCourse(
  courseId: string,
  videoIds: string[],  // Mux video IDs
  startDate: Date,
  endDate: Date
): Promise<{
  totalWatchTimeMinutes: number;
  uniqueViewers: number;
  totalViews: number;
}> {
  // Query Mux Data API for metrics
  const metrics = await muxData.metrics.timeseries.list({
    timeframe: [
      startDate.toISOString().split("T")[0],
      endDate.toISOString().split("T")[0],
    ],
    metric: ["videos.view.count", "watched.minutes"],
    filters: [
      `video.id:${videoIds.join("|")}`,  // Filter by video IDs in this course
    ],
  });

  // Aggregate results
  let totalWatchMinutes = 0;
  let uniqueViewers = new Set<string>();
  let totalViews = 0;

  metrics.data.forEach((point) => {
    if (point.metric === "watched.minutes") {
      totalWatchMinutes += point.value || 0;
    }
    if (point.metric === "videos.view.count") {
      totalViews += point.value || 0;
    }
  });

  // Get unique viewers (cohort method)
  const cohortMetrics = await muxData.metrics.timeseries.list({
    timeframe: [...],
    metric: ["viewers"],
    filters: [`video.id:${videoIds.join("|")}`],
  });

  const uniqueViewerCount = cohortMetrics.data[0]?.value || 0;

  return {
    totalWatchTimeMinutes: Math.round(totalWatchMinutes),
    uniqueViewers: uniqueViewerCount,
    totalViews,
  };
}
```

### Alternative: Custom Watch-Time Tracking

If direct Mux API access is limited, store watch-time events:

```typescript
// On video progress event (from student app)
async function recordWatchProgress(
  videoId: string,
  courseId: string,
  studentId: string,
  watchedSeconds: number,
  timestamp: Date,
) {
  await db.watch_events.create({
    video_id: videoId,
    course_id: courseId,
    student_id: studentId,
    watched_seconds: watchedSeconds,
    created_at: timestamp,
  });
}

// Aggregate at calculation time
async function getWatchTimeMetricsForCourse(
  courseId: string,
  startDate: Date,
  endDate: Date,
) {
  const events = await db.watch_events.query({
    courseId,
    createdAt: {
      $gte: startDate,
      $lte: endDate,
    },
  });

  const totalWatchSeconds = events.reduce(
    (sum, e) => sum + e.watched_seconds,
    0,
  );

  const uniqueStudents = new Set(events.map((e) => e.student_id)).size;

  return {
    totalWatchTimeMinutes: Math.round(totalWatchSeconds / 60),
    uniqueViewers: uniqueStudents,
    totalViews: events.length,
  };
}
```

---

## Monthly Revenue Calculation Job

### Trigger: First Day of Month at 00:00 UTC

```typescript
// Schedule using node-schedule or cron
import schedule from "node-schedule";

// Every 1st of month at 00:00 UTC
schedule.scheduleJob("0 0 1 * *", async () => {
  await calculateMonthlyAllAccessRevenue();
});

// Alternative: Trigger manually for testing/backfill
// POST /admin/calculate-subscription-revenue?billingPeriod=2024-02
```

### Calculation Logic

```typescript
async function calculateMonthlyAllAccessRevenue(
  billingPeriod?: string, // YYYY-MM, defaults to previous month
) {
  // 1. Determine billing period (default to previous month)
  if (!billingPeriod) {
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    billingPeriod = previousMonth.toISOString().slice(0, 7); // YYYY-MM
  }

  console.log(`Starting All Access revenue calculation for ${billingPeriod}`);

  // 2. Fetch total All Access subscription revenue for period
  const allAccessRevenue = await getSubscriptionPoolTotal(billingPeriod);
  if (!allAccessRevenue || allAccessRevenue <= 0) {
    console.log(`No subscription revenue for ${billingPeriod}`);
    return;
  }

  // 3. Fetch eligible courses
  const eligibleCourses = await db.subscription_eligibility.find({
    is_eligible: true,
    eligible_from_period: { $lte: billingPeriod },
    $or: [
      { eligible_until_period: null },
      { eligible_until_period: { $gte: billingPeriod } },
    ],
  });

  if (eligibleCourses.length === 0) {
    console.log(`No eligible courses for ${billingPeriod}`);
    return;
  }

  // 4. Get Mux watch-time data for each course
  const startDate = new Date(`${billingPeriod}-01`);
  const endDate = new Date(
    startDate.getFullYear(),
    startDate.getMonth() + 1,
    0,
  );

  const watchTimeMetrics = [];

  for (const course of eligibleCourses) {
    try {
      const muxMetrics = await getWatchTimeMetricsForCourse(
        course.course_id,
        course.mux_video_ids, // Store Mux IDs in courses table
        startDate,
        endDate,
      );

      const metric = {
        courseId: course.course_id,
        instructorId: course.instructor_id,
        billingPeriod,
        totalWatchTimeMinutes: muxMetrics.totalWatchTimeMinutes,
        uniqueViewers: muxMetrics.uniqueViewers,
        totalViews: muxMetrics.totalViews,
      };

      watchTimeMetrics.push(metric);
    } catch (error) {
      console.error(
        `Failed to fetch metrics for course ${course.course_id}:`,
        error,
      );
      // Continue with other courses
    }
  }

  // 5. Calculate total watch-time across all eligible courses
  const totalWatchTimeMinutes = watchTimeMetrics.reduce(
    (sum, m) => sum + m.totalWatchTimeMinutes,
    0,
  );

  if (totalWatchTimeMinutes === 0) {
    console.log(`No watch-time data for any course in ${billingPeriod}`);
    return;
  }

  // 6. Store watch-time metrics in database
  for (const metric of watchTimeMetrics) {
    const watchTimePercentage =
      (metric.totalWatchTimeMinutes / totalWatchTimeMinutes) * 100;

    await db.watch_time_metrics.create({
      ...metric,
      total_pool_watch_time_minutes: totalWatchTimeMinutes,
      watch_time_percentage: Math.round(watchTimePercentage * 100) / 100,
      mux_data_retrieved_at: new Date(),
      mux_query_start_date: startDate,
      mux_query_end_date: endDate,
    });
  }

  // 7. Calculate revenue allocation per instructor
  const revenueAllocations = [];

  for (const metric of watchTimeMetrics) {
    const watchTimePercentage =
      (metric.totalWatchTimeMinutes / totalWatchTimeMinutes) * 100;
    const instructorShare =
      Math.round(((allAccessRevenue * watchTimePercentage) / 100) * 100) / 100;

    const allocation = {
      courseId: metric.courseId,
      instructorId: metric.instructorId,
      billingPeriod,
      allAccessPoolTotal: allAccessRevenue,
      instructorShare,
      watchTimePercentage,
      watchTimeMinutes: metric.totalWatchTimeMinutes,
    };

    revenueAllocations.push(allocation);
  }

  // 8. Create earnings records for each instructor
  for (const allocation of revenueAllocations) {
    const transactionId = `sub-${billingPeriod}-${allocation.instructorId.slice(0, 8)}-${Date.now()}`;

    // Determine course IDs for this instructor's subscription earnings
    const instructorEligibleCourses = eligibleCourses
      .filter((c) => c.instructor_id === allocation.instructorId)
      .map((c) => c.course_id);

    await db.earnings.create({
      instructor_id: allocation.instructorId,
      transaction_id: transactionId,
      type: "subscription",
      status: "completed",
      billing_period: allocation.billingPeriod,
      course_ids: instructorEligibleCourses,
      gross_amount: allocation.allAccessPoolTotal, // Pool amount (not instructor's share)
      instructor_share: allocation.instructorShare,
      platform_share:
        allocation.allAccessPoolTotal - allocation.instructorShare,
      watch_time_percentage: allocation.watchTimePercentage,
      watch_time_minutes: allocation.watchTimeMinutes,
      subscription_subscriber_count: await getSubscriberCount(
        allocation.billingPeriod,
      ),
      payout_included: false,
      created_at: new Date(),
    });

    // Log event
    await eventBus.emit("subscription.revenue.allocated", {
      instructorId: allocation.instructorId,
      amount: allocation.instructorShare,
      billingPeriod: allocation.billingPeriod,
      watchTimePercentage: allocation.watchTimePercentage,
    });
  }

  console.log(
    `Completed All Access revenue calculation for ${billingPeriod}. Allocated to ${revenueAllocations.length} instructors.`,
  );

  return {
    success: true,
    billingPeriod,
    totalAllAccessRevenue: allAccessRevenue,
    totalWatchTimeMinutes,
    instructorCount: revenueAllocations.length,
    totalAllocated: revenueAllocations.reduce(
      (sum, a) => sum + a.instructorShare,
      0,
    ),
  };
}
```

### Get Subscription Pool Total from Stripe

```typescript
async function getSubscriptionPoolTotal(
  billingPeriod: string,
): Promise<number> {
  // Query Stripe for All Access subscription revenue
  // This would come from a Stripe subscription product

  const invoices = await stripe.invoices.list({
    created: {
      gte: new Date(`${billingPeriod}-01`).getTime() / 1000,
      lt:
        new Date(
          new Date(`${billingPeriod}-01`).getFullYear(),
          new Date(`${billingPeriod}-01`).getMonth() + 1,
          1,
        ).getTime() / 1000,
    },
    subscription: process.env.STRIPE_ALL_ACCESS_SUBSCRIPTION_ID,
    limit: 100,
  });

  const totalRevenue = invoices.data.reduce((sum, invoice) => {
    if (invoice.status === "paid") {
      return sum + (invoice.total || 0) / 100; // Convert cents to dollars
    }
    return sum;
  }, 0);

  return totalRevenue;
}
```

---

## Admin API Endpoints

### GET /admin/all-access-revenue-calculation

**View calculation results for a billing period**

**Request:**

```http
GET /admin/all-access-revenue-calculation?billingPeriod=2024-02
Authorization: Bearer {super_admin_jwt}
```

**Response (200 OK):**

```json
{
  "billingPeriod": "2024-02",
  "status": "completed",
  "totalAllAccessRevenue": 5000.0,
  "totalWatchTimeMinutes": 48900,
  "calculatedAt": "2024-03-01T00:00:15Z",
  "allocations": [
    {
      "instructorId": "instructor-uuid-1",
      "instructorName": "Jane Doe",
      "courseIds": ["course-uuid-1"],
      "watchTimeMinutes": 12450,
      "watchTimePercentage": 25.5,
      "instructorShare": 1275.0,
      "platformShare": 3725.0,
      "status": "allocated"
    },
    {
      "instructorId": "instructor-uuid-2",
      "instructorName": "John Smith",
      "courseIds": ["course-uuid-2"],
      "watchTimeMinutes": 9875,
      "watchTimePercentage": 20.2,
      "instructorShare": 1010.0,
      "platformShare": 3990.0,
      "status": "allocated"
    }
  ],
  "totalAllocated": 4250.0,
  "platformRetained": 750.0
}
```

---

### POST /admin/recalculate-subscription-revenue

**Manually trigger calculation (for backfill or correction)**

**Request:**

```json
{
  "billingPeriod": "2024-01"
}
```

**Response (202 Accepted):**

```json
{
  "success": true,
  "jobId": "job-uuid-123",
  "message": "Calculation started. Check status with GET /admin/calculation-status/job-uuid-123",
  "billingPeriod": "2024-01"
}
```

---

## Requirements

### Mux Data API Setup

1. Get Mux Data access token (separate from video token)
2. Store in environment:
   - `MUX_DATA_ACCESS_TOKEN_ID`
   - `MUX_DATA_ACCESS_TOKEN_SECRET`
3. Verify API access before first calculation

### Stripe Setup

1. Identify All Access subscription product/price ID
2. Store in environment: `STRIPE_ALL_ACCESS_SUBSCRIPTION_ID`
3. Ensure invoices are queryable for the period

### Database Indexes

1. `subscription_eligibility(course_id, is_eligible)`
2. `watch_time_metrics(billing_period, course_id)`
3. `earnings(billing_period, instructor_id)` for quick rollup

### Calculation Schedule

1. Run on 1st of month at 00:00 UTC (previous month's data)
2. Allow manual re-run via admin endpoint (for corrections)
3. Implement with job queue (Bull, node-schedule, or Cloud Tasks)

### Data Reconciliation

1. Compare total allocated vs. all-access pool (small variance expected due to rounding)
2. Verify sum of watch-time percentages ≈ 100%
3. Monthly report of allocation vs. actual

---

## Acceptance Criteria

- [ ] Admin can view and manage eligible courses for All Access pool
- [ ] POST /admin/subscription-eligibility/add-course adds course to pool
- [ ] DELETE /admin/subscription-eligibility/remove-course removes course
- [ ] Watch-time data retrieved from Mux Data API or custom tracking
- [ ] Monthly calculation job runs on schedule (1st of month)
- [ ] Calculation aggregates watch-time across all eligible courses
- [ ] Revenue allocated based on watch-time percentage
- [ ] Earnings records created with subscription type and course IDs
- [ ] Revenue split stored: gross_amount, instructor_share, platform_share
- [ ] Watch-time metrics stored in database for audit trail
- [ ] Calculation results queryable via admin API
- [ ] Manual recalculation endpoint available for corrections
- [ ] Total allocated ≈ subscription pool total (within rounding)
- [ ] Watch-time percentages sum to 100% (within rounding)
- [ ] Idempotent: running calculation twice for same period doesn't duplicate earnings
- [ ] Handles courses with no watch-time gracefully
- [ ] Handles zero total watch-time (no allocation)
- [ ] Mux API errors are logged and calculation can be retried
- [ ] Calculation results exportable for reporting

## Dependencies

- **Milestone**: Database Schema (02-database-schema) - earnings, subscription tables
- **Milestone**: Payments Integration (08-payments-and-subscriptions) - Stripe setup
- **External Service**: Mux Data API for watch-time analytics
- **External Service**: Stripe for subscription revenue data
- **Job Queue**: Bull, node-schedule, or Cloud Tasks for monthly job
- **Notification System**: Email notification to instructors of allocation

## Technical Notes

### Watch-Time Aggregation Strategy

1. **Preferred**: Use Mux Data API if available (most reliable)
2. **Fallback**: Query custom watch_events table
3. **Hybrid**: Combine Mux data + custom events (for courses with/without Mux)

### Rounding Behavior

- Watch-time percentages: Round to 2 decimals (e.g., 25.50%)
- Revenue amounts: Round to 2 decimals using banker's rounding
- Ensure sum check: allocations may be $0.01 off due to rounding

### Idempotency

- Check if earnings records already exist for (instructor_id, billing_period, type='subscription')
- If exists: return success without creating duplicates
- Use unique constraint: (instructor_id, billing_period, type)

### Error Handling

- If Mux API fails: log error, skip that course, continue with others
- If Stripe fails: retry with exponential backoff
- If database transaction fails: rollback entire calculation, notify admin

### Monitoring

- Log calculation start/end with timing
- Alert if calculation takes > 30 minutes
- Track number of courses, total watch-time, revenue allocated
- Daily reconciliation: sum(earnings.instructor_share where type='subscription') vs allocated

### Future Enhancements

1. Weighted allocation (e.g., newer courses weighted higher)
2. Quality metrics (only courses with 4+ stars count for pool)
3. Subscriber growth incentives (bonus allocation for growth)
4. Segmented pools (e.g., separate pool for premium courses)
5. Instructor dashboard showing watch-time rank
