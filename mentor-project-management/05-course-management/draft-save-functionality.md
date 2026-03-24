# Task: Draft Save Functionality

## Description

Implement auto-save and manual save functionality for course builder drafts. Users can save a course at any step of the wizard and resume editing later. The system tracks unsaved changes, warns before leaving with changes, and displays draft status in the instructor dashboard.

## Affected Apps/Packages

- Backend: `@mentor/api` (Hono on Vercel)
- Database: `@mentor/db` (Drizzle + Neon PostgreSQL)
- Frontend: `@mentor/web` (Next.js, React)
- Shared types: `@mentor/types`

## API Endpoints

### PUT /api/v1/courses/{courseId}/draft

Save course as draft (can be called from any step).

**Request Body:**

```json
{
  "title": string (optional),
  "description": string (optional),
  "category": string (optional),
  "skillLevel": string (optional),
  "price": number (optional),
  "thumbnailUrl": string (optional),
  "modules": [
    {
      "id": "uuid (optional if new)",
      "title": string,
      "description": string (optional),
      "sortOrder": number,
      "lessons": [
        {
          "id": "uuid (optional if new)",
          "title": string,
          "description": string (optional),
          "muxAssetId": string (optional),
          "muxPlaybackId": string (optional),
          "videoDuration": number (optional),
          "sortOrder": number
        }
      ]
    }
  ],
  "resources": [
    {
      "id": "uuid (optional if new)",
      "title": string,
      "url": string (optional),
      "type": string (pdf, doc, zip, audio, video, external_link)
    }
  ],
  "assignments": [
    {
      "id": "uuid (optional if new)",
      "title": string,
      "type": "lesson" | "course"
    }
  ],
  "communityEnabled": boolean (optional),
  "communityGuidelines": string (optional),
  "allowedPostTypes": string[] (optional)
}
```

**Response (200 OK):**

```json
{
  "courseId": "uuid",
  "status": "draft",
  "savedAt": "ISO8601",
  "lastSavedBy": "user_id",
  "completeness": 0.45,
  "missingFields": ["modules", "lessons"]
}
```

### GET /api/v1/courses/{courseId}/draft

Fetch draft course data for resuming editing.

**Response (200 OK):**

```json
{
  "id": "uuid",
  "instructorId": "uuid",
  "type": "masterclass" | "lesson",
  "status": "draft",
  "title": string,
  "description": string,
  "category": string,
  "skillLevel": string,
  "price": number,
  "thumbnailUrl": string | null,
  "modules": [...],
  "resources": [...],
  "assignments": [...],
  "communityEnabled": boolean,
  "communityGuidelines": string | null,
  "allowedPostTypes": string[],
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601",
  "lastSavedAt": "ISO8601"
}
```

### GET /api/v1/courses/drafts

List all draft courses for authenticated instructor.

**Query Parameters:**

- `type`: Optional filter ("masterclass" or "lesson")
- `limit`: Default 20, max 100
- `offset`: For pagination

**Response (200 OK):**

```json
{
  "drafts": [
    {
      "id": "uuid",
      "type": "masterclass" | "lesson",
      "title": string,
      "category": string,
      "skillLevel": string,
      "completeness": number (0-100),
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601",
      "lastSavedAt": "ISO8601"
    }
  ],
  "total": number
}
```

## UI Components

### Auto-Save Indicator

- Location: Bottom-right of course builder
- States:
  - "Saving..." (spinner, 3 seconds after last change)
  - "All changes saved" (checkmark, visible for 2 seconds)
  - "Failed to save" (error icon, red)
  - "Save now" (button, if auto-save disabled)

### Unsaved Changes Warning

- Display: Alert banner at top of builder
- Message: "You have unsaved changes"
- Actions: "Save Now" button, "Discard" button
- Trigger: Before page unload, navigate away, close browser

### Draft List in Dashboard

- Mentor dashboard shows list of draft courses
- Columns:
  - Title
  - Course type (Masterclass/Lesson)
  - Category
  - Completeness progress bar (0-100%)
  - Last saved date/time
  - Missing fields count (e.g., "1 step remaining")
  - Actions: Edit, Delete
- Sort options:
  - Last saved (default, most recent first)
  - Title (A-Z)
  - Completeness (least complete first)

### Resume Draft

- Link from dashboard: "Continue editing"
- Auto-load draft data into wizard
- Display last saved timestamp: "Last saved on [date] [time]"
- Show completeness: "45% complete - missing modules"
- Highlight missing required fields

## Requirements

1. **Auto-Save**
   - Trigger: 3 seconds after user stops typing/interacting
   - Debounce: Do not make more than 1 request per 5 seconds
   - Silent on success: No notification unless explicitly requested
   - Error notification: Show toast on failure
   - Indicator: Small "saving..." text and spinner

2. **Manual Save**
   - Button: "Save Draft" available on all wizard steps
   - Keyboard shortcut: Cmd/Ctrl + S
   - Success feedback: Toast notification "Saved successfully"
   - Error handling: Clear error message if save fails

3. **Unsaved Changes Tracking**
   - Track form state changes in frontend state manager
   - Compare current state with last saved state
   - Flag `unsavedChanges` boolean
   - Clear flag after successful save
   - Persist unsaved state in sessionStorage (optional, for browser crash recovery)

4. **Warn Before Navigation**
   - If unsaved changes exist:
     - Show browser confirmation dialog: "You have unsaved changes. Leave anyway?"
     - Block navigation until user confirms or saves
     - Also handle: Back button, forward button, URL changes
   - If no unsaved changes: Allow free navigation

5. **Draft Persistence**
   - Save entire course state, not just required fields
   - Allow partial saves (can save course without video, etc.)
   - Preserve all form data between sessions
   - Do NOT delete draft when course is published (option to delete later)

6. **Draft Completeness**
   - Calculate completeness percentage based on:
     - Course metadata (title, description, category, skill level): 20%
     - Course type:
       - Masterclass: modules (20%), lessons (20%), resources (10%), assignments (10%), community (10%), pricing (10%)
       - Lesson: video (20%), resources (10%), assignments (10%), community (10%), pricing (10%)
     - Thumbnail: 10% (optional but recommended)
   - Show missing fields list for wizard navigation

7. **Draft Versioning**
   - Keep only 1 draft per course (latest version)
   - Previous saves overwritten (no version history)
   - Timestamp shows when last saved

8. **Error Handling**
   - Network error: Retry with exponential backoff (1s, 2s, 4s, 8s)
   - Server error: Show clear message and allow manual retry
   - Invalid data: Return validation errors with field indicators
   - Conflict (concurrent edits): Last-write-wins (no conflict resolution)

9. **Session Management**
   - If user logs out: Draft persists (can resume on login)
   - If course deleted by instructor: Draft deleted
   - If draft not touched for 30 days: (Optional) show archive notice

## Acceptance Criteria

- [ ] PUT /api/v1/courses/{courseId}/draft saves partial course data
- [ ] Auto-save debounces and doesn't exceed 1 request per 5 seconds
- [ ] Auto-save indicator shows "saving..." and "saved" states
- [ ] Manual "Save Draft" button available on all wizard steps
- [ ] Cmd/Ctrl + S keyboard shortcut triggers save
- [ ] Unsaved changes warning prevents navigation
- [ ] Browser unload dialog shows if unsaved changes exist
- [ ] GET /api/v1/courses/{courseId}/draft returns full draft data
- [ ] GET /api/v1/courses/drafts lists all drafts for instructor
- [ ] Draft completeness calculated correctly (0-100%)
- [ ] Missing fields identified and displayed
- [ ] Dashboard draft list shows completeness progress bar
- [ ] Resume draft: wizard pre-populates with saved data
- [ ] Last saved timestamp displays
- [ ] Error handling: network failures trigger retry
- [ ] Error handling: server errors show clear messages
- [ ] sessionStorage preserves form state on browser crash recovery
- [ ] Draft persists after course published
- [ ] Deleting course also deletes associated draft

## Dependencies

- **Upstream**: Course Creation API (course-creation-api.md)
- **Upstream**: Module Management API (module-management.md)
- **Upstream**: Lesson Management API (lesson-management.md)
- **Upstream**: Course Builder UI (course-builder-ui-masterclass.md, course-builder-ui-lesson.md)
- **Related**: Mentor Dashboard (10-instructor-dashboard-and-revenue)

## Technical Notes

### Database Schema

```sql
-- Extend courses table
ALTER TABLE courses ADD COLUMN draft_data JSONB; -- Stores complete draft state
ALTER TABLE courses ADD COLUMN last_saved_at TIMESTAMP;
ALTER TABLE courses ADD COLUMN draft_completeness INTEGER DEFAULT 0; -- 0-100

-- Index for efficient draft queries
CREATE INDEX idx_instructor_drafts ON courses(instructor_id, status) WHERE status = 'draft';
```

### Backend Handler: Save Draft

```typescript
export const saveDraft = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { courseId } = event.context.params;

  // Verify course ownership
  const course = await db.query.courses.findFirst({
    where: (courses, { eq, and }) =>
      and(eq(courses.id, courseId), eq(courses.instructorId, user.id)),
  });

  if (!course) throw createError({ statusCode: 403 });

  const body = await readBody(event);

  // Validate partial data (no strict requirements for draft)
  if (body.title && body.title.length > 200) {
    throw createError({ statusCode: 400, message: "Title too long" });
  }

  // Calculate completeness
  const completeness = calculateCompleteness(course.type, body);

  // Identify missing fields
  const missingFields = identifyMissingFields(course.type, body);

  // Update course record
  const updated = await db
    .update(courses)
    .set({
      title: body.title || course.title,
      description: body.description || course.description,
      category: body.category || course.category,
      skillLevel: body.skillLevel || course.skillLevel,
      price: body.price !== undefined ? body.price : course.price,
      thumbnailUrl: body.thumbnailUrl || course.thumbnailUrl,
      draftData: body, // Store complete state as JSON
      draftCompleteness: completeness,
      lastSavedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(courses.id, courseId))
    .returning();

  return {
    courseId,
    status: "draft",
    savedAt: new Date().toISOString(),
    lastSavedBy: user.id,
    completeness,
    missingFields,
  };
});

function calculateCompleteness(courseType: string, body: any): number {
  let score = 0;

  // Course metadata (20%)
  if (body.title) score += 5;
  if (body.description) score += 5;
  if (body.category) score += 5;
  if (body.skillLevel) score += 5;

  if (courseType === "masterclass") {
    // Masterclass specifics
    if (body.modules?.length > 0) score += 20;
    if (body.modules?.some((m: any) => m.lessons?.length > 0)) score += 20;
    if (body.resources?.length > 0) score += 10;
    if (body.assignments?.length > 0) score += 10;
    if (body.communityEnabled !== undefined) score += 10;
    if (body.price !== undefined) score += 10;
    if (body.thumbnailUrl) score += 10;
  } else {
    // Lesson specifics
    if (body.modules?.length > 0 && body.modules[0].lessons?.length > 0)
      score += 20;
    if (body.resources?.length > 0) score += 10;
    if (body.assignments?.length > 0) score += 10;
    if (body.communityEnabled !== undefined) score += 10;
    if (body.price !== undefined) score += 10;
    if (body.thumbnailUrl) score += 10;
  }

  return Math.min(score, 100);
}

function identifyMissingFields(courseType: string, body: any): string[] {
  const missing: string[] = [];

  if (!body.title) missing.push("course_title");
  if (!body.description) missing.push("description");
  if (!body.category) missing.push("category");
  if (!body.skillLevel) missing.push("skill_level");

  if (courseType === "masterclass") {
    if (!body.modules || body.modules.length === 0) missing.push("modules");
    if (!body.modules?.some((m: any) => m.lessons?.length > 0))
      missing.push("lessons");
    if (body.price === undefined) missing.push("pricing");
  } else {
    if (!body.modules?.[0]?.lessons?.[0]) missing.push("lesson_content");
    if (body.price === undefined) missing.push("pricing");
  }

  if (body.communityEnabled === undefined) missing.push("community_settings");

  return missing;
}
```

### Backend Handler: Get Draft

```typescript
export const getDraft = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { courseId } = event.context.params;

  const course = await db.query.courses.findFirst({
    where: (courses, { eq, and }) =>
      and(
        eq(courses.id, courseId),
        eq(courses.instructorId, user.id),
        eq(courses.status, "draft"),
      ),
  });

  if (!course) throw createError({ statusCode: 404 });

  return {
    id: course.id,
    instructorId: course.instructorId,
    type: course.type,
    status: "draft",
    title: course.title,
    description: course.description,
    category: course.category,
    skillLevel: course.skillLevel,
    price: course.price,
    thumbnailUrl: course.thumbnailUrl,
    ...course.draftData, // Merge complete draft state
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
    lastSavedAt: course.lastSavedAt,
  };
});
```

### Frontend Hook: useCourseBuilderForm

```typescript
import { useCallback, useEffect, useRef } from "react";

export function useCourseBuilderForm(
  courseId: string,
  onSaveComplete?: () => void,
) {
  const [formData, setFormData] = useState<CourseBuilderFormData | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const isUnloadingRef = useRef(false);

  // Load draft on mount
  useEffect(() => {
    loadDraft(courseId);
  }, [courseId]);

  // Auto-save with debounce
  useEffect(() => {
    if (!unsavedChanges || !formData) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout (3 seconds of inactivity)
    saveTimeoutRef.current = setTimeout(() => {
      saveDraftAuto();
    }, 3000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [formData, unsavedChanges]);

  // Warn on unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (unsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [unsavedChanges]);

  // Router navigation warning
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      if (unsavedChanges && !isUnloadingRef.current) {
        const confirmed = confirm("You have unsaved changes. Leave anyway?");
        if (!confirmed) {
          // Cancel navigation (router-specific)
          throw new Error("Navigation cancelled");
        }
      }
    };

    // Hook into Next.js router
    const router = useRouter();
    router.events?.on("beforeHistoryChange", handleRouteChange);

    return () => {
      router.events?.off("beforeHistoryChange", handleRouteChange);
    };
  }, [unsavedChanges]);

  const loadDraft = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/courses/${courseId}/draft`);
      if (response.ok) {
        const draft = await response.json();
        setFormData(draft);
        setLastSavedAt(new Date(draft.lastSavedAt));
        setUnsavedChanges(false);
      }
    } catch (error) {
      console.error("Failed to load draft:", error);
    }
  }, [courseId]);

  const updateFormData = useCallback(
    (newData: Partial<CourseBuilderFormData>) => {
      setFormData((prev) => (prev ? { ...prev, ...newData } : null));
      setUnsavedChanges(true);
    },
    [],
  );

  const saveDraftAuto = useCallback(async () => {
    if (!formData || isSaving) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/courses/${courseId}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const result = await response.json();
        setUnsavedChanges(false);
        setLastSavedAt(new Date(result.savedAt));
      }
    } catch (error) {
      console.error("Auto-save failed:", error);
      // Silently fail and retry on next debounce
    } finally {
      setIsSaving(false);
    }
  }, [formData, courseId, isSaving]);

  const saveDraftManual = useCallback(async () => {
    if (!formData) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/courses/${courseId}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const result = await response.json();
        setUnsavedChanges(false);
        setLastSavedAt(new Date(result.savedAt));
        toast.success("Draft saved successfully");
        onSaveComplete?.();
      } else {
        throw new Error("Save failed");
      }
    } catch (error) {
      console.error("Manual save failed:", error);
      toast.error("Failed to save draft: " + error.message);
    } finally {
      setIsSaving(false);
    }
  }, [formData, courseId, onSaveComplete]);

  // Keyboard shortcut: Cmd/Ctrl + S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveDraftManual();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveDraftManual]);

  return {
    formData,
    unsavedChanges,
    isSaving,
    lastSavedAt,
    updateFormData,
    saveDraftManual,
    loadDraft,
  };
}
```

### Frontend Component: Auto-Save Indicator

```typescript
export function AutoSaveIndicator({ isSaving, lastSavedAt, error }: Props) {
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (!isSaving && lastSavedAt) {
      setShowSaved(true);
      const timeout = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [isSaving, lastSavedAt]);

  return (
    <div className="auto-save-indicator">
      {isSaving && (
        <div className="saving">
          <Spinner size="sm" />
          <span>Saving...</span>
        </div>
      )}

      {showSaved && !isSaving && (
        <div className="saved">
          <CheckIcon />
          <span>All changes saved</span>
        </div>
      )}

      {error && (
        <div className="error">
          <ErrorIcon />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
```

### Testing Checklist

- Save draft via PUT endpoint → data persisted
- Auto-save triggers after 3 seconds of inactivity
- Manual "Save Draft" button saves immediately
- Cmd/Ctrl + S keyboard shortcut triggers save
- Unsaved changes warning shows before navigation
- Browser unload dialog shows if unsaved changes
- Draft list shows completeness percentage
- Resume draft pre-populates form with saved data
- Last saved timestamp displays
- Network error triggers retry (with backoff)
- Server validation errors display in form
