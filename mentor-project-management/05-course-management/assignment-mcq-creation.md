# Task: Assignment/MCQ Creation

## Description

Implement the system for creating, editing, and managing assignments and multiple-choice questions (MCQs) at both lesson and course levels. Assignments consist of multiple questions with options, correct answer marking, and optional explanations. This task covers backend API endpoints and frontend UI components for building and previewing assignments.

## Affected Apps/Packages

- Backend: `@mentor/api` (Hono on Vercel)
- Database: `@mentor/db` (Drizzle + Neon PostgreSQL)
- Frontend: `@mentor/web` (Next.js, React)
- Shared types: `@mentor/types`
- API client: `@mentor/api-client`

## API Endpoints

### POST /api/v1/courses/{courseId}/assignments

Create a new assignment (at course level).

**Request Body:**

```json
{
  "title": string,
  "description": string (optional),
  "type": "lesson" | "course",
  "lessonId": string (required if type="lesson"),
  "passingScore": number (0-100, optional, default 70),
  "maxAttempts": number (optional, default unlimited),
  "questions": [
    {
      "text": string,
      "order": number,
      "type": "multiple_choice",
      "options": [
        {
          "text": string,
          "isCorrect": boolean,
          "explanation": string (optional)
        }
      ]
    }
  ]
}
```

**Response (201 Created):**

```json
{
  "id": "uuid",
  "courseId": "uuid",
  "lessonId": "uuid" | null,
  "title": string,
  "description": string | null,
  "type": "lesson" | "course",
  "passingScore": number,
  "maxAttempts": number | null,
  "questionCount": number,
  "createdAt": "ISO8601"
}
```

### GET /api/v1/courses/{courseId}/assignments

List all assignments for a course.

**Query Parameters:**

- `type`: Optional filter ("lesson" or "course")
- `lessonId`: Optional filter by lesson

**Response (200 OK):**

```json
{
  "assignments": [
    {
      "id": "uuid",
      "courseId": "uuid",
      "lessonId": "uuid" | null,
      "title": string,
      "description": string | null,
      "type": "lesson" | "course",
      "passingScore": number,
      "maxAttempts": number | null,
      "questionCount": number,
      "createdAt": "ISO8601"
    }
  ],
  "total": number
}
```

### GET /api/v1/courses/{courseId}/assignments/{assignmentId}

Get a single assignment with all questions and options.

**Response (200 OK):**

```json
{
  "id": "uuid",
  "courseId": "uuid",
  "lessonId": "uuid" | null,
  "title": string,
  "description": string | null,
  "type": "lesson" | "course",
  "passingScore": number,
  "maxAttempts": number | null,
  "questions": [
    {
      "id": "uuid",
      "assignmentId": "uuid",
      "text": string,
      "order": number,
      "type": "multiple_choice",
      "options": [
        {
          "id": "uuid",
          "text": string,
          "isCorrect": boolean,
          "explanation": string | null
        }
      ]
    }
  ],
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

### PUT /api/v1/courses/{courseId}/assignments/{assignmentId}

Update assignment metadata (title, description, passingScore, maxAttempts).

**Request Body:**

```json
{
  "title": string (optional),
  "description": string (optional),
  "passingScore": number (optional),
  "maxAttempts": number (optional)
}
```

**Response (200 OK):**

```json
{
  "id": "uuid",
  "courseId": "uuid",
  "title": string,
  "description": string | null,
  "passingScore": number,
  "maxAttempts": number | null,
  "updatedAt": "ISO8601"
}
```

### DELETE /api/v1/courses/{courseId}/assignments/{assignmentId}

Delete an assignment and all associated questions.

**Response (200 OK):**

```json
{
  "success": true,
  "deletedAssignmentId": "uuid",
  "questionsDeleted": number
}
```

### POST /api/v1/courses/{courseId}/assignments/{assignmentId}/questions

Create a new question in an assignment.

**Request Body:**

```json
{
  "text": string,
  "order": number (auto-assigned if omitted),
  "type": "multiple_choice",
  "options": [
    {
      "text": string,
      "isCorrect": boolean,
      "explanation": string (optional)
    }
  ]
}
```

**Response (201 Created):**

```json
{
  "id": "uuid",
  "assignmentId": "uuid",
  "text": string,
  "order": number,
  "type": "multiple_choice",
  "options": [
    {
      "id": "uuid",
      "text": string,
      "isCorrect": boolean,
      "explanation": string | null
    }
  ],
  "createdAt": "ISO8601"
}
```

### PUT /api/v1/courses/{courseId}/assignments/{assignmentId}/questions/{questionId}

Update a question's text and options.

**Request Body:**

```json
{
  "text": string (optional),
  "order": number (optional),
  "options": [
    {
      "text": string,
      "isCorrect": boolean,
      "explanation": string (optional)
    }
  ]
}
```

**Response (200 OK):**

```json
{
  "id": "uuid",
  "assignmentId": "uuid",
  "text": string,
  "order": number,
  "options": [
    {
      "id": "uuid",
      "text": string,
      "isCorrect": boolean,
      "explanation": string | null
    }
  ],
  "updatedAt": "ISO8601"
}
```

### DELETE /api/v1/courses/{courseId}/assignments/{assignmentId}/questions/{questionId}

Delete a question from an assignment.

**Response (200 OK):**

```json
{
  "success": true,
  "deletedQuestionId": "uuid"
}
```

## Requirements

1. **Assignment Structure**
   - `title`: Required, max 200 characters
   - `description`: Optional, max 1000 characters
   - `type`: Either "lesson" (per-lesson) or "course" (per-course)
   - `lessonId`: Required if type="lesson", null if type="course"
   - `passingScore`: 0-100 integer, default 70
   - `maxAttempts`: Optional, if set limits learner attempts
   - `questionCount`: Denormalized count for quick queries

2. **Question Structure**
   - `text`: Required, max 500 characters
   - `order`: Integer for question ordering within assignment
   - `type`: Currently "multiple_choice" (extensible for future types)
   - `options`: Array of options (JSONB stored)
   - Minimum 2 options required
   - At least 1 option must be marked correct

3. **Option Structure**
   - `text`: Required, max 300 characters
   - `isCorrect`: Boolean flag marking correct option(s)
   - `explanation`: Optional text explaining the correct answer

4. **Question Ordering**
   - Auto-assign `order` as next integer if not provided
   - Support reordering questions via separate endpoint
   - Store order in database for consistent retrieval

5. **Validation**
   - Assignment title required
   - At least 1 question required before publishing
   - Each question requires ≥2 options
   - Each question requires ≥1 correct option
   - Passing score must be 0-100
   - If maxAttempts set, must be positive integer

6. **Authorization**
   - Verify JWT and instructor role
   - Verify user is course owner
   - Return 403 if unauthorized
   - Return 404 if course/assignment not found

7. **Error Handling**
   - 400: Missing required fields, validation failed
   - 403: User not authorized
   - 404: Course/assignment/question not found
   - 409: Cannot delete assignment with active learner attempts (optional warning)

8. **Database Constraints**
   - Foreign key: `course_id` references courses
   - Foreign key: `lesson_id` references lessons (nullable)
   - Index on `(course_id, type)` for efficient filtering
   - Unique constraint: `(course_id, lesson_id, title)` to prevent duplicate per-lesson assignments

## Acceptance Criteria

- [ ] POST creates assignment with questions and options
- [ ] GET (list) returns all assignments for course
- [ ] GET (single) returns assignment with all questions
- [ ] PUT updates assignment metadata without affecting questions
- [ ] DELETE removes assignment and all questions
- [ ] POST question creates new question in assignment
- [ ] PUT question updates text and options
- [ ] DELETE question removes question from assignment
- [ ] Question order auto-assigned if not provided
- [ ] Validation enforces ≥2 options per question
- [ ] Validation enforces ≥1 correct option per question
- [ ] Validation prevents assignment without ≥1 question
- [ ] Passing score must be 0-100
- [ ] Per-lesson vs per-course filtering works
- [ ] 403 returned if user not course owner
- [ ] 404 returned if course/assignment not found

## Dependencies

- **Upstream**: Course Creation API (course-creation-api.md)
- **Upstream**: Lesson Management API (lesson-management.md)
- **Upstream**: Authentication (04-authentication-and-onboarding)
- **Related**: Course Builder UI (course-builder-ui-masterclass.md)
- **Related**: Learning Assessment (07-video-player-and-learning)

## Technical Notes

### Database Schema

```sql
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL CHECK (type IN ('lesson', 'course')),
  passing_score INTEGER DEFAULT 70,
  max_attempts INTEGER,
  question_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  UNIQUE (course_id, lesson_id, title),
  INDEX idx_course_type (course_id, type),
  INDEX idx_lesson_assignments (lesson_id)
);

CREATE TABLE assignment_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  text VARCHAR(500) NOT NULL,
  order INTEGER NOT NULL,
  type VARCHAR(20) DEFAULT 'multiple_choice',
  options JSONB NOT NULL, -- [{ text, isCorrect, explanation }]
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  INDEX idx_assignment_order (assignment_id, order)
);
```

### Backend Handlers

**Create Assignment:**

```typescript
export const createAssignment = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { courseId } = event.context.params;

  // Verify course ownership
  const course = await db.query.courses.findFirst({
    where: (courses, { eq, and }) =>
      and(eq(courses.id, courseId), eq(courses.instructorId, user.id)),
  });

  if (!course) throw createError({ statusCode: 403 });

  const body = await readBody(event);
  validateAssignmentInput(body);

  // If lesson type, verify lesson belongs to course
  if (body.type === "lesson" && body.lessonId) {
    const lesson = await db.query.lessons.findFirst({
      where: (lessons, { eq, and }) =>
        and(eq(lessons.id, body.lessonId), eq(lessons.courseId, courseId)),
    });

    if (!lesson) throw createError({ statusCode: 404 });
  }

  // Create assignment
  const assignmentId = crypto.randomUUID();
  const assignment = await db
    .insert(assignments)
    .values({
      id: assignmentId,
      courseId,
      lessonId: body.lessonId || null,
      title: body.title,
      description: body.description || null,
      type: body.type,
      passingScore: body.passingScore || 70,
      maxAttempts: body.maxAttempts || null,
      questionCount: body.questions?.length || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // Create questions
  const questions = (body.questions || []).map((q: any, i: number) => ({
    id: crypto.randomUUID(),
    assignmentId,
    text: q.text,
    order: q.order || i + 1,
    type: "multiple_choice",
    options: q.options, // JSONB array
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  if (questions.length > 0) {
    await db.insert(assignmentQuestions).values(questions);
  }

  setResponseStatus(event, 201);
  return {
    ...assignment[0],
    questionCount: questions.length,
  };
});

function validateAssignmentInput(body: any) {
  if (!body.title || body.title.length > 200) {
    throw createError({ statusCode: 400, message: "Invalid title" });
  }

  if (!["lesson", "course"].includes(body.type)) {
    throw createError({ statusCode: 400, message: "Invalid type" });
  }

  if (body.type === "lesson" && !body.lessonId) {
    throw createError({
      statusCode: 400,
      message: "lessonId required for lesson type",
    });
  }

  if (body.passingScore !== undefined) {
    if (
      typeof body.passingScore !== "number" ||
      body.passingScore < 0 ||
      body.passingScore > 100
    ) {
      throw createError({
        statusCode: 400,
        message: "Passing score must be 0-100",
      });
    }
  }

  if (body.questions && Array.isArray(body.questions)) {
    for (const q of body.questions) {
      validateQuestion(q);
    }
  }
}

function validateQuestion(question: any) {
  if (!question.text || question.text.length > 500) {
    throw createError({ statusCode: 400, message: "Invalid question text" });
  }

  if (!Array.isArray(question.options) || question.options.length < 2) {
    throw createError({
      statusCode: 400,
      message: "Question requires at least 2 options",
    });
  }

  const correctOptions = question.options.filter((o: any) => o.isCorrect);
  if (correctOptions.length === 0) {
    throw createError({
      statusCode: 400,
      message: "Question requires at least 1 correct option",
    });
  }

  for (const option of question.options) {
    if (!option.text || option.text.length > 300) {
      throw createError({ statusCode: 400, message: "Invalid option text" });
    }
  }
}
```

**Get Assignment with Questions:**

```typescript
export const getAssignment = defineEventHandler(async (event) => {
  const { courseId, assignmentId } = event.context.params;

  const assignment = await db.query.assignments.findFirst({
    where: (a, { eq, and }) =>
      and(eq(a.id, assignmentId), eq(a.courseId, courseId)),
  });

  if (!assignment) throw createError({ statusCode: 404 });

  const questions = await db.query.assignmentQuestions.findMany({
    where: (q, { eq }) => eq(q.assignmentId, assignmentId),
    orderBy: (q) => asc(q.order),
  });

  return {
    ...assignment,
    questions: questions.map((q) => ({
      id: q.id,
      text: q.text,
      order: q.order,
      type: q.type,
      options: q.options, // JSONB options
    })),
  };
});
```

### Frontend Component: Assignment Builder

```typescript
import { useState } from 'react';

export function AssignmentBuilder({ courseId, lessonId, onSave }: Props) {
  const [assignment, setAssignment] = useState({
    title: '',
    description: '',
    type: lessonId ? 'lesson' : 'course',
    lessonId,
    passingScore: 70,
    maxAttempts: null as number | null,
    questions: [] as Question[]
  });

  const handleAddQuestion = () => {
    setAssignment({
      ...assignment,
      questions: [
        ...assignment.questions,
        {
          id: crypto.randomUUID(),
          text: '',
          order: assignment.questions.length + 1,
          type: 'multiple_choice',
          options: [
            { text: '', isCorrect: false, explanation: '' },
            { text: '', isCorrect: false, explanation: '' }
          ]
        }
      ]
    });
  };

  const handleUpdateQuestion = (index: number, updatedQ: Question) => {
    const questions = [...assignment.questions];
    questions[index] = updatedQ;
    setAssignment({ ...assignment, questions });
  };

  const handleDeleteQuestion = (index: number) => {
    const questions = assignment.questions.filter((_, i) => i !== index);
    setAssignment({ ...assignment, questions });
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/v1/courses/${courseId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignment)
      });

      if (!response.ok) throw new Error('Failed to save');

      onSave?.(await response.json());
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  return (
    <div className="assignment-builder">
      <div className="header">
        <input
          type="text"
          placeholder="Assignment Title"
          value={assignment.title}
          onChange={(e) => setAssignment({ ...assignment, title: e.target.value })}
        />
        <textarea
          placeholder="Description (optional)"
          value={assignment.description}
          onChange={(e) => setAssignment({ ...assignment, description: e.target.value })}
        />
      </div>

      <div className="settings">
        <label>
          Passing Score: {assignment.passingScore}%
          <input
            type="range"
            min="0"
            max="100"
            value={assignment.passingScore}
            onChange={(e) => setAssignment({ ...assignment, passingScore: parseInt(e.target.value) })}
          />
        </label>
        <label>
          Max Attempts (leave blank for unlimited):
          <input
            type="number"
            min="1"
            value={assignment.maxAttempts || ''}
            onChange={(e) => setAssignment({ ...assignment, maxAttempts: e.target.value ? parseInt(e.target.value) : null })}
          />
        </label>
      </div>

      <div className="questions">
        {assignment.questions.map((q, i) => (
          <QuestionBuilder
            key={q.id}
            question={q}
            onUpdate={(updated) => handleUpdateQuestion(i, updated)}
            onDelete={() => handleDeleteQuestion(i)}
          />
        ))}
      </div>

      <button onClick={handleAddQuestion}>+ Add Question</button>
      <button onClick={handleSave} className="primary">Save Assignment</button>
    </div>
  );
}

function QuestionBuilder({ question, onUpdate, onDelete }: QuestionBuilderProps) {
  return (
    <div className="question">
      <input
        type="text"
        placeholder="Question text"
        value={question.text}
        onChange={(e) => onUpdate({ ...question, text: e.target.value })}
      />

      <div className="options">
        {question.options.map((opt, i) => (
          <div key={i} className="option">
            <input
              type="text"
              placeholder="Option text"
              value={opt.text}
              onChange={(e) => {
                const options = [...question.options];
                options[i] = { ...opt, text: e.target.value };
                onUpdate({ ...question, options });
              }}
            />
            <label>
              <input
                type="radio"
                name={`correct-${question.id}`}
                checked={opt.isCorrect}
                onChange={() => {
                  const options = question.options.map((o, idx) => ({
                    ...o,
                    isCorrect: idx === i
                  }));
                  onUpdate({ ...question, options });
                }}
              />
              Correct
            </label>
            <input
              type="text"
              placeholder="Explanation (optional)"
              value={opt.explanation || ''}
              onChange={(e) => {
                const options = [...question.options];
                options[i] = { ...opt, explanation: e.target.value };
                onUpdate({ ...question, options });
              }}
            />
          </div>
        ))}
      </div>

      <button onClick={onDelete}>Delete Question</button>
    </div>
  );
}
```

### Testing Checklist

- Create assignment with questions → saved correctly
- Create assignment with invalid questions → validation error
- Update question text → persisted
- Delete question → removed from assignment
- Assignment requires ≥1 question
- Assignment requires ≥2 options per question
- Each question requires ≥1 correct option
- Passing score 0-100 validated
- Per-lesson and per-course filtering works
- Assignment list shows question count
