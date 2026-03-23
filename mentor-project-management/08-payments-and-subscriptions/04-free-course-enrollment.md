# Task 4: Free Course Enrollment

## Description

Implement free course enrollment functionality. Users can enroll directly in free courses without any payment or checkout process. Free courses are clearly marked in the catalog and provide immediate access. This task ensures clear separation between paid courses (subscription or one-time purchase) and entirely free courses.

## Affected Apps/Packages

- **Backend**: Hono API service (`packages/api`)
- **Database**: `enrollments` table
- **Frontend**: Course catalog filtering and course detail pages

## API Endpoints

### POST /api/v1/courses/:courseId/enroll

Enroll user in a free course without payment.

**Request**:

```
POST /api/v1/courses/course_12345abc/enroll
Headers:
  Content-Type: application/json
  Authorization: Bearer {user_jwt_token}

Body:
{
  "userId": "user_xyz789" (optional, defaults to authenticated user)
}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "enrollmentId": "enrollment_123",
    "courseId": "course_12345abc",
    "courseTitle": "Basic Skincare for Beginners",
    "userId": "user_xyz789",
    "enrolledAt": "2024-02-18T10:30:00Z",
    "accessLevel": "full",
    "isFree": true,
    "progress": {
      "completedLessons": 0,
      "totalLessons": 8,
      "percentComplete": 0
    }
  }
}
```

**Error Response (400 Bad Request - Course Not Free)**:

```json
{
  "success": false,
  "error": {
    "code": "COURSE_NOT_FREE",
    "message": "This course requires payment. Use subscription or one-time purchase."
  }
}
```

**Error Response (400 Bad Request - Already Enrolled)**:

```json
{
  "success": false,
  "error": {
    "code": "ALREADY_ENROLLED",
    "message": "User is already enrolled in this course"
  }
}
```

**Error Response (404 Not Found)**:

```json
{
  "success": false,
  "error": {
    "code": "COURSE_NOT_FOUND",
    "message": "Course does not exist"
  }
}
```

**Error Response (401 Unauthorized)**:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "User not authenticated"
  }
}
```

### GET /api/v1/courses/:courseId/enrollment-status

Check enrollment status for a free course.

**Request**:

```
GET /api/v1/courses/course_12345abc/enrollment-status
Headers:
  Authorization: Bearer {user_jwt_token}
```

**Response (200 OK - Enrolled)**:

```json
{
  "success": true,
  "data": {
    "enrolled": true,
    "enrollmentId": "enrollment_123",
    "enrolledAt": "2024-02-18T10:30:00Z",
    "accessLevel": "full",
    "progress": {
      "completedLessons": 3,
      "totalLessons": 8,
      "percentComplete": 37.5
    }
  }
}
```

**Response (200 OK - Not Enrolled)**:

```json
{
  "success": true,
  "data": {
    "enrolled": false,
    "enrollmentId": null,
    "accessLevel": null
  }
}
```

### GET /api/v1/courses

List courses with free/paid indicators.

**Request**:

```
GET /api/v1/courses?filter=free
Headers:
  Authorization: Bearer {user_jwt_token}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": [
    {
      "id": "course_12345abc",
      "title": "Basic Skincare for Beginners",
      "description": "Learn fundamental skincare techniques",
      "instructor": {
        "id": "instructor_789xyz",
        "name": "Dr. Emma Thompson"
      },
      "isFree": true,
      "pricing": {
        "type": "free",
        "requiresSubscription": false,
        "requiresPurchase": false
      },
      "badge": {
        "label": "FREE",
        "color": "green"
      },
      "enrolled": true,
      "progress": {
        "percentComplete": 37.5
      }
    },
    {
      "id": "course_67890def",
      "title": "Advanced Eye Makeup Techniques",
      "description": "Master professional eye makeup",
      "instructor": {
        "id": "instructor_456uvw",
        "name": "Sarah Williams"
      },
      "isFree": false,
      "pricing": {
        "type": "both", // Can be purchased or accessed via subscription
        "priceOneTime": 29.99,
        "currency": "EUR",
        "requiresSubscription": false,
        "requiresPurchase": false
      },
      "badge": {
        "label": "PREMIUM",
        "color": "blue"
      },
      "enrolled": false
    },
    {
      "id": "course_11111ghi",
      "title": "Color Theory for Makeup Artists",
      "description": "Understanding color harmony",
      "instructor": {
        "id": "instructor_222jkl",
        "name": "Michael Chen"
      },
      "isFree": false,
      "pricing": {
        "type": "subscription_only",
        "requiresSubscription": true,
        "requiresPurchase": false
      },
      "badge": {
        "label": "MEMBERS ONLY",
        "color": "purple"
      },
      "enrolled": false
    }
  ]
}
```

## Requirements

### Free Course Designation

1. **Course Model**:
   - Add `is_free` boolean field to courses table (default: false)
   - Add `pricing_type` enum to courses table:
     - `free`: Free course, no payment required
     - `one_time_purchase`: Can be purchased individually
     - `subscription_only`: Only accessible via active subscription
     - `both`: Accessible via subscription OR one-time purchase

2. **Catalog Display**:
   - Free courses clearly marked with "FREE" badge (green color)
   - Premium subscription-only courses marked with "MEMBERS ONLY" badge (purple)
   - Both payment methods available marked with "PREMIUM" badge (blue)
   - Badge color and text configurable via admin panel (milestone 11)

3. **Course Filtering**:
   - API supports `?filter=free` to show only free courses
   - API supports `?filter=paid` to show only paid courses
   - API supports `?filter=subscription` to show subscription-only courses
   - Default view shows all courses with appropriate indicators

### Enrollment Logic

1. **Enrollment Creation**:
   - Verify course exists in database
   - Verify course is marked as `is_free = true`
   - Verify user not already enrolled in this course
   - Create enrollment record with:
     - User ID
     - Course ID
     - Enrollment timestamp
     - Access level: "full" (free courses grant full access)
   - Grant immediate access to all course materials
   - Return enrollment details with enrollment ID

2. **Duplicate Prevention**:
   - Check if user already has active enrollment in course
   - If exists, return 400 with `ALREADY_ENROLLED` error (not idempotent like purchases)
   - Alternatively, could be idempotent (return existing enrollment on duplicate)
   - Choose approach and document clearly

3. **Access Control**:
   - User can only enroll in courses marked as free
   - Non-free courses return 400 `COURSE_NOT_FREE` error
   - Attempting to enroll in subscription-only or one-time purchase course returns error
   - Error message directs user to appropriate payment method

### Enrollment Status Tracking

1. **Enrollment Status Endpoint**:
   - Return enrollment status including:
     - Whether user is enrolled
     - Enrollment ID (if enrolled)
     - Enrollment date (if enrolled)
     - Access level
     - Progress tracking (lessons completed, percentage)

2. **Progress Tracking**:
   - Track completed lessons per user/course (implementation in milestone 7)
   - Calculate percentage complete based on lesson count
   - Include progress in enrollment status response

### Course Access Determination

1. **Access Logic for Course**:
   Implement centralized function to determine user access:

   ```typescript
   function userCanAccessCourse(user, course) {
     // User has free enrollment
     if (course.is_free && user.enrolledInCourse(course.id)) {
       return true;
     }

     // User has active subscription
     if (
       user.hasActiveSubscription &&
       course.pricing_type !== "one_time_purchase_only"
     ) {
       return true;
     }

     // User has one-time purchase
     if (user.purchasedCourses.includes(course.id)) {
       return true;
     }

     return false;
   }
   ```

2. **Catalog Display Logic**:
   - Show "Enroll Free" button for free courses (if not enrolled)
   - Show "Enrolled" button for free courses (if enrolled, non-clickable)
   - Show "Subscribe" or "Purchase" button for paid courses
   - Show "Access Course" button if user has subscription or purchase

### Database Schema

```sql
CREATE TABLE enrollments (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  enrollment_type VARCHAR(50) NOT NULL DEFAULT 'free', -- 'free', 'subscription', 'purchase'
  access_level VARCHAR(50) NOT NULL DEFAULT 'full', -- 'full', 'preview', 'none'
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  progress_percent INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, course_id)
);

ALTER TABLE courses ADD COLUMN is_free BOOLEAN DEFAULT FALSE;
ALTER TABLE courses ADD COLUMN pricing_type VARCHAR(50) DEFAULT 'subscription_only';
-- pricing_type values: 'free', 'one_time_purchase', 'subscription_only', 'both'

CREATE INDEX idx_enrollments_user_course ON enrollments(user_id, course_id);
CREATE INDEX idx_courses_is_free ON courses(is_free);
CREATE INDEX idx_courses_pricing_type ON courses(pricing_type);
```

### Error Handling

1. **Validation Errors**:
   - Course not found: Return 404 `COURSE_NOT_FOUND`
   - Course not free: Return 400 `COURSE_NOT_FREE`
   - Already enrolled: Return 400 `ALREADY_ENROLLED`

2. **Authentication Errors**:
   - User not authenticated: Return 401 `UNAUTHORIZED`

3. **Database Errors**:
   - Database connection failure: Return 500 with `DATABASE_ERROR`

### Course Catalog Integration

1. **Course List Response**:
   - Include `isFree` boolean field
   - Include `pricing` object with:
     - `type`: 'free', 'one_time_purchase', 'subscription_only', or 'both'
     - `priceOneTime`: Price if one-time purchase available (null if not)
     - `currency`: Always 'EUR'
   - Include `badge` object with:
     - `label`: 'FREE', 'PREMIUM', or 'MEMBERS ONLY'
     - `color`: Color code for display

2. **Filtering**:
   - Support `?filter=free` query parameter
   - Support `?filter=paid` query parameter
   - Support `?filter=subscription` query parameter

3. **User Enrollment Status**:
   - For each course in list, include `enrolled` boolean
   - For enrolled courses, include progress percentage
   - Allow users to see which free courses they're already enrolled in

### Mobile App Considerations

1. **Deep Link Support**:
   - Support deep link for free course enrollment: `mentor://enroll?courseId=course_123`
   - Mobile app calls backend API to enroll
   - Handle enrollment errors gracefully

2. **Offline Access** (future enhancement):
   - Consider offline access to free courses (milestone 14)
   - Sync enrollment status when online

## Acceptance Criteria

- [ ] POST /api/v1/courses/:courseId/enroll endpoint implemented
- [ ] Course validation ensures course is marked as free
- [ ] Duplicate enrollment detection prevents multiple enrollments
- [ ] Enrollment record created in database with all required fields
- [ ] User receives enrollment ID and enrollment timestamp
- [ ] Immediate access granted upon successful enrollment
- [ ] GET /api/v1/courses/:courseId/enrollment-status endpoint returns correct status
- [ ] Enrollment status includes progress tracking (lessons completed, percentage)
- [ ] GET /api/v1/courses supports filter=free query parameter
- [ ] Courses filtered correctly by pricing type (free, paid, subscription-only)
- [ ] Free courses marked with "FREE" badge in catalog
- [ ] Premium/subscription courses marked with appropriate badges
- [ ] isFree boolean field included in course list response
- [ ] pricing object included with type and requiresSubscription/requiresPurchase flags
- [ ] badge object included with label and color
- [ ] enrolled boolean shows enrollment status in course list
- [ ] progress included in enrolled courses (percent complete)
- [ ] Course access logic correctly determines user access based on:
  - Free enrollment
  - Active subscription
  - One-time purchase
- [ ] Non-free courses return COURSE_NOT_FREE error when user attempts to enroll
- [ ] Database schema updated with enrollments table and course pricing fields
- [ ] Unique constraint prevents duplicate enrollments
- [ ] Error handling covers all failure scenarios with appropriate HTTP codes
- [ ] JWT authentication required for enrollment endpoints
- [ ] Unauthenticated users can view courses but cannot enroll
- [ ] Course list includes all pricing and badge information
- [ ] Mobile deep link support for course enrollment
- [ ] Unit tests cover enrollment creation, duplicate detection, enrollment status
- [ ] Integration tests verify free course enrollment flow
- [ ] API documentation includes enrollment examples and error codes

## Dependencies

- Milestone 2: Database schema for courses and users
- Milestone 4: User authentication (JWT validation)
- Milestone 5: Course management (course data)
- Task 1: Stripe Billing Setup (for context on pricing types)

## Technical Notes

### Distinction Between Pricing Types

| Type                | Description                   | Access Method                     | Cost                     |
| ------------------- | ----------------------------- | --------------------------------- | ------------------------ |
| `free`              | No payment required           | Direct enrollment                 | Free                     |
| `one_time_purchase` | Can be purchased individually | Stripe Checkout (task 3)          | One-time fee             |
| `subscription_only` | Only via subscription         | Active subscription required      | Monthly/Annual           |
| `both`              | Both purchase options         | Subscription OR one-time purchase | Subscription or one-time |

### Enrollment Type vs Pricing Type

- `pricing_type` (on courses): Determines how course can be accessed
- `enrollment_type` (on enrollments): Tracks HOW user accessed the course
  - `free`: Enrolled directly (free course)
  - `subscription`: Access via active subscription
  - `purchase`: Access via one-time purchase

### No Freemium Model

Per requirements, there is NO freemium model:

- Free courses are entirely free (100% access)
- Paid courses are entirely paid (no free preview or preview-then-pay)
- Clear binary distinction between free and paid

### Course Availability in Different Contexts

| Course Type       | Free Enrollment | Subscription | One-Time Purchase |
| ----------------- | --------------- | ------------ | ----------------- |
| Free              | YES             | N/A          | N/A               |
| Subscription Only | NO              | YES          | NO                |
| One-Time Purchase | NO              | NO           | YES               |
| Both              | NO              | YES          | YES               |

### Idempotency Decision

Current implementation treats enrollment as non-idempotent:

- User can only enroll once
- Second enrollment attempt returns 400 ALREADY_ENROLLED
- Alternative: Could return existing enrollment (idempotent)
- Choose based on product requirements

### No Payment Processing for Free Courses

- No Stripe involvement for free courses
- No checkout session created
- No payment intent created
- Direct database write only
- Simpler, faster enrollment experience

### Analytics Integration

1. Track free course enrollments separately from paid enrollments
2. Monitor conversion: free → subscription
3. Measure engagement: free courses → paid courses
4. Identify popular free courses (potential paid course inspiration)

### Future Enhancements

1. **Free Trial for Paid Courses**: Offer limited-time preview of premium courses
2. **Freemium Model** (if product decision changes): Some courses partially free, more features with payment
3. **Free Course Bundles**: Group free courses into learning paths
4. **Certificate of Completion**: Generate free certificates for free courses
5. **Social Sharing**: Allow users to share free course completion

### Performance Optimization

1. Index on `is_free` for quick free course filtering
2. Index on `pricing_type` for filtering by type
3. Cache course pricing information (refreshed when course updated)
4. Use materialized view for frequently accessed course lists with enrollment status

### Monitoring and Alerts

1. Track free course enrollment rate
2. Monitor for unusual enrollment patterns (spam detection)
3. Alert on free course enrollment failures
4. Track percentage of users engaging with free courses
5. Measure free → paid conversion metrics
