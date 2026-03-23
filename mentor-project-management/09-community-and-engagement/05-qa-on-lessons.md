# Task 5: Q&A System on Lessons

## Description

Implement a Q&A system where learners can ask questions linked to specific lessons. Questions are displayed chronologically on the lesson page, instructors receive push notifications when new questions are asked, and they can provide answers/replies. Implement single-level comments only (no nested replies and no @mentions). Mark answers as helpful/resolved. Provide API endpoints, database schema, and UI components for web and mobile.

## Affected Apps/Packages

- `apps/api` - Hono.js backend API
- `packages/db` - Prisma schema for Q&A
- `packages/ui` - React components for web Q&A UI
- `packages/ui-mobile` - React Native Q&A components
- `packages/api-client` - TypeScript API client hooks
- `apps/web-learner` - Learner web app
- `apps/web-mentor` - Instructor web app
- `apps/mobile` - React Native mobile app

## API Endpoints

### GET /api/lessons/:lessonId/qa

**Description:** Retrieve Q&A for a specific lesson with pagination

**Query Parameters:**

- `page` (number, optional, default: 1) - Page number
- `limit` (number, optional, default: 20, max: 50) - Items per page
- `sortBy` (enum: "recent", "oldest", "unanswered", "helpful", optional, default: "recent")
- `filterStatus` (enum: "all", "unanswered", "answered", "resolved", optional, default: "all")

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": "qa_123",
      "lessonId": "lesson_456",
      "courseId": "course_789",
      "question": "How do I apply this technique to mature skin?",
      "asker": {
        "id": "user_100",
        "username": "beauty_learner",
        "avatarUrl": "https://cdn.example.com/avatar.jpg"
      },
      "status": "answered",
      "isResolved": false,
      "isHelpful": 0,
      "userFeedback": null, // "helpful", "not_helpful", null
      "views": 125,
      "answers": [
        {
          "id": "answer_200",
          "qandaId": "qa_123",
          "content": "For mature skin, I recommend using a hydrating primer first...",
          "answerer": {
            "id": "mentor_300",
            "username": "makeup_expert",
            "avatarUrl": "https://cdn.example.com/mentor.jpg",
            "isMentor": true
          },
          "isInstructorAnswer": true,
          "isResolved": true,
          "helpfulCount": 23,
          "notHelpfulCount": 2,
          "createdAt": "2024-02-18T12:00:00Z",
          "updatedAt": "2024-02-18T12:00:00Z"
        }
      ],
      "createdAt": "2024-02-18T10:30:00Z",
      "updatedAt": "2024-02-18T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 47,
    "hasMore": true
  }
}
```

**Notes:**

- Return only answer from instructor if multiple answers exist
- If multiple learner answers, return most helpful one
- Include view count for ranking/analytics
- userFeedback shows current user's feedback (helpful/not helpful)

### POST /api/lessons/:lessonId/qa

**Description:** Create a new Q&A question on a lesson

**Request Body:**

```json
{
  "question": "How do I apply this technique to mature skin?"
}
```

**Response (201 Created):**

```json
{
  "id": "qa_123",
  "lessonId": "lesson_456",
  "courseId": "course_789",
  "question": "How do I apply this technique to mature skin?",
  "asker": {
    "id": "user_100",
    "username": "beauty_learner",
    "avatarUrl": "https://cdn.example.com/avatar.jpg"
  },
  "status": "unanswered",
  "isResolved": false,
  "isHelpful": 0,
  "views": 0,
  "answers": [],
  "createdAt": "2024-02-18T10:30:00Z"
}
```

**Validation Rules:**

- Question must be 10-1000 characters
- Must be related to the lesson (enforced on client, optional server validation)
- User must be authenticated
- User must be enrolled in course containing lesson

**Notifications:**

- Push notification to course instructor: "New question on lesson [name]"
- In-app notification in instructor's notification inbox
- Email notification (if instructor has enabled Q&A notifications)

### POST /api/qa/:qaId/answers

**Description:** Post an answer to a question

**Request Body:**

```json
{
  "content": "For mature skin, I recommend using a hydrating primer first..."
}
```

**Response (201 Created):**

```json
{
  "id": "answer_200",
  "qandaId": "qa_123",
  "content": "For mature skin, I recommend using a hydrating primer first...",
  "answerer": {
    "id": "mentor_300",
    "username": "makeup_expert",
    "isMentor": true
  },
  "isInstructorAnswer": true,
  "isResolved": false,
  "helpfulCount": 0,
  "notHelpfulCount": 0,
  "createdAt": "2024-02-18T12:00:00Z"
}
```

**Validation Rules:**

- Content must be 10-2000 characters
- User must be authenticated
- Only instructor (course creator) can provide instructor answers
- Learners can also provide answers (peer-to-peer)

**Notifications:**

- Push notification to question asker: "Someone answered your question"
- In-app notification
- Optional email notification

### PUT /api/qa/:qaId/answers/:answerId

**Description:** Update an answer

**Request Body:**

```json
{
  "content": "Updated answer content..."
}
```

**Response (200 OK):**
Same answer object with updated content and updatedAt timestamp

**Access Control:**

- Only answer author (instructor) can update
- Cannot update content that changes meaning significantly

### DELETE /api/qa/:qaId/answers/:answerId

**Description:** Delete an answer (soft delete)

**Response (204 No Content):**

**Access Control:**

- Only answer author (instructor) can delete
- Instructor can delete any answer on their lesson
- Use soft delete

### POST /api/qa/:qaId/resolve

**Description:** Mark question as resolved (instructor marks answer as solution)

**Request Body:**

```json
{
  "answerId": "answer_200"
}
```

**Response (200 OK):**

```json
{
  "id": "qa_123",
  "isResolved": true,
  "resolvedAnswerId": "answer_200",
  "resolvedAt": "2024-02-18T12:00:00Z"
}
```

**Access Control:**

- Only instructor can mark as resolved
- Can only mark one answer as resolved per question
- Can unmark by passing null answerId

### POST /api/qa/:qaId/answers/:answerId/helpful

**Description:** Mark answer as helpful

**Request Body:**

```json
{
  "isHelpful": true // or false for "not helpful"
}
```

**Response (200 OK):**

```json
{
  "id": "answer_200",
  "helpfulCount": 24,
  "notHelpfulCount": 2,
  "userFeedback": "helpful"
}
```

**Access Control:**

- Only authenticated users can provide feedback
- Each user can provide feedback once per answer
- Can change feedback (helpful → not helpful or vice versa)

### PUT /api/qa/:qaId

**Description:** Update question (learner only)

**Request Body:**

```json
{
  "question": "Updated question text..."
}
```

**Access Control:**

- Only question author can update
- Cannot change core meaning (recommend delete + create new instead)

### DELETE /api/qa/:qaId

**Description:** Delete question (soft delete)

**Response (204 No Content):**

**Access Control:**

- Question author can delete their own question
- Instructor can delete questions on their lesson
- Admin can delete any question

## Database Schema (Prisma)

```prisma
model QandA {
  id String @id @default(cuid())

  lessonId String
  lesson Lesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  courseId String
  course Course @relation("CourseQA", fields: [courseId], references: [id], onDelete: Cascade)

  question String @db.Text

  askerId String
  asker User @relation("QAAsker", fields: [askerId], references: [id], onDelete: Cascade)

  // Q&A state
  status String @default("unanswered") // "unanswered", "answered", "resolved"
  isResolved Boolean @default(false)
  resolvedAnswerId String?

  // Answers
  answers QandAAnswer[]

  // Stats
  viewCount Int @default(0)
  helpfulCount Int @default(0)

  // Moderation
  deletedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([lessonId])
  @@index([courseId])
  @@index([askerId])
  @@index([status])
  @@index([isResolved])
  @@index([createdAt])
}

model QandAAnswer {
  id String @id @default(cuid())

  qandaId String
  qanda QandA @relation(fields: [qandaId], references: [id], onDelete: Cascade)

  content String @db.Text

  answererId String
  answerer User @relation("QAAnswer", fields: [answererId], references: [id], onDelete: Cascade)

  // Instructor answer marker
  isInstructorAnswer Boolean @default(false)

  // Resolution marker
  isResolved Boolean @default(false)

  // Feedback
  helpfulFeedback QandAAnswerFeedback[]
  helpfulCount Int @default(0)
  notHelpfulCount Int @default(0)

  // Moderation
  deletedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([qandaId])
  @@index([answererId])
  @@index([isInstructorAnswer])
  @@index([isResolved])
  @@index([createdAt])
}

model QandAAnswerFeedback {
  id String @id @default(cuid())

  answerId String
  answer QandAAnswer @relation(fields: [answerId], references: [id], onDelete: Cascade)

  userId String
  user User @relation("QAAnswerFeedback", fields: [userId], references: [id], onDelete: Cascade)

  isHelpful Boolean // true = helpful, false = not helpful

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([answerId, userId])
  @@index([answerId])
  @@index([userId])
}

// Add to Lesson model
extend model Lesson {
  qaCount Int @default(0) // Denormalized for perf
  unansweredQACount Int @default(0)
}
```

## UI Components

### Web Components

#### 1. QandASection Component

**Location:** `packages/ui/src/components/QandASection.tsx`

**Props:**

```typescript
interface QandASectionProps {
  lessonId: string;
  courseId: string;
  isInstructor: boolean;
  canAsk: boolean;
}
```

**Features:**

- Display Q&A list for lesson
- Filters (All, Unanswered, Answered, Resolved)
- Sort options (Recent, Oldest, Most Helpful, Unanswered)
- Pagination or infinite scroll
- Ask a question form
- Q&A cards

#### 2. QandACard Component

**Location:** `packages/ui/src/components/QandACard.tsx`

**Layout:**

```
┌─────────────────────────────────────┐
│ [Avatar] Asker Name | Timestamp     │
│ [Resolved badge if resolved]        │
│ Question text...                    │
│                                     │
│ [👁 123 views] [❤️ Helpful] [Sad]   │
├─────────────────────────────────────┤
│ [✓ Answer from instructor]          │
│ [Avatar] Instructor Name            │
│ Answer text...                      │
│ [❤️ 23 helpful] [Not helpful: 2]    │
│ [Mark as helpful] [Not helpful]     │
│ [Edit] [Delete] (instructor only)   │
└─────────────────────────────────────┘
```

**Features:**

- Show question with timestamp
- Display instructor answer if exists
- Show helpful/not helpful counts
- Allow marking as helpful (learner only)
- Edit/Delete buttons (instructor only)
- View count
- Resolved badge
- Expand/collapse for long content

#### 3. AskQuestionForm Component

**Location:** `packages/ui/src/components/AskQuestionForm.tsx`

**Props:**

```typescript
interface AskQuestionFormProps {
  lessonId: string;
  courseId: string;
  onQuestionSubmitted?: (qa: QandA) => void;
  onClose?: () => void;
}
```

**Features:**

- Text area for question (max 1000 chars)
- Character counter
- Submit button
- Cancel button
- Validation hints (min 10 chars)
- Keyboard shortcuts (Cmd/Ctrl+Enter)

#### 4. AnswerForm Component

**Location:** `packages/ui/src/components/AnswerForm.tsx`

**Props:**

```typescript
interface AnswerFormProps {
  qaId: string;
  onAnswerSubmitted?: (answer: QandAAnswer) => void;
  isLoading?: boolean;
  placeholder?: string;
}
```

**Features:**

- Rich text input (optional: support basic formatting)
- Max 2000 characters
- Submit/Cancel buttons
- Loading state

### Mobile Components

#### 1. QandAListScreen Component

**Location:** `apps/mobile/src/screens/QandAListScreen.tsx`

**Features:**

- FlatList for Q&A
- Pull-to-refresh
- Load more pagination
- Filter picker (dropdown or modal)
- Sort picker
- Ask question button
- Empty state

#### 2. QandACardMobile Component

**Location:** `packages/ui-mobile/src/components/QandACardMobile.tsx`

**Features:**

- Vertical layout (touch-friendly)
- Tap to expand/collapse
- Helpful feedback buttons
- Long-press menu for more actions

#### 3. AskQuestionSheetMobile Component

**Location:** `packages/ui-mobile/src/components/AskQuestionSheetMobile.tsx`

**Features:**

- Bottom sheet modal
- Text input with counter
- Submit button with loading
- Keyboard handling

## Placement

### Learner Web

- Show Q&A section below video player on lesson detail page
- Show 3-5 Q&A items with "View all Q&A" link
- Or show in dedicated tab

### Mentor Web

- Dashboard showing recent questions
- Questions list on lesson management page
- Notification bell for new questions

### Mobile

- Tab in lesson detail screen or expandable section
- Q&A questions list with infinite scroll
- Tap to expand and view/post answer

## Routing

### Web

```
/lessons/:lessonId
  └── (Q&A shown on same page)

/courses/:courseId/lessons/:lessonId/qa
  └── (optional dedicated Q&A page)
```

### Mobile

```
/lesson/:lessonId
  └── Q&A tab or expandable section
```

## Requirements

### Real-Time Updates

- Show new answers immediately when posted
- Update answer helpful counts in real-time (optional)
- Use polling or WebSocket for updates

### Notifications

```typescript
// On new question
await sendPushNotification(instructorId, {
  title: "New Question",
  body: `"${question}" on ${lessonName}`,
  data: { lessonId, qaId },
  deepLink: `/lessons/${lessonId}/qa/${qaId}`,
});

// On new answer
await sendPushNotification(askerUserId, {
  title: "Answer to Your Question",
  body: `${answererName} answered your question`,
  data: { qaId },
  deepLink: `/lessons/${lessonId}/qa/${qaId}`,
});
```

### View Counting

- Increment viewCount when question loaded (once per session per user)
- Track with user ID to prevent multiple counts

### Search (Optional Enhancement)

- Search questions by keywords
- Filter by asker
- Endpoint: GET /api/lessons/:lessonId/qa/search?q=keyword

### Analytics

- Track unanswered question rates
- Track helpful answer ratios
- Monitor Q&A activity per lesson

## Acceptance Criteria

- [ ] GET /api/lessons/:lessonId/qa returns paginated Q&A
- [ ] POST /api/lessons/:lessonId/qa creates new question
- [ ] Question requires 10-1000 characters validation
- [ ] Instructor receives push notification on new question
- [ ] POST /api/qa/:qaId/answers creates answer
- [ ] Only instructor can mark as instructor answer
- [ ] PUT /api/qa/:qaId/resolve marks question as resolved
- [ ] Only one answer can be marked as resolved per question
- [ ] POST /api/qa/:qaId/answers/:answerId/helpful marks helpful
- [ ] Users can change helpful feedback (helpful ↔ not helpful)
- [ ] Q&A section displays on lesson detail page
- [ ] Q&A cards show question, instructor answer, helpful count
- [ ] Ask question form validates max 1000 characters
- [ ] Resolved badge appears on resolved questions
- [ ] Instructor answer highlighted/distinguished from learner answers
- [ ] Helpful count updates in real-time (or on refresh)
- [ ] Filter by status (answered, unanswered, resolved) works
- [ ] Sort options (recent, helpful, unanswered) work
- [ ] Mobile Q&A sheet opens and closes smoothly
- [ ] Edit/Delete buttons show only to authorized users
- [ ] Question asker and instructor notified of activity

## Dependencies

- `apps/api` - Hono.js API
- `packages/db` - Prisma ORM
- `packages/ui` - React components
- `packages/ui-mobile` - React Native components
- `packages/api-client` - API hooks
- Firebase Cloud Messaging - Notifications
- `@tanstack/react-query` - Server state

## Technical Notes

### Query Optimization

```typescript
// Efficient query to get Q&A with best answer
const qa = await db.qandA.findUnique({
  where: { id: qaId },
  include: {
    asker: { select: { id: true, username: true, avatarUrl: true } },
    answers: {
      where: { deletedAt: null },
      orderBy: [
        { isInstructorAnswer: "desc" }, // Instructor answer first
        { helpfulCount: "desc" }, // Then by helpful count
      ],
      take: 1, // Get best answer
      include: {
        answerer: { select: { id: true, username: true, avatarUrl: true } },
        helpfulFeedback: {
          where: { userId: currentUserId },
          select: { isHelpful: true },
        },
      },
    },
  },
});
```

### Denormalization for Performance

```typescript
// Keep lesson.qaCount and lesson.unansweredQACount in sync
// Update on new question, delete, resolve, etc.
// Allows fast sorting/filtering without full scan
```

### Preventing Duplicate Feedback

```prisma
@@unique([answerId, userId])
```

### Single-Level Comments

- No parentAnswerId in schema
- All answers are direct replies to the question
- Enforced at API level (reject if client sends parentAnswerId)

### Hidden Content Handling

- Soft delete (deletedAt field) for audit trail
- Filter out deleted content in queries
- Don't show "deleted" message, just exclude from results

### Rate Limiting

- Ask question: 5 per day per user
- Post answer: 20 per day per instructor
- Mark helpful: 100 per minute per user

### Monitoring

- Track Q&A velocity per course
- Alert on low answer rate
- Monitor abuse patterns (spam questions)
