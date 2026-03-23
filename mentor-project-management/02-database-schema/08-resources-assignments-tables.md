# Task 8: Resources and Assignments Tables

## Description

Create tables for course resources (downloadable files, external links) and lesson assignments (multiple choice questions, quizzes). Resources enhance lessons with supplementary materials; assignments enable knowledge verification and user engagement with interactive content.

## Affected Apps/Packages

- `packages/db` (schema definition)
- `apps/api` (resource and assignment endpoints)
- `apps/web-learner` (resource downloads, assignment completion)
- `apps/web-mentor` (resource and assignment management)

## Requirements

### Resources Table

Create table `resources` for lesson-attached files and links:

| Column            | Type           | Constraints                | Description                                      |
| ----------------- | -------------- | -------------------------- | ------------------------------------------------ |
| `id`              | `UUID`         | PK, Default: `uuid_v7()`   | Unique resource identifier                       |
| `lesson_id`       | `UUID`         | FK → lessons(id), NOT NULL | Associated lesson                                |
| `title`           | `VARCHAR(255)` | NOT NULL                   | Resource title/name                              |
| `description`     | `TEXT`         | NULL                       | Resource description                             |
| `file_type`       | `VARCHAR(50)`  | NOT NULL                   | Enum: pdf, doc, docx, zip, mp3, mp4, link, image |
| `file_url`        | `TEXT`         | NULL                       | R2 URL to hosted file (if file_type != 'link')   |
| `external_url`    | `TEXT`         | NULL                       | External URL (if file_type == 'link')            |
| `file_size_bytes` | `INTEGER`      | NULL                       | Size of file (for display/limits)                |
| `download_count`  | `INTEGER`      | DEFAULT: 0                 | Number of downloads (denormalized)               |
| `sort_order`      | `INTEGER`      | NOT NULL, DEFAULT: 0       | Display order within lesson                      |
| `created_at`      | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()` | Resource creation timestamp                      |
| `updated_at`      | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()` | Last update timestamp                            |

### Indexes for Resources Table

- Primary Key: `id`
- Index: `(lesson_id)` - find lesson resources
- Index: `(lesson_id, sort_order)` - ordered resources
- Index: `(file_type)` - filter by resource type

### Assignments Table

Create table `assignments`:

| Column               | Type           | Constraints                | Description                                         |
| -------------------- | -------------- | -------------------------- | --------------------------------------------------- |
| `id`                 | `UUID`         | PK, Default: `uuid_v7()`   | Unique assignment identifier                        |
| `lesson_id`          | `UUID`         | FK → lessons(id), NULL     | Associated lesson (nullable for course assignments) |
| `course_id`          | `UUID`         | FK → courses(id), NULL     | Associated course (for course-level assignments)    |
| `title`              | `VARCHAR(255)` | NOT NULL                   | Assignment title                                    |
| `description`        | `TEXT`         | NULL                       | Assignment instructions/description                 |
| `type`               | `VARCHAR(50)`  | NOT NULL, DEFAULT: 'mcq'   | Enum: mcq (multiple choice)                         |
| `passing_percentage` | `INTEGER`      | DEFAULT: 70                | Percentage required to pass (0-100)                 |
| `is_required`        | `BOOLEAN`      | DEFAULT: TRUE              | Must be completed to progress                       |
| `is_graded`          | `BOOLEAN`      | DEFAULT: TRUE              | Instructor grades vs. auto-graded                   |
| `max_attempts`       | `INTEGER`      | DEFAULT: 3                 | Maximum attempt count (0 = unlimited)               |
| `show_answers`       | `BOOLEAN`      | DEFAULT: TRUE              | Show correct answers after completion               |
| `show_score`         | `BOOLEAN`      | DEFAULT: TRUE              | Display score to learner                            |
| `sort_order`         | `INTEGER`      | NOT NULL, DEFAULT: 0       | Display order                                       |
| `created_at`         | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()` | Assignment creation timestamp                       |
| `updated_at`         | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()` | Last update timestamp                               |

### Constraints for Assignments

- Check: Either lesson_id OR course_id must be NOT NULL
- Check: passing_percentage between 0 and 100

### Indexes for Assignments Table

- Primary Key: `id`
- Index: `(lesson_id)` - find lesson assignments
- Index: `(course_id)` - find course assignments
- Index: `(is_required)` - find required assignments

### Assignment Questions Table

Create table `assignment_questions`:

| Column            | Type           | Constraints                    | Description                                    |
| ----------------- | -------------- | ------------------------------ | ---------------------------------------------- |
| `id`              | `UUID`         | PK, Default: `uuid_v7()`       | Unique question identifier                     |
| `assignment_id`   | `UUID`         | FK → assignments(id), NOT NULL | Parent assignment                              |
| `question_text`   | `TEXT`         | NOT NULL                       | The question content                           |
| `question_type`   | `VARCHAR(50)`  | DEFAULT: 'mcq'                 | Enum: mcq (single choice), multiple_select     |
| `options`         | `JSONB`        | NOT NULL                       | Question options (array of objects)            |
| `correct_answer`  | `VARCHAR(255)` | NULL                           | Index/key of correct answer (for auto-grading) |
| `correct_answers` | `TEXT[]`       | NULL                           | Array of correct answers (for multiple select) |
| `explanation`     | `TEXT`         | NULL                           | Explanation shown after answering              |
| `media_url`       | `TEXT`         | NULL                           | Optional image/media for question              |
| `points`          | `INTEGER`      | DEFAULT: 1                     | Points awarded for correct answer              |
| `sort_order`      | `INTEGER`      | NOT NULL, DEFAULT: 0           | Display order within assignment                |
| `created_at`      | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()`     | Question creation timestamp                    |
| `updated_at`      | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()`     | Last update timestamp                          |

### Options JSON Structure

Example for multiple choice question:

```json
[
  {
    "id": "a",
    "text": "Option A - this is the first option",
    "order": 1
  },
  {
    "id": "b",
    "text": "Option B - this is the second option",
    "order": 2
  },
  {
    "id": "c",
    "text": "Option C - this is the third option",
    "order": 3
  },
  {
    "id": "d",
    "text": "Option D - this is the fourth option",
    "order": 4
  }
]
```

### Indexes for Assignment Questions Table

- Primary Key: `id`
- Index: `(assignment_id)` - find assignment questions
- Index: `(assignment_id, sort_order)` - ordered questions

### Learner Assignment Submissions Table

Create table `learner_assignment_submissions`:

| Column            | Type           | Constraints                    | Description                            |
| ----------------- | -------------- | ------------------------------ | -------------------------------------- |
| `id`              | `UUID`         | PK, Default: `uuid_v7()`       | Unique submission identifier           |
| `assignment_id`   | `UUID`         | FK → assignments(id), NOT NULL | Assignment being submitted             |
| `user_id`         | `UUID`         | FK → users(id), NOT NULL       | Learner submitting                     |
| `attempt_number`  | `INTEGER`      | NOT NULL, DEFAULT: 1           | Which attempt (1, 2, 3, etc.)          |
| `submission_data` | `JSONB`        | NOT NULL                       | User's answers (question_id → answer)  |
| `score`           | `INTEGER`      | NULL                           | Points earned (null if not graded)     |
| `percentage`      | `DECIMAL(5,2)` | NULL                           | Score as percentage (null if pending)  |
| `is_passed`       | `BOOLEAN`      | NULL                           | Whether score meets passing_percentage |
| `feedback`        | `TEXT`         | NULL                           | Instructor feedback on submission      |
| `graded_by`       | `UUID`         | FK → users(id), NULL           | Instructor who graded                  |
| `submitted_at`    | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()`     | When submitted                         |
| `graded_at`       | `TIMESTAMP`    | NULL                           | When graded (if applicable)            |

### Unique Constraint for Submissions

- Composite unique index: `(assignment_id, user_id, attempt_number)` - one submission per attempt

### Indexes for Learner Assignment Submissions Table

- Primary Key: `id`
- Index: `(assignment_id)` - find assignment submissions
- Index: `(user_id)` - find learner submissions
- Index: `(assignment_id, user_id)` - find learner's submission for assignment
- Index: `(submitted_at)` - pagination by submission time
- Index: `(is_passed)` - find passed/failed submissions

### Submission Data JSON Structure

Example for user's answers:

```json
{
  "question_id_1": "a",
  "question_id_2": "b",
  "question_id_3": ["a", "c"],
  "question_id_4": "d"
}
```

### Enums Definition

Create PostgreSQL ENUM types:

```sql
CREATE TYPE resource_file_type AS ENUM ('pdf', 'doc', 'docx', 'zip', 'mp3', 'mp4', 'link', 'image');
CREATE TYPE assignment_type AS ENUM ('mcq');
CREATE TYPE question_type AS ENUM ('mcq', 'multiple_select');
```

### Drizzle Schema Definition

In `packages/db/src/schema/resources.ts`:

- Define `resources` table
- Define `assignments` table
- Define `assignmentQuestions` table
- Define `learnerAssignmentSubmissions` table
- Use `relations()` for:
  - lessons ↔ resources (one-to-many)
  - assignments ↔ assignmentQuestions (one-to-many)
  - assignments ↔ learnerAssignmentSubmissions (one-to-many)
  - users ↔ learnerAssignmentSubmissions (one-to-many)

## Database Tables

### resources

- **Purpose**: Supplementary downloadable files and external links
- **Row estimate**: ~500K-2M (avg 5-10 per lesson)
- **Key relationships**: N:1 with lessons

### assignments

- **Purpose**: Quizzes and knowledge checks
- **Row estimate**: ~50K-500K (varies by course count)
- **Key relationships**: N:1 with lessons/courses, 1:N with assignmentQuestions, 1:N with submissions

### assignment_questions

- **Purpose**: Individual quiz questions
- **Row estimate**: ~500K-5M (avg 10 questions per assignment)
- **Key relationships**: N:1 with assignments

### learner_assignment_submissions

- **Purpose**: Track learner quiz attempts and grades
- **Row estimate**: ~5M-50M (varies by engagement)
- **Key relationships**: N:1 with assignments, N:1 with users

## Acceptance Criteria

- [ ] `resources` table created with file_type enum
- [ ] Resources support both file uploads (R2) and external links
- [ ] `assignments` table created with type enum
- [ ] Check constraint enforces lesson_id OR course_id NOT NULL
- [ ] `assignment_questions` table created with options JSONB
- [ ] Options JSONB stores array of objects with id and text
- [ ] `correct_answer` and `correct_answers` fields support different question types
- [ ] `learner_assignment_submissions` table tracks attempts and scoring
- [ ] Submission data JSONB stores user answers by question
- [ ] Unique constraint on (assignment_id, user_id, attempt_number)
- [ ] Partial index on resources for most-downloaded
- [ ] All timestamps use UTC timezone
- [ ] Denormalized download_count can be updated
- [ ] Test data with various resource types and assignments
- [ ] Test assignment submissions with scoring
- [ ] Migration file generated and runnable

## Dependencies

- Task 01: Drizzle ORM Setup and Configuration
- Task 02: Users and Profiles Tables
- Task 06: Courses, Modules, and Lessons Tables

## Technical Notes

### Resource File Types

- **pdf** - PDF documents
- **doc/docx** - Word documents
- **zip** - Compressed archives
- **mp3** - Audio files
- **mp4** - Video files (supplementary to lesson video)
- **link** - External URL (no file upload)
- **image** - Image files (guides, reference images)

### File Storage and Security

- Store files in R2 with access control
- Only authenticated users can download
- Track downloads for analytics
- Consider file size limits (max 500MB per file)
- Virus scan files on upload (optional but recommended)

### Assignment Scoring

- Multiple choice: 1 point per question (configurable)
- Passing percentage: Default 70% (configurable)
- Auto-grading for MCQ (compare to correct_answer)
- Manual grading for essays/open-ended (future enhancement)
- Track passing status for progress metrics

### Question Options Storage

JSONB structure allows flexibility:

- Each option has unique id (a, b, c, d or numeric)
- Text property stores option content
- Optional media_url for image options
- Optional explanation per option

### Submission Tracking

- Track attempt number for max_attempts enforcement
- Store submission data as JSONB for future reference
- Calculate score, percentage, and pass status immediately
- Allow resubmission up to max_attempts
- Show feedback only after grading (if show_score=true)

### Multiple Attempt Management

- First attempt scored and stored
- Second attempt creates new submission record
- Track best score or latest score (decide per assignment)
- Usually track best score for learner benefit
- Don't count failed attempts against learner

### Auto-Grading Logic

```typescript
// Calculate score for submission
const calculateScore = (submission, questions) => {
  let totalPoints = 0;
  let earnedPoints = 0;

  for (const question of questions) {
    totalPoints += question.points;

    if (question.questionType === "mcq") {
      if (submission.submissionData[question.id] === question.correctAnswer) {
        earnedPoints += question.points;
      }
    } else if (question.questionType === "multiple_select") {
      const userAnswers = submission.submissionData[question.id] || [];
      if (arraysEqual(userAnswers.sort(), question.correctAnswers.sort())) {
        earnedPoints += question.points;
      }
    }
  }

  return {
    score: earnedPoints,
    percentage: (earnedPoints / totalPoints) * 100,
    isPassed:
      (earnedPoints / totalPoints) * 100 >= assignment.passingPercentage,
  };
};
```

### Query Patterns

```typescript
// Get learner's best submission for assignment
db.select()
  .from(learnerAssignmentSubmissions)
  .where(and(
    eq(learnerAssignmentSubmissions.assignmentId, assignmentId),
    eq(learnerAssignmentSubmissions.userId, userId)
  ))
  .orderBy(desc(learnerAssignmentSubmissions.score))
  .limit(1);

// Get all learners' scores for assignment
db.select()
  .from(learnerAssignmentSubmissions)
  .where(eq(learnerAssignmentSubmissions.assignmentId, assignmentId))
  .groupBy(learnerAssignmentSubmissions.userId)
  .having(// get latest submission per user)
```

### Resource Ordering

- Sort_order determines display in lesson
- Reordering updates sort_order values
- Resources appear in same order for all learners

### Assignment Organization

- Can be attached to lesson or course level
- Course-level assignments apply to entire course
- Lesson-level assignments specific to that lesson
- Mixing both supported (course + lesson assignments)

### Feedback and Explanations

- `explanation` field shown for each question (after answering)
- Controlled by assignment's `show_answers` flag
- `feedback` field for instructor-provided feedback on submission
- Helps learners understand correct answers

### Testing Considerations

- Test resource download tracking
- Test assignment with various question types
- Test auto-grading MCQ questions
- Test multiple submission attempts
- Test attempt limit enforcement
- Test passing score calculation
- Test feedback visibility based on settings
- Test JSONB question options storage and retrieval
- Test cascade delete (deleting assignment deletes submissions)

### Performance Optimization

- Index on (assignment_id, user_id) for quick lookup
- Cache assignment questions (rarely changes)
- Denormalize score/percentage to avoid recalculation
- Consider separate table for graded submissions (archive old ones)

### Advanced Features (Future)

- Question randomization (shuffle answer options)
- Question shuffling (randomize question order)
- Timed quizzes (deadline tracking)
- Question pools (randomly select from larger bank)
- Partial credit (partial points for partial credit)
- Essay/short answer with rubric-based grading
