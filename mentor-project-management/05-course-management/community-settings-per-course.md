# Task: Community Settings Per Course

## Description

Implement per-course community configuration system. Instructors can enable/disable community features for each course, set community guidelines, and configure allowed post types (text, image, video, audio). Community settings are stored as course metadata and can be edited on published courses. These settings govern which content types learners can post in the course community.

## Affected Apps/Packages

- Backend: `@mentor/api` (Hono on Vercel)
- Database: `@mentor/db` (Drizzle + Neon PostgreSQL)
- Frontend: `@mentor/web` (Next.js, React)
- Shared types: `@mentor/types`

## API Endpoints

### GET /api/v1/courses/{courseId}/community-settings

Get community settings for a course.

**Response (200 OK):**

```json
{
  "courseId": "uuid",
  "communityEnabled": boolean,
  "guidelines": string | null,
  "allowedPostTypes": [
    "text",
    "image",
    "video",
    "audio"
  ],
  "moderationLevel": "none" | "strict" | "moderate",
  "allowAnonymousPosts": boolean,
  "requireApprovalForNewMembers": boolean,
  "autoModerateWithAI": boolean,
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

### PUT /api/v1/courses/{courseId}/community-settings

Update community settings for a course.

**Request Body:**

```json
{
  "communityEnabled": boolean (optional),
  "guidelines": string (optional),
  "allowedPostTypes": string[] (optional, e.g., ["text", "image", "video"]),
  "moderationLevel": "none" | "strict" | "moderate" (optional),
  "allowAnonymousPosts": boolean (optional),
  "requireApprovalForNewMembers": boolean (optional),
  "autoModerateWithAI": boolean (optional)
}
```

**Response (200 OK):**

```json
{
  "courseId": "uuid",
  "communityEnabled": boolean,
  "guidelines": string | null,
  "allowedPostTypes": string[],
  "moderationLevel": string,
  "updatedAt": "ISO8601",
  "message": "Community settings updated successfully"
}
```

## UI Components

### Community Settings Card (Course Builder Step 5)

Location: Step 5 in Masterclass/Lesson builder wizard

**Section 1: Enable Community**

- Toggle: "Enable Community Features"
- Description: "Allow learners to interact with each other and discuss course content"
- When disabled: Show placeholder "Community disabled"

**Section 2: Community Guidelines** (visible if enabled)

- Textarea: Community Guidelines
- Max 2000 characters
- Placeholder: "Example: Be respectful, no spam, constructive feedback only"
- Character counter

**Section 3: Post Types** (visible if enabled)

- Checkboxes:
  - Text posts
  - Images
  - Videos
  - Audio
- At least 1 type required if community enabled
- Help text: "Learners can post these content types in the community"

**Section 4: Moderation** (visible if enabled)

- Radio buttons:
  - None (unmoderated)
  - Moderate (instructor reviews before publishing)
  - Strict (auto-moderate with AI, instructor review for flagged)
- Checkbox: "Auto-moderate with AI"
- Checkbox: "Allow anonymous posts"
- Checkbox: "Require approval for new members"

**Preview Card:**

- Shows how community will look with current settings
- Shows enabled features and allowed post types
- Shows guidelines snippet

### Community Settings Page (Published Course)

Location: Course settings (if editing published course)

**Same layout as above**

- All fields editable
- Save button
- Changes apply immediately
- "Last updated [date]" timestamp

### Validation and Feedback

- If community enabled, at least 1 post type required
- Save toast: "Community settings saved"
- Error toast: "Failed to save settings"
- Visual feedback: Checkboxes highlight when at least 1 selected

## Requirements

1. **Community Enable/Disable**
   - Toggle to enable community for each course
   - Default: disabled (safe for courses that don't need community)
   - When disabled: community section hidden from learners
   - Disabling community does NOT delete existing posts (archive them)

2. **Guidelines**
   - Text field for instructor to set community guidelines
   - Max 2000 characters
   - Optional (only required if community enabled)
   - Displayed to learners in community tab
   - Searchable/queryable for moderation

3. **Allowed Post Types**
   - Checkboxes for: text, image, video, audio
   - At least 1 required if community enabled
   - Learners cannot post types that are disabled
   - File type validation on server-side

4. **Moderation Level**
   - None: All posts auto-publish, no approval needed
   - Moderate: Instructor must approve posts before publishing
   - Strict: AI auto-moderates (flags inappropriate content), instructor reviews flagged posts
   - Default: Moderate (safest)

5. **Anonymous Posts**
   - Toggle: Allow learners to post anonymously
   - If disabled: All posts show author
   - If enabled: Learners can choose to post anonymously
   - Instructors can always see author (even anonymous posts)

6. **Member Approval**
   - Checkbox: Require approval for new community members
   - If enabled: Learners must request to join community
   - Instructor approves members
   - If disabled: Enrolled learners auto-added to community

7. **AI Moderation** (Optional)
   - Checkbox: Enable AI auto-moderation
   - Only applicable with "Strict" moderation level
   - AI flags spam, hate speech, inappropriate content
   - Flagged posts go to review queue

8. **Storage**
   - Store settings as JSONB in courses table: `community_settings`
   - Include: enabled, guidelines, allowed_types, moderation_level, etc.
   - Timestamp when settings last updated

9. **Validation**
   - Guidelines: max 2000 characters
   - At least 1 post type if community enabled
   - Moderation level: must be valid enum
   - All fields optional if community disabled

10. **Authorization**
    - Verify JWT token
    - Verify user is course owner
    - Return 403 if not authorized

## Acceptance Criteria

- [ ] GET /api/v1/courses/{courseId}/community-settings returns community settings
- [ ] PUT /api/v1/courses/{courseId}/community-settings updates settings
- [ ] Community toggle enables/disables features
- [ ] Guidelines textarea accepts up to 2000 characters
- [ ] Post type checkboxes enforce at least 1 if community enabled
- [ ] Moderation level selectable
- [ ] Anonymous post toggle functional
- [ ] Member approval toggle functional
- [ ] AI moderation toggle functional
- [ ] Settings stored in courses.community_settings JSONB
- [ ] Settings editable on published courses
- [ ] Changes apply immediately
- [ ] UI displays current settings accurately
- [ ] Validation prevents invalid settings
- [ ] 403 returned if user not course owner
- [ ] Community settings card displays in course builder
- [ ] Settings preview shows enabled features
- [ ] Guidelines visible to learners in community
- [ ] Server-side validation enforces allowed post types
- [ ] If community disabled, hidden from learner views

## Dependencies

- **Upstream**: Course Creation API (course-creation-api.md)
- **Upstream**: Publish Validation Flow (publish-validation-flow.md)
- **Related**: Community and Engagement (09-community-and-engagement)
- **Related**: Course Builder UI (course-builder-ui-masterclass.md)

## Technical Notes

### Database Schema

```sql
-- Extend courses table
ALTER TABLE courses ADD COLUMN community_settings JSONB;

-- Example structure stored in JSONB:
{
  "enabled": true,
  "guidelines": "Be respectful and constructive...",
  "allowedPostTypes": ["text", "image"],
  "moderationLevel": "moderate",
  "allowAnonymousPosts": false,
  "requireApprovalForNewMembers": false,
  "autoModerateWithAI": true,
  "createdAt": "2026-02-18T10:00:00Z",
  "updatedAt": "2026-02-18T10:00:00Z"
}

-- Index for filtering courses by community enabled
CREATE INDEX idx_community_enabled ON courses USING gin (community_settings);
```

### Backend Handlers

**Get Community Settings:**

```typescript
export const getCommunitySettings = defineEventHandler(async (event) => {
  const { courseId } = event.context.params;

  const course = await db.query.courses.findFirst({
    where: (courses, { eq }) => eq(courses.id, courseId),
  });

  if (!course) throw createError({ statusCode: 404 });

  // Return defaults if not set
  const settings = course.communitySettings || {
    enabled: false,
    guidelines: null,
    allowedPostTypes: [],
    moderationLevel: "moderate",
    allowAnonymousPosts: false,
    requireApprovalForNewMembers: false,
    autoModerateWithAI: false,
  };

  return {
    courseId,
    ...settings,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
});
```

**Update Community Settings:**

```typescript
export const updateCommunitySettings = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { courseId } = event.context.params;

  // Verify course ownership
  const course = await db.query.courses.findFirst({
    where: (courses, { eq, and }) =>
      and(eq(courses.id, courseId), eq(courses.instructorId, user.id)),
  });

  if (!course) throw createError({ statusCode: 403 });

  const body = await readBody(event);

  // Validate
  if (
    body.communityEnabled &&
    (!body.allowedPostTypes || body.allowedPostTypes.length === 0)
  ) {
    throw createError({
      statusCode: 400,
      message: "At least 1 post type required if community is enabled",
    });
  }

  if (body.guidelines && body.guidelines.length > 2000) {
    throw createError({
      statusCode: 400,
      message: "Guidelines exceed 2000 characters",
    });
  }

  const validModerationLevels = ["none", "moderate", "strict"];
  if (
    body.moderationLevel &&
    !validModerationLevels.includes(body.moderationLevel)
  ) {
    throw createError({
      statusCode: 400,
      message: "Invalid moderation level",
    });
  }

  // Prepare settings
  const settings = {
    enabled:
      body.communityEnabled ?? course.communitySettings?.enabled ?? false,
    guidelines: body.guidelines ?? null,
    allowedPostTypes: body.allowedPostTypes || [],
    moderationLevel: body.moderationLevel || "moderate",
    allowAnonymousPosts: body.allowAnonymousPosts ?? false,
    requireApprovalForNewMembers: body.requireApprovalForNewMembers ?? false,
    autoModerateWithAI: body.autoModerateWithAI ?? false,
    createdAt: course.communitySettings?.createdAt || new Date(),
    updatedAt: new Date(),
  };

  // Update course
  const updated = await db
    .update(courses)
    .set({
      communitySettings: settings,
      updatedAt: new Date(),
    })
    .where(eq(courses.id, courseId))
    .returning();

  return {
    courseId,
    ...settings,
    message: "Community settings updated successfully",
  };
});
```

### Frontend Component: Community Settings Form

```typescript
import { useState } from 'react';

export function CommunitySettingsForm({ courseId, currentSettings }: Props) {
  const [settings, setSettings] = useState({
    enabled: currentSettings?.enabled ?? false,
    guidelines: currentSettings?.guidelines ?? '',
    allowedPostTypes: currentSettings?.allowedPostTypes ?? [],
    moderationLevel: currentSettings?.moderationLevel ?? 'moderate',
    allowAnonymousPosts: currentSettings?.allowAnonymousPosts ?? false,
    requireApprovalForNewMembers: currentSettings?.requireApprovalForNewMembers ?? false,
    autoModerateWithAI: currentSettings?.autoModerateWithAI ?? false
  });

  const [isSaving, setIsSaving] = useState(false);

  const postTypeOptions = [
    { id: 'text', label: 'Text posts', description: 'Simple text-based discussions' },
    { id: 'image', label: 'Images', description: 'Photo and image uploads' },
    { id: 'video', label: 'Videos', description: 'Video uploads and links' },
    { id: 'audio', label: 'Audio', description: 'Audio uploads and voice notes' }
  ];

  const handlePostTypeChange = (typeId: string, checked: boolean) => {
    const types = checked
      ? [...settings.allowedPostTypes, typeId]
      : settings.allowedPostTypes.filter(t => t !== typeId);

    setSettings({ ...settings, allowedPostTypes: types });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/courses/${courseId}/community-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (!response.ok) throw new Error('Save failed');

      toast.success('Community settings saved');
    } catch (error) {
      toast.error('Failed to save: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="community-settings-form">
      <div className="form-section">
        <h3>Community Features</h3>
        <label className="toggle-control">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
            disabled={isSaving}
          />
          <span>Enable Community</span>
          <p className="help-text">Allow learners to discuss and interact</p>
        </label>
      </div>

      {settings.enabled && (
        <>
          {/* Guidelines Section */}
          <div className="form-section">
            <h3>Community Guidelines</h3>
            <textarea
              value={settings.guidelines}
              onChange={(e) => setSettings({ ...settings, guidelines: e.target.value })}
              placeholder="Set expectations for community behavior..."
              maxLength={2000}
              disabled={isSaving}
            />
            <p className="char-count">
              {settings.guidelines.length}/2000 characters
            </p>
          </div>

          {/* Post Types Section */}
          <div className="form-section">
            <h3>Allowed Post Types</h3>
            <p className="section-help">Select which content types learners can post</p>
            <div className="post-types">
              {postTypeOptions.map(option => (
                <label key={option.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={settings.allowedPostTypes.includes(option.id)}
                    onChange={(e) => handlePostTypeChange(option.id, e.target.checked)}
                    disabled={isSaving}
                  />
                  <div className="checkbox-content">
                    <span className="label">{option.label}</span>
                    <p className="description">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
            {settings.allowedPostTypes.length === 0 && (
              <p className="error">Select at least 1 post type</p>
            )}
          </div>

          {/* Moderation Section */}
          <div className="form-section">
            <h3>Content Moderation</h3>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  value="none"
                  checked={settings.moderationLevel === 'none'}
                  onChange={(e) => setSettings({ ...settings, moderationLevel: e.target.value })}
                  disabled={isSaving}
                />
                <span className="label">No moderation</span>
                <p className="help-text">All posts auto-publish</p>
              </label>
              <label>
                <input
                  type="radio"
                  value="moderate"
                  checked={settings.moderationLevel === 'moderate'}
                  onChange={(e) => setSettings({ ...settings, moderationLevel: e.target.value })}
                  disabled={isSaving}
                />
                <span className="label">Moderate</span>
                <p className="help-text">You review posts before publishing</p>
              </label>
              <label>
                <input
                  type="radio"
                  value="strict"
                  checked={settings.moderationLevel === 'strict'}
                  onChange={(e) => setSettings({ ...settings, moderationLevel: e.target.value })}
                  disabled={isSaving}
                />
                <span className="label">Strict</span>
                <p className="help-text">AI flags content, you review flagged posts</p>
              </label>
            </div>
          </div>

          {/* Advanced Options */}
          <div className="form-section">
            <h3>Advanced Options</h3>
            <label className="checkbox-control">
              <input
                type="checkbox"
                checked={settings.allowAnonymousPosts}
                onChange={(e) => setSettings({ ...settings, allowAnonymousPosts: e.target.checked })}
                disabled={isSaving}
              />
              <span>Allow anonymous posts</span>
              <p className="help-text">Learners can post without showing their name</p>
            </label>

            <label className="checkbox-control">
              <input
                type="checkbox"
                checked={settings.requireApprovalForNewMembers}
                onChange={(e) => setSettings({ ...settings, requireApprovalForNewMembers: e.target.checked })}
                disabled={isSaving}
              />
              <span>Require approval for new members</span>
              <p className="help-text">Learners must request to join community</p>
            </label>

            {settings.moderationLevel === 'strict' && (
              <label className="checkbox-control">
                <input
                  type="checkbox"
                  checked={settings.autoModerateWithAI}
                  onChange={(e) => setSettings({ ...settings, autoModerateWithAI: e.target.checked })}
                  disabled={isSaving}
                />
                <span>Auto-moderate with AI</span>
                <p className="help-text">AI automatically flags inappropriate content</p>
              </label>
            )}
          </div>

          {/* Preview */}
          <div className="form-section preview">
            <h3>Preview</h3>
            <div className="preview-box">
              <p><strong>Post Types:</strong> {settings.allowedPostTypes.join(', ') || 'None'}</p>
              <p><strong>Moderation:</strong> {settings.moderationLevel}</p>
              <p><strong>Guidelines:</strong> {settings.guidelines || 'None set'}</p>
            </div>
          </div>
        </>
      )}

      <div className="form-actions">
        <button onClick={handleSave} disabled={isSaving} className="primary">
          {isSaving ? 'Saving...' : 'Save Community Settings'}
        </button>
      </div>
    </div>
  );
}
```

### Testing Checklist

- Get community settings → returns current settings
- Update community settings → saved and reflected
- Enable community toggle → expands options
- Post type checkboxes → selection persisted
- Guidelines text → saved up to 2000 chars
- Moderation level selection → saved
- Validation prevents empty post types when community enabled
- Guidelines limit enforced (2000 chars)
- Settings editable on published courses
- 403 returned if not course owner
- Community settings displayed in course builder
- Settings persist across wizard steps
