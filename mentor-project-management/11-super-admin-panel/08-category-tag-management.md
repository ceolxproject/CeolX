# Category and Tag Management

## Description

CRUD interface for managing course categories and tags. Supports hierarchical categories with parent-child relationships, tag creation and assignment, icon assignment for visual identification, reordering via drag-and-drop, category merging with impact preview, and deletion with impact analysis.

## Affected Apps/Packages

- Frontend: `apps/web-admin` (Next.js)
- Backend: `apps/hono-api` (Hono)
- Shared: `packages/shared` (types)

## API Endpoints

- `GET /api/admin/categories` — List all categories with hierarchy
- `POST /api/admin/categories` — Create new category
- `PATCH /api/admin/categories/:id` — Update category (name, parent, icon, display_order)
- `DELETE /api/admin/categories/:id` — Delete category with impact analysis
- `POST /api/admin/categories/:id/merge` — Merge category into another
- `GET /api/admin/categories/:id/impact` — Preview impact of deletion/merge
- `GET /api/admin/tags` — List all tags
- `POST /api/admin/tags` — Create new tag
- `PATCH /api/admin/tags/:id` — Update tag (name, color)
- `DELETE /api/admin/tags/:id` — Delete tag
- `POST /api/admin/categories/reorder` — Reorder categories (drag-and-drop)

## Requirements

- Categories section:
  - Tree view of categories showing hierarchy (parent-child relationships)
  - Create category button opens form with: name, parent category (optional), icon selector, display order
  - Edit category button opens modal to update name, parent, icon
  - Drag-and-drop to reorder categories and change parent-child relationships
  - Course count displayed next to each category
  - Delete button with impact preview: shows courses affected, option to move courses to another category
  - Merge button: select target category, shows impact (all courses in category A moved to B)
- Tags section:
  - List of all tags with count of courses using each tag
  - Create tag form: name, optional color/background-color
  - Edit tag: update name, color
  - Delete tag button with confirmation (shows courses affected)
  - Search/filter tags
- Category icons: dropdown with icon library (or icon picker component)
- Impact preview before destructive actions: shows affected courses, allows reassignment
- Audit trail: all CRUD operations logged with admin_id

## Acceptance Criteria

- [ ] Categories display in tree view with hierarchy
- [ ] Create category form accepts name, optional parent, icon, display order
- [ ] Edit category modal updates name, parent, icon, display order
- [ ] Drag-and-drop reorder categories within list
- [ ] Drag category onto another category to set as child (hierarchy change)
- [ ] Course count displayed next to each category
- [ ] Delete category shows impact: number of courses, courses list, option to move to another category
- [ ] Merge category form shows source and target, course count, preview of action
- [ ] After merge, all courses in source category assigned to target, source deleted
- [ ] Icon selector dropdown shows available icons with preview
- [ ] Tags section shows list with tag name, color, course count
- [ ] Create tag form accepts name, optional color (color picker or preset colors)
- [ ] Edit tag modal updates name, color
- [ ] Delete tag shows affected courses, option to remove tag or bulk reassign to another
- [ ] All CRUD operations logged to audit_logs
- [ ] Toast notifications confirm successful actions
- [ ] Empty state messages when no categories/tags
- [ ] Mobile: list is scrollable, modals are readable

## Dependencies

- Database tables: categories, tags, course_tags, audit_logs
- Icon library or asset set for category icons
- Audit log system

## Technical Notes

- **Category Hierarchy**: Create categories table with columns: id, name, parent_id (nullable, FK to categories), icon_name, display_order, created_at
- **Tree View**: Recursive query or ORM relation to build hierarchy in backend, send nested JSON to frontend for tree rendering
- **Reorder**: Update display_order on multiple categories in transaction
- **Parent Change**: When dragging category to new parent, update parent_id, adjust display_order for siblings
- **Tags**: Separate tags table with columns: id, name, color_hex, created_at
- **Course-Tag**: Create course_tags junction table with columns: id, course_id, tag_id
- **Impact Query**: COUNT courses by category/tag for deletion/merge preview
- **Delete Category**: Option 1: cascade delete to course_tags; Option 2: move courses to target category (preferred)
- **Merge Category**: Update all course.category_id = target_category_id, then delete source category
- **Icons**: Store icon_name as string (e.g., 'book', 'video', 'rocket'); use icon library (react-icons, heroicons, etc.)
- **Color**: Store color as hex (e.g., '#FF5733') or use preset palette
- **Audit Log**: Log create, update, delete, merge, reorder with category/tag details and admin_id
- **Performance**: Index categories on (parent_id) for fast hierarchy queries
- **Display Order**: Use integer field, sort by display_order ASC, allow gaps for easy reordering
