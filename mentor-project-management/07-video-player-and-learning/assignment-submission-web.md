# Assignment & MCQ Submission — Learner Web

## Description

Implement the learner-facing assignment and MCQ (Multiple Choice Question) submission experience for the web-learner application. Learners can view assignments attached to courses or individual lessons, complete MCQ-based quizzes, submit answers, and see their results. This is the consumption counterpart to the instructor-side assignment creation (Milestone 05: `assignment-mcq-creation.md`). The mobile equivalent is covered in Milestone 14: `10-mobile-bookmarks-assignments.md`.

## PRD Reference

- Section 5.1.3 — Video Player & Learning: "View course/lecture assignments (if applicable); MCQ-based assignments; Results visible after submission; Assignments set by instructor"
- Section 5.2.1 — Learner Web App: Feature parity with mobile

## Affected Apps/Packages

- `apps/web-learner` (Next.js) — Assignment UI components and pages
- `apps/api` (Hono) — Assignment submission and grading endpoints
- `packages/db` — Assignment submissions table (Drizzle schema)
- `packages/validators` — Zod schemas for submission payloads
- `packages/ui` — Shared assignment/quiz UI components

## API Endpoints

- `GET /api/courses/:courseId/assignments` — List all assignments for a course
- `GET /api/lessons/:lessonId/assignments` — List assignments for a specific lesson
- `GET /api/assignments/:assignmentId` — Get assignment details with questions
- `POST /api/assignments/:assignmentId/submissions` — Submit answers
  - Request: `{ "answers": [{ "questionId": "uuid", "selectedOptionId": "uuid" }] }`
  - Response: `{ "submissionId": "uuid", "score": 8, "totalQuestions": 10, "percentage": 80, "passed": true, "results": [...] }`
- `GET /api/assignments/:assignmentId/submissions/:submissionId` — Get submission results
- `GET /api/users/me/submissions` — Get all user submissions (for profile/progress tracking)

## Requirements

### 1. Assignment Display in Lesson Player

- **Assignment Tab**: New "Assignments" tab in the lesson player alongside Transcript, Notes, Comments
- Show assignment count badge on tab (e.g., "Assignments (2)")
- List all assignments linked to the current lesson
- Each assignment card shows:
  - Assignment title
  - Number of questions
  - Estimated time (calculated from question count, ~30s per question)
  - Status: Not Attempted / Completed / Passed / Failed
  - Score (if previously completed): "8/10 (80%)"
  - "Start Quiz" or "Retake" button
- Empty state: "No assignments for this lesson"

### 2. Assignment Display on Course Detail Page

- **Course-level Assignments** section (if course has assignments)
- Show assignments organized by module/lesson
- Assignment cards with same info as lesson player view
- Collapsible sections per module
- Progress indicator: "3 of 5 assignments completed"

### 3. MCQ Quiz Interface

- Full-screen or modal quiz view when learner starts an assignment
- Quiz header:
  - Assignment title
  - Progress indicator: "Question 3 of 10"
  - Progress bar (visual)
  - Timer (optional, if instructor set a time limit)
- Question display:
  - Question text (supports rich text/markdown)
  - Question image (if attached by instructor)
  - Multiple choice options (radio buttons for single-answer, checkboxes for multi-answer)
  - Option labels: A, B, C, D (or numbered)
  - Selected option highlighted with brand color
- Navigation:
  - "Next" button to advance
  - "Previous" button to go back
  - Question navigator: clickable numbered circles showing answered/unanswered/flagged
  - "Flag for Review" button on each question
- Submit flow:
  - "Review Answers" screen before final submission
  - Shows all questions with selected answers and flagged items
  - "Submit Quiz" button with confirmation dialog: "Are you sure? You cannot change your answers after submitting."
  - Loading state during submission

### 4. Results Display

- Immediately after submission, show results page:
  - Overall score: "8 out of 10 correct (80%)"
  - Pass/fail status (if passing threshold set by instructor)
  - Visual score indicator (circular progress or bar)
  - Time taken to complete
- Per-question breakdown:
  - Question text
  - Selected answer (highlighted green if correct, red if incorrect)
  - Correct answer (highlighted green)
  - Explanation text (if provided by instructor)
- Action buttons:
  - "Retake Quiz" (if retakes allowed by instructor)
  - "Back to Lesson" — return to lesson player
  - "Next Lesson" — continue to next lesson in course
- Results saved and accessible from:
  - Lesson player Assignments tab (shows score)
  - Course detail page (shows completion status)
  - Learner profile (submission history)

### 5. Retake Logic

- If instructor allows retakes:
  - Show "Retake" button on completed assignments
  - Track attempt number: "Attempt 2 of 3" (if max attempts set)
  - Best score or latest score displayed (configurable by instructor)
  - Previous attempts viewable in submission history
- If retakes not allowed:
  - "Retake" button disabled after first submission
  - Message: "This quiz can only be taken once"

### 6. Progress Integration

- Assignment completion contributes to overall course progress
- Completed assignments visible in progress tracking API
- If assignment is required for lesson completion:
  - Lesson marked complete only after passing assignment
  - Visual indicator on lesson: "Complete assignment to finish this lesson"

### 7. Accessibility & UX

- Keyboard navigation: Tab through options, Enter to select, arrow keys to navigate
- Focus management: Focus trapped within quiz modal
- Screen reader support: ARIA labels on all interactive elements
- High contrast: Selected options clearly distinguishable
- Mobile-responsive: Quiz works on all screen sizes
- Auto-save: Answers saved locally (localStorage) in case of browser crash
- Recovery: If user returns to unfinished quiz, prompt to resume or restart

## Acceptance Criteria

- [ ] "Assignments" tab visible in lesson player with correct count badge
- [ ] Assignment cards show title, question count, status, and score
- [ ] "Start Quiz" button launches MCQ quiz interface
- [ ] Quiz shows questions with multiple choice options
- [ ] Single-answer questions use radio buttons; multi-answer use checkboxes
- [ ] Navigation: Next, Previous, and question navigator work correctly
- [ ] "Flag for Review" marks questions in navigator
- [ ] "Review Answers" screen shows all selections before submission
- [ ] Confirmation dialog before final submission
- [ ] Submission API called with correct payload
- [ ] Results page shows score, pass/fail, per-question breakdown
- [ ] Correct/incorrect answers highlighted with explanations
- [ ] Retake button available when instructor allows retakes
- [ ] Attempt tracking: shows attempt number and max attempts
- [ ] Assignment completion updates course progress
- [ ] Auto-save answers to localStorage during quiz
- [ ] Recovery prompt on returning to unfinished quiz
- [ ] Empty state when no assignments exist for a lesson
- [ ] Course-level assignment progress indicator
- [ ] Keyboard navigation and screen reader tested
- [ ] Responsive design tested at 1920px, 1200px, 768px, 375px
- [ ] Loading states during submission
- [ ] Error handling: network failure during submission shows retry option
- [ ] i18n: All strings use translation keys

## Dependencies

- Milestone 05: `assignment-mcq-creation.md` (instructor creates assignments)
- Milestone 02: `08-resources-assignments-tables.md` (database schema)
- Milestone 07: `mux-player-integration-web.md` (lesson player tabs)
- Milestone 07: `progress-tracking-api.md` (progress integration)
- Design system components (RadioGroup, Checkbox, ProgressBar, Modal)
- `packages/validators` for submission payload validation

## Technical Notes

- Use React state or `useReducer` for quiz state management (current question, answers, flags)
- Optimistic UI not needed here — wait for server response before showing results
- localStorage key format: `quiz_${assignmentId}_${userId}_progress` for auto-save
- Clear localStorage entry after successful submission
- Consider debouncing answer selection API calls if tracking partial progress server-side
- Timer implementation: use `setInterval` with cleanup, pause on blur if configured
- Question randomization: handled server-side when fetching assignment (if instructor enabled)
