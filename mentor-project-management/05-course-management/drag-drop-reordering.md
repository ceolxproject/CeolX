# Task: Drag-and-Drop Reordering

## Description

Implement drag-and-drop reordering for modules within a course and lessons within a module. Use the dnd-kit library for accessible, keyboard-friendly drag-and-drop. Support optimistic UI updates and persist reordering to the API with `sort_order` field management.

## Affected Apps/Packages

- Frontend: `@mentor/web` (Next.js, React)
- Shared components: `@mentor/ui` (Design system)
- Shared types: `@mentor/types`
- External library: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

## UI/UX Requirements

### Module Reordering

- Display modules in a vertical list
- Drag handle on left side of each module
- Visual feedback on hover (highlight, cursor change)
- Dragging module shows semi-transparent copy
- Drop target highlighted when dragging
- Reordering persists immediately to API
- Undo button (optional) if reorder fails

### Lesson Reordering (Within Module)

- Display lessons nested under module
- Drag handle for each lesson
- Can only reorder within same module (no cross-module drag)
- Same visual feedback as modules
- Lessons drop order affects `sort_order` in DB

### Visual Feedback States

- **Idle**: Normal list appearance
- **Dragging**:
  - Dragged item: semi-transparent (opacity 0.5)
  - Drag handle: cursor becomes grab/grabbing
  - Drop zones: highlighted with dashed border
- **Hover**: List item background slightly highlighted
- **Disabled**: Cannot drag (e.g., during API call)

### Keyboard Accessibility

- Tab to focus list items
- Space/Enter to activate drag
- Arrow keys (↑↓) to reorder
- Escape to cancel drag
- Screen reader announcements for reorder events

## API Endpoints

### PUT /api/v1/courses/{courseId}/modules/reorder

Update module sort order.

**Request Body:**

```json
{
  "modules": [
    {
      "id": "uuid",
      "sortOrder": number
    }
  ]
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "modules": [
    {
      "id": "uuid",
      "sortOrder": number
    }
  ]
}
```

### PUT /api/v1/courses/{courseId}/modules/{moduleId}/lessons/reorder

Update lesson sort order within a module.

**Request Body:**

```json
{
  "lessons": [
    {
      "id": "uuid",
      "sortOrder": number
    }
  ]
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "lessons": [
    {
      "id": "uuid",
      "sortOrder": number
    }
  ]
}
```

## Requirements

1. **dnd-kit Library Integration**
   - Install: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
   - Use `DndContext` wrapper for drag-drop functionality
   - Implement `SortableContext` for sortable lists
   - Use `useSortable` hook in draggable items

2. **Optimistic UI Updates**
   - Immediately update local state when item is dropped
   - Show "saving..." indicator during API call
   - If API fails, revert local state
   - Toast notification on success/failure

3. **Sort Order Management**
   - Maintain sequential sort order (1, 2, 3, ...)
   - No gaps in sort order after reordering
   - Calculate new sort order from new item positions
   - Send only changed sort orders to API (optional optimization)

4. **Drag Handle Design**
   - Small icon (6 horizontal dots) or hamburger icon
   - Position on left side of list item
   - Show cursor change on hover (grab/grabbing)
   - Touch-friendly (minimum 44x44px hit area on mobile)

5. **Drop Targets**
   - Visual indicator (dashed border, background color change)
   - Show where item will be inserted
   - Animate list items as they shift
   - Smooth transitions (CSS transform for performance)

6. **Constraints**
   - Lessons can only be reordered within same module
   - Prevent cross-module lesson dragging
   - Prevent invalid drops (e.g., lesson to module level)
   - Show visual feedback for invalid drop zones

7. **Error Handling**
   - If API call fails, revert to previous order
   - Show error toast: "Failed to save order. Reverted changes."
   - Log errors for debugging
   - Retry button (optional)

8. **Performance Optimization**
   - Use `React.memo` for list items to prevent unnecessary re-renders
   - Batch sort order updates in single API call
   - Debounce API calls if multiple reorders happen quickly (optional)
   - Use CSS transforms for smooth animations (GPU-accelerated)

9. **Mobile Considerations**
   - Touch-friendly drag handles
   - Longer drag handle on mobile
   - Disable text selection during drag
   - Works on iOS and Android browsers

10. **Keyboard & Screen Reader Support**
    - Focus management: ensure items remain focusable
    - ARIA live regions for reorder announcements
    - Keyboard shortcut help text
    - Announce: "Item moved from position X to position Y"

## Acceptance Criteria

- [ ] Modules can be dragged and reordered within course
- [ ] Lessons can be dragged and reordered within module
- [ ] Drag handle visible and properly styled
- [ ] Visual feedback during drag (opacity, border, etc.)
- [ ] Drop target highlighted when dragging
- [ ] Optimistic UI update on drop
- [ ] API call persists sort order
- [ ] If API fails, revert to previous order with error message
- [ ] Lesson drag constrained to same module
- [ ] Cross-module lesson drag prevented
- [ ] Sort order values sequential (no gaps) after reorder
- [ ] Keyboard navigation works (arrow keys, space, escape)
- [ ] Tab navigation focuses items
- [ ] Screen reader announces reorder events
- [ ] Mobile touch drag works
- [ ] Drag handle cursor feedback works
- [ ] Animation smooth (60fps)
- [ ] List items animate as order changes

## Dependencies

- **Upstream**: Module Management API (module-management.md)
- **Upstream**: Lesson Management API (lesson-management.md)
- **Related**: Course Builder UI (course-builder-ui-masterclass.md)

## Technical Notes

### Component Structure

```
CourseBuilder/
├── ModuleList.tsx (with dnd-kit integration)
│   ├── DndContext (wraps entire list)
│   ├── SortableContext
│   └── Module items (useSortable hook)
│       ├── LessonList.tsx (nested)
│       │   ├── SortableContext (lesson-level)
│       │   └── Lesson items (useSortable hook)
```

### Installation

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### ModuleList Component Implementation

```typescript
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragCancelEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';

interface Module {
  id: string;
  title: string;
  sortOrder: number;
  lessons: Lesson[];
}

export function ModuleList({ modules: initialModules, courseId }: Props) {
  const [modules, setModules] = useState<Module[]>(initialModules);
  const [isReordering, setIsReordering] = useState(false);
  const [previousOrder, setPreviousOrder] = useState<Module[]>(initialModules);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      distance: 8 // Minimum drag distance
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates // Use arrow keys
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    // Find items by ID
    const oldIndex = modules.findIndex(m => m.id === active.id);
    const newIndex = modules.findIndex(m => m.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Calculate new order
    const newModules = arrayMove(modules, oldIndex, newIndex);

    // Optimistic update
    setModules(newModules);
    setPreviousOrder(modules);
    setIsReordering(true);

    // Persist to API
    try {
      const sortOrderUpdate = newModules.map((m, i) => ({
        id: m.id,
        sortOrder: i + 1
      }));

      await reorderModulesApi(courseId, sortOrderUpdate);

      // Success
      toast.success('Module order saved');
    } catch (error) {
      // Revert on failure
      setModules(previousOrder);
      toast.error('Failed to save module order. Changes reverted.');
      console.error('Reorder error:', error);
    } finally {
      setIsReordering(false);
    }
  };

  const moduleIds = modules.map(m => m.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={moduleIds}
        strategy={verticalListSortingStrategy}
        disabled={isReordering}
      >
        <div className="module-list">
          {modules.map(module => (
            <SortableModule
              key={module.id}
              module={module}
              courseId={courseId}
              isReordering={isReordering}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
```

### SortableModule Component

```typescript
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function SortableModule({ module, courseId, isReordering }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: module.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`module-item ${isDragging ? 'dragging' : ''}`}
    >
      <div className="module-header">
        <div
          className="drag-handle"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder module"
          role="button"
          tabIndex={0}
        >
          <DragIcon />
        </div>

        <div className="module-content">
          <h3>{module.title}</h3>
          <p className="lesson-count">{module.lessons.length} lessons</p>
        </div>
      </div>

      {/* Nested lesson list */}
      <LessonList
        lessons={module.lessons}
        moduleId={module.id}
        courseId={courseId}
        disabled={isReordering}
      />
    </div>
  );
}
```

### LessonList Component (Nested)

```typescript
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';

interface Lesson {
  id: string;
  title: string;
  sortOrder: number;
  videoDuration?: number;
}

export function LessonList({
  lessons: initialLessons,
  moduleId,
  courseId,
  disabled
}: Props) {
  const [lessons, setLessons] = useState<Lesson[]>(initialLessons);
  const [isReordering, setIsReordering] = useState(false);
  const [previousOrder, setPreviousOrder] = useState<Lesson[]>(initialLessons);

  const sensors = useSensors(
    useSensor(PointerSensor, { distance: 8 }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = lessons.findIndex(l => l.id === active.id);
    const newIndex = lessons.findIndex(l => l.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newLessons = arrayMove(lessons, oldIndex, newIndex);

    setLessons(newLessons);
    setPreviousOrder(lessons);
    setIsReordering(true);

    try {
      const sortOrderUpdate = newLessons.map((l, i) => ({
        id: l.id,
        sortOrder: i + 1
      }));

      await reorderLessonsApi(courseId, moduleId, sortOrderUpdate);

      toast.success('Lesson order saved');
    } catch (error) {
      setLessons(previousOrder);
      toast.error('Failed to save lesson order. Changes reverted.');
      console.error('Reorder error:', error);
    } finally {
      setIsReordering(false);
    }
  };

  const lessonIds = lessons.map(l => l.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={lessonIds}
        strategy={verticalListSortingStrategy}
        disabled={disabled || isReordering}
      >
        <div className="lesson-list">
          {lessons.map(lesson => (
            <SortableLesson
              key={lesson.id}
              lesson={lesson}
              isReordering={isReordering}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
```

### SortableLesson Component

```typescript
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function SortableLesson({ lesson, isReordering }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`lesson-item ${isDragging ? 'dragging' : ''}`}
    >
      <div className="lesson-header">
        <div
          className="drag-handle"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder lesson"
          role="button"
          tabIndex={0}
        >
          <DragIcon />
        </div>

        <div className="lesson-content">
          <h4>{lesson.title}</h4>
          {lesson.videoDuration && (
            <p className="duration">{formatDuration(lesson.videoDuration)}</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

### CSS Styling

```css
.module-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.module-item {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  transition: all 0.2s;
}

.module-item.dragging {
  opacity: 0.5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.module-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  cursor: grab;
  color: #9ca3af;
  border-radius: 4px;
  transition: all 0.2s;
}

.drag-handle:hover {
  background: #f3f4f6;
  color: #6b7280;
  cursor: grab;
}

.drag-handle:active {
  cursor: grabbing;
}

.module-content {
  flex: 1;
}

.module-content h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.lesson-count {
  margin: 0.25rem 0 0;
  font-size: 0.875rem;
  color: #6b7280;
}

.lesson-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0 0 8px 8px;
}

.lesson-item {
  padding: 0.75rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  transition: all 0.2s;
}

.lesson-item.dragging {
  opacity: 0.5;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.lesson-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.lesson-content {
  flex: 1;
}

.lesson-content h4 {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 500;
}

.duration {
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  color: #9ca3af;
}
```

### API Client Functions

```typescript
export async function reorderModulesApi(
  courseId: string,
  modules: Array<{ id: string; sortOrder: number }>
): Promise<void> {
  const response = await fetch(`/api/v1/courses/${courseId}/modules/reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modules }),
  });

  if (!response.ok) {
    throw new Error("Failed to reorder modules");
  }
}

export async function reorderLessonsApi(
  courseId: string,
  moduleId: string,
  lessons: Array<{ id: string; sortOrder: number }>
): Promise<void> {
  const response = await fetch(
    `/api/v1/courses/${courseId}/modules/${moduleId}/lessons/reorder`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessons }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to reorder lessons");
  }
}
```

### Testing Checklist

- Drag module and drop → optimistic update, API call made
- Drag lesson and drop → within same module only
- Lesson drag across modules → prevented with visual feedback
- API failure → revert to previous order with error message
- Arrow key navigation → reorder using keyboard
- Tab navigation → can focus items and drag handle
- Screen reader → announces reorder events
- Mobile touch → drag handle works on touch screens
- Multiple rapid reorders → debounced or batched API calls
- Sort order values sequential → no gaps after reorder
