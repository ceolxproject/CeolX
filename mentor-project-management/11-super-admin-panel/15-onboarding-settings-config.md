# Onboarding Settings Configuration

## Description

Admin interface to configure learner onboarding experience. Admins customize welcome screen content, skill level options, interest categories list, and role options. Changes apply to new users only; existing user settings remain unaffected.

## Affected Apps/Packages

- Frontend: `apps/web-admin` (Next.js), `apps/web` (learner onboarding flow)
- Backend: `apps/hono-api` (Hono)
- Shared: `packages/shared` (types)

## API Endpoints

- `GET /api/admin/onboarding/settings` — Get current onboarding configuration
- `PATCH /api/admin/onboarding/settings` — Update onboarding settings
- `GET /api/admin/onboarding/settings/preview` — Preview onboarding flow
- `POST /api/admin/onboarding/reset-defaults` — Reset to default settings
- `GET /api/admin/onboarding/analytics` — Onboarding completion analytics

## Requirements

- Onboarding settings page with sections:
  1. **Welcome Screen**:
     - Title text input (e.g., "Welcome to Mentor")
     - Subtitle/description text area (e.g., "Learn cosmetics from industry experts")
     - Hero image upload (background image or decorative image)
     - Call-to-action button text (e.g., "Get Started", "Next")
     - Optional: video URL for welcome video instead of image
  2. **Skill Level Configuration**:
     - Editable list of skill levels (add/remove/reorder)
     - Default options: Beginner, Intermediate, Advanced
     - Each with: label, description, emoji/icon
     - Ability to add custom levels (e.g., "Expert", "Professional")
  3. **Interest Categories**:
     - Editable list of interest categories (add/remove/reorder)
     - Default options: Makeup, Skincare, Fragrance, Nails, Hair, Beauty Business, etc.
     - Each with: label, icon/emoji
     - Enable/disable specific categories
     - Reorder for presentation on onboarding
  4. **Role Options** (for signup):
     - Editable list of roles (add/remove/reorder)
     - Default: Learner, Instructor
     - Each with: label, description
     - Control which roles visible during signup
- Preview button: shows how onboarding flow appears to new users
- Save changes button
- Reset to defaults button with confirmation
- Change history: show when settings were last modified and by whom
- Analytics: show onboarding completion rate, drop-off points, popular selections
- Validation: at least 1 skill level, 1 interest category, 1 role required

## Acceptance Criteria

- [ ] Onboarding settings page loads current configuration
- [ ] Welcome screen section shows title, subtitle, image/video, CTA text fields
- [ ] Image upload with preview for hero image
- [ ] Skill levels list with add/remove/reorder buttons
- [ ] Each skill level has: label, description, icon selector
- [ ] Interest categories list with add/remove/reorder buttons
- [ ] Each interest category has: label, icon/emoji selector
- [ ] Enable/disable toggle per interest category
- [ ] Role options list with add/remove/reorder buttons
- [ ] Each role has: label, description, visibility toggle
- [ ] Save button updates all settings in one transaction
- [ ] Reset to defaults button reverts to hardcoded defaults with confirmation
- [ ] Preview button shows live onboarding flow as new user would see it
- [ ] Change history shows: setting names, previous value, new value, changed by, changed date
- [ ] Analytics page shows: completion rate %, drop-off points, selected skill distribution, selected interests distribution
- [ ] Validation: prevent removal of all skill levels, categories, or roles
- [ ] Changes apply to new users; existing user settings unchanged
- [ ] Audit trail logs all setting changes with admin_id
- [ ] Mobile: form fields readable, preview is usable

## Dependencies

- Database tables: onboarding_settings, onboarding_config_items (for skill levels, interests, roles), onboarding_analytics
- File storage service for welcome image upload
- Audit log system

## Technical Notes

- **Settings Storage**: Create onboarding_settings table with columns: id, config_json (JSONB), updated_by, updated_at
  - config_json structure:
    ```json
    {
      "welcome": {
        "title": "Welcome to Mentor",
        "subtitle": "...",
        "image_url": "...",
        "video_url": null,
        "cta_text": "Get Started"
      },
      "skill_levels": [
        {
          "id": "beginner",
          "label": "Beginner",
          "description": "...",
          "icon": "emoji"
        },
        {
          "id": "intermediate",
          "label": "Intermediate",
          "description": "...",
          "icon": "emoji"
        }
      ],
      "interests": [
        { "id": "makeup", "label": "Makeup", "icon": "emoji", "enabled": true }
      ],
      "roles": [
        {
          "id": "learner",
          "label": "Learner",
          "description": "...",
          "visible": true
        }
      ]
    }
    ```
- **Config Items Table**: Alternatively, store skill_levels, interests, roles as separate config_items table with type field for organization
- **Defaults**: Hardcode defaults in backend; on /reset-defaults, set config_json to default structure
- **Preview**: Frontend endpoint returns full config; preview screen uses same data to show new user flow
- **Image Upload**: Upload to S3/GCS, store URL in config_json.welcome.image_url
- **Icon/Emoji**: Store as emoji character or icon name (e.g., "👨‍🎓" or "user-graduate")
- **User Onboarding**: When new user signs up, fetch onboarding_settings and use latest config
  - Store user's selections (skill_level, interests) in user_preferences table
- **Change History**: Log all updates to onboarding_settings to audit_logs with before/after config_json
- **Analytics Queries**:
  - Completion rate: COUNT(users with completed onboarding) / COUNT(new users in period)
  - Drop-off: where are users leaving the flow? (track with event logs)
  - Skill distribution: SELECT skill_level, COUNT(\*) FROM user_preferences GROUP BY skill_level
  - Interest distribution: SELECT interest_id, COUNT(\*) FROM user_preference_interests GROUP BY interest_id
- **Cascade Changes**: Existing user preferences are immutable; changes only affect new signups
- **Validation**: At least 1 item in each array (skill_levels, interests, roles) required
- **Audit Trail**: Log admin_id, changed_fields, old_values, new_values on every update
